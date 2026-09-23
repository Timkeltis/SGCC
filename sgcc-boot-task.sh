#!/bin/sh
set -eu

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DATA_DIR="$BASE_DIR/data"
BOOT_LOG="$DATA_DIR/boot-task.log"

mkdir -p "$DATA_DIR"
printf '%s [sgcc-boot-task] invoked uid=%s gid=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$(id -u)" "$(id -g)" >> "$BOOT_LOG"

# 从 cron 开机任务中脱离，避免飞牛 cron 清理任务时连带终止 watchdog。
SGCC_START_DELAY=50 PYTHON_BIN="$BASE_DIR/.venv/bin/python" nohup "$BASE_DIR/sgcc-watchdog.sh" >> "$DATA_DIR/service.log" 2>&1 </dev/null &
watchdog_pid=$!
printf '%s [sgcc-boot-task] watchdog_pid=%s started\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$watchdog_pid" >> "$BOOT_LOG"
exit 0
