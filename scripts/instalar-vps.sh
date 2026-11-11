#!/usr/bin/env bash
# Prepara uma VPS Ubuntu 22.04/24.04 do zero e sobe o TrivanoHub com HTTPS.
# Uso (dentro da pasta do projeto, como root ou com sudo):  sudo bash scripts/instalar-vps.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo: sudo bash scripts/instalar-vps.sh"; exit 1; }

echo "==> Atualizando o sistema e instalando o básico"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw unattended-upgrades openssl
dpkg-reconfigure -f noninteractive unattended-upgrades
timedatectl set-timezone America/Sao_Paulo || true

if ! command -v docker >/dev/null; then
  echo "==> Instalando o Docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# Swap de 2 GB se a máquina tiver menos de 3 GB de RAM (o build do Next.js precisa de memória)
if [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 3000 ] && ! swapon --show | grep -q swapfile; then
  echo "==> Criando swap de 2 GB"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Traefik já rodando nesta VPS? Então ele recebe o tráfego (sem Caddy) e o firewall não é mexido.
MODO=caddy
if grep -q '^COMPOSE_FILE=.*traefik' .env 2>/dev/null; then
  MODO=traefik
elif [ ! -f .env ]; then
  TRAEFIK_ID=$(docker ps --format '{{.ID}} {{.Image}}' | awk '$2 ~ /traefik/ {print $1; exit}')
  if [ -n "$TRAEFIK_ID" ]; then
    echo "==> Traefik encontrado rodando nesta VPS"
    read -rp "Usar o Traefik existente para publicar o TrivanoHub? (S/n): " R
    [ "${R,,}" = "n" ] || MODO=traefik
  fi
fi

if [ "$MODO" = traefik ] && [ ! -f .env ]; then
  # Sugestões lidas da configuração do próprio Traefik
  NETS=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$TRAEFIK_ID")
  CFG=$(docker inspect -f '{{join .Args " "}} {{join .Config.Cmd " "}} {{range $k, $v := .Config.Labels}}{{$k}} {{end}}' "$TRAEFIK_ID" 2>/dev/null || true)
  EP=$(grep -oE 'entrypoints\.[A-Za-z0-9_-]+\.address=:443' <<<"$CFG" | head -1 | cut -d. -f2 || true)
  CR=$(grep -oE 'certificatesresolvers\.[A-Za-z0-9_-]+' <<<"$CFG" | head -1 | cut -d. -f2 || true)
  NET_SUG=$(tr ' ' '\n' <<<"$NETS" | grep -v '^$' | grep -vx bridge | head -1 || true)
  echo "Redes do Traefik: $NETS"
  read -rp "Rede Docker do Traefik [${NET_SUG:-traefik}]: " T_NET; T_NET=${T_NET:-${NET_SUG:-traefik}}
  read -rp "Entrypoint HTTPS [${EP:-websecure}]: " T_EP; T_EP=${T_EP:-${EP:-websecure}}
  read -rp "Certresolver [${CR:-letsencrypt}]: " T_CR; T_CR=${T_CR:-${CR:-letsencrypt}}
  docker network inspect "$T_NET" >/dev/null 2>&1 || { echo "Rede '$T_NET' não existe. Veja com: docker network ls"; exit 1; }
fi

if [ "$MODO" = caddy ]; then
  echo "==> Firewall: só SSH (22), HTTP (80) e HTTPS (443)"
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
  ufw --force enable
else
  echo "==> Modo Traefik: firewall e portas 80/443 ficam como já estão"
fi

if [ ! -f .env ]; then
  echo "==> Configuração inicial"
  read -rp "Domínio do app (ex.: hub.trivano.com.br): " DOMAIN
  read -rp "Nome do administrador: " U1N
  read -rp "E-mail do administrador: " U1E
  rnd() { openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  P1=$(rnd 16)
  umask 077
  cat > .env <<ENV
DOMAIN=$DOMAIN
POSTGRES_USER=gestorshop
POSTGRES_PASSWORD=$(rnd 32)
POSTGRES_DB=gestorshop
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
USER1_NAME=$U1N
USER1_EMAIL=$U1E
USER1_PASSWORD=$P1
ENV
  if [ "$MODO" = traefik ]; then
    cat >> .env <<ENV
COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml
TRAEFIK_NETWORK=$T_NET
TRAEFIK_ENTRYPOINT=$T_EP
TRAEFIK_CERTRESOLVER=$T_CR
ENV
  fi
  cat > LOGINS.txt <<TXT
TrivanoHub - administrador inicial (troque a senha no primeiro acesso e apague este arquivo)
$U1E / $P1
Crie os outros usuários em Usuários, dentro do app.
TXT
  echo ".env criado. Acesso do administrador em LOGINS.txt"
fi

mkdir -p backups && chown 1000:1000 backups 2>/dev/null || true

echo "==> Subindo (o primeiro build leva alguns minutos)"
. scripts/_compose.sh
$DC up -d --build
$DC ps

DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2)
echo
echo "Pronto: https://$DOMAIN"
echo "O certificado HTTPS sai em até 1 minuto, desde que o DNS do domínio já aponte para este servidor."
[ "$MODO" = traefik ] && echo "Publicado pelo Traefik (router: trivanohub). Se não abrir: docker logs <container do traefik> --tail 50"
[ -f LOGINS.txt ] && cat LOGINS.txt
