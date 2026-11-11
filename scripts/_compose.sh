# Usado pelos outros scripts: define $DC com os arquivos certos do Docker Compose.
# Se o .env tiver COMPOSE_FILE (ex.: modo Traefik), o próprio Docker Compose usa ele.
# Senão, usa o padrão com Caddy (docker-compose.vps.yml).
if grep -q '^COMPOSE_FILE=' .env 2>/dev/null; then
  DC="docker compose"
else
  DC="docker compose -f docker-compose.yml -f docker-compose.vps.yml"
fi
