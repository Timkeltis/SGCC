# 网上国网小组件（Scripting + NAS API / HA）

在 iOS 桌面展示网上国网用电量、电费、余额、日用电和阶梯电量的 `systemMedium` 小组件。

本项目包含两部分：

1. **Scripting 小组件脚本**：运行在 iPhone / iPad 的 Scripting App 中，负责显示桌面小组件和配置页面；
2. **NAS SGCC API 服务**：运行在飞牛 NAS 上，负责登录/请求网上国网数据，并向 Scripting 提供稳定 API。

---

## 当前推荐架构

默认链路：

```text
Scripting 小组件 → NAS SGCC API → 网上国网 App 数据接口
```

备用链路：

```text
NAS API 失败且 HA 配置完整 → Home Assistant REST API → hass-state-grid
```

推荐 NAS API 的原因：

- 网上国网账号、密码、登录会话和设备状态都只保存在 NAS；
- Scripting 只保存 NAS API Base URL 和 API Token；
- 不再依赖 Loon / Surge / Quantumult X / BoxJs / MITM / 重写订阅；
- NAS 可以长期运行，适合作为手机小组件的数据源；
- Home Assistant 仍可作为备用链路。

---

## 仓库文件说明

```text
SGCC/
├── index.tsx                 # Scripting 设置页
├── widget.tsx                # Scripting 桌面小组件
├── script.json               # Scripting 脚本元数据
├── lib/                      # Scripting 侧类型、取数、计算、缓存、设置
│   ├── api.ts                # NAS API / HA 取数适配层
│   ├── calc.ts               # 小组件视图模型与阶梯电量计算
│   ├── store.ts              # 设置读写与兼容校验
│   ├── types.ts              # 类型定义与默认设置
│   └── cache.ts              # 本地诊断缓存
├── service.py                # NAS SGCC API 服务入口
├── sgcc_client/              # NAS 端网上国网 App 协议客户端
├── start-api.sh              # NAS API 启动脚本
├── stop-api.sh               # NAS API 手动停止脚本
├── sgcc-boot-task.sh         # NAS 开机任务入口
├── sgcc-watchdog.sh          # NAS 开机延迟与异常自动重启脚本
├── requirements-api.txt      # NAS Python 3.12 依赖
├── .env.example              # NAS 环境变量模板，不要提交真实 .env
├── API.md                    # NAS API 详细部署和接口说明
├── install.html              # Scripting 一键导入中转页
└── README.md                 # 当前说明文档
```

> 真实 `.env`、`data/`、登录态 `state.json`、日志文件不要提交到 GitHub。

---

## 一、部署 NAS SGCC API

详细部署见 [`API.md`](API.md)，这里给出最常用的飞牛 NAS Python 虚拟环境方式。

### 1. 准备目录

推荐目录：

```text
/vol1/1000/Disk1/docker/sgcc
```

把仓库中的 NAS 相关文件放入该目录，至少包括：

```text
service.py
sgcc_client/
requirements-api.txt
.env.example
start-api.sh
stop-api.sh
```

### 2. 安装 Python 依赖

在飞牛 NAS 终端执行：

```bash
cd /vol1/1000/Disk1/docker/sgcc
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements-api.txt
```

### 3. 创建并编辑 `.env`

```bash
cp .env.example .env
```

`.env` 示例：

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
| `SGCC_API_TOKEN` | Scripting 调用 NAS API 的令牌，建议使用长随机字符串 |
| `SGCC_USERNAME` | 网上国网登录手机号 |
| `SGCC_PASSWORD` | 网上国网登录密码 |
| `SGCC_HISTORY_MONTHS` | 拉取最近几个月的日用电，默认 2 |
| `PORT` | NAS API 监听端口，当前推荐 8080 |

安全要求：

- 真实 `.env` 只放在 NAS；
- 不要提交 `.env` 到 GitHub；
- 不要把网上国网账号密码填到 Scripting；
- 不要删除 `data/state.json`，否则可能触发重新登录或设备验证。

### 4. 启动服务

```bash
chmod +x start-api.sh stop-api.sh sgcc-watchdog.sh
./start-api.sh
```

查看日志：

```bash
tail -f data/service.log
```

停止服务：

```bash
./stop-api.sh
```

### 5. 飞牛开机自启建议

建议在飞牛 NAS 的开机任务中配置：

在飞牛 NAS 的“开机任务”中只执行一次：

```bash
/vol1/1000/Disk1/docker/sgcc/sgcc-boot-task.sh
```

入口脚本会自行脱离 cron，并启动 watchdog；不要在 crontab 行中额外添加 `nohup` 或 `&`。

```text
飞牛 NAS 开机
→ 等待 50 秒，确保网络和磁盘挂载完成
→ 启动 SGCC API
→ 服务异常退出后自动重启
→ 手动 stop-api.sh 停止时不自动拉起
```

自动重启由 `sgcc-watchdog.sh` 实现，`start-api.sh` 只负责启动一次服务。

### 6. 内网验证

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

测试数据接口：

```bash
curl -X POST http://127.0.0.1:8080/v1/electricity/bill/all \
  -H 'Authorization: Bearer 你的SGCC_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

成功时返回：

```json
{
  "ok": true,
  "source": "csc-service.sgcc.com.cn",
  "refresh_time": "...",
  "accounts": [],
  "data": {}
}
```

---

## 二、配置外网访问

Scripting 在 iPhone 外出时需要访问 NAS API，因此建议配置 HTTPS 外网地址。

当前示例 Base URL：

```text
https://pjqj69wa.kooldns.cn
```

当前反向代理使用根路径，没有 `/sgcc` 子路径：

```text
GET  https://pjqj69wa.kooldns.cn/health
POST https://pjqj69wa.kooldns.cn/v1/electricity/bill/all
```

反向代理目标：

```text
http://NAS局域网IP:8080
```

注意：

- 当前生产方式不是 Docker `18080:8080` 映射；
- 内网端口使用 `8080`；
- 不要暴露飞牛管理端口；
- 建议只暴露 NAS API 所需域名/路径；
- HTTPS 证书必须正常，否则 iOS 小组件可能访问失败。

---

## 三、导入 Scripting 小组件

### 方式一：一键导入

在 iPhone 或 iPad 上打开：

### [📲 一键导入到 Scripting](https://timkeltis.github.io/SGCC/install.html)

说明：GitHub README 会过滤 `scripting://` 这类 App URL Scheme，所以通过 GitHub Pages 的 HTTPS 页面中转。

如果安装页没有自动打开 Scripting，可以复制下面链接到 Safari：

```text
scripting://import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2FTimkeltis%2FSGCC%2Farchive%2Frefs%2Fheads%2Fmain.zip%22%5D
```

### 方式二：手动导入

将仓库内容放入 Scripting 脚本目录，脚本名为：

```text
SGCC_Mod
```

---

## 四、首次配置 Scripting

运行 `index.tsx` 打开设置页。

推荐设置：

```text
数据源：NAS 优先，失败回退 HA
NAS API Base URL：https://pjqj69wa.kooldns.cn
NAS API Token：NAS .env 中的 SGCC_API_TOKEN
```

如需 Home Assistant 备用回退，再填写：

```text
Home Assistant 地址：https://ha.example.com
Home Assistant Token：HA Long-Lived Access Token
```

然后：

1. 点击右上角「保存」；
2. 点击「获取账户列表」；
3. 如果显示 `已通过 NAS SGCC API 获取 X 个账户`，说明 NAS 链路正常；
4. 选择默认账户；
5. 再次保存；
6. 在桌面添加 `systemMedium` 小组件。

---

## 五、Home Assistant 备用链路

如果需要 HA 回退，请确认：

1. Home Assistant 已安装并运行 `hass-state-grid`；
2. `hass-state-grid` 已成功获取网上国网数据；
3. Home Assistant 可以从当前设备访问；
4. 已创建 Home Assistant Long-Lived Access Token。

Token 创建位置：

```text
Home Assistant → 用户头像 → 长期访问令牌 → 创建令牌
```

脚本支持 HA 地址填写以下形式：

```text
https://ha.example.com
https://ha.example.com/api
https://ha.example.com/api/states
```

脚本会自动整理为 `/api/states`。

---

## 六、设置说明

| 设置 | 说明 |
|---|---|
| 数据源 | 默认 NAS 优先，失败回退 HA；也可手动选择 Home Assistant |
| NAS API Base URL | NAS API 根地址，例如 `https://pjqj69wa.kooldns.cn` |
| NAS API Token | NAS `.env` 中的 `SGCC_API_TOKEN` |
| Home Assistant 地址 | HA 的访问地址，仅作为回退链路需要 |
| Home Assistant Token | HA Long-Lived Access Token，仅作为回退链路需要 |
| 获取账户列表 | 按当前数据源获取账户；NAS 失败可回退 HA |
| 当前账户 | 默认显示的账户下标，从 0 开始 |
| 刷新间隔 | WidgetKit 自动刷新建议间隔，非精确定时器 |
| 户 1/2/3 名称 | 给不同户设置易识别名称 |
| 柱状图天数 | 近 5–14 日用电 |
| 阶梯百分比 | 全量比例或当前阶梯内进度 |
| 第二/三档阈值 | 自定义阶梯阈值；留空使用默认口径 |
| 清除缓存 | 清理本地诊断缓存 |
| 预览小组件 | 真实数据联网，演示数据不联网 |

---

## 七、桌面多个小组件

在每个桌面小组件的参数中可以填写：

- 自定义户名；
- `1`、`2`、`3` 等账户序号；
- 留空则使用设置页默认账户。

这样可以在桌面同时放多个 SGCC 小组件，分别显示不同户号。

---

## 八、阶梯口径

默认按北京居民阶梯口径：

- 按月：一档 ≤240 度，二档 ≤400 度，三档 >400 度；
- 按年：一档 ≤2880 度，二档 ≤4800 度，三档 >4800 度。

各地区政策可能不同，请按当地实际情况填写第二档和第三档阈值。

---

## 九、自动刷新说明

小组件每次被 iOS 实际唤醒时，都会按数据源设置联网请求。设置的刷新间隔是 WidgetKit 的刷新建议时间，不是精确定时器。

iOS 可能因为：

- 省电策略；
- 后台刷新预算；
- 系统负载；
- 网络状态；
- 小组件可见性；

延迟执行刷新。

---

## 十、故障排查

### 1. NAS 健康检查失败

检查：

```bash
curl http://127.0.0.1:8080/health
```

如果本机失败：

- 服务没启动；
- `.venv` 或依赖有问题；
- `.env` 缺少必要变量；
- 端口不是 8080；
- 查看 `data/service.log`。

### 2. 外网打不开

检查：

- 域名是否解析正确；
- 反向代理是否指向 `http://NAS局域网IP:8080`；
- HTTPS 证书是否正常；
- 路由器 / 防火墙是否放行；
- 不要把飞牛管理端口当作 API 端口。

### 3. NAS API 401

含义：

```text
API Token 或网上国网认证失败
```

检查：

- Scripting 中 NAS API Token 是否等于 `.env` 的 `SGCC_API_TOKEN`；
- 网上国网账号密码是否正确；
- NAS 端登录会话是否失效。

### 4. NAS API 409

含义：

```text
网上国网要求设备验证
```

这不是 Scripting 问题，需要在 NAS 端处理设备验证。不要删除 `data/state.json`，否则可能更容易触发新设备验证。

### 5. NAS API 502 / 503

通常是网上国网上游异常、网络问题或 NAS 到国网接口暂时不可用。若 HA 已配置，Scripting 会尝试回退 HA。

### 6. Home Assistant 返回 HTML

通常表示反向代理返回了首页或登录页。检查：

- HA 地址是否正确；
- `/api/states` 是否可访问；
- Token 是否属于当前 HA 实例；
- 反向代理是否把 API 请求转到了网页首页。

### 7. 没有发现账户

- NAS 模式：检查 `/v1/electricity/bill/all` 返回的 `accounts` 是否为空；
- HA 模式：检查 `hass-state-grid` 是否生成对应实体。

---

## 十一、开发与同步到 GitHub

本项目可以用 `SGCC_GitHub_Sync` 脚本通过 Scripting 已连接的 GitHub 同步核心文件到仓库。

注意：

- 同步脚本不会读取或显示 GitHub Token；
- 首次使用需要允许 `read_contents` 和 `write_contents`；
- 若新增文件，需要把文件加入同步列表；
- `.env`、`data/`、日志、登录态不要同步。

---

## 原脚本来源与本项目改动

本项目最初参考并移植了 Scriptable 版「网上国网」脚本，原作者信息和来源链接保留如下：

- 原作者：脑瓜
- 原反馈渠道：https://t.me/Scriptable_CN
- 原参考项目：https://github.com/anker1209
- Scripting 移植及后续维护：本项目维护者

主要改动：

1. 原脚本依赖代理重写和 BoxJs；本项目改为 NAS SGCC API + HA 备用；
2. Scripting 不保存网上国网账号密码；
3. 支持 NAS API Token / HA Token 设置页输入；
4. 默认北京居民阶梯口径；
5. 保留并扩展三栏布局、多账户、多户名和桌面参数选户。

---

## 免责声明

本项目为非官方实现，仅供学习、研究和个人自动化使用。数据请以网上国网官方 App 为准。请自行保护 NAS API Token、Home Assistant Token 和网上国网账号信息，不要在不可信环境中保存或分享凭据。

## 致谢

本项目最初参考并移植了 Scriptable 网上国网脚本的界面和功能思路，保留原作者署名要求。当前 NAS API、Home Assistant 适配和 Scripting 小组件由本项目维护者整理维护。
