# 来源说明

本仓库的网上国网核心脚本来源于 [Yuheng0101/X](https://github.com/Yuheng0101/X) 的 [`Tasks/95598/95598.js`](https://github.com/Yuheng0101/X/blob/main/Tasks/95598/95598.js)。`95598-upstream.js` 保存了构建所使用的上游输入副本。

新增的 `sgcc_client/` 直接移植自 [stevenjoezhang/hass-state-grid](https://github.com/stevenjoezhang/hass-state-grid) 的纯 Python 数据获取实现；该项目使用 MIT License，本仓库保留其来源并在此基础上增加了独立 HTTP API 封装。

- `95598.js`：在上游脚本基础上应用本仓库的请求兼容补丁生成。
- `patch_sgcc.py`：Timkeltis 编写的本地补丁构建脚本。
- `95598-fixed.js`、`c02-fix.js`：Timkeltis 编写的请求兼容包装/补丁代码。
- `sgcc-fixed.loon.plugin`：Timkeltis 编写的接口调用配置。

上游脚本的版权、署名和许可证仍归原作者及其上游声明所有。本仓库保留来源并只声明自己编写的补丁、构建和配置部分。
