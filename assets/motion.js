/* ══════════════════════════════════════════════════════════════════
   motion.js — 动效系统
   Lenis 平滑滚动 + GSAP ScrollTrigger：视差 / 动态排版 / 横向翻页 /
   光标 / 跑马灯 / 漂浮文字 / 颗粒
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

  var desktop = window.matchMedia("(min-width: 981px)");
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
      if (lenis) lenis.scrollTo(target, { offset: -50, duration: 1.4 });
      else target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ── 2. HERO 入场 ─────────────────────────────────────────── */
  var heroTl = gsap.timeline({ delay: 0.9, defaults: { ease: "expo.out" } });
  heroTl
    .from(".hero__tl > *", { y: 18, opacity: 0, duration: 1.1, stagger: 0.07 })
    .from(".hero__tr .meta", { y: 14, opacity: 0, duration: 1, stagger: 0.06 }, "<0.1")
    .from(".hero__kicker", { y: 16, opacity: 0, duration: 1 }, "<")
    .from(".hero__title span", { yPercent: 26, opacity: 0, duration: 1.5 }, "<0.05")
    .from(".hero__sub", { y: 14, opacity: 0, duration: 1 }, "<0.25")
    .from(".hero__intro > *", { y: 16, opacity: 0, duration: 1, stagger: 0.08 }, "<0.1")
    .from(".hero__badge", { y: 14, opacity: 0, duration: 1 }, "<0.1")
    .from(".hero__scroll", { opacity: 0, duration: 1 }, "<0.1");

  /* ── 3. 通用渐显 ──────────────────────────────────────────── */
  gsap.set("[data-reveal]", { y: 26 });
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
  gsap.to(".hero__stage", {
    yPercent: 12,
    scale: 1.06,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".hero__grid", {
    yPercent: -6,
    opacity: 0.25,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  /* Kinetic typography：主标题随滚动横向漂移 */
  gsap.to(".hero__title", {
    xPercent: -5,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 }
  });

  /* ── 5. 跑马灯（无限横向动态排版） ────────────────────────── */
  var row = document.getElementById("marqueeRow");
  if (row) {
    gsap.to(row, { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
  }

  /* ── 6. ABOUT：巨大词层叠 / 背景视差 ─────────────────────── */
  gsap.to(".about__backdrop", {
    yPercent: -16,
    ease: "none",
    scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: true }
  });
  Array.prototype.forEach.call(document.querySelectorAll(".wordstack__w"), function (w, i) {
    gsap.fromTo(w,
      { xPercent: i % 2 === 0 ? -6 : 6 },
      {
        xPercent: i % 2 === 0 ? 3 : -3,
        ease: "none",
        scrollTrigger: { trigger: ".wordstack", start: "top bottom", end: "bottom top", scrub: true }
      });
  });

  /* ── 7. WORK：横向编辑式翻页 ─────────────────────────────── */
  var mm = gsap.matchMedia();
  mm.add("(min-width: 981px)", function () {
    var view = document.querySelector(".work__view");
    var rail = document.getElementById("workRail");
    if (!view || !rail) return;

    view.classList.add("is-pinned");
    var bar = document.getElementById("workBar");

    var dist = function () { return Math.max(0, rail.scrollWidth - view.clientWidth); };
    var tween = gsap.to(rail, {
      x: function () { return -dist(); },
      ease: "none",
      scrollTrigger: {
        trigger: ".work",
        start: "top top",
        end: function () { return "+=" + dist(); },
        pin: view,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          if (bar) bar.style.width = (self.progress * 100).toFixed(2) + "%";
        }
      }
    });

    return function () {
      view.classList.remove("is-pinned");
      if (bar) bar.style.width = "0%";
      if (tween.scrollTrigger) tween.scrollTrigger.kill();
      tween.kill();
      gsap.set(rail, { clearProps: "x" });
    };
  });

  /* 面板内容超出视口时，允许内部滚动（并让 Lenis 放行） */
  Array.prototype.forEach.call(document.querySelectorAll(".project__body"), function (b) {
    function check() {
      var over = b.scrollHeight > b.clientHeight + 4;
      b.classList.toggle("is-scroll", over);
      if (over) b.setAttribute("data-lenis-prevent", "");
      else b.removeAttribute("data-lenis-prevent");
    }
    b.style.maxHeight = "80svh";
    b.style.overflowY = "auto";
    b.style.scrollbarWidth = "none";
    check();
    ScrollTrigger.addEventListener("refresh", check);
  });

  /* ── 8. EXPERIENCE：年份横向滑入 ─────────────────────────── */
  Array.prototype.forEach.call(document.querySelectorAll(".xp__entry"), function (entry) {
    var year = entry.querySelector(".xp__year");
    if (!year) return;
    gsap.fromTo(year,
      { xPercent: -12, opacity: 0.2 },
      {
        xPercent: 0, opacity: 1, ease: "none",
        scrollTrigger: { trigger: entry, start: "top 92%", end: "top 45%", scrub: true }
      });
    var stats = entry.querySelectorAll(".xp__stats b");
    if (stats.length) {
      gsap.from(stats, {
        yPercent: 30, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.055,
        scrollTrigger: { trigger: entry.querySelector(".xp__stats"), start: "top 90%", once: true }
      });
    }
  });

  /* ── 9. CULTURE：漂浮文字 + 视差 ─────────────────────────── */
  var field = document.getElementById("cultureField");
  if (field) {
    var words = field.querySelectorAll("span");
    var stage = document.querySelector(".culture");
    Array.prototype.forEach.call(words, function (w, i) {
      var s = parseFloat(w.getAttribute("data-s") || "1");
      w.style.left = w.getAttribute("data-x") + "%";
      w.style.top = w.getAttribute("data-y") + "%";
      w.style.fontSize = "clamp(1.2rem," + (2.4 + s * 2.4).toFixed(1) + "vw," + (1.6 + s * 2.4).toFixed(1) + "rem)";

      gsap.fromTo(w, { yPercent: 0 }, {
        yPercent: -16 - s * 12,
        ease: "none",
        scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: true }
      });
      gsap.to(w, {
        y: "+=" + (10 + s * 10),
        duration: 4 + i * 0.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: i * 0.2
      });
      gsap.to(w, { x: "+=" + (i % 2 ? 12 : -12), duration: 6 + i * 0.4, ease: "sine.inOut", repeat: -1, yoyo: true });
    });
  }

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
  autoVideo(document.getElementById("contactVideo"));
  autoVideo(document.getElementById("oceanVideo"));

  /* ── 11. 自定义光标 ───────────────────────────────────────── */
  var cursor = document.getElementById("cursor");
  var label = document.getElementById("cursorLabel");
  if (cursor && label && fine.matches) {
    var xTo = gsap.quickTo(cursor, "x", { duration: 0.32, ease: "power3" });
    var yTo = gsap.quickTo(cursor, "y", { duration: 0.32, ease: "power3" });
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var shown = false;

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      xTo(mx); yTo(my);
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
    Array.prototype.forEach.call(document.querySelectorAll(".tbtn, .project__link, .folio__go"), function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        gsap.to(el, { x: dx * 9, y: dy * 5, duration: 0.4, ease: "power3" });
      });
      el.addEventListener("mouseleave", function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "expo.out" });
      });
    });
  }

  /* ── 13. 水波扭曲：section 交界处的装饰层 ─────────────────── */
  gsap.utils.toArray(".culture, .contact").forEach(function (sec) {
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
