#!/bin/sh
set -eu

BASE_DIR=/vol1/1000/Disk1/docker/sgcc
DATA_DIR="$BASE_DIR/data"
BOOT_LOG="$DATA_DIR/boot-task.log"

mkdir -p "$DATA_DIR"
printf '%s [sgcc-boot-task] invoked uid=%s gid=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$(id -u)" "$(id -g)" >> "$BOOT_LOG"

# Detach from cron so fnOS cron cleanup cannot terminate the watchdog.
nohup "$BASE_DIR/sgcc-watchdog.sh" >> "$DATA_DIR/service.log" 2>&1 </dev/null &
watchdog_pid=$!
printf '%s [sgcc-boot-task] watchdog_pid=%s started\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$watchdog_pid" >> "$BOOT_LOG"
exit 0
