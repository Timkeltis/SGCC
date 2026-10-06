# 网上国网小组件（Scripting + NAS SGCC API）

在 iOS 桌面展示网上国网用电量、电费、余额、日用电和阶梯电量的 `systemMedium` 小组件。

## 数据链路

```text
Scripting 小组件 → NAS SGCC API → 网上国网 App 数据接口
```

这是 **NAS-only** 版本：不再支持 Home Assistant、hass-state-grid、Loon、Surge、Quantumult X、BoxJs、MITM 或重写订阅取数。

网上国网账号、密码、登录会话和设备状态只保存在 NAS；Scripting 只保存 NAS API Base URL 与 API Token。

## 功能

- NAS SGCC API 直连网上国网数据；
- 多账户、多户名和桌面参数选户；
- 日用电、月度/年度电量电费、余额与待缴；
- 阶梯电量与进度条，默认北京居民年度阶梯口径；
- 近 N 日用电柱状图；
- 刷新间隔建议设置；
- NAS 异常、认证异常、设备验证和空数据的明确错误提示。

## 仓库结构

```text
SGCC/
├── index.tsx                 # Scripting 设置页
├── widget.tsx                # Scripting 桌面小组件
├── lib/                      # NAS API 请求、设置与计算
├── service.py                # NAS SGCC API 服务入口
├── sgcc_client/              # 网上国网 App 协议客户端
├── requirements-api.txt      # NAS Python 依赖
├── start-api.sh              # NAS API 启动脚本
├── stop-api.sh               # NAS API 停止脚本
├── .env.example              # NAS 配置模板
├── API.md                    # NAS 部署与接口说明
└── install.html              # Scripting 导入页
```

> 不要提交真实 `.env`、`data/`、登录态 `state.json` 或日志文件。

## 一、部署 NAS SGCC API

详细步骤见 [`API.md`](API.md)。飞牛 NAS Python 虚拟环境的常用部署方式：

```bash
cd /vol1/1000/Disk1/docker/sgcc
python3 -m venv .venv
.venv/bin/pip install -r requirements-api.txt
cp .env.example .env
# 编辑 .env：填写网上国网账号、密码和 SGCC_API_TOKEN
chmod +x start-api.sh stop-api.sh
PYTHON_BIN="$PWD/.venv/bin/python" ./start-api.sh
```

`.env`：

```env
SGCC_API_TOKEN=replace-with-a-long-random-token
SGCC_USERNAME=95598-login-phone
SGCC_PASSWORD=95598-login-password
SGCC_HISTORY_MONTHS=2
PORT=8080
```

检查服务：

```bash
curl http://127.0.0.1:8080/health
```

查看日志：

```bash
tail -f data/service.log
```

飞牛开机任务建议：

```bash
sleep 50
cd /vol1/1000/Disk1/docker/sgcc
PYTHON_BIN="$PWD/.venv/bin/python" ./start-api.sh
```

## 二、配置外网访问

通过 HTTPS 反向代理把 NAS 的 `8080` 端口提供给手机访问。

示例：

```text
NAS API Base URL：https://pjqj69wa.kooldns.cn
GET  https://pjqj69wa.kooldns.cn/health
POST https://pjqj69wa.kooldns.cn/v1/electricity/bill/all
```

反向代理目标：

```text
http://NAS局域网IP:8080
```

Scripting 中只填写 Base URL，不填写 `/health` 或完整数据接口路径。不要暴露 NAS 管理端口。

## 三、导入 Scripting

### 一键导入

### [📲 一键导入到 Scripting](https://timkeltis.github.io/SGCC/install.html)

如果安装页没有自动拉起 Scripting，请复制到 Safari 打开：

```text
scripting://import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2FTimkeltis%2FSGCC%2Farchive%2Frefs%2Fheads%2Fmain.zip%22%5D
```

## 四、首次配置

1. 在 Scripting 运行 `index.tsx`；
2. 填写 `NAS API Base URL`，例如 `https://pjqj69wa.kooldns.cn`；
3. 填写 NAS `.env` 中的 `SGCC_API_TOKEN`；
4. 点击保存；
5. 点击「获取账户列表」；
6. 选择默认账户；
7. 在桌面添加 `systemMedium` 小组件。

Scripting 不需要、也不应填写网上国网账号密码。

## 五、桌面多个小组件

在每个小组件的参数中填写：

- 自定义户名；
- `1`、`2`、`3` 等账户序号；
- 留空则使用设置页默认账户。

## 六、阶梯口径

默认按北京居民年度阶梯口径：

- 第一档：≤2880 度；
- 第二档：≤4800 度；
- 第三档：>4800 度。

各地区政策不同，可在设置页填写第二、三档阈值覆盖默认值。

## 七、自动刷新

刷新间隔是 WidgetKit 的刷新建议，不是精确计时器。iOS 会因省电、后台预算、网络和系统负载延迟刷新。每次实际唤醒时，小组件都会请求 NAS API 最新数据。

## 八、故障排查

### NAS API 健康检查失败

```bash
curl http://127.0.0.1:8080/health
```

检查服务是否启动、端口、Python 虚拟环境、`.env` 以及 `data/service.log`。

### 小组件提示 401

检查 Scripting 中的 NAS API Token 是否等于 NAS `.env` 的 `SGCC_API_TOKEN`；再检查网上国网登录状态。

### 小组件提示 409

网上国网要求设备验证。请在 NAS 端处理验证；不要随意删除 `data/state.json`。

### 小组件提示 502 / 503

网上国网上游接口、NAS 网络或国网服务暂时异常。查看 NAS 日志后稍后重试。

### 提示“NAS API 未返回有效用电数据”

NAS 服务和账户认证可能仍正常，但国网日用电、月账单和年度数据接口可能返回空内容。先检查 NAS 端 `data/service.log`，并确认运行代码与仓库版本一致。`1.6.1-nas` 修复了日/月请求中的账户字段映射；升级后仍为空时，再核查上游接口是否变更或该账户/地区是否支持相应数据。不要仅凭 `/health`、HTTP 200 或账户数判断账单数据完整。

```bash
tail -f /vol1/1000/Disk1/docker/sgcc/data/service.log
```

## 安全说明

- 网上国网账号密码只放 NAS `.env`；
- `SGCC_API_TOKEN` 只填入 Scripting 设置，不写入源码或公开截图；
- 不公开 `.env`、`data/state.json`、日志；
- 怀疑 API Token 泄露时，修改 `.env` 的 `SGCC_API_TOKEN`、重启 NAS 服务，并更新 Scripting 设置。

## 来源与致谢

本项目最初参考并移植 Scriptable 版「网上国网」脚本的界面与功能思路。

- 原作者：脑瓜
- 原反馈渠道：https://t.me/Scriptable_CN
- 原参考项目：https://github.com/anker1209

本项目为非官方实现，仅供学习、研究和个人自动化使用，数据以网上国网官方 App 为准。
