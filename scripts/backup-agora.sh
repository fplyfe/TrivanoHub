#!/usr/bin/env bash
# Faz um backup imediato (além do automático das 03:00).
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/_compose.sh
$DC exec backup /backup.sh
ls -lh backups/last/
