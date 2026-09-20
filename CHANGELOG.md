## 1.4.0-ha

- 获取方式改为 Home Assistant REST API。
- 不再需要 Loon、Surge、Quantumult X、BoxJs、MITM、重写订阅或网上国网账号密码。
- 新增设置页输入 Home Assistant 地址和 Long-Lived Access Token。
- Token 不再硬编码在源码中；请求仅允许同一 HA 地址的重定向。
- 每次小组件实际运行直接请求 HA，失败重试后显示错误，不使用旧缓存冒充最新数据。
- 优化 HA 请求超时、重试次数和地址/Token 格式兼容。
- 修正阶梯阈值边界与非法阈值处理。
- Logo 改为本地读取，减少刷新时额外网络请求。
- 更新 README，移除旧的代理、BoxJs 和重写配置说明。

## 1.3.0-ha

- 自动发现国家电网实体，兼容 previous/latest 两套实体命名。
- 使用 HA 的 current_month_usage / current_year_usage / account_balance 等实体。
- 使用 daily_history 与 monthly_bill_history 还原日/月历史数据。
- 移除远程自动更新配置，避免被原仓库覆盖。
- 修复原 widget.tsx 阶梯条 JSX 缺少闭合大括号的问题。

## 更新日志

### v1.2.5

- 新增阶梯进度条样式可选（三色渐变 / 纯色原始）。
- 新增阶梯百分比计算方式可选（全量 / 阶梯）。
- 新增三色进度条超出第三阶梯后的动态显示。
- 新增年度用电量标注。
- 组件宽度适配不同设备。

### v1.2.0

- 初始 Scripting 移植版本。
- 支持三栏自定义、多账户、桌面参数选户、阶梯电量和日用电图表。
