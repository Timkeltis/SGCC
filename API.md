# 公网 API

此服务把网上国网 App 数据层直接部署在 NAS 上。账号密码只放在 NAS 的 `.env`，调用端只需要 API Token。

## 当前实际部署

当前生产部署为飞牛 NAS Python 3.12 虚拟环境，不是 Docker 端口映射：

```text
项目目录：/vol1/1000/Disk1/docker/sgcc
Python 虚拟环境：/vol1/1000/Disk1/docker/sgcc/.venv
服务文件：service.py
数据目录：/vol1/1000/Disk1/docker/sgcc/data
配置文件：/vol1/1000/Disk1/docker/sgcc/.env
```

账号、密码和 API Token 只保存在 NAS `.env`，不要提交到 GitHub，也不要写入 Scripting 源码。

## 当前外网地址

Base URL：

```text
https://pjqj69wa.kooldns.cn
```

当前反向代理使用根路径，没有 `/sgcc` 子路径。Scripting 只填写 Base URL，代码自动拼接接口路径。

完整接口：

```text
GET  https://pjqj69wa.kooldns.cn/health
POST https://pjqj69wa.kooldns.cn/v1/electricity/bill/all
```

内网地址使用 NAS 本机 `8080` 端口，例如：

```text
http://NAS局域网IP:8080/health
```

当前不是 Docker 的 `18080:8080` 映射，内网不要使用 `18080`。

## 方式一：飞牛应用商店 Python（当前使用）

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

服务监听 NAS 的 `PORT`（当前为 `8080`）。

## 方式二：Docker（可选，不是当前生产方式）

```bash
cp .env.example .env
# 编辑 .env 后执行
docker compose -f docker-compose.api.yml up -d --build
```

先在 NAS 内部验证：

```bash
curl http://NAS地址:8080/health
curl -X POST http://NAS地址:8080/v1/electricity/bill/all \
  -H 'Authorization: Bearer replace-with-a-long-random-token' \
  -H 'Content-Type: application/json' \
  -d '{}'
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

## DDNSTO / 外网反向代理

当前生产部署将 DDNSTO / 外网域名映射到 NAS 的 `8080` 端口。Scripting 使用 DDNSTO 提供的 HTTPS Base URL，例如 `https://pjqj69wa.kooldns.cn`。不要暴露飞牛管理端口，也不要把网上国网账号密码放入 Scripting。
