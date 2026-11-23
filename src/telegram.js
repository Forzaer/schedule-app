window.ScheduleTelegram = (function () {
    var params = {};
    var dec = function (x) { try { return decodeURIComponent(x.replace(/\+/g, "%20")); } catch (e) { return x; } };
    try {
      var h = location.hash.replace(/^#/, ""), q = h.indexOf("?");
      if (q >= 0 && h.indexOf("=") > q) h = h.slice(q + 1); // форма "#путь?параметры"
      h.split("&").forEach(function (p) {
        var i = p.indexOf("=");
        if (i > 0) params[dec(p.slice(0, i))] = dec(p.slice(i + 1));
      });
    } catch (e) {}
    try { // после перезагрузки Telegram не передаёт параметры повторно
      if (params.tgWebAppVersion) sessionStorage.setItem("tgParams", JSON.stringify(params));
      else params = JSON.parse(sessionStorage.getItem("tgParams") || "null") || params;
    } catch (e) {}

    var isIframe = false;
    try { isIframe = window.parent != null && window !== window.parent; } catch (e) {}
    var hasProxy = function () { return typeof window.TelegramWebviewProxy !== "undefined"; };
    var hasNotify = function () { try { return !!(window.external && "notify" in window.external); } catch (e) { return false; } };
    var version = params.tgWebAppVersion || "6.0";
    var handlers = {};

    function atLeast(v) {
      var a = version.split("."), b = v.split(".");
      for (var i = 0; i < Math.max(a.length, b.length); i++) {
        var x = parseInt(a[i] || 0, 10), y = parseInt(b[i] || 0, 10);
        if (x !== y) return x > y;
      }
      return true;
    }
    function post(type, data) {
      if (data === undefined) data = "";
      try {
        if (hasProxy()) window.TelegramWebviewProxy.postEvent(type, JSON.stringify(data));
        else if (hasNotify()) window.external.notify(JSON.stringify({ eventType: type, eventData: data }));
        else if (isIframe) window.parent.postMessage(JSON.stringify({ eventType: type, eventData: data }), "*");
      } catch (e) {}
    }
    function receive(type, data) {
      (handlers[type] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
    }
    window.Telegram = window.Telegram || {};
    window.Telegram.WebView = window.Telegram.WebView || {};
    window.Telegram.WebView.receiveEvent = receive;
    window.TelegramGameProxy = { receiveEvent: receive };
    window.TelegramGameProxy_receiveEvent = receive;
    if (isIframe && params.tgWebAppVersion) {
      window.addEventListener("message", function (ev) {
        if (ev.source !== window.parent) return;
        var d;
        try { d = JSON.parse(ev.data); } catch (e) { return; }
        if (!d || !d.eventType) return;
        if (d.eventType === "reload_iframe") { post("iframe_will_reload"); location.reload(); return; }
        receive(d.eventType, d.eventData);
      });
      post("iframe_ready", { reload_supported: true });
    }
    return {
      available: function () { return hasProxy() || hasNotify() || (isIframe && !!params.tgWebAppVersion); },
      atLeast: atLeast, post: post,
      on: function (type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    };
  })();

