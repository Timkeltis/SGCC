// 网上国网 c02/f02 请求兼容修正
// 仅规范请求字段，不处理响应，不做风控绕过。

(function () {
  try {
    const req = { ...$request, headers: { ...($request.headers || {}) } };
    let body = req.body;
    let obj = null;

    if (typeof body === "string" && body.length) {
      try { obj = JSON.parse(body); } catch (_) {}
    }

    const ts = String(
      req.headers.timestamp ||
      req.headers.Timestamp ||
      (obj && obj.timestamp) ||
      Date.now()
    );

    req.headers.timestamp = ts;
    delete req.headers.Timestamp;
    req.headers.Accept = "application/json;charset=UTF-8";
    req.headers["Content-Type"] = "application/json;charset=UTF-8";
    req.headers.version = req.headers.version || "1.0";
    req.headers.source = req.headers.source || "0901";
    req.headers.wsgwType = req.headers.wsgwType || "web";
    req.headers.appKey = req.headers.appKey || "7e5b5e84ddad4994b0ebc68dedca4962";
    req.headers.Origin = req.headers.Origin || "https://www.95598.cn";
    req.headers.Referer = req.headers.Referer || "https://www.95598.cn/osgweb/login";
    req.headers["Accept-Language"] = req.headers["Accept-Language"] || "zh-CN,zh-Hans;q=0.9";

    if (obj) {
      obj.timestamp = ts;
      req.body = JSON.stringify(obj);
    }

    console.log(`[SGCC-C02-FIX] timestamp=${ts}`);
    $done(req);
  } catch (e) {
    console.log(`[SGCC-C02-FIX] failed: ${e && e.message ? e.message : e}`);
    $done({});
  }
})();
