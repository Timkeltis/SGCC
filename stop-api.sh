#!/bin/sh
set -eu

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PID_FILE=${SGCC_DATA_DIR:-"$BASE_DIR/data"}/service.pid

if [ ! -f "$PID_FILE" ]; then
  echo "SGCC API is not running."
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "SGCC API stopped (PID $PID)."
else
  echo "Stale PID file removed."
fi
rm -f "$PID_FILE"
