#!/bin/sh
set -eu

# 飞牛 NAS 开机任务入口：延迟启动并持续监控 SGCC API。
BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
START="$BASE_DIR/start-api.sh"
DATA_DIR=${SGCC_DATA_DIR:-"$BASE_DIR/data"}
PID_FILE="$DATA_DIR/service.pid"
MANUAL_STOP_MARKER="$DATA_DIR/service.manual-stop"
LOG="$DATA_DIR/service.log"
PORT=${PORT:-8080}
LOCK_DIR="$DATA_DIR/sgcc-watchdog.lock"
DELAY=${SGCC_START_DELAY:-0}
INTERVAL=${SGCC_CHECK_INTERVAL:-3600}

mkdir -p "$DATA_DIR"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

log() {
  printf '%s [sgcc-watchdog] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
}

log "NAS 开机任务已启动，等待 ${DELAY}s"
is_service_running() {
  pid=$1
  [ -r "/proc/$pid/stat" ] || return 1
  state=$(cut -d ' ' -f 3 "/proc/$pid/stat" 2>/dev/null || true)
  [ "$state" != "Z" ] || return 1
  cmd=$(tr '\000' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
  case "$cmd" in
    *"$BASE_DIR/service.py"*) return 0 ;;
    *) return 1 ;;
  esac
}

sleep "$DELAY"
log "开机延迟结束，开始监控"

while :; do
  if [ -f "$MANUAL_STOP_MARKER" ]; then
    sleep "$INTERVAL"
    continue
  fi

  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    sleep "$INTERVAL"
    continue
  fi

  log "健康检查失败，执行自动启动"
  if "$START" >> "$LOG" 2>&1; then
    log "SGCC API 自动启动命令已执行"
  else
    log "SGCC API 自动启动失败，${INTERVAL}s 后重试"
  fi
  sleep "$INTERVAL"
done
