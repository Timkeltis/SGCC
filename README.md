# 网上国网小组件与 NAS API

在 iPhone/iPad 的 Scripting App 中展示网上国网用电量、电费、余额和日用电数据。项目包含 Scripting 小组件、飞牛 NAS API，以及可选的 Home Assistant 备用数据源。

## 架构

```text
Scripting 小组件 → 飞牛 NAS SGCC API → 网上国网
                       └─ 可选：Home Assistant 回退
```

NAS API 负责网上国网登录与数据请求；账号、密码、API Token 和登录状态仅保存在 NAS。小组件只需配置 API 地址和 Token。

## 部署 NAS API（飞牛 NAS / Python 3.12）

本服务直接运行于 NAS，不使用 Docker。详细接口及配置见 [`API.md`](API.md)。

1. 将仓库下载到 NAS，例如 `/vol1/1000/Disk1/docker/sgcc`。
2. 创建虚拟环境并安装依赖：

   ```bash
   cd /vol1/1000/Disk1/docker/sgcc
   python3.12 -m venv .venv
   .venv/bin/python -m pip install -r requirements-api.txt
   cp .env.example .env
   ```

3. 编辑 `.env`，填写 `SGCC_API_TOKEN`、`SGCC_USERNAME`、`SGCC_PASSWORD`；按需设置 `SGCC_HISTORY_MONTHS` 和 `PORT`。限制凭据文件权限：

   ```bash
   chmod 600 .env
   ```

4. 启动：`./start-api.sh`；手动停止：`./stop-api.sh`。

### 开机启动与恢复策略

飞牛 NAS 上由 Hermes 用户的 crontab 注册 `@reboot`，入口脚本默认等待 50 秒。watchdog 开机后只尝试启动一次；若开机启动失败，会写入 `data/service.log` 并退出，不进行高频轮询。服务启动后，watchdog 每 3600 秒检查一次健康状态；运行中意外停止时尝试恢复。手动执行 `stop-api.sh` 会创建停止标记，避免 watchdog 重启服务；再次执行 `start-api.sh` 可清除标记并启动。

仓库提供 `sgcc-boot-task.sh` 与 `sgcc-watchdog.sh` 示例。将入口脚本添加到 NAS 的开机任务，并按需配置 `SGCC_START_DELAY`、`SGCC_CHECK_INTERVAL`。每台 NAS 的实际部署路径、账户和开机任务由管理员配置。

验证：

```bash
curl -fsS http://127.0.0.1:8080/health
```

预期：`{"ok": true, "service": "sgcc-api"}`。不要删除 `data/state.json`，其中保存登录会话和设备状态。

## 配置小组件

1. 在 iPhone/iPad 打开[一键导入到 Scripting](https://timkeltis.github.io/SGCC/install.html)，或在 Scripting 中手动导入仓库脚本。
2. 运行 `index.tsx`，设置 NAS API Base URL 和与 NAS `.env` 中一致的 `SGCC_API_TOKEN`。
3. 点击“获取账户列表”，选择账户并保存，再将 `systemMedium` 小组件添加到桌面。
4. 可选填写 Home Assistant 地址和长期访问令牌，作为备用数据源。

外网访问建议使用 HTTPS 反向代理，仅代理 API 所需地址；不要暴露 NAS 管理端口。iOS 的 WidgetKit 刷新时间是系统建议，并非精确计时。

## 仓库结构

- `index.tsx`、`widget.tsx`、`lib/`：Scripting 设置页、小组件和数据处理。
- `service.py`、`sgcc_client/`：NAS API 与网上国网客户端。
- `start-api.sh`、`stop-api.sh`、`sgcc-boot-task.sh`、`sgcc-watchdog.sh`：服务生命周期脚本。
- `API.md`：API 部署、配置与接口说明。

## 安全

不要提交真实 `.env`、`data/`、虚拟环境、日志、Token、账号密码或 `state.json`。`.env.example` 仅含占位值。保护 NAS API 与 Home Assistant Token，并限制 API 的外网暴露范围。

## 来源与免责声明

本项目最初参考并移植 Scriptable 版网上国网脚本，原作者：脑瓜；反馈渠道：[Scriptable_CN](https://t.me/Scriptable_CN)，参考项目：[anker1209](https://github.com/anker1209)。本项目为非官方个人项目，数据以网上国网官方 App 为准。
