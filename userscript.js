/*
 * WatchLuna userscript for TizenBrew (packageType: "mods")
 * Injected into https://watchluna.com/ by the TizenBrew app on Samsung TVs.
 *
 * Provides:
 *  1. Remote/D-pad spatial navigation for sites that don't implement TV focus.
 *  2. Media-key mapping (Play/Pause -> <video>, Stop -> stop+back).
 *  3. A lightweight, conservative ad blocker for the host page
 *     (popunders, overlay banners, known ad networks, ad iframes).
 *     Note: ads INSIDE the cross-origin player iframe cannot be touched
 *     from here - only the player's wrappers/popups around it.
 */
(function () {
  "use strict";
  if (window.__watchlunaMod) return;
  window.__watchlunaMod = true;

  /* ---------------- config you can tweak ---------------- */
  // Extra hosts to block (substring match on src/href). Extend as needed.
  var BLOCK_HOSTS = [
    "googlesyndication.com", "doubleclick.net", "google-analytics.com",
    "googletagmanager.com", "googleservicesdk", "adservice.google",
    "googletagservices.com", "tpc.googlesyndication", "pagead2.googlesyndication",
    "amazon-adsystem.com", "adnxs.com", "pubmatic.com", "openx.net",
    "criteo.com", "casalemedia.com", "rubiconproject.com", "taboola.com",
    "outbrain.com", "exoclick.com", "exdyns.com", "zergnet.com",
    "popads.net", "popcash.net", "popmyads.com", "popunder", "popadscdn.net",
    "adexchangepop", "historyads.com", "onclckmn.com", "onclickall",
    "trafficjunky", "hilltopads", "adman.net", "propellerads", "propellerclick",
    "revcash", "adcash", "adform.net", "smartadserver", "sharethrough",
    "moatads", "adsafeprotected", "confiant", "scorecardresearch", "quantserve",
    "hotjar.com", "clarity.ms", "facebook.net", "connect.facebook",
    "discuss.com", "crssx", "solvemedia"
  ];
  // CSS selectors for elements commonly used for overlays/banners/popups.
  var HIDE_SELECTORS = [
    ".adsbygoogle", "ins.adsbygoogle",
    "[class*='popunder']", "[id*='popunder']",
    "[class*='popup-overlay']", "[class*='overlay-ad']", "[id*='ad-overlay']",
    "[class*='banner-ad']", "[class*='ad-banner']", "[id*='ad-banner']",
    "iframe[src*='doubleclick']", "iframe[src*='googlesyndication']",
    "iframe[src*='amazon-adsystem']", "iframe[src*='moatads']"
  ];
  /* ------------------------------------------------------ */

  var blockedCount = 0;

  function blockedUrl(url) {
    if (!url) return false;
    url = String(url).toLowerCase();
    if (url.indexOf("watchluna") !== -1) return false; // never block the site itself
    for (var i = 0; i < BLOCK_HOSTS.length; i++) {
      if (url.indexOf(BLOCK_HOSTS[i]) !== -1) return true;
    }
    return false;
  }

  /* ---- 0. focus visibility CSS ---- */
  var style = document.createElement("style");
  style.textContent =
    ":focus{outline:3px solid #4f9cff !important;outline-offset:2px !important;}" +
    "a:focus,button:focus,[tabindex]:focus{box-shadow:0 0 0 3px rgba(79,156,255,.85) !important;}" +
    "iframe[id^=\"google_\"],iframe[title*=\"Ad\"],iframe[src*=\"doubleclick\"],iframe[src*=\"googlesyndication\"]{display:none !important;}";
  (document.head || document.documentElement).appendChild(style);

  /* ---- 1. kill ad scripts/iframes as they appear (MutationObserver) ---- */
  function sweep(root) {
    var els = (root && root.querySelectorAll) ? root.querySelectorAll("script,iframe") : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var src = el.src || el.dataSrc || el.getAttribute("data-src") || "";
      if (blockedUrl(src)) {
        if (el.tagName === "IFRAME") {
          el.remove();
          blockedCount++;
        } else {
          // defer removal to the next microtask so parsing can continue safely
          setTimeout(function (s) { return function () { s.remove(); }; }(el), 0);
          blockedCount++;
        }
      }
    }
    var hide = (root && root.querySelectorAll) ? root.querySelectorAll(HIDE_SELECTORS.join(",")) : [];
    for (var j = 0; j < hide.length; j++) hide[j].remove();
  }

  function startObserver() {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t.nodeType === 1) sweep(t);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---- 2. intercept fetch/XHR for blocked hosts ---- */
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function (input) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (blockedUrl(url)) return Promise.reject(new Error("blocked by watchluna mod"));
      return _fetch.apply(window, arguments);
    };
  }
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (blockedUrl(url)) {
      this.__blocked = true;
      arguments[1] = "data:,blocked";
    }
    return _open.apply(this, arguments);
  };
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (this.__blocked) return;
    return _send.apply(this, arguments);
  };

  /* ---- 3. popunder/popup killer ----
   * Popunders open a new window on the first remote "Enter" press.
   * We allow window.open only from real user intent signals we control,
   * which in practice means: block them all (TV browser can't use them). */
  var _winOpen = window.open;
  window.open = function () {
    blockedCount++;
    return null;
  };
  document.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== document.body) {
      if (t.tagName === "A" && t.target === "_blank") { t.removeAttribute("target"); }
      t = t.parentElement;
    }
  }, true);

  /* ---- 4. media keys -> video controls ---- */
  function getVideo() {
    return document.querySelector("video") ||
      document.querySelector("iframe"); // last resort (can't control inside iframe, harmless)
  }
  document.addEventListener("keydown", function (e) {
    var kc = e.keyCode || e.which;
    if (kc === 413 /* MediaPlayPause */) {
      var v = document.querySelector("video");
      if (v) { v.paused ? v.play() : v.pause(); e.preventDefault(); }
    } else if (kc === 415 /* MediaStop */) {
      var vv = document.querySelector("video");
      if (vv) { vv.pause(); vv.currentTime = 0; history.back(); e.preventDefault(); }
    }
  }, true);

  /* ---- 5. spatial (D-pad) navigation fallback ----
   * Works when the page has no focus management of its own:
   * moves focus to the visually nearest focusable element in the
   * pressed direction. If the site already moves focus itself (its
   * activeElement changes between keydown and here), we do nothing. */
  var FOCUSABLE = "a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex='-1']),[role='button'],[role='link'],[role='menuitem'],[role='tab']";

  function rectsOf() {
    var out = [];
    var els = document.querySelectorAll(FOCUSABLE);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.disabled || el.getAttribute("aria-hidden") === "true") continue;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      out.push({ el: el, r: r });
    }
    return out;
  }

  function pick(dir, from) {
    var fx = from.x, fy = from.y, best = null, bestScore = Infinity;
    var cand = rectsOf();
    for (var i = 0; i < cand.length; i++) {
      var r = cand[i].r;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = cx - fx, dy = cy - fy;
      if (dir === "ArrowRight" && dx < 12) continue;
      if (dir === "ArrowLeft" && dx > -12) continue;
      if (dir === "ArrowDown" && dy < 12) continue;
      if (dir === "ArrowUp" && dy > -12) continue;
      var along = (dir === "ArrowLeft" || dir === "ArrowRight") ? Math.abs(dx) : Math.abs(dy);
      var cross = (dir === "ArrowLeft" || dir === "ArrowRight") ? Math.abs(dy) : Math.abs(dx);
      var score = along + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = cand[i]; }
    }
    return best;
  }

  var pendingFrom = null;
  document.addEventListener("keydown", function (e) {
    var dir = e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(dir) === -1) return;
    var ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;

    // remember where we were; only intervene if the page does nothing itself
    if (ae && ae !== document.body) {
      var r = ae.getBoundingClientRect();
      if (r.width >= 4 && r.height >= 4) pendingFrom = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    if (!pendingFrom) pendingFrom = { x: innerWidth / 2, y: innerHeight / 2 };

    var active = document.activeElement;
    setTimeout(function () {
      if (document.activeElement !== active) { pendingFrom = null; return; } // page handled it
      var hit = pick(dir, pendingFrom);
      pendingFrom = null;
      if (hit) {
        try { hit.el.focus({ preventScroll: false }); } catch (err) { hit.el.focus(); }
        hit.el.scrollIntoView({ block: "nearest", inline: "nearest" });
        e.preventDefault();
      }
    }, 0);
  }, true);

  /* ---- boot ---- */
  function boot() {
    sweep(document);
    startObserver();
    console.log("[WatchLuna mod] loaded; ad-block hosts:", BLOCK_HOSTS.length);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
