# 公网 API

此服务把网上国网 App 数据层直接部署在 NAS 上。账号密码只放在 NAS 的 `.env`，调用端只需要 API Token。

## 方式一：飞牛应用商店 Python（推荐）

在飞牛应用商店安装 Python 3.12，然后在 NAS 终端执行：

```bash
cd /vol1/1000/Disk1/docker/sgcc
python3 -m venv .venv
.venv/bin/pip install -r requirements-api.txt
cp .env.example .env
# 编辑 .env，填写网上国网账号和 SGCC_API_TOKEN
chmod +x start-api.sh stop-api.sh
PYTHON_BIN="$PWD/.venv/bin/python" ./start-api.sh
```

查看运行日志：

```bash
tail -f data/service.log
```

停止服务：

```bash
./stop-api.sh
```

服务监听 NAS 的 `PORT`（默认 `8080`）。如果需要映射到 NAS 的 `18080`，请在 `.env` 中设置 `PORT=18080`。

## 方式二：Docker

```bash
cp .env.example .env
# 编辑 .env 后执行
docker compose -f docker-compose.api.yml up -d --build
```

先在 NAS 内部验证：

```bash
curl http://NAS地址:18080/health
curl -X POST http://NAS地址:18080/v1/electricity/bill/all \
  -H 'Authorization: Bearer replace-with-a-long-random-token'
```

## 接口

### `GET /health`

健康检查，不需要 Token，不返回账号信息。

### `POST /v1/electricity/bill/all`

需要：

```http
Authorization: Bearer <SGCC_API_TOKEN>
```

请求体可以为空。返回 `accounts` 和 `data`，包括日用电、月账单、年度汇总和余额。

### `POST /v1/auth/login`

需要同样的 Token。用于手动触发一次登录和数据同步。首次登录遇到新设备验证时会返回 `409`，需要后续补充短信验证接口。

## DDNSTO

容器启动并在内网验证通过后，将 DDNSTO 域名映射到 NAS 的 `18080` 端口。Scripting 使用 DDNSTO 提供的 HTTPS 地址，不要暴露飞牛管理端口，也不要把网上国网账号密码放入 Scripting。
