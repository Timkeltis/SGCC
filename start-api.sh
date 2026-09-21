#!/bin/sh
set -eu

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PYTHON_BIN=${PYTHON_BIN:-python3}
DATA_DIR=${SGCC_DATA_DIR:-"$BASE_DIR/data"}

if [ ! -f "$BASE_DIR/.env" ]; then
  echo "Missing $BASE_DIR/.env; copy .env.example and fill in credentials."
  exit 1
fi

set -a
. "$BASE_DIR/.env"
set +a

mkdir -p "$DATA_DIR"
if [ -f "$DATA_DIR/service.pid" ] && kill -0 "$(cat "$DATA_DIR/service.pid")" 2>/dev/null; then
  echo "SGCC API is already running (PID $(cat "$DATA_DIR/service.pid"))."
  exit 0
fi

export PYTHONPATH="$BASE_DIR${PYTHONPATH:+:$PYTHONPATH}"
nohup "$PYTHON_BIN" "$BASE_DIR/service.py" >> "$DATA_DIR/service.log" 2>&1 &
echo $! > "$DATA_DIR/service.pid"
echo "SGCC API started on port ${PORT:-8080} (PID $!)."
