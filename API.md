# NAS SGCC API 部署与接口说明

此服务把网上国网 App 数据层部署在 NAS 上。账号、密码、登录会话和设备状态只保存在 NAS；Scripting 只通过 API Token 调用接口。

---

## 1. 当前推荐部署方式

当前推荐生产方式为：

```text
飞牛 NAS + Python 3.12 虚拟环境 + 开机任务
```

当前示例目录：

```text
项目目录：/vol1/1000/Disk1/docker/sgcc
Python 虚拟环境：/vol1/1000/Disk1/docker/sgcc/.venv
服务文件：/vol1/1000/Disk1/docker/sgcc/service.py
数据目录：/vol1/1000/Disk1/docker/sgcc/data
配置文件：/vol1/1000/Disk1/docker/sgcc/.env
```

真实 `.env`、`data/state.json`、日志文件不要提交到 GitHub。

---

## 2. 文件准备

NAS 目录至少需要：

```text
service.py
sgcc_client/
requirements-api.txt
.env.example
start-api.sh
stop-api.sh
```

可选 Docker 文件：

```text
Dockerfile.api
docker-compose.api.yml
```

---

## 3. Python 虚拟环境安装

在飞牛 NAS 终端执行：

```bash
cd /vol1/1000/Disk1/docker/sgcc
python3 -m venv .venv
.venv/bin/pip install -r requirements-api.txt
```

依赖文件：

```text
requirements-api.txt
```

当前依赖：

```text
aiohttp>=3.10,<4
gmssl>=3.2,<4
```

---

## 4. 配置 `.env`

创建配置文件：

```bash
cp .env.example .env
```

示例：

```env
SGCC_API_TOKEN=replace-with-a-long-random-token
SGCC_USERNAME=95598-login-phone
SGCC_PASSWORD=95598-login-password
SGCC_HISTORY_MONTHS=2
PORT=8080
```

变量说明：

| 变量 | 必填 | 说明 |
|---|---:|---|
| `SGCC_API_TOKEN` | 是 | Scripting 调用 NAS API 的 Bearer Token，建议使用长随机字符串 |
| `SGCC_USERNAME` | 是 | 网上国网登录手机号 |
| `SGCC_PASSWORD` | 是 | 网上国网登录密码 |
| `SGCC_HISTORY_MONTHS` | 否 | 查询最近几个月日用电，默认 2，建议 1–3 |
| `PORT` | 否 | 服务监听端口，当前推荐 8080 |

安全要求：

- `.env` 只保存在 NAS；
- 不要把 `.env` 上传到 GitHub；
- 不要把 `SGCC_USERNAME` / `SGCC_PASSWORD` 填进 Scripting；
- 不要把 `SGCC_API_TOKEN` 写进 README 或截图；
- 不要删除 `data/state.json`，否则可能触发网上国网重新登录或设备验证。

---

## 5. 启动与停止

赋权：

```bash
chmod +x start-api.sh stop-api.sh
```

启动：

```bash
cd /vol1/1000/Disk1/docker/sgcc
PYTHON_BIN="$PWD/.venv/bin/python" ./start-api.sh
```

停止：

```bash
./stop-api.sh
```

查看日志：

```bash
tail -f data/service.log
```

服务监听：

```text
0.0.0.0:8080
```

---

## 6. 飞牛开机任务

建议在飞牛 NAS 开机任务中配置：

```bash
sleep 50
cd /vol1/1000/Disk1/docker/sgcc
PYTHON_BIN="$PWD/.venv/bin/python" ./start-api.sh
```

推荐逻辑：

```text
飞牛 NAS 开机
→ 等待 50 秒
→ 启动 SGCC API
→ 服务异常退出后自动重启
→ 手动 stop-api.sh 停止时不自动拉起
```

如果你自己改 `start-api.sh`，建议保留：

- pid 文件；
- 日志输出到 `data/service.log`；
- 异常退出自动拉起；
- 手动停止标记。

---

## 7. 内网验证

健康检查：

```bash
curl http://127.0.0.1:8080/health
```

正常返回：

```json
{
  "ok": true,
  "service": "sgcc-api"
}
```

查询用电数据：

```bash
curl -X POST http://127.0.0.1:8080/v1/electricity/bill/all \
  -H 'Authorization: Bearer 你的SGCC_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

正常返回结构：

```json
{
  "ok": true,
  "source": "csc-service.sgcc.com.cn",
  "refresh_time": "2026-09-21T20:00:00+08:00",
  "accounts": [
    {
      "account": {
        "id": "...",
        "name": "...",
        "cons_no": "...",
        "masked_number": "...",
        "province": "...",
        "address": "..."
      },
      "daily": [],
      "latest": {},
      "current_month_total": 0,
      "current_year_usage": 0,
      "current_year_charge": 0,
      "monthly_bills": [],
      "balance": {
        "balance": 0,
        "amount_due": 0,
        "history_owe": 0,
        "date": "..."
      },
      "meter": {}
    }
  ],
  "data": {}
}
```

Scripting 主要使用：

```text
accounts[].account
accounts[].daily
accounts[].latest
accounts[].current_month_total
accounts[].current_year_usage
accounts[].current_year_charge
accounts[].monthly_bills
accounts[].balance
accounts[].meter
```

---

## 8. 外网访问 / 反向代理

当前示例 Base URL：

```text
https://pjqj69wa.kooldns.cn
```

当前反向代理使用根路径，没有 `/sgcc` 子路径。

完整接口：

```text
GET  https://pjqj69wa.kooldns.cn/health
POST https://pjqj69wa.kooldns.cn/v1/electricity/bill/all
```

反向代理目标：

```text
http://NAS局域网IP:8080
```

注意：

- 当前不是 Docker 的 `18080:8080` 映射；
- 当前生产端口是 `8080`；
- Scripting 中填写 Base URL，不填写完整接口路径；
- HTTPS 证书必须正常；
- 不要暴露飞牛管理端口；
- 不要把网上国网账号密码放入 Scripting。

---

## 9. Scripting 侧配置

Scripting 设置页填写：

```text
数据源：NAS 优先，失败回退 HA
NAS API Base URL：https://pjqj69wa.kooldns.cn
NAS API Token：SGCC_API_TOKEN
```

代码会自动请求：

```text
POST /v1/electricity/bill/all
```

不要在 Scripting 里填写：

```text
SGCC_USERNAME
SGCC_PASSWORD
```

---

## 10. 接口定义

### `GET /health`

健康检查。

认证：不需要 Token。

响应：

```json
{
  "ok": true,
  "service": "sgcc-api"
}
```

### `POST /v1/electricity/bill/all`

获取全部账户用电数据。

认证：需要 Token。

```http
Authorization: Bearer <SGCC_API_TOKEN>
Content-Type: application/json
```

请求体可以为空，也可以是：

```json
{}
```

响应包含：

```text
accounts
data
refresh_time
source
```

### `POST /v1/auth/login`

手动触发一次登录和数据同步。

认证：需要同样的 Token。

首次登录遇到新设备验证时可能返回 `409`，需要在 NAS 端处理设备验证。

---

## 11. HTTP 状态码

| 状态码 | 含义 | 处理建议 |
|---:|---|---|
| 200 | 成功 | 正常 |
| 401 | API Token 错误，或网上国网认证失败 | 检查 Token、账号密码、登录态 |
| 409 | 网上国网要求设备验证 | 在 NAS 端处理设备验证 |
| 502 | 网上国网上游接口异常 | 稍后重试，查看日志 |
| 503 | NAS 到网上国网网络异常 | 检查网络，稍后重试 |
| 500 | NAS API 内部错误 | 查看 `data/service.log` |

---

## 12. Docker 部署（可选）

当前生产不使用 Docker，但仓库保留可选 Docker 文件。

```bash
cp .env.example .env
# 编辑 .env 后执行
docker compose -f docker-compose.api.yml up -d --build
```

`docker-compose.api.yml` 默认示例可能使用：

```text
18080:8080
```

如果使用 Docker，则访问：

```text
http://NAS局域网IP:18080/health
```

如果使用当前推荐 Python 虚拟环境，则访问：

```text
http://NAS局域网IP:8080/health
```

不要混用两个端口。

---

## 13. 常见问题

### 1. `/health` 正常，但数据接口 401

检查：

- `Authorization: Bearer <SGCC_API_TOKEN>` 是否正确；
- `.env` 中 `SGCC_API_TOKEN` 是否和 Scripting 一致；
- 网上国网账号密码是否正确；
- NAS 端登录状态是否失效。

### 2. 返回 409

说明网上国网认为这是新设备或需要验证。不要反复删除 `data/state.json`。需要在 NAS 端完成设备验证。

### 3. `accounts` 为空

可能原因：

- 网上国网账号下无绑定户号；
- 国网接口临时异常；
- 登录态异常；
- `SGCC_HISTORY_MONTHS` 设置过低通常不会导致账户为空，但会影响日用电历史长度。

### 4. Scripting 外网打不开 NAS

检查：

- iPhone 使用蜂窝网络时能否打开 `/health`；
- 域名是否解析到正确公网入口；
- 反向代理是否转发到 `8080`；
- HTTPS 证书是否有效。

---

## 14. 安全建议

- `SGCC_API_TOKEN` 使用长随机字符串；
- 不公开 `.env`；
- 不公开 `data/state.json`；
- 不把网上国网账号密码放入 Scripting；
- 不把 NAS API Token 截图发到公开场景；
- 如怀疑泄露，立即更换 `.env` 中的 `SGCC_API_TOKEN` 并重启服务。
