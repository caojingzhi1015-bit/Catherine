/* ══════════════════════════════════════════════════════════════════
   motion.js — 动效系统
   Lenis 平滑滚动 + GSAP ScrollTrigger：
   视差 / 动态排版 / 项目 Hover 预览 / 漂浮关键词 / 光标 / 跑马灯 / 颗粒
   全部动效都是「增强」：库不可用时自动降级为静态可读页面。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!window.gsap || !window.ScrollTrigger || reduce) {
    root.classList.add("no-anim");
    window.__jscMotionReady = true;
    return;
  }

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);
  var ScrollTrigger = window.ScrollTrigger;

  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ── 1. 平滑滚动 ──────────────────────────────────────────── */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      lerp: null
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* 锚点点击 → 平滑滚动 */
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -78, duration: 1.4 });
      else window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 78, behavior: "smooth" });
    });
  });

  /* ── 2. HERO 入场 ─────────────────────────────────────────── */
  if (document.querySelector(".hero__title")) {
    var heroTl = gsap.timeline({ delay: 0.85, defaults: { ease: "expo.out" } });
    heroTl
      .from(".hero__tl > *", { y: 16, opacity: 0, duration: 1.1, stagger: 0.07 })
      .from(".hero__tr .meta", { y: 12, opacity: 0, duration: 1, stagger: 0.06 }, "<0.1")
      .from(".hero__kicker", { y: 14, opacity: 0, duration: 1 }, "<")
      .from(".hero__title span", { yPercent: 26, opacity: 0, duration: 1.5 }, "<0.05")
      .from(".hero__sub", { y: 12, opacity: 0, duration: 1 }, "<0.25")
      .from(".hero__intro > *", { y: 14, opacity: 0, duration: 1, stagger: 0.08 }, "<0.1")
      .from(".hero__badge", { y: 12, opacity: 0, duration: 1 }, "<0.1")
      .from(".hero__scroll", { opacity: 0, duration: 1 }, "<0.1");
  }

  /* ── 3. 通用渐显 ──────────────────────────────────────────── */
  gsap.set("[data-reveal]", { y: 24 });
  ScrollTrigger.batch("[data-reveal]", {
    interval: 0.12,
    batchMax: 8,
    start: "top 88%",
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 1.05,
        ease: "expo.out",
        stagger: 0.075,
        overwrite: true
      });
    }
  });

  /* ── 4. 首屏视差 ─────────────────────────────────────────── */
  if (document.querySelector(".hero__grid")) {
    gsap.to(".hero__grid", {
      yPercent: -7,
      opacity: 0.22,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
    /* Kinetic typography：主标题随滚动横向漂移 */
    gsap.to(".hero__title", {
      xPercent: -5,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 }
    });
    gsap.to(".hero__tl", {
      yPercent: -16,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  }

  /* ── 5. 跑马灯（无限横向动态排版） ────────────────────────── */
  var row = document.getElementById("marqueeRow");
  if (row) {
    gsap.to(row, { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
  }

  /* ── 6. 时间线：数字轻微横向滑入 ─────────────────────────── */
  Array.prototype.forEach.call(document.querySelectorAll(".tl__row"), function (r) {
    var hit = r.querySelector(".tl__hit");
    if (!hit) return;
    gsap.fromTo(hit,
      { xPercent: -10, opacity: 0.25 },
      {
        xPercent: 0, opacity: 1, ease: "none",
        scrollTrigger: { trigger: r, start: "top 94%", end: "top 55%", scrub: true }
      });
  });

  /* ── 7. PROJECTS：Hover 浮动预览（跟随鼠标 + 惯性） ───────── */
  if (fine.matches) {
    Array.prototype.forEach.call(document.querySelectorAll(".prow"), function (prow) {
      var thumb = prow.querySelector(".prow__thumb");
      if (!thumb) return;

      var tx = 0, ty = 0, cx = 0, cy = 0, active = false, raf = false;

      function loop() {
        if (!active) { raf = false; return; }
        cx += (tx - cx) * 0.13;
        cy += (ty - cy) * 0.13;
        gsap.set(thumb, { x: cx, y: cy, xPercent: -50, yPercent: -50 });
        requestAnimationFrame(loop);
      }

      prow.addEventListener("mouseenter", function (e) {
        tx = cx = e.clientX;
        ty = cy = e.clientY;
        active = true;
        thumb.classList.add("is-on");
        gsap.set(thumb, { x: cx, y: cy, xPercent: -50, yPercent: -50, scale: 1 });
        if (!raf) { raf = true; requestAnimationFrame(loop); }
      });

      prow.addEventListener("mouseleave", function () {
        active = false;
        thumb.classList.remove("is-on");
      });

      prow.addEventListener("mousemove", function (e) {
        tx = e.clientX;
        ty = e.clientY;
      });
    });
  }

  /* ── 8. SKILLS：漂浮关键词（原文化板块动效迁移而来） ─────── */
  var field = document.getElementById("skillField");
  if (field) {
    var words = field.querySelectorAll("span");
    var stage = document.querySelector(".skills");
    Array.prototype.forEach.call(words, function (w, i) {
      var s = parseFloat(w.getAttribute("data-s") || "1");
      w.style.left = w.getAttribute("data-x") + "%";
      w.style.top = w.getAttribute("data-y") + "%";
      w.style.fontSize = "clamp(1rem," + (1.9 + s * 2.0).toFixed(1) + "vw," + (1.3 + s * 2.1).toFixed(1) + "rem)";

      gsap.fromTo(w, { yPercent: 0 }, {
        yPercent: -14 - s * 11,
        ease: "none",
        scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: true }
      });
      gsap.to(w, {
        y: "+=" + (9 + s * 9),
        duration: 4 + i * 0.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: i * 0.2
      });
      gsap.to(w, { x: "+=" + (i % 2 ? 11 : -11), duration: 6 + i * 0.4, ease: "sine.inOut", repeat: -1, yoyo: true });
    });
  }

  /* ── 9. 项目详情页：标题先出现 → 大图 reveal → 正文渐次 ──── */
  if (document.querySelector(".case__title")) {
    var caseTl = gsap.timeline({ delay: 0.25, defaults: { ease: "expo.out" } });
    caseTl
      .from(".case__back", { y: 10, opacity: 0, duration: .8 })
      .from(".case__no", { y: 10, opacity: 0, duration: .8 }, "<0.05")
      .from(".case__title", { yPercent: 12, opacity: 0, duration: 1.3 }, "<0.05")
      .from(".case__sub", { y: 12, opacity: 0, duration: .9 }, "<0.25")
      .from(".case__daterow", { y: 10, opacity: 0, duration: .8 }, "<0.1")
      .from(".case__tags", { y: 10, opacity: 0, duration: .8 }, "<0.05");
  }
  Array.prototype.forEach.call(document.querySelectorAll(".case__figure img"), function (img) {
    gsap.fromTo(img,
      { scale: 1.08 },
      {
        scale: 1, ease: "none",
        scrollTrigger: { trigger: img, start: "top bottom", end: "bottom top", scrub: true }
      });
  });

  /* ── 10. 视频：进入视口才播放 ─────────────────────────────── */
  function autoVideo(v) {
    if (!v || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.1 });
    io.observe(v);
  }
  autoVideo(document.getElementById("oceanVideo"));

  /* ── 10. 场景内的轻微纵深：卡片与场景背景反向错位 ─────────── */
  [".about__top", ".tl", ".folio__grid", ".skills__grid", ".contact__rows"].forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el,
      { yPercent: 2.2 },
      {
        yPercent: -2.2, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
      });
  });

  /* ── 11. 自定义光标 ───────────────────────────────────────── */
  var cursor = document.getElementById("cursor");
  var label = document.getElementById("cursorLabel");
  if (cursor && label && fine.matches) {
    var xTo = gsap.quickTo(cursor, "x", { duration: 0.32, ease: "power3" });
    var yTo = gsap.quickTo(cursor, "y", { duration: 0.32, ease: "power3" });
    var shown = false;

    window.addEventListener("mousemove", function (e) {
      xTo(e.clientX); yTo(e.clientY);
      if (!shown) { shown = true; cursor.classList.add("is-on"); }
    }, { passive: true });
    window.addEventListener("mouseout", function () { cursor.classList.remove("is-on"); shown = false; });

    Array.prototype.forEach.call(document.querySelectorAll("[data-cursor]"), function (el) {
      el.addEventListener("mouseenter", function () {
        label.textContent = el.getAttribute("data-cursor") || "VIEW";
        cursor.classList.add("is-label");
      });
      el.addEventListener("mouseleave", function () {
        cursor.classList.remove("is-label");
      });
    });
  }

  /* ── 12. 磁吸按钮 ─────────────────────────────────────────── */
  if (fine.matches) {
    Array.prototype.forEach.call(document.querySelectorAll(".tbtn, .folio__go, .case__back"), function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        gsap.to(el, { x: dx * 8, y: dy * 4, duration: 0.4, ease: "power3" });
      });
      el.addEventListener("mouseleave", function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "expo.out" });
      });
    });
  }

  /* ── 13. 水波扭曲：section 交界处的装饰层 ─────────────────── */
  gsap.utils.toArray(".skills, .contact").forEach(function (sec) {
    ScrollTrigger.create({
      trigger: sec,
      start: "top bottom",
      end: "top top",
      onUpdate: function (self) {
        sec.style.setProperty("--ripple", self.progress.toFixed(3));
      }
    });
  });

  /* ── 14. 布局刷新 ─────────────────────────────────────────── */
  window.__jscMotionReady = true;
  var refreshTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 220);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener("load", function () { setTimeout(function () { ScrollTrigger.refresh(); }, 300); });
})();
