# NAS SGCC API

飞牛 NAS 上的 Python 3.12 API 服务，调用网上国网数据并向 Scripting 小组件提供接口。生产运行不使用 Docker。

## 安装

```bash
cd /vol1/1000/Disk1/docker/sgcc
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-api.txt
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，填写 NAS API Token 和网上国网账号密码。不要把真实 `.env`、`data/`、`.venv/` 或登录状态提交到 GitHub。

启动与停止：

```bash
./start-api.sh
./stop-api.sh
```

日志位于 `data/service.log`。不要删除 `data/state.json`，其中保存登录会话和设备状态。

## 开机启动与自动恢复

将 `sgcc-boot-task.sh` 配置为 NAS 开机任务入口。默认等待 50 秒，使用项目 `.venv` 的 Python 3.12。

- 开机阶段：延迟后检查健康状态；未运行时只尝试启动一次。启动失败会记录日志并退出，不进行高频轮询。
- 运行阶段：启动成功后，watchdog 默认每 3600 秒检查一次；发现运行中意外停止则尝试恢复，失败后按相同间隔重试。
- 手动停止：`stop-api.sh` 创建 `data/service.manual-stop` 标记，watchdog 不会重启服务；再次运行 `start-api.sh` 会清除标记。

可在开机脚本中调整 `SGCC_START_DELAY` 与 `SGCC_CHECK_INTERVAL`。开机执行记录写入 `data/boot-task.log`，服务及 watchdog 日志写入 `data/service.log`。遇到锁目录时先检查 watchdog 进程和日志，不要直接删除锁目录。

## API

### 健康检查

```http
GET /health
```

本机检查：

```bash
curl -fsS http://127.0.0.1:8080/health
```

返回：`{"ok": true, "service": "sgcc-api"}`。

### 获取用电数据

```http
POST /v1/electricity/bill/all
Authorization: Bearer <SGCC_API_TOKEN>
Content-Type: application/json
```

请求体可为空或 `{}`。例如：

```bash
curl -X POST http://127.0.0.1:8080/v1/electricity/bill/all \
  -H 'Authorization: Bearer <SGCC_API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

接口实时请求网上国网，返回账户、日用电、账单、年度用电/电费及余额等数据。多请求由服务串行处理，以避免并发登录冲突。

## 外网访问

如需外网访问，建议用 HTTPS 反向代理指向 `http://NAS局域网IP:8080`，只开放 API 所需域名/路径，不要暴露 NAS 管理端口。小组件只配置 API Base URL 和 API Token，不填写网上国网账号密码。

## 安全与数据

- `.env` 保存 API Token 和网上国网凭据，权限建议为 `600`。
- `data/state.json` 保存登录会话与设备信息；备份时按敏感凭据对待。
- `.env`、`data/`、`.venv/`、日志及备份文件不应进入版本库。
- 本项目为非官方实现，数据请以网上国网官方 App 为准。
