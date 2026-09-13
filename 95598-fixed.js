/**
 * 网上国网 Loon 兼容修复包装器
 *
 * 作用：
 * - 动态加载 Yuheng0101/X 的原版 95598.js
 * - 仅修正发往 /api/oauth2/outer/c02/f02 的请求
 * - 保留原脚本的账号、查询、通知、多户号、服务模式等全部逻辑
 *
 * 不做 WAF 绕过，仅规范当前请求字段类型与常规 HTTP 请求头。
 */

const UPSTREAM = "https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js";
const TARGET_RE = /^https:\/\/www\.95598\.cn\/api\/oauth2\/outer\/c02\/f02(?:\?|$)/i;
const APP_KEY = "7e5b5e84ddad4994b0ebc68dedca4962";

(function () {
  if (typeof $httpClient === "undefined") {
    console.log("❌ 当前环境未提供 $httpClient，仅支持 Loon/兼容脚本环境");
    if (typeof $done === "function") $done();
    return;
  }

  const originalPost = $httpClient.post.bind($httpClient);
  const originalGet = $httpClient.get.bind($httpClient);

  function normalizeC02Request(input) {
    const req = typeof input === "string" ? { url: input } : { ...input };
    if (!req.url || !TARGET_RE.test(req.url)) return req;

    req.headers = { ...(req.headers || {}) };

    let bodyObj = null;
    if (typeof req.body === "string") {
      try { bodyObj = JSON.parse(req.body); } catch (_) {}
    } else if (req.body && typeof req.body === "object") {
      bodyObj = { ...req.body };
    }

    const timestamp = String(
      req.headers.timestamp ||
      (bodyObj && bodyObj.timestamp) ||
      Date.now()
    );

    req.headers.timestamp = timestamp;
    req.headers.Accept = "application/json;charset=UTF-8";
    req.headers["Content-Type"] = "application/json;charset=UTF-8";
    req.headers.version = req.headers.version || "1.0";
    req.headers.source = req.headers.source || "0901";
    req.headers.wsgwType = req.headers.wsgwType || "web";
    req.headers.appKey = req.headers.appKey || APP_KEY;

    // 常规 Web 请求头，避免请求形态异常。
    req.headers["User-Agent"] = req.headers["User-Agent"] ||
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
    req.headers.Origin = req.headers.Origin || "https://www.95598.cn";
    req.headers.Referer = req.headers.Referer || "https://www.95598.cn/osgweb/login";
    req.headers["Accept-Language"] = req.headers["Accept-Language"] || "zh-CN,zh-Hans;q=0.9";

    if (bodyObj) {
      bodyObj.timestamp = timestamp;
      req.body = JSON.stringify(bodyObj);
    }

    // Loon：官方站点请求强制直连，避免代理出口影响。
    req.node = "DIRECT";

    console.log("[SGCC-FIX] 已修正 c02/f02 请求");
    console.log("[SGCC-FIX] timestamp=" + timestamp + " (string)");

    return req;
  }

  // 在原版脚本真正发送 HTTP 请求的最底层做最小补丁。
  $httpClient.post = function (options, callback) {
    try {
      return originalPost(normalizeC02Request(options), callback);
    } catch (e) {
      console.log("[SGCC-FIX] 请求修正异常: " + (e && e.message ? e.message : e));
      return originalPost(options, callback);
    }
  };

  console.log("[SGCC-FIX] 正在加载原版 95598.js");

  // 使用未修改的 GET 拉取上游脚本，随后在当前 Loon 上下文执行。
  originalGet({
    url: UPSTREAM,
    headers: {
      "User-Agent": "Loon SGCC Compatibility Wrapper"
    },
    timeout: 15
  }, function (error, response, body) {
    if (error) {
      console.log("❌ [SGCC-FIX] 原版脚本下载失败: " + error);
      $notification.post("网上国网", "❌ 修复版加载失败", String(error));
      $done();
      return;
    }

    const status = Number(response && (response.status || response.statusCode) || 0);
    if (status < 200 || status >= 300 || !body) {
      console.log("❌ [SGCC-FIX] 原版脚本 HTTP " + status);
      $notification.post("网上国网", "❌ 修复版加载失败", "上游脚本 HTTP " + status);
      $done();
      return;
    }

    try {
      console.log("[SGCC-FIX] 原版脚本加载成功，开始执行");
      (0, eval)(body);
    } catch (e) {
      console.log("❌ [SGCC-FIX] 原版脚本执行失败: " + (e && e.stack ? e.stack : e));
      $notification.post(
        "网上国网",
        "❌ 修复版执行失败",
        String(e && e.message ? e.message : e)
      );
      $done();
    }
  });
})();
