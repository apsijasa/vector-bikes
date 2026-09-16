#!/bin/sh
# Arranca el servidor construido (dist/server/entry.mjs) y prueba HTTP. Uso: sh scripts/smoke.sh
set -eu
PORT="${SMOKE_PORT:-4399}"
BASE="http://127.0.0.1:$PORT"
HOST=127.0.0.1 PORT="$PORT" node --env-file-if-exists=.env dist/server/entry.mjs >.smoke.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
i=0
until curl -s -o /dev/null "$BASE/api/health"; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    cat .smoke.log
    exit 1
  fi
  sleep 1
done
HEALTH="$(curl -s "$BASE/api/health")"
echo "$HEALTH" | grep -q '"ok":true'
echo "smoke ok: $HEALTH"
