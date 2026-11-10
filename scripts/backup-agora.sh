#!/usr/bin/env bash
# Faz um backup imediato (além do automático das 03:00).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.yml -f docker-compose.vps.yml exec backup /backup.sh
ls -lh backups/last/
