/* ══════════════════════════════════════════════════════════════════
   scenes.js — 沉浸式海洋场景引擎
   ──────────────────────────────────────────────────────────────────
   四个连续场景，由一个固定全屏 WebGL 画布渲染，滚动进度 uS 驱动混合：
     s 0 → 1  海滩   BEACH    （海浪视频为底，阳光碎光）
     s 1 → 2  水面   SURFACE  （程序化焦散 Caustics）
     s 2 → 3  水滴   DROPLET  （深水 + 微焦散）
     s 3 → 4  水下   DEEP     （丁达尔光束 + 悬浮微粒 → 潜入黑暗）
   段与段之间用 smoothstep 权重叠加，没有硬边界。

   玻璃立方体是贯穿元素：小圆角（有棱角）、中性无色、屏幕空间折射
   （Screen-space Refraction）+ 三通道色散 + Fresnel 白色细边，
   背面 / 正面两个 Mesh 分层叠加渲染。可拖拽旋转，松手带惯性，闲置缓慢漂移。

   WebGL2 不可用 / prefers-reduced-motion / 窄屏 → 回退到 <video> + CSS 渐变。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var ocean = document.getElementById("ocean");
  var canvas = document.getElementById("oceanCanvas");
  var video = document.getElementById("oceanVideo");
  var handle = document.getElementById("cubeHandle");
  if (!ocean || !canvas || !video) return;

  var doc = document.documentElement;
  var mk = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };
  var reduce = mk("(prefers-reduced-motion: reduce)");
  var wide = mk("(min-width: 981px)");
  var hasGL = (function () {
    try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
  })();

  /* ══════════════════════════════════════════════════════════════
     一、场景进度（与 WebGL 无关，回退路径同样需要）
     ══════════════════════════════════════════════════════════════ */
  var SCENES = ["hero", "about", "projects", "skills"];
  var keys = [0, 0, 0, 0];
  var endY = 1;

  function measure() {
    var y = window.pageYOffset || doc.scrollTop || 0;
    for (var i = 0; i < SCENES.length; i++) {
      var el = document.getElementById(SCENES[i]);
      keys[i] = el ? el.getBoundingClientRect().top + y : 0;
    }
    /* 四段之间若顺序异常，兜底为等距，避免 NaN */
    for (var j = 1; j < 4; j++) if (keys[j] <= keys[j - 1]) keys[j] = keys[j - 1] + 1;
    endY = Math.max(1, doc.scrollHeight - window.innerHeight);
  }

  function rawS() {
    var y = window.pageYOffset || doc.scrollTop || 0;
    if (y <= keys[0]) return 0;
    if (y >= keys[3]) return 3;
    for (var i = 0; i < 3; i++) {
      if (y < keys[i + 1]) {
        var t = (y - keys[i]) / Math.max(1, keys[i + 1] - keys[i]);
        return i + Math.min(1, Math.max(0, t));
      }
    }
    return 3;
  }

  var S = 0;          /* 平滑后的场景值 0..3 */
  var STarget = 0;
  var endT = 0, endTarget = 0;

  function readScroll() {
    STarget = rawS();
    var y = window.pageYOffset || doc.scrollTop || 0;
    endTarget = Math.min(1, Math.max(0, (y / endY - 0.78) / 0.22));
  }

  var lastMode = "";
  function syncMode(s) {
    var mode = s < 1.45 ? "light" : "dark";
    var band = String(Math.round(Math.min(3, Math.max(0, s))));
    if (mode !== lastMode) {
      document.body.classList.remove("is-light", "is-dark");
      document.body.classList.add(mode === "light" ? "is-light" : "is-dark");
      lastMode = mode;
    }
    if (document.body.getAttribute("data-scene") !== band) {
      document.body.setAttribute("data-scene", band);
    }
  }

  measure();
  readScroll();
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", function () { measure(); readScroll(); });
  window.addEventListener("load", function () { measure(); readScroll(); });

  /* 视频源：VP9 WebM 优先，MP4 兜底。WebGL 与回退两条路径共用。 */
  (function setupVideo() {
    var small = window.innerWidth <= 900;
    var src = small ? video.getAttribute("data-src-sm") : video.getAttribute("data-src");
    var probe = document.createElement("video");
    var webm = probe.canPlayType && probe.canPlayType('video/webm; codecs="vp9"') !== "";
    if (src && webm) src = src.replace(/\.mp4$/, ".webm");
    if (!src) return;
    video.setAttribute("src", src);
    video.setAttribute("preload", "auto");
    try { video.load(); } catch (e) {}
  })();

  /* ══════════════════════════════════════════════════════════════
     二、回退路径（WebGL 是增强，不是内容生存的前提）
     —— 无论什么原因失败，页面都保持「海浪 + 巨大字体 + 完整内容」
     ══════════════════════════════════════════════════════════════ */
  var fbRaf = 0;
  function fallback(reason) {
    if (reason) console.warn("[scenes] 回退到静态海浪：", reason);
    if (ocean.classList.contains("ocean--fallback")) return;
    ocean.classList.remove("ocean--webgl");
    ocean.classList.add("ocean--fallback");
    canvas.style.display = "none";
    try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    if (fbRaf) return;                       /* 回退循环只允许存在一条 */
    (function tick() {
      fbRaf = requestAnimationFrame(tick);
      var t = (S += (STarget - S) * 0.12);
      endT += (endTarget - endT) * 0.12;
      syncMode(t);
      ocean.style.setProperty("--end", endT.toFixed(3));
    })();
  }

  /* 移动端不再直接放弃 WebGL：与桌面同一视觉系统，只是降分辨率。
     真正跑不动时由「首帧看门狗 + 帧率看门狗」降级回静态海浪。 */
  if (reduce || !hasGL) { fallback(!hasGL ? "no webgl2" : "reduced-motion"); return; }

  /* ══════════════════════════════════════════════════════════════
     三、WebGL 场景
     ══════════════════════════════════════════════════════════════ */
  var booting = false;
  function loadScene() {
    if (booting) return;
    booting = true;
    Promise.all([
      import("three"),
      import("three/addons/geometries/RoundedBoxGeometry.js")
    ]).then(function (mods) {
      try { boot(mods[0], mods[1].RoundedBoxGeometry); }
      catch (err) { booting = false; fallback(err && err.message); }
    }).catch(function (err) {
      booting = false;
      fallback(err && err.message);
    });
  }
  loadScene();

  /* bfcache 恢复（前进 / 后退回来）：WebGL 资源已在 pagehide 被释放，
     必须重新初始化，否则会留下一个黑屏的死画布。 */
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    if (ocean.classList.contains("ocean--fallback")) return;
    try { location.reload(); } catch (err) {}
  });

  function boot(THREE, RoundedBoxGeometry) {
    /* 画质档位：窄屏 / 低核数设备只降分辨率与抗锯齿，视觉语言不变 */
    var lowPower = !wide || (navigator.hardwareConcurrency || 4) <= 4;
    var DPR = lowPower ? 1 : 1.5;

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !lowPower,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;               /* 两遍渲染，手动清屏 */

    /* ── 视频纹理（海滩场景的底色） ─────────────────────────── */
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    var vtex = new THREE.VideoTexture(video);
    vtex.colorSpace = THREE.NoColorSpace;     /* 直接按显示空间采样，不做二次转换 */
    vtex.minFilter = THREE.LinearFilter;
    vtex.magFilter = THREE.LinearFilter;
    vtex.generateMipmaps = false;

    /* ══ 全屏画布：一个三角形覆盖整屏 ════════════════════════ */
    var quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var oceanU = {
      uTime: { value: 0 },
      uS: { value: 0 },
      uEnd: { value: 0 },
      uAspect: { value: 1 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uVideo: { value: vtex },
      uHasVideo: { value: 0 },
      uVidAspect: { value: 16 / 9 }
    };

    var oceanMat = new THREE.ShaderMaterial({
      uniforms: oceanU,
      depthTest: false,
      depthWrite: false,
      vertexShader: [
        "varying vec2 vUv;",
        "void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }"
      ].join("\n"),
      fragmentShader: FRAG
    });

    var quadScene = new THREE.Scene();
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), oceanMat);
    quad.frustumCulled = false;
    quadScene.add(quad);

    /* ══ 离屏缓冲：先把「不含玻璃的背景」渲染一遍 ════════════ */
    var rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false
    });
    rt.texture.colorSpace = THREE.NoColorSpace;

    /* ══ 玻璃：中性、无色、只有 Fresnel 白色细边 ═════════════ */
    var glassU = {
      uScene: { value: rt.texture },
      uRefract: { value: 0.105 },
      uDispersion: { value: 0.095 },
      uFresnel: { value: 2.6 },
      uOpacity: { value: 1 }
    };

    function glassMaterial(side) {
      return new THREE.ShaderMaterial({
        uniforms: glassU,                  /* 两块 Mesh 共享同一组 uniform */
        side: side,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: [
          "varying vec3 vN;",
          "varying vec3 vViewPos;",
          "varying vec4 vClip;",
          "void main(){",
          "  vN = normalize(normalMatrix * normal);",
          "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
          "  vViewPos = mv.xyz;",
          "  vClip = projectionMatrix * mv;",
          "  gl_Position = vClip;",
          "}"
        ].join("\n"),
        fragmentShader: [
          "uniform sampler2D uScene;",
          "uniform float uRefract, uDispersion, uFresnel, uOpacity;",
          "varying vec3 vN;",
          "varying vec3 vViewPos;",
          "varying vec4 vClip;",
          "void main(){",
          "  vec3 N = normalize(vN);",
          "  vec3 V = normalize(-vViewPos);",
          "  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);",
          /* Fresnel：正视近乎透明，掠射处才亮 —— 这是玻璃「有棱角」的来源 */
          "  float fres = pow(1.0 - ndv, uFresnel);",
          "  vec2 uv = (vClip.xy / vClip.w) * 0.5 + 0.5;",
          "  vec2 off = N.xy * uRefract * (0.26 + 0.74 * (1.0 - ndv));",
          "  float d = uDispersion * (0.30 + fres);",
          "  vec3 col;",
          "  col.r = texture2D(uScene, uv + off * (1.0 + d)).r;",
          "  col.g = texture2D(uScene, uv + off).g;",
          "  col.b = texture2D(uScene, uv + off * (1.0 - d)).b;",
          "  col *= 1.06;",
          /* 边缘一线细白高光，不带任何固有蓝 */
          "  float edge = clamp(fres * 1.45, 0.0, 1.0);",
          "  col = mix(col, vec3(0.965, 0.995, 1.0), edge * 0.90);",
          "  float alpha = mix(0.30, 1.0, smoothstep(0.02, 0.74, edge));",
          "  gl_FragColor = vec4(col, alpha * uOpacity);",
          "}"
        ].join("\n")
      });
    }

    var glassGeo = new RoundedBoxGeometry(1, 1, 1, 5, 0.055);
    var cubeBack = new THREE.Mesh(glassGeo, glassMaterial(THREE.BackSide));
    var cubeFront = new THREE.Mesh(glassGeo, glassMaterial(THREE.FrontSide));
    cubeBack.renderOrder = 1;
    cubeFront.renderOrder = 2;
    cubeBack.frustumCulled = false;
    cubeFront.frustumCulled = false;

    var cubePivot = new THREE.Group();
    cubePivot.add(cubeBack);
    cubePivot.add(cubeFront);
    var cubeScene = new THREE.Scene();
    cubeScene.add(cubePivot);

    var cubeCam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cubeCam.position.set(0, 0, 4);

    /* ── 视频就绪判定：只在真正可渲染时才采样 VideoTexture ── */
    function videoUsable() {
      return video.readyState >= 2 /* HAVE_CURRENT_DATA */ && video.videoWidth > 0;
    }
    function syncVideo() {
      if (videoUsable()) {
        oceanU.uVidAspect.value = video.videoWidth / video.videoHeight;
        oceanU.uHasVideo.value = 1;
      } else {
        oceanU.uHasVideo.value = 0;   /* 未就绪 → 走程序化海面，绝不采样空纹理 */
      }
    }

    /* ── 尺寸 ───────────────────────────────────────────────── */
    var aspect = 1;
    var resizePending = 0;
    function resizeNow() {
      resizePending = 0;
      var w = window.innerWidth, h = window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, DPR);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      aspect = w / Math.max(1, h);
      cubeCam.aspect = aspect;
      cubeCam.updateProjectionMatrix();
      rt.setSize(Math.max(2, Math.round(w * dpr)), Math.max(2, Math.round(h * dpr)));
      oceanU.uAspect.value = aspect;
      syncVideo();
    }
    function resize() {                       /* resize 合并到下一帧，避免抖动 */
      if (resizePending) return;
      resizePending = requestAnimationFrame(resizeNow);
    }
    resizeNow();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    ["loadedmetadata", "loadeddata", "canplay", "playing"].forEach(function (ev) {
      video.addEventListener(ev, syncVideo);
    });
    ["error", "stalled", "abort", "emptied"].forEach(function (ev) {
      video.addEventListener(ev, function () { oceanU.uHasVideo.value = 0; });
    });

    /* ── WebGL 上下文丢失 / 恢复：绝不留下永久黑屏 ─────────── */
    var contextLost = false;
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();                    /* 允许后续 restore */
      contextLost = true;
      stopLoop();
    }, false);
    canvas.addEventListener("webglcontextrestored", function () {
      contextLost = false;
      try { resizeNow(); } catch (err) {}
      startLoop();
    }, false);

    /* ── 鼠标视差 ───────────────────────────────────────────── */
    var mx = 0, my = 0, tmx = 0, tmy = 0;
    window.addEventListener("mousemove", function (e) {
      tmx = (e.clientX / window.innerWidth - 0.5) * 2;
      tmy = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    /* ── 拖拽旋转（惯性 + 闲置漂移） ─────────────────────────── */
    var drag = { on: false, lx: 0, ly: 0, vx: 0, vy: 0, rx: 0.32, ry: -0.62, idle: 99 };
    if (handle) {
      handle.addEventListener("pointerdown", function (e) {
        drag.on = true;
        drag.lx = e.clientX; drag.ly = e.clientY;
        drag.vx = 0; drag.vy = 0; drag.idle = 0;
        ocean.classList.add("is-dragging");
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      window.addEventListener("pointermove", function (e) {
        if (!drag.on) return;
        var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
        drag.lx = e.clientX; drag.ly = e.clientY;
        drag.ry += dx * 0.0080;
        drag.rx += dy * 0.0064;
        drag.vx = dx * 0.0080;
        drag.vy = dy * 0.0064;
        drag.idle = 0;
      }, { passive: true });
      var end = function () {
        if (!drag.on) return;
        drag.on = false;
        ocean.classList.remove("is-dragging");
      };
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    }

    /* ── 立方体在各场景中的位置 / 大小 / 透明度 ────────────── */
    function cubeAt(s) {
      var pts = [
        { x: 1.72, y: 0.02, sc: 1.00, op: 1.00 },   /* 0 海滩：右侧 */
        { x: 2.34, y: -0.72, sc: 1.04, op: 0.72 },  /* 1 水面：沉到右下角，不挡文字 */
        { x: 1.95, y: 0.72, sc: 1.08, op: 0.94 },   /* 2 水滴：浮到右上，成为核心 */
        { x: 1.05, y: -2.10, sc: 1.26, op: 0.00 }   /* 3 水下：下沉、消散 */
      ];
      var i = Math.min(2, Math.max(0, Math.floor(s)));
      var t = Math.min(1, Math.max(0, s - i));
      t = t * t * (3 - 2 * t);
      var a = pts[i], b = pts[i + 1];
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        sc: a.sc + (b.sc - a.sc) * t,
        op: a.op + (b.op - a.op) * t
      };
    }

    /* ── 主循环：全生命周期只有这一条 RAF ───────────────────── */
    var clock = new THREE.Clock();
    var pageHidden = document.hidden === true;
    var raf = 0;
    var frames = 0;
    var slowFrames = 0;

    function frame() {
      raf = requestAnimationFrame(frame);
      if (pageHidden || contextLost) { clock.getDelta(); return; }
      frames++;

      var dt = Math.min(0.05, clock.getDelta());
      var t = clock.elapsedTime;

      /* 看门狗 2：跑得太慢（<22fps）→ 降级到静态海浪，别让手机烫成幻灯片 */
      if (frames > 60 && frames < 400 && dt > 0.045) slowFrames++;
      if (frames === 400 && slowFrames > 120) { stopLoop(); fallback("帧率过低"); return; }

      /* 平滑场景进度（比原生滚动更柔和，天然消除硬切） */
      S += (STarget - S) * Math.min(1, dt * 6.5);
      endT += (endTarget - endT) * Math.min(1, dt * 4.0);
      syncMode(S);

      mx += (tmx - mx) * Math.min(1, dt * 4);
      my += (tmy - my) * Math.min(1, dt * 4);

      oceanU.uTime.value = t;
      oceanU.uS.value = S;
      oceanU.uEnd.value = endT;
      oceanU.uMouse.value.set(mx, my);

      /* 立方体姿态 */
      var c = cubeAt(S);
      if (!drag.on) {
        drag.ry += drag.vx; drag.rx += drag.vy;
        drag.vx *= 0.955; drag.vy *= 0.955;
        drag.idle += dt;
        var calm = Math.min(1, Math.max(0, drag.idle / 4));
        drag.ry += dt * 0.085 * calm * calm;
        drag.rx += Math.sin(t * 0.26) * dt * 0.055 * calm;
      } else {
        drag.idle = 0;
      }
      cubePivot.rotation.set(drag.rx + my * 0.10, drag.ry - mx * 0.16, Math.sin(t * 0.21) * 0.05);
      cubePivot.position.set(
        c.x + mx * 0.10,
        c.y + Math.sin(t * 0.52) * 0.055 - my * 0.06,
        0
      );
      cubePivot.scale.setScalar(c.sc);
      glassU.uOpacity.value = Math.max(0, Math.min(1, c.op));
      var shown = c.op > 0.02;
      cubeBack.visible = shown;
      cubeFront.visible = shown;

      /* 拖拽手柄的可用状态 */
      if (handle) {
        var live = c.op > 0.35 && S < 2.7;
        if (handle.classList.contains("is-live") !== live) handle.classList.toggle("is-live", live);
        if (live) {
          handle.style.transform =
            "translate3d(" + (window.innerWidth * (0.5 + c.x / (2 * Math.tan(cubeCam.fov * Math.PI / 360) * 4 * aspect))) + "px," +
            (window.innerHeight * (0.5 - c.y / (2 * Math.tan(cubeCam.fov * Math.PI / 360) * 4))) + "px,0) translate(-50%,-50%)";
        }
      }

      /* 第 1 遍：把背景渲染进离屏缓冲 */
      renderer.setRenderTarget(rt);
      renderer.clear(true, true, false);
      renderer.render(quadScene, quadCam);

      /* 第 2 遍：带上玻璃渲染到屏幕，玻璃采样离屏结果做折射 */
      renderer.setRenderTarget(null);
      renderer.clear(true, true, false);
      renderer.render(quadScene, quadCam);
      if (shown) renderer.render(cubeScene, cubeCam);
    }

    function startLoop() {
      if (raf) return;
      clock.getDelta();                       /* 丢掉隐藏期间累积的时间差 */
      raf = requestAnimationFrame(frame);
    }
    function stopLoop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    /* 切到后台：停渲染 + 暂停视频；回到前台：恢复播放并重新起循环 */
    document.addEventListener("visibilitychange", function () {
      pageHidden = document.hidden === true;
      if (pageHidden) {
        stopLoop();
        try { video.pause(); } catch (e) {}
      } else {
        try { var pv = video.play(); if (pv && pv.catch) pv.catch(function () {}); } catch (e) {}
        syncVideo();
        startLoop();
      }
    });

    /* 启动：视频就绪即开始；即便 video 永久失败，1.6s 后也照样渲染 */
    ocean.classList.add("ocean--webgl");
    var started = false;
    function start() {
      if (started) return;
      started = true;
      try { resizeNow(); } catch (e) {}
      clock.start();
      startLoop();
    }
    try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    video.addEventListener("canplay", start, { once: true });
    video.addEventListener("playing", start, { once: true });
    setTimeout(start, 1600);

    /* 看门狗 1：5s 内一帧都没画出来（且页面可见）→ 判定渲染失败 */
    setTimeout(function () {
      if (frames < 3 && !document.hidden) { stopLoop(); fallback("渲染循环未启动"); }
    }, 5000);

    /* 调试面板：?debug 或 #debug 时显示 WEBGL / VIDEO / TEXTURE / FONT / RAF */
    if (/[?&#]debug\b/.test(location.search + location.hash)) {
      var panel = document.createElement("div");
      panel.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:9999;padding:8px 10px;" +
        "font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#c9f5ff;background:rgba(2,20,30,.72);" +
        "border:1px solid rgba(120,220,235,.35);border-radius:6px;pointer-events:none;white-space:pre";
      document.body.appendChild(panel);
      setInterval(function () {
        panel.textContent =
          "WEBGL   " + (contextLost ? "LOST" : "OK") + "\n" +
          "VIDEO   " + (videoUsable() ? "READY" : (video.error ? "ERROR" : "LOADING")) + "\n" +
          "TEXTURE " + (oceanU.uHasVideo.value > 0.5 ? "VIDEO" : "PROC") + "\n" +
          "FONT    " + (document.fonts && document.fonts.status === "loaded" ? "READY" : "…") + "\n" +
          "RAF     " + frames + "f / " + (raf ? "RUNNING" : "STOPPED") + "\n" +
          "SCENE   " + S.toFixed(2);
      }, 500);
    }

    window.addEventListener("pagehide", function () {
      stopLoop();
      try {
        renderer.dispose();
        rt.dispose();
        vtex.dispose();
        oceanMat.dispose();
      } catch (e) {}
    });
  }

  /* ══════════════════════════════════════════════════════════════
     四、主片元着色器
     ══════════════════════════════════════════════════════════════ */
  var FRAG = [
    "precision highp float;",
    "uniform float uTime, uS, uEnd, uAspect, uHasVideo, uVidAspect;",
    "uniform vec2 uMouse;",
    "uniform sampler2D uVideo;",
    "varying vec2 vUv;",

    "float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 34.56); return fract(p.x * p.y); }",

    /* 平滑值噪声：沙滩颗粒 / 潮线不规则 / 浪花 */
    "float vnoise(vec2 p){",
    "  vec2 i = floor(p), f = fract(p);",
    "  f = f * f * (3.0 - 2.0 * f);",
    "  float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));",
    "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);",
    "}",

    /* 焦散：多层旋转正弦干涉取「脊线」，再用低频域扭曲打破规则网格 */
    "float caustic(vec2 p, float t){",
    "  p += vec2(sin(p.y * 0.53 + t * 0.21), cos(p.x * 0.61 - t * 0.19)) * 1.10;",
    "  float v = 0.0, a = 1.0, sum = 0.0;",
    "  for (int i = 0; i < 4; i++) {",
    "    p = mat2(1.58, 1.21, -1.21, 1.58) * p;",
    "    float s = sin(p.x * 1.05 + t * 0.60) * cos(p.y * 0.95 - t * 0.50)",
    "            + 0.72 * sin(p.y * 1.55 - t * 0.42) * cos(p.x * 1.35 + t * 0.36);",
    "    v += a * (1.0 - clamp(abs(s), 0.0, 1.0));",
    "    sum += a;",
    "    a *= 0.58;",
    "  }",
    "  return clamp(v / sum, 0.0, 1.0);",
    "}",

    /* 悬浮微粒（marine snow） */
    "float snow(vec2 uv, float t, float sc, float seed){",
    "  vec2 p = uv * sc;",
    "  p.y += t * 0.30;",
    "  p.x += sin(uv.y * 6.0 + t * 0.35 + seed) * 0.30;",
    "  vec2 id = floor(p);",
    "  vec2 f = fract(p) - 0.5;",
    "  float h = h21(id + seed);",
    "  if (h < 0.905) return 0.0;",
    "  vec2 c = vec2(h21(id + 11.3), h21(id + 27.7)) - 0.5;",
    "  float d = length(f - c * 0.60);",
    "  return smoothstep(0.085, 0.0, d) * (0.45 + 0.55 * sin(t * 1.5 + h * 40.0));",
    "}",

    "vec2 coverUV(vec2 uv, float sa, float da){",
    "  vec2 k = sa > da ? vec2(da / sa, 1.0) : vec2(1.0, sa / da);",
    "  return (uv - 0.5) * k + 0.5;",
    "}",

    /* ── 场景 1：海滩 ─────────────────────────────────────── */
    "vec3 beachProc(vec2 uv, float t){",
    "  vec2 p = vec2(uv.x * uAspect, uv.y) * 12.0;",
    "  float k = pow(caustic(p * 0.95, t * 0.85), 2.2);",
    "  vec3 c = mix(vec3(0.045, 0.375, 0.520), vec3(0.42, 0.855, 0.875), k);",
    "  c += vec3(1.0) * pow(max(0.0, uv.y), 9.0) * 0.12;",
    "  return c;",
    "}",
    "vec3 beach(vec2 uv){",
    "  float t = uTime;",
    "  float s = uS;",
    "  vec3 sea;",
    "  if (uHasVideo > 0.5) {",
    "    vec2 b = coverUV(uv, uVidAspect, uAspect);",
    "    float w1 = sin(uv.y * 7.5 - t * 0.52) * 0.0042;",
    "    float w2 = sin(uv.x * 5.6 + t * 0.39) * 0.0036;",
    "    float w3 = sin((uv.x + uv.y) * 13.0 + t * 0.86) * 0.0016;",
    "    vec2 o = vec2(w1 + w2, w2 * 0.80 + w3);",
    "    vec3 v = vec3(",
    "      texture2D(uVideo, b + o * 1.00).r,",
    "      texture2D(uVideo, b + o * 1.10).g,",
    "      texture2D(uVideo, b + o * 1.22).b",
    "    );",
    "    float l = dot(v, vec3(0.299, 0.587, 0.114));",
    /* 近岸青绿 → 远海浅蓝的纵向渐变，视频只提供波光明暗 */
    "    sea = mix(vec3(0.150, 0.545, 0.640), vec3(0.640, 0.820, 0.875), smoothstep(0.10, 0.98, uv.y));",
    "    sea = mix(sea, sea * (0.62 + 0.80 * l), 0.92);",
    "    sea += vec3(0.72, 0.90, 0.92) * pow(max(0.0, l - 0.58), 1.5) * 1.05;",
    "    sea = mix(sea, vec3(0.659, 0.835, 0.886), 0.14);    /* 远海浅蓝 #A8D5E2 */",
    "  } else {",
    "    sea = beachProc(uv, t);",
    "  }",
    "  sea += vec3(1.0, 0.99, 0.95) * pow(max(0.0, uv.y), 8.0) * 0.10;",

    /* 潮线：随滚动上移 —— 沙滩退出画面、海水填满全屏 */
    "  float rise = smoothstep(0.0, 0.95, s) * 1.30;",
    "  float n1 = vnoise(vec2(uv.x * 3.4 + t * 0.05, t * 0.07));",
    "  float n2 = vnoise(vec2(uv.x * 11.0 - t * 0.10, 4.3));",
    "  float edge = 0.255 + rise + (n1 - 0.5) * 0.070 + (n2 - 0.5) * 0.026;",

    /* 沙滩：米白 #F5F0E8 / 浅金 #E8D5B7，靠水一侧是湿沙 */
    "  float sn = vnoise(vec2(uv.x * 24.0, uv.y * 34.0)) * 0.6 + vnoise(vec2(uv.x * 68.0, uv.y * 96.0)) * 0.4;",
    "  vec3 dry = mix(vec3(0.902, 0.827, 0.706), vec3(0.968, 0.949, 0.922), 0.45 + 0.55 * sn);",
    "  vec3 wets = vec3(0.735, 0.640, 0.500);",
    "  vec3 sand = mix(dry, wets, smoothstep(0.150, 0.0, edge - uv.y));",

    /* 浪花：主潮线 + 两道退去的痕迹 */
    "  float foam = smoothstep(0.020, 0.0, abs(uv.y - edge - 0.010)) * (0.45 + 0.55 * n2);",
    "  foam += smoothstep(0.011, 0.0, abs(uv.y - edge - 0.052 - sin(t * 0.45) * 0.009)) * 0.42;",
    "  foam += smoothstep(0.008, 0.0, abs(uv.y - edge + 0.048 - sin(t * 0.33 + 2.0) * 0.008)) * 0.30;",

    "  vec3 col = mix(sand, sea, smoothstep(-0.005, 0.009, uv.y - edge));",
    "  col = mix(col, vec3(1.0, 0.996, 0.982), clamp(foam, 0.0, 1.0) * 0.88);",

    /* 涌浪：向岸推进的平行浪脊，越靠近岸边越密 */
    "  float wy = uv.y - edge;",
    "  float ph = pow(max(wy, 0.0), 0.72) * 22.0 - t * 0.62 + sin(uv.x * 2.4 + t * 0.20) * 1.30;",
    "  float swell = pow(max(0.0, sin(ph)), 8.0) * smoothstep(0.015, 0.30, wy);",
    "  col += vec3(0.62, 0.86, 0.90) * swell * 0.42;",

    /* 海面碎光：只在水面、且不在沙滩上 */
    "  float g = sin(uv.x * 118.0 + t * 1.35) * sin(uv.y * 96.0 - t * 1.15);",
    "  g *= sin(uv.x * 47.0 - t * 0.62) * 0.5 + 0.5;",
    "  col += vec3(1.0, 0.99, 0.95) * pow(max(0.0, g), 34.0) * 0.55",
    "       * smoothstep(0.22, 0.95, uv.y) * smoothstep(0.02, 0.20, uv.y - edge);",
    "  return col;",
    "}",

    /* ── 场景 2：水面（焦散） ─────────────────────────────── */
    "vec3 surface(vec2 uv){",
    "  float t = uTime;",
    "  vec2 p = vec2(uv.x * uAspect, uv.y) * 5.6 + vec2(sin(t * 0.10), cos(t * 0.13)) * 0.30;",
    "  float c1 = caustic(p, t);",
    "  float c2 = caustic(p * 2.05 + 5.0, t * 1.25);",
    "  float k = pow(clamp(c1 * 0.62 + c2 * 0.38, 0.0, 1.0), 3.2);",
    /* 大尺度的深浅起伏，避免整屏过于均匀 */
    "  float big = caustic(p * 0.26 + 17.0, t * 0.32);",
    /* 绿松石 #4FB3C9 ↔ 深海蓝 #1A6B8A */
    "  vec3 col = mix(vec3(0.055, 0.330, 0.455), vec3(0.180, 0.640, 0.720), smoothstep(0.0, 1.0, uv.y));",
    "  col = mix(col, vec3(0.120, 0.545, 0.640), big * 0.45);",
    "  col += vec3(0.36, 0.72, 0.70) * k * 0.52;",
    "  col += vec3(0.88, 0.985, 0.98) * pow(k, 2.2) * 0.44;",
    "  col = mix(col, vec3(0.24, 0.72, 0.76), smoothstep(0.44, 0.0, uv.y) * 0.20);",
    "  col += vec3(1.0) * pow(max(0.0, 1.0 - uv.y), 7.0) * 0.18;",
    /* 水面碎光 */
    "  float g = sin(uv.x * 152.0 + t * 1.10) * sin(uv.y * 134.0 - t * 0.95);",
    "  col += vec3(1.0, 0.99, 0.96) * pow(max(0.0, g), 42.0) * 0.55;",
    "  return col;",
    "}",

    /* ── 场景 3：水滴（深水） ─────────────────────────────── */
    "vec3 droplet(vec2 uv){",
    "  float t = uTime;",
    "  vec2 p = vec2(uv.x * uAspect, uv.y) * 5.4;",
    "  float k = pow(caustic(p, t * 0.78), 3.0);",
    "  vec3 col = mix(vec3(0.010, 0.075, 0.130), vec3(0.030, 0.245, 0.330), smoothstep(0.0, 1.0, uv.y));",
    "  col = mix(col, vec3(0.020, 0.145, 0.155), smoothstep(0.55, 1.0, uv.y) * 0.55);  /* 墨绿 #0D3B36 */",
    "  col += vec3(0.22, 0.62, 0.62) * k * 0.55;",
    "  col += vec3(1.0) * pow(max(0.0, 1.0 - uv.y), 5.0) * 0.11;",
    "  return col;",
    "}",

    /* ── 场景 4：水下（光束 + 微粒 → 黑暗） ───────────────── */
    "vec3 deep(vec2 uv){",
    "  float t = uTime;",
    "  vec3 col = mix(vec3(0.004, 0.024, 0.038), vec3(0.022, 0.115, 0.155), smoothstep(0.0, 0.55, uv.y));",
    "  col = mix(col, vec3(0.065, 0.290, 0.345), smoothstep(0.55, 1.0, uv.y));",
    /* 丁达尔光束：从水面斜射进来 */
    "  float beams = 0.0;",
    "  for (int i = 0; i < 5; i++) {",
    "    float fi = float(i);",
    "    float x = 0.06 + fi * 0.202 + sin(t * 0.11 + fi * 1.7) * 0.040;",
    "    float wd = 0.032 + fi * 0.011;",
    "    float d = abs(uv.x - x + (1.0 - uv.y) * (-0.09 + fi * 0.045));",
    "    beams += smoothstep(wd, 0.0, d) * (0.55 + 0.45 * sin(t * 0.50 + fi * 2.3));",
    "  }",
    "  col += vec3(0.52, 0.90, 0.88) * beams * smoothstep(0.02, 1.0, uv.y) * 0.105;",
    "  col += vec3(0.75, 0.95, 0.95) * (snow(uv, t, 24.0, 0.0) * 0.50 + snow(uv, t * 0.72, 44.0, 13.0) * 0.32);",
    "  col *= mix(0.28, 1.0, smoothstep(0.0, 0.40, uv.y));",
    "  return col;",
    "}",

    "void main(){",
    "  vec2 uv = vUv;",
    "  float s = uS;",
    "  float wB = 1.0 - smoothstep(0.30, 1.05, s);",
    "  float wS = smoothstep(0.30, 1.05, s) * (1.0 - smoothstep(1.30, 2.05, s));",
    "  float wD = smoothstep(1.30, 2.05, s) * (1.0 - smoothstep(2.30, 3.00, s));",
    "  float wU = smoothstep(2.30, 3.00, s);",
    "  vec3 col = vec3(0.0);",
    "  if (wB > 0.002) col += beach(uv) * wB;",
    "  if (wS > 0.002) col += surface(uv) * wS;",
    "  if (wD > 0.002) col += droplet(uv) * wD;",
    "  if (wU > 0.002) col += deep(uv) * wU;",
    /* 视差：极轻，只为制造纵深 */
    "  col *= 1.0 - 0.02 * uMouse.y;",
    /* 暗角 */
    "  float vig = smoothstep(1.45, 0.25, length((uv - 0.5) * vec2(1.02, 1.06)) * 1.42);",
    "  col *= mix(0.82, 1.05, vig);",
    /* 潜入黑暗 */
    "  col = mix(col, vec3(0.0035, 0.0130, 0.0210), uEnd * wU * 0.88);",
    "  gl_FragColor = vec4(max(col, 0.0), 1.0);",
    "}"
  ].join("\n");
})();
