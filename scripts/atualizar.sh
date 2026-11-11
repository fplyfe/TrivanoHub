#!/usr/bin/env bash
# Baixa a versão mais nova do GitHub e recompila. O banco e os backups são preservados.
# Uso: bash scripts/atualizar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/_compose.sh
git pull --ff-only
$DC up -d --build
docker image prune -f >/dev/null
$DC ps
