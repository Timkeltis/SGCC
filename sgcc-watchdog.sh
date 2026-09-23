#!/bin/sh
set -eu

# 开机只尝试启动一次；运行中异常停止后按 INTERVAL 尝试恢复。
BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
START="$BASE_DIR/start-api.sh"
DATA_DIR=${SGCC_DATA_DIR:-"$BASE_DIR/data"}
MANUAL_STOP_MARKER="$DATA_DIR/service.manual-stop"
LOG="$DATA_DIR/service.log"
PORT=${PORT:-8080}
LOCK_DIR="$DATA_DIR/sgcc-watchdog.lock"
DELAY=${SGCC_START_DELAY:-0}
INTERVAL=${SGCC_CHECK_INTERVAL:-3600}
STARTUP_WAIT=${SGCC_STARTUP_WAIT:-15}

mkdir -p "$DATA_DIR"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

log() {
  printf '%s [sgcc-watchdog] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
}
healthy() {
  curl -fsS --max-time 3 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1
}
start_once() {
  if [ -f "$MANUAL_STOP_MARKER" ]; then
    log "手动停止标记存在，不启动服务"
    return 1
  fi
  if ! "$START" >> "$LOG" 2>&1; then
    return 1
  fi
  elapsed=0
  while [ "$elapsed" -lt "$STARTUP_WAIT" ]; do
    if healthy; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  return 1
}

log "NAS 开机任务已启动，等待 ${DELAY}s"
sleep "$DELAY"
log "开机延迟结束，执行一次启动检查"
if ! healthy; then
  if start_once; then
    log "开机启动成功，开始运行期监控"
  else
    log "开机启动失败；本次不重复轮询，需检查日志或手动启动"
    exit 1
  fi
else
  log "服务已健康，开始运行期监控"
fi

while :; do
  sleep "$INTERVAL"
  if [ -f "$MANUAL_STOP_MARKER" ]; then
    continue
  fi
  if healthy; then
    continue
  fi
  log "运行期检测到服务异常停止，尝试恢复"
  if start_once; then
    log "运行期自动恢复成功"
  else
    log "运行期恢复失败，将在 ${INTERVAL}s 后再次检查"
  fi
done
