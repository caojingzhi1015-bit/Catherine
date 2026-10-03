/* ══════════════════════════════════════════════════════════════════
   app.js — 配置注入 / 中英双语 / 导航状态 / 渐显标记
   不依赖任何 CDN，纯原生 JS。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var root = document.documentElement;
  var cfg = window.SITE_CONFIG || {};

  /* ── 1. 视频源：按视口 + 编码支持挑文件
         （不用 <source media>，避免 Chrome 源选择直接失败） ── */
  (function setupVideos() {
    var small = window.matchMedia("(max-width: 900px)").matches;
    var probe = document.createElement("video");
    var canWebm = probe.canPlayType('video/webm; codecs="vp9"') !== "";
    ["oceanVideo", "contactVideo"].forEach(function (id) {
      var v = document.getElementById(id);
      if (!v) return;
      var src = small ? v.getAttribute("data-src-sm") : v.getAttribute("data-src");
      if (!src) return;
      if (canWebm) src = src.replace(/\.mp4$/, ".webm");   // 优先 VP9，MP4 兜底
      v.setAttribute("src", src);
      v.setAttribute("preload", "auto");
      try { v.load(); } catch (e) {}
    });
  })();

  /* ── 2. 配置注入：联系方式集中定义，页面只读配置 ───────────── */
  function setText(id, txt) {
    var el = document.getElementById(id);
    if (el && txt) el.textContent = txt;
  }

  if (cfg.email) {
    var mail = document.querySelector('[data-contact="email"]');
    if (mail) mail.setAttribute("href", "mailto:" + cfg.email);
    setText("cEmail", cfg.email);
  }
  if (cfg.phone) {
    var tel = document.querySelector('[data-contact="phone"]');
    if (tel) tel.setAttribute("href", "tel:" + cfg.phone);
    setText("cPhone", cfg.phone);
  }
  function wire(key, id) {
    var v = cfg[key];
    var el = document.querySelector('[data-contact="' + key + '"]');
    if (!v || !v.url) { if (el) el.style.display = "none"; return; }
    if (el) { el.setAttribute("href", v.url); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
    setText(id, v.label || v.url);
  }
  wire("portfolio", "cPortfolio");
  wire("github", "cGithub");
  wire("instagram", "cInstagram");
  wire("weibo", "cWeibo");

  var dl = document.querySelector(".crow--dl");
  if (dl && cfg.resume) dl.setAttribute("href", cfg.resume);

  /* ── 3. 中英双语 ──────────────────────────────────────────── */
  var STORE_LANG = "jsc-lang";
  var langToggle = document.getElementById("langToggle");
  var nodes = document.querySelectorAll("[data-en]");
  var titleEl = document.querySelector("title[data-en]");

  Array.prototype.forEach.call(nodes, function (el) {
    if (!el.hasAttribute("data-zh")) el.setAttribute("data-zh", el.textContent.trim());
  });
  if (titleEl && !titleEl.hasAttribute("data-zh")) {
    titleEl.setAttribute("data-zh", titleEl.textContent.trim());
  }

  function applyLang(lang) {
    Array.prototype.forEach.call(nodes, function (el) {
      var t = el.getAttribute(lang === "en" ? "data-en" : "data-zh");
      if (t) el.textContent = t;
    });
    root.setAttribute("lang", lang === "en" ? "en" : "zh-CN");
    if (langToggle) langToggle.textContent = lang === "en" ? "中文" : "EN";
    if (titleEl) {
      titleEl.textContent = titleEl.getAttribute(lang === "en" ? "data-en" : "data-zh");
    }
  }

  var saved = null;
  try { saved = localStorage.getItem(STORE_LANG); } catch (e) { saved = null; }
  applyLang(saved === "en" ? "en" : "zh");

  if (langToggle) {
    langToggle.addEventListener("click", function () {
      var next = root.getAttribute("lang") === "zh-CN" ? "en" : "zh";
      applyLang(next);
      try { localStorage.setItem(STORE_LANG, next); } catch (e) {}
    });
  }

  /* ── 4. 标记渐显元素（在首帧之前完成，避免闪白） ───────────── */
  var REVEAL = [
    ".practice__intro", ".folio__intro", ".lab__intro",
    ".sec-head",
    ".about__title", ".about__body", ".about__portrait",
    ".wordstack__w",
    ".track",
    ".xp__head", ".xp__stats", ".xp__duties",
    ".folio__item", ".cap", ".caps__lang",
    ".culture__title", ".culture__note",
    ".lab__title", ".lab__item",
    ".contact__title", ".crow", ".contact__sign"
  ];
  var stagger = [".wordstack", ".xp__stats", ".folio__grid", ".tracks", ".caps__grid", ".lab__list", ".culture__title"];
  Array.prototype.forEach.call(document.querySelectorAll(REVEAL.join(",")), function (el) {
    if (!el.hasAttribute("data-reveal")) el.setAttribute("data-reveal", "");
  });
  Array.prototype.forEach.call(document.querySelectorAll(stagger.join(",")), function (group) {
    Array.prototype.forEach.call(group.children, function (c, i) {
      c.style.setProperty("--d", (i % 6) * 70 + "ms");
    });
  });

  /* ── 5. 导航：吸顶 + 当前章节高亮 ─────────────────────────── */
  var masthead = document.getElementById("masthead");
  var navLinks = document.querySelectorAll(".masthead__nav a");
  var sections = [];
  Array.prototype.forEach.call(navLinks, function (a) {
    var id = a.getAttribute("href");
    if (id && id.charAt(0) === "#") {
      var sec = document.querySelector(id);
      if (sec) sections.push({ el: sec, a: a });
    }
  });

  var lastY = -1;
  var current = null;
  function syncNav() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (masthead) {
      if (y > 40 && !masthead.classList.contains("is-stuck")) masthead.classList.add("is-stuck");
      else if (y <= 40 && masthead.classList.contains("is-stuck")) masthead.classList.remove("is-stuck");
    }
    /* 当前章节 = 最后一个「顶端已越过视口中线」的章节 */
    var mid = y + window.innerHeight * 0.42;
    var hit = null;
    for (var i = 0; i < sections.length; i++) {
      var top = sections[i].el.getBoundingClientRect().top + y;
      if (top <= mid) hit = sections[i];
    }
    if (hit !== current) {
      if (current) current.a.classList.remove("is-active");
      if (hit) hit.a.classList.add("is-active");
      current = hit;
    }
    lastY = y;
  }
  window.addEventListener("scroll", syncNav, { passive: true });
  window.addEventListener("resize", syncNav);
  syncNav();

  /* ── 6. 卷首过场：JS 就绪即收幕 ───────────────────────────── */
  var preload = document.getElementById("preload");
  if (preload) {
    var done = function () { preload.classList.add("is-done"); };
    if (document.readyState === "complete") done();
    else window.addEventListener("load", done);
    setTimeout(done, 2600);   // 兜底：无论如何最长 2.6s
  }

  /* ── 7. 兜底：若动效库没加载成功，让所有内容可见 ─────────── */
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!window.__jscMotionReady) root.classList.add("no-anim");
    }, 1200);
  });
})();
