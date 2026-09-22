#!/bin/sh
set -eu

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -z "${PYTHON_BIN:-}" ]; then
  if [ -x "$BASE_DIR/.venv/bin/python" ]; then
    PYTHON_BIN="$BASE_DIR/.venv/bin/python"
  elif command -v python3.12 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.12)"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    echo "Python 3.12 is required but was not found." >&2
    exit 1
  fi
fi
PYTHON_VERSION="$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
if [ "$PYTHON_VERSION" != "3.12" ]; then
  echo "Python 3.12 is required; selected $PYTHON_VERSION ($PYTHON_BIN)." >&2
  exit 1
fi
VENV_SITE="$BASE_DIR/.venv/lib/python3.12/site-packages"
DATA_DIR=${SGCC_DATA_DIR:-"$BASE_DIR/data"}
MANUAL_STOP_MARKER="$DATA_DIR/service.manual-stop"

if [ ! -f "$BASE_DIR/.env" ]; then
  echo "Missing $BASE_DIR/.env; copy .env.example and fill in credentials."
  exit 1
fi

set -a
. "$BASE_DIR/.env"
set +a

mkdir -p "$DATA_DIR"
rm -f "$MANUAL_STOP_MARKER"
if curl -fsS --max-time 3 "http://127.0.0.1:${PORT:-8080}/health" >/dev/null 2>&1; then
  echo "SGCC API is already healthy on port ${PORT:-8080}."
  exit 0
fi
export PYTHONPATH="$VENV_SITE:$BASE_DIR${PYTHONPATH:+:$PYTHONPATH}"
nohup "$PYTHON_BIN" "$BASE_DIR/service.py" >> "$DATA_DIR/service.log" 2>&1 &
echo $! > "$DATA_DIR/service.pid"
echo "SGCC API started on port ${PORT:-8080} (PID $!)."
