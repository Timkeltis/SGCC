/**
 * 网上国网 Loon 兼容修复包装器
 * - 优先从 jsDelivr 加载上游 95598.js，失败再回退 GitHub Raw
 * - 仅规范 /api/oauth2/outer/c02/f02 请求
 */

const UPSTREAMS = [
  "https://fastly.jsdelivr.net/gh/Yuheng0101/X@main/Tasks/95598/95598.js",
  "https://cdn.jsdelivr.net/gh/Yuheng0101/X@main/Tasks/95598/95598.js",
  "https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js"
];
const TARGET_RE = /^https:\/\/www\.95598\.cn\/api\/oauth2\/outer\/c02\/f02(?:\?|$)/i;
const APP_KEY = "7e5b5e84ddad4994b0ebc68dedca4962";

(function () {
  if (typeof $httpClient === "undefined") {
    console.log("❌ 当前环境未提供 $httpClient");
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

    const timestamp = String(req.headers.timestamp || (bodyObj && bodyObj.timestamp) || Date.now());

    req.headers.timestamp = timestamp;
    req.headers.Accept = "application/json;charset=UTF-8";
    req.headers["Content-Type"] = "application/json;charset=UTF-8";
    req.headers.version = req.headers.version || "1.0";
    req.headers.source = req.headers.source || "0901";
    req.headers.wsgwType = req.headers.wsgwType || "web";
    req.headers.appKey = req.headers.appKey || APP_KEY;
    req.headers["User-Agent"] = req.headers["User-Agent"] || "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
    req.headers.Origin = req.headers.Origin || "https://www.95598.cn";
    req.headers.Referer = req.headers.Referer || "https://www.95598.cn/osgweb/login";
    req.headers["Accept-Language"] = req.headers["Accept-Language"] || "zh-CN,zh-Hans;q=0.9";

    if (bodyObj) {
      bodyObj.timestamp = timestamp;
      req.body = JSON.stringify(bodyObj);
    }

    req.node = "DIRECT";
    console.log("[SGCC-FIX] 已修正 c02/f02 请求");
    console.log("[SGCC-FIX] timestamp=" + timestamp + " (string)");
    return req;
  }

  $httpClient.post = function (options, callback) {
    try {
      return originalPost(normalizeC02Request(options), callback);
    } catch (e) {
      console.log("[SGCC-FIX] 请求修正异常: " + (e && e.message ? e.message : e));
      return originalPost(options, callback);
    }
  };

  function loadUpstream(index) {
    if (index >= UPSTREAMS.length) {
      $notification.post("网上国网", "❌ 修复版加载失败", "jsDelivr 与 GitHub Raw 均无法下载上游脚本");
      $done();
      return;
    }

    const url = UPSTREAMS[index];
    console.log(`[SGCC-FIX] 加载上游 ${index + 1}/${UPSTREAMS.length}: ${url}`);

    originalGet({
      url,
      headers: { "User-Agent": "Loon SGCC Compatibility Wrapper" },
      timeout: 30
    }, function (error, response, body) {
      const status = Number(response && (response.status || response.statusCode) || 0);
      if (error || status < 200 || status >= 300 || !body) {
        console.log(`[SGCC-FIX] 当前源失败: ${error || `HTTP ${status}`}`);
        loadUpstream(index + 1);
        return;
      }

      try {
        console.log("[SGCC-FIX] 原版脚本加载成功，开始执行");
        (0, eval)(body);
      } catch (e) {
        console.log("❌ [SGCC-FIX] 原版脚本执行失败: " + (e && e.stack ? e.stack : e));
        $notification.post("网上国网", "❌ 修复版执行失败", String(e && e.message ? e.message : e));
        $done();
      }
    });
  }

  loadUpstream(0);
})();
