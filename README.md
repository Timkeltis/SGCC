# 网上国网 HA 小组件（Scripting）

在 iOS 桌面展示网上国网用电量、电费、余额、日用电和阶梯电量的 `systemMedium` 小组件。

## 获取方式说明

本项目已经改为通过 **Home Assistant REST API** 获取数据。

不再需要：

- Loon
- Surge
- Quantumult X
- BoxJs
- MITM
- 重写订阅
- 国网账号密码

你只需要准备：

1. 已安装并运行 `hass-state-grid` 的 Home Assistant；
2. Home Assistant 的访问地址；
3. Home Assistant 的 Long-Lived Access Token。

数据链路为：

```text
Scripting 小组件 → Home Assistant REST API → hass-state-grid → 网上国网数据
```

## 功能

- 右侧三栏自由配置；
- 阶梯电量、当前档位进度和进度条；
- 近 N 日用电柱状图；
- 年度/月度用电和电费；
- 账户余额和待缴电费；
- 多账户、多户名；
- 桌面多个小组件通过参数分别显示不同账户；
- 可设置自动刷新间隔；
- 每次小组件实际运行都会直接请求 HA，不使用旧缓存冒充最新数据。

## Home Assistant 准备

请先确认：

1. Home Assistant 已安装 `hass-state-grid`；
2. `hass-state-grid` 已成功获取网上国网数据；
3. Home Assistant 可以从当前设备访问；
4. 已创建一个 Long-Lived Access Token。

创建 Token 的位置通常为：

```text
Home Assistant → 用户头像 → 长期访问令牌 → 创建令牌
```

Token 只需要用于读取实体状态。不要把 Token 写入公开代码、README、截图或聊天记录。

## 安装和首次配置

1. 将项目导入 Scripting 的脚本目录；
2. 运行 `index.tsx` 打开设置页；
3. 在「Home Assistant 地址」中填写地址，例如：

   ```text
   https://ha.example.com
   ```

   也支持填写带 `/api` 或 `/api/states` 的地址，脚本会自动整理。

4. 在「Home Assistant Token」中填写 Long-Lived Access Token；
5. 点击右上角「保存」；
6. 点击「获取账户列表」验证连接；
7. 选择默认账户并保存；
8. 在桌面添加 `systemMedium` 小组件。

地址和 Token 保存在 Scripting 的脚本配置中，不写入源码。请求失败时不会显示旧缓存数据，而是显示错误提示。

## 桌面多个小组件

在每个小组件的参数中可以填写：

- 自定义户名；
- `1`、`2`、`3` 等账户序号；
- 留空则使用设置页中的默认账户。

## 设置说明

| 设置 | 说明 |
|---|---|
| Home Assistant 地址 | HA 的访问地址 |
| Home Assistant Token | HA Long-Lived Access Token |
| 获取账户列表 | 从 HA 获取当前发现的国网账户和户列表 |
| 当前账户 | 默认显示的账户下标，从 0 开始 |
| 刷新间隔 | 自动刷新建议间隔：60 分钟至 24 小时 |
| 户 1/2/3 名称 | 给不同户设置易识别的名称 |
| 柱状图天数 | 近 5–14 日用电 |
| 阶梯百分比 | 全量比例或当前阶梯内进度 |
| 第二/三档阈值 | 自定义阶梯阈值；留空使用默认口径 |
| 清除缓存 | 清理本地诊断缓存；正常显示不依赖缓存 |
| 预览小组件 | 真实数据联网，演示数据不联网 |

## 阶梯口径

默认按山东居民阶梯口径：

- 按月：一档 ≤210 度，二档 ≤400 度，三档 >400 度；
- 按年：一档 ≤2520 度，二档 ≤4800 度，三档 >4800 度。

各地区政策可能不同，请按当地实际情况填写第二档和第三档阈值。

## 自动刷新说明

小组件每次被 iOS 实际唤醒时，都会直接请求 Home Assistant。设置的刷新间隔是 WidgetKit 的刷新建议时间，不是精确计时器。iOS 可能因为省电、后台刷新预算或系统负载延迟执行。

如果 HA 请求失败，脚本会重试后显示错误，不会继续显示旧数据冒充最新数据。

## 故障排查

### 显示未填写地址或 Token

回到设置页填写 Home Assistant 地址和 Token，点击「保存」后再点「获取账户列表」。

### 返回 HTML 而不是 JSON

通常表示反向代理返回了首页或登录页。请确认：

- 地址确实指向 Home Assistant；
- `/api/states` 可以通过浏览器或其他客户端访问；
- HTTPS 反向代理没有把 API 请求转到网页首页；
- Token 有效且属于当前 HA 实例。

### 没有发现国网账户

确认 `hass-state-grid` 已成功生成相应实体，并检查实体状态是否为可用值。

## 免责声明

本项目为非官方实现，仅供学习、研究和个人自动化使用。数据请以网上国网官方 App 为准。请自行保护 Home Assistant 地址和 Token，不要在不可信环境中保存或分享凭据。

## 致谢

本项目最初参考并移植了 Scriptable 网上国网脚本的界面和功能思路，保留原作者署名要求。当前数据获取链路、Scripting 适配和 Home Assistant 接入由本项目维护者改造。
