#!/usr/bin/env bash
# Restaura o banco a partir de um backup (.sql.gz). ATENÇÃO: substitui os dados atuais.
# Uso: bash scripts/restaurar.sh [arquivo]   (sem arquivo, usa o backup mais recente)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
FILE="${1:-backups/last/${POSTGRES_DB}-latest.sql.gz}"
[ -f "$FILE" ] || { echo "Backup não encontrado: $FILE"; exit 1; }
read -rp "Restaurar $FILE por cima dos dados atuais? Digite SIM: " OK
[ "$OK" = "SIM" ] || { echo "Cancelado."; exit 0; }
C="docker compose -f docker-compose.yml -f docker-compose.vps.yml"
$C stop app
gunzip -c "$FILE" | $C exec -T db psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"
$C start app
echo "Restaurado a partir de $FILE"
