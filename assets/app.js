/* ══════════════════════════════════════════════════════════════════
   app.js — 配置注入 / 中英双语 / 导航状态 / 渐显标记
   不依赖任何 CDN，纯原生 JS。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var root = document.documentElement;
  var cfg = window.SITE_CONFIG || {};

  /* ── 1. 海洋视频的源选择由 assets/scenes.js 统一负责 ───────── */

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

  /* 用 innerHTML 保存/还原，避免抹掉标题里的 <em> 等内联标签 */
  Array.prototype.forEach.call(nodes, function (el) {
    if (!el.hasAttribute("data-zh")) el.setAttribute("data-zh", el.innerHTML.trim());
  });
  if (titleEl && !titleEl.hasAttribute("data-zh")) {
    titleEl.setAttribute("data-zh", titleEl.textContent.trim());
  }

  function applyLang(lang) {
    Array.prototype.forEach.call(nodes, function (el) {
      var t = el.getAttribute(lang === "en" ? "data-en" : "data-zh");
      if (t) el.innerHTML = t;
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
    ".sec-head",
    ".about__top", ".about__title", ".about__portrait", ".about__body",
    ".tl__head", ".tl__row",
    ".proj__title", ".proj__intro", ".prow",
    ".folio__intro", ".folio__item",
    ".skills__title", ".skill", ".skills__lang",
    ".contact__title", ".crow",
    ".case__sec", ".case__cta", ".case__next"
  ];
  var stagger = [".tl__list", ".ptable", ".folio__grid", ".skills__grid"];
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
    var done = function () {
      if (preload.classList.contains("is-done")) return;
      preload.classList.add("is-done");
      /* 卷首幕布收起后，才让首屏大标题的字母依次入场 */
      root.classList.add("is-ready");
    };
    if (document.readyState === "complete") done();
    else window.addEventListener("load", done);
    setTimeout(done, 2600);   // 兜底：无论如何最长 2.6s
  } else {
    root.classList.add("is-ready");
  }

  /* ── 7. 兜底：若动效库没加载成功，让所有内容可见 ─────────── */
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!window.__jscMotionReady) root.classList.add("no-anim");
    }, 1200);
  });

  /* ── 8. 刷新后统一从顶部开始（避免浏览器恢复滚动位置，
        直接落进几乎全黑的水下场景，看起来像「刷新变黑」） ──── */
  try { if (history.scrollRestoration) history.scrollRestoration = "manual"; } catch (e) {}
  if (!window.location.hash) {
    try { window.scrollTo(0, 0); } catch (e) {}
    window.addEventListener("load", function () {
      if (!window.location.hash) { try { window.scrollTo(0, 0); } catch (e) {} }
    });
  }

  /* ── 9. 能力板块：卡片鼠标跟随光晕（只写 CSS 变量） ──────── */
  Array.prototype.forEach.call(document.querySelectorAll(".skills__grid .skill"), function (card) {
    card.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  });
})();
