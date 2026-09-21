# 网上国网小组件（Scripting + NAS API / HA）

在 iOS 桌面展示网上国网用电量、电费、余额、日用电和阶梯电量的 `systemMedium` 小组件。

## 数据链路

默认链路：

```text
Scripting 小组件 → NAS SGCC API → 网上国网 App 数据接口
```

回退链路：

```text
NAS API 失败且 HA 配置完整 → Home Assistant REST API → hass-state-grid
```

推荐使用 NAS SGCC API：网上国网账号、密码、登录会话和设备状态全部保存在 NAS；Scripting 只保存 NAS API Base URL 和 API Token。Home Assistant 仍保留为备用数据源。

## 不再需要

- Loon / Surge / Quantumult X；
- BoxJs；
- MITM；
- 重写订阅；
- 在 Scripting 中保存网上国网账号密码。

## 功能

- 默认 NAS SGCC API 取数，失败时自动回退 HA；
- 右侧三栏自由配置；
- 阶梯电量、当前档位进度和进度条；
- 近 N 日用电柱状图；
- 年度/月度用电和电费；
- 账户余额和待缴电费；
- 多账户、多户名；
- 桌面多个小组件通过参数分别显示不同账户；
- 可设置自动刷新建议间隔；
- 默认北京居民阶梯规则。

## 原脚本来源与本项目改动

本项目最初参考并移植了 Scriptable 版「网上国网」脚本，原作者信息和来源链接保留如下：

- 原作者：脑瓜
- 原反馈渠道：https://t.me/Scriptable_CN
- 原参考项目：https://github.com/anker1209
- Scripting 移植及后续维护：本项目维护者

主要改动：

1. **更换数据获取方式**
   - 原脚本依赖代理重写和 BoxJs；
   - 现在推荐通过 NAS SGCC API 获取数据；
   - 保留 Home Assistant / hass-state-grid 作为备用链路；
   - Scripting 不保存网上国网账号密码。

2. **增加安全配置方式**
   - 设置页输入 NAS API Base URL；
   - 设置页输入 NAS API Token；
   - 可选填写 HA 地址和 HA Long-Lived Access Token 作为备用；
   - Token 不写入源码。

3. **优化小组件刷新机制**
   - 每次小组件实际运行都会联网请求当前数据源；
   - NAS 失败后自动尝试 HA；
   - 请求失败重试后显示错误；
   - 本地缓存仅用于排障，不用于冒充最新数据。

4. **修正阶梯电量和百分比**
   - 默认阶梯规则改为北京居民口径；
   - 年度默认阈值为 2880 / 4800 度；
   - 月度默认阈值为 240 / 400 度；
   - 修正阈值等号边界；
   - 支持当前阶梯内百分比。

5. **优化显示和稳定性**
   - 保留并扩展原三栏布局；
   - 支持多账户、多户名和桌面参数选户；
   - Logo 改为本地读取，减少额外网络请求。

## 一键导入 Scripting

在 iPhone 或 iPad 上点击下面的链接，会打开安装页，再由安装页调用 Scripting 导入本项目：

### [📲 一键导入到 Scripting](https://timkeltis.github.io/SGCC/install.html)

说明：GitHub README 会过滤 `scripting://` 这类 App URL Scheme，不能直接在 README 里做真正可点击的一键导入。因此这里使用 GitHub Pages 上的 HTTPS 安装页中转，安装页再打开 Scripting。

如果安装页没有自动打开 Scripting，请点击安装页中的「打开 Scripting 并导入」按钮，或复制下面这个完整链接到 Safari 地址栏打开。

```text
scripting://import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2FTimkeltis%2FSGCC%2Farchive%2Frefs%2Fheads%2Fmain.zip%22%5D
```

> 一键导入只负责把项目导入 Scripting，不会自动填写 NAS API Token 或 HA Token。

## NAS SGCC API 准备

当前推荐生产部署为飞牛 NAS Python 3.12 虚拟环境，详见 [`API.md`](API.md)。Scripting 侧只需要：

```text
NAS API Base URL: https://pjqj69wa.kooldns.cn
NAS API Token: NAS .env 中的 SGCC_API_TOKEN
```

健康检查：

```text
GET https://pjqj69wa.kooldns.cn/health
```

数据接口由代码自动拼接：

```text
POST /v1/electricity/bill/all
```

不要把 NAS `.env` 中的网上国网账号密码写入 Scripting 或 GitHub。

## Home Assistant 备用链路

如需 HA 回退，请确认：

1. Home Assistant 已安装并运行 `hass-state-grid`；
2. `hass-state-grid` 已成功获取网上国网数据；
3. Home Assistant 可以从当前设备访问；
4. 已创建 Home Assistant Long-Lived Access Token。

创建 Token 的位置通常为：

```text
Home Assistant → 用户头像 → 长期访问令牌 → 创建令牌
```

## 安装和首次配置

1. 将项目导入 Scripting 的脚本目录；
2. 运行 `index.tsx` 打开设置页；
3. 数据源保持默认：`NAS 优先，失败回退 HA`；
4. 填写 NAS API Base URL，例如：

   ```text
   https://pjqj69wa.kooldns.cn
   ```

5. 填写 NAS API Token；
6. 如需回退 HA，继续填写 Home Assistant 地址和 Token；
7. 点击右上角「保存」；
8. 点击「获取账户列表」验证连接；
9. 选择默认账户并保存；
10. 在桌面添加 `systemMedium` 小组件。

## 桌面多个小组件

在每个小组件的参数中可以填写：

- 自定义户名；
- `1`、`2`、`3` 等账户序号；
- 留空则使用设置页中的默认账户。

## 设置说明

| 设置 | 说明 |
|---|---|
| 数据源 | 默认 NAS 优先，失败回退 HA；也可手动选择 Home Assistant |
| NAS API Base URL | NAS API 根地址，例如 `https://pjqj69wa.kooldns.cn` |
| NAS API Token | NAS `.env` 中的 `SGCC_API_TOKEN`，不要提交到 GitHub |
| Home Assistant 地址 | HA 的访问地址；仅作为回退链路需要 |
| Home Assistant Token | HA Long-Lived Access Token；仅作为回退链路需要 |
| 获取账户列表 | 按当前数据源获取账户列表；NAS 失败可回退 HA |
| 当前账户 | 默认显示的账户下标，从 0 开始 |
| 刷新间隔 | 自动刷新建议间隔：60 分钟至 24 小时 |
| 户 1/2/3 名称 | 给不同户设置易识别的名称 |
| 柱状图天数 | 近 5–14 日用电 |
| 阶梯百分比 | 全量比例或当前阶梯内进度 |
| 第二/三档阈值 | 自定义阶梯阈值；留空使用默认口径 |
| 清除缓存 | 清理本地诊断缓存 |
| 预览小组件 | 真实数据联网，演示数据不联网 |

## 阶梯口径

默认按北京居民阶梯口径：

- 按月：一档 ≤240 度，二档 ≤400 度，三档 >400 度；
- 按年：一档 ≤2880 度，二档 ≤4800 度，三档 >4800 度。

各地区政策可能不同，请按当地实际情况填写第二档和第三档阈值。

## 自动刷新说明

小组件每次被 iOS 实际唤醒时，都会按数据源设置联网请求。设置的刷新间隔是 WidgetKit 的刷新建议时间，不是精确计时器。iOS 可能因为省电、后台刷新预算或系统负载延迟执行。

## 故障排查

### NAS API Token 或网上国网认证失败

通常对应 HTTP 401。检查：

- Scripting 中 NAS API Token 是否正确；
- NAS `.env` 中 `SGCC_API_TOKEN` 是否一致；
- NAS 端网上国网账号登录状态是否正常。

### 网上国网要求设备验证

通常对应 HTTP 409。需要在 NAS 端处理设备验证，Scripting 不负责网上国网登录流程。

### NAS 返回 502 / 503

通常是网上国网上游异常、网络问题或 NAS 到国网接口暂时不可用。此时如果 HA 已配置，Scripting 会尝试回退 HA。

### Home Assistant 返回 HTML 而不是 JSON

通常表示反向代理返回了首页或登录页。请确认：

- 地址确实指向 Home Assistant；
- `/api/states` 可以通过浏览器或其他客户端访问；
- HTTPS 反向代理没有把 API 请求转到网页首页；
- Token 有效且属于当前 HA 实例。

### 没有发现国网账户

- NAS 模式：检查 NAS API 返回的 `accounts` 是否为空；
- HA 模式：检查 `hass-state-grid` 是否生成对应实体。

## 免责声明

本项目为非官方实现，仅供学习、研究和个人自动化使用。数据请以网上国网官方 App 为准。请自行保护 NAS API Token、Home Assistant Token 和网上国网账号信息，不要在不可信环境中保存或分享凭据。

## 致谢

本项目最初参考并移植了 Scriptable 网上国网脚本的界面和功能思路，保留原作者署名要求。当前 NAS API、Home Assistant 适配和 Scripting 小组件由本项目维护者整理维护。
