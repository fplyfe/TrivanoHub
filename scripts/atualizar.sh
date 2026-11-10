#!/usr/bin/env bash
# Baixa a versão mais nova do GitHub e recompila. O banco e os backups são preservados.
# Uso: bash scripts/atualizar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --build
docker image prune -f >/dev/null
docker compose -f docker-compose.yml -f docker-compose.vps.yml ps
