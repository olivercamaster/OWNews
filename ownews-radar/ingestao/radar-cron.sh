#!/usr/bin/env bash
# Ingestão do Radar Offshore no VPS (crontab). Lê o segredo de ~/.config/ownews/radar-ingest-secret
# sem imprimir. Uso: radar-cron.sh [--so-noticias]. Um por vez (flock).
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>/tmp/ownews-radar-ingestao.lock
flock -n 9 || exit 0
export RADAR_WORKER_URL="https://ownews-radar.olivercamaster.workers.dev"
RADAR_INGEST_SECRET="$(cat /home/offshore/.config/ownews/radar-ingest-secret)"
export RADAR_INGEST_SECRET
exec /usr/bin/env node ingestao/run.mjs "$@" >> /home/offshore/ownews-radar-state/cron.log 2>&1
