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

echo "==> Firewall: só SSH (22), HTTP (80) e HTTPS (443)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

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
  cat > LOGINS.txt <<TXT
TrivanoHub - administrador inicial (troque a senha no primeiro acesso e apague este arquivo)
$U1E / $P1
Crie os outros usuários em Usuários, dentro do app.
TXT
  echo ".env criado. Acesso do administrador em LOGINS.txt"
fi

mkdir -p backups && chown 1000:1000 backups 2>/dev/null || true

echo "==> Subindo (o primeiro build leva alguns minutos)"
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.vps.yml ps

DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2)
echo
echo "Pronto: https://$DOMAIN"
echo "O certificado HTTPS sai em até 1 minuto, desde que o DNS do domínio já aponte para este servidor."
[ -f LOGINS.txt ] && cat LOGINS.txt
