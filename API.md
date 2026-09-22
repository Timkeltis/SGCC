# NAS SGCC API 部署说明（飞牛 Python 3.12）

本服务直接在飞牛 NAS 的 Python 3.12 虚拟环境中运行，调用网上国网 App 数据协议，并向 Scripting 提供 API。

> 本项目当前生产部署不使用 Docker。账号、密码、API Token、登录会话和设备状态只保存在 NAS。

## 1. 目录与文件

推荐目录：

```text
/vol1/1000/Disk1/docker/sgcc
```

主要文件：

```text
service.py
sgcc_client/
requirements-api.txt
.env.example
start-api.sh
stop-api.sh
sgcc-watchdog.sh
```

运行数据：

```text
data/service.log
data/service.pid
data/service.manual-stop
data/state.json
```

`.env`、`data/` 和 `.venv/` 不得提交到 GitHub。

## 2. 安装 Python 3.12 环境

在飞牛 NAS 终端执行：

```bash
cd /vol1/1000/Disk1/docker/sgcc
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements-api.txt
chmod +x start-api.sh stop-api.sh sgcc-watchdog.sh
```

如果 NAS 的应用商店 Python 3.12 命令名是 `python3`，先确认：

```bash
python3 --version
```

必须显示 Python 3.12，再执行：

```bash
python3 -m venv .venv
```

当前依赖：

```text
aiohttp>=3.10,<4
gmssl>=3.2,<4
cryptography>=42,<51
```

## 3. 配置 `.env`

```bash
cp .env.example .env
```

填写：

```env
SGCC_API_TOKEN=replace-with-a-long-random-token
SGCC_USERNAME=95598-login-phone
SGCC_PASSWORD=95598-login-password
SGCC_HISTORY_MONTHS=2
PORT=8080
```

说明：

| 变量 | 说明 |
|---|---|
| `SGCC_API_TOKEN` | Scripting 调用 NAS API 的 Bearer Token |
| `SGCC_USERNAME` | 网上国网登录手机号，只保存在 NAS |
| `SGCC_PASSWORD` | 网上国网登录密码，只保存在 NAS |
| `SGCC_HISTORY_MONTHS` | 查询最近几个月数据，默认 2，范围 1–3 |
| `PORT` | API 监听端口，默认 8080 |

不要将真实 `.env`、账号、密码、Token 或 `data/state.json` 提交到 GitHub。

## 4. 手动启动与停止

启动：

```bash
cd /vol1/1000/Disk1/docker/sgcc
./start-api.sh
```

启动脚本会强制使用 Python 3.12 和当前 `.venv` 的依赖。如果健康检查已经正常，会直接退出，不会重复占用端口。

停止：

```bash
./stop-api.sh
```

`stop-api.sh` 会写入：

```text
data/service.manual-stop
```

监督器看到此标记后不会自动拉起服务。

恢复自动运行：

```bash
./start-api.sh
```

显式执行 `start-api.sh` 会清除手动停止标记。

查看日志：

```bash
tail -f data/service.log
```

不要删除：

```text
data/state.json
```

其中保存设备状态和网上国网登录会话，删除后可能触发重新登录或设备验证。

## 5. 飞牛 NAS 开机任务与自动重启

在飞牛 NAS 的“开机任务”中只配置一次以下命令：

```bash
nohup /vol1/1000/Disk1/docker/sgcc/sgcc-watchdog.sh >/dev/null 2>&1 &
```

`sgcc-watchdog.sh` 的行为：

```text
NAS 开机任务启动
→ 等待 50 秒
→ 检查 /health
→ 服务未运行时执行 start-api.sh
→ 每 10 秒检查一次
→ 服务异常退出后自动启动
→ 手动 stop-api.sh 后保持停止
```

监督器使用锁目录避免重复启动：

```text
data/sgcc-watchdog.lock
```

如果曾经重复执行过开机命令，可清理旧监督器后重新启动一次：

```bash
ps -eo pid,args | awk '$0 ~ /[s]gcc-watchdog.sh/ {print $1}' | xargs -r kill
rm -rf /vol1/1000/Disk1/docker/sgcc/data/sgcc-watchdog.lock
nohup /vol1/1000/Disk1/docker/sgcc/sgcc-watchdog.sh >/dev/null 2>&1 &
```

## 6. API 接口

### 健康检查

```http
GET /health
```

当前 NAS 本机地址：

```text
http://127.0.0.1:8080/health
```

正常返回：

```json
{"ok": true, "service": "sgcc-api"}
```

不需要 Token。

### 获取全部用电数据

```http
POST /v1/electricity/bill/all
Authorization: Bearer <SGCC_API_TOKEN>
Content-Type: application/json
```

请求体可以为空，或发送 `{}`。

示例：

```bash
curl -X POST http://127.0.0.1:8080/v1/electricity/bill/all \
  -H 'Authorization: Bearer <SGCC_API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

外网 Base URL 由反向代理提供，例如：

```text
https://pjqj69wa.kooldns.cn
```

完整地址：

```text
https://pjqj69wa.kooldns.cn/v1/electricity/bill/all
```

不要在 Scripting 中保存网上国网账号密码，只保存 NAS API Base URL 和 API Token。

### 登录/同步

```http
POST /v1/auth/login
Authorization: Bearer <SGCC_API_TOKEN>
```

此接口用于触发一次登录和数据同步。通常 Scripting 直接使用 `/v1/electricity/bill/all` 即可。

## 7. 返回字段

成功响应包含：

```text
ok
source
refresh_time
accounts
data
```

账户数据包含：

```text
account
daily
latest
current_month_total
current_year_usage
current_year_charge
monthly_bills
balance
meter
```

## 8. 错误码

| 状态码 | 含义 |
|---:|---|
| 401 | API Token 错误，或网上国网认证失败 |
| 409 | 网上国网要求设备验证 |
| 502 | 网上国网上游接口异常 |
| 503 | 访问网上国网网络失败 |
| 500 | NAS API 内部错误 |

## 9. 验证清单

```bash
cd /vol1/1000/Disk1/docker/sgcc
.venv/bin/python --version
.venv/bin/python -c 'import aiohttp, gmssl, cryptography; print("imports OK")'
curl http://127.0.0.1:8080/health
```

预期：

```text
Python 3.12.x
imports OK
{"ok": true, "service": "sgcc-api"}
```

本服务是基于网上国网 App 协议的非官方实现。网上国网修改登录、加密或接口协议时，可能需要更新代码。
