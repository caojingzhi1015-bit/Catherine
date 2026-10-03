/* ══════════════════════════════════════════════════════════════════
   ocean.js — WebGL 海洋场景（明亮版）
   · 海浪视频作为底层画布（THREE.VideoTexture），保持青绿通透、不压暗
   · 一块真正「透明」的玻璃：RenderTarget + 屏幕空间折射
     （Screen-space Refraction / Chromatic Dispersion / Fresnel）
     玻璃本身中性无色，只有边缘一线细白高光；颜色全部来自被折射的海浪
   移动端 / 无 WebGL / 减少动效时：不加载 three，直接用 DOM <video>。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var hero = document.getElementById("hero");
  var canvas = document.getElementById("oceanCanvas");
  var video = document.getElementById("oceanVideo");
  if (!hero || !canvas || !video) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wide = window.matchMedia("(min-width: 981px)").matches;
  if (reduce || !wide) { canvas.style.display = "none"; return; }

  /* WebGL2 能力检测 */
  var probe = document.createElement("canvas");
  if (!probe.getContext("webgl2")) { canvas.style.display = "none"; return; }

  Promise.all([
    import("three"),
    import("three/addons/geometries/RoundedBoxGeometry.js")
  ]).then(function (mods) {
    var THREE = mods[0];
    var RoundedBoxGeometry = mods[1].RoundedBoxGeometry;
    try { boot(THREE, RoundedBoxGeometry); }
    catch (err) { fallback(err); }
  }).catch(fallback);

  function fallback(err) {
    if (err) console.warn("[ocean] WebGL 场景不可用，回退到视频背景：", err);
    canvas.style.display = "none";
    try { video.play(); } catch (e) {}
  }

  function boot(THREE, RoundedBoxGeometry) {
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    /* ── 海浪视频：底层画布 ──────────────────────────────── */
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.style.opacity = "0";         /* 画面交给 WebGL，元素只做解码源 */
    var tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    var aspect16x9 = 16 / 9;

    /* ══ 背景：明亮的青绿海水 ══════════════════════════════ */
    var bgUniforms = {
      uTex: { value: tex },
      uTime: { value: 0 }
    };

    var bgMat = new THREE.ShaderMaterial({
      uniforms: bgUniforms,
      depthWrite: false,
      vertexShader:
        "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "uniform sampler2D uTex;",
        "uniform float uTime;",
        "varying vec2 vUv;",
        "vec3 toSRGB(vec3 c){",
        "  c = max(c, vec3(0.0));",
        "  return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(vec3(0.0031308), c));",
        "}",
        "void main(){",
        "  vec2 uv = vUv;",
        /* 三层正弦叠加：缓慢、克制的水面呼吸 */
        "  float w1 = sin(uv.y * 8.0 + uTime * 0.52) * 0.0040;",
        "  float w2 = sin(uv.x * 6.2 - uTime * 0.39) * 0.0034;",
        "  float w3 = sin((uv.x + uv.y) * 14.0 + uTime * 0.86) * 0.0014;",
        "  vec2 o = vec2(w1 + w2, w2 * 0.75 + w3);",
        /* RGB 采样点微错位 → 水面下极轻的色散 */
        "  float r = texture2D(uTex, uv + o * 1.00).r;",
        "  float g = texture2D(uTex, uv + o * 1.12).g;",
        "  float b = texture2D(uTex, uv + o * 1.26).b;",
        "  vec3 c = vec3(r, g, b);",
        /* 只做极轻微的统一，保留海水原本的青绿与通透 */
        "  float l = dot(c, vec3(0.299, 0.587, 0.114));",
        "  c = mix(c, vec3(l), 0.06);",
        /* 提亮：海水本身是画面最重要的颜色来源 */
        "  c *= 1.07;",
        "  c = mix(c, vec3(1.0), 0.03);",
        /* 极轻暗角，只为把视线收进中心，不压暗画面 */
        "  float vig = smoothstep(1.28, 0.20, length((vUv - 0.5) * vec2(1.02, 1.10)) * 1.5);",
        "  c *= mix(0.90, 1.0, vig);",
        "  gl_FragColor = vec4(toSRGB(c), 1.0);",
        "}"
      ].join("\n")
    });

    var bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
    bg.position.z = -2;
    scene.add(bg);

    /* ══ 离屏缓冲：把「不含玻璃的海水」先渲染一遍 ══════════ */
    var rt = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false
    });

    /* ══ 玻璃：屏幕空间折射（中性、无色、只有白色 Fresnel 边缘） ══ */
    var glassUniforms = {
      uScene: { value: rt.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uRefractPower: { value: 0.052 },   /* 折射偏移强度：小 → 内部能看清原始海浪 */
      uDispersion: { value: 0.075 },     /* 色散：轻微、高级，不做彩虹塑料 */
      uFresnelPower: { value: 3.4 },     /* 边缘高光收得细而亮 */
      uEdgeGain: { value: 1.18 }
    };

    var glassMat = new THREE.ShaderMaterial({
      uniforms: glassUniforms,
      transparent: false,
      depthWrite: true,
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
        "uniform vec2 uResolution;",
        "uniform float uRefractPower;",
        "uniform float uDispersion;",
        "uniform float uFresnelPower;",
        "uniform float uEdgeGain;",
        "varying vec3 vN;",
        "varying vec3 vViewPos;",
        "varying vec4 vClip;",
        "void main(){",
        "  vec3 N = normalize(vN);",
        "  vec3 V = normalize(-vViewPos);",
        "  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);",
        /* Fresnel：正视近乎 0，掠射趋近 1 —— 只有边缘才亮 */
        "  float fres = pow(1.0 - ndv, uFresnelPower);",
        /* 屏幕空间 UV */
        "  vec2 uv = (vClip.xy / vClip.w) * 0.5 + 0.5;",
        /* 折射偏移：正中心几乎不动，掠射处偏移更强 */
        "  vec2 off = N.xy * uRefractPower * (0.30 + 0.70 * (1.0 - ndv));",
        /* 色散：RGB 三通道分别采样，幅度随 Fresnel 增大 */
        "  float d = uDispersion * (0.35 + fres);",
        "  vec3 col;",
        "  col.r = texture2D(uScene, uv + off * (1.0 + d)).r;",
        "  col.g = texture2D(uScene, uv + off).g;",
        "  col.b = texture2D(uScene, uv + off * (1.0 - d)).b;",
        /* 边缘：一线细白高光，不带任何固有蓝或其他基色 */
        "  vec3 white = vec3(0.985, 0.995, 1.0);",
        "  col = mix(col, white, clamp(fres * uEdgeGain * uEdgeGain, 0.0, 0.90));",
        "  col += white * fres * 0.22;",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });

    var glassGeo = new RoundedBoxGeometry(1.16, 1.16, 1.16, 8, 0.23);
    var glass = new THREE.Mesh(glassGeo, glassMat);
    var glassPivot = new THREE.Group();
    glassPivot.add(glass);
    glassPivot.position.set(1.52, 0.12, 0);
    scene.add(glassPivot);

    /* ── 尺寸 ─────────────────────────────────────────────── */
    var stage = hero.querySelector(".hero__stage") || hero;
    function resize() {
      var w = stage.clientWidth || window.innerWidth;
      var h = stage.clientHeight || window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      /* 离屏缓冲与画布同尺寸：屏幕空间折射需要 1:1 对应 */
      rt.setSize(Math.max(2, Math.round(w * dpr)), Math.max(2, Math.round(h * dpr)));
      glassUniforms.uResolution.value.set(w * dpr, h * dpr);

      var vAspect = video.videoWidth && video.videoHeight
        ? video.videoWidth / video.videoHeight
        : aspect16x9;
      var dist = camera.position.z - bg.position.z;
      var vh = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
      var vw = vh * camera.aspect;
      /* cover：保证画面铺满，不出现黑边 */
      var pw = vw, ph = vw / vAspect;
      if (ph < vh) { ph = vh; pw = vh * vAspect; }
      bg.scale.set(pw, ph, 1);
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    window.addEventListener("resize", resize);
    video.addEventListener("loadedmetadata", resize);

    /* ── 交互：鼠标视差 / 滚动离开 ───────────────────────── */
    var mx = 0, my = 0, tmx = 0, tmy = 0;
    window.addEventListener("mousemove", function (e) {
      tmx = (e.clientX / window.innerWidth - 0.5) * 2;
      tmy = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    var scrollP = 0;
    function onScroll() {
      var h = window.innerHeight || 1;
      scrollP = Math.min(1, Math.max(0, (window.pageYOffset || 0) / h));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* ── 只在首屏可见时渲染 ──────────────────────────────── */
    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
      }, { threshold: 0 }).observe(hero);
    }
    var pageHidden = false;
    document.addEventListener("visibilitychange", function () { pageHidden = document.hidden; });

    /* ── 主循环：两遍渲染 ─────────────────────────────────── */
    var clock = new THREE.Clock();
    var running = false;

    function frame() {
      if (!visible || pageHidden) { running = false; return; }
      var t = clock.getElapsedTime();
      bgUniforms.uTime.value = t;

      mx += (tmx - mx) * 0.045;
      my += (tmy - my) * 0.045;

      /* 玻璃：缓慢自转 + 鼠标视差 + 随滚动上浮 */
      glassPivot.rotation.y = t * 0.16 + mx * 0.34;
      glassPivot.rotation.x = Math.sin(t * 0.24) * 0.09 - my * 0.22;
      glassPivot.rotation.z = Math.sin(t * 0.19) * 0.06;
      glassPivot.position.y = 0.12 + Math.sin(t * 0.55) * 0.075 + scrollP * 1.45;
      glassPivot.position.x = 1.52 + mx * 0.16;
      var sc = 1 - scrollP * 0.35;
      glassPivot.scale.setScalar(Math.max(0.4, sc));

      /* 背景画布轻微视差，制造纵深 */
      bg.position.x = mx * -0.1;
      bg.position.y = my * -0.07 + scrollP * 0.6;

      /* 第 1 遍：把海水渲染进离屏缓冲 */
      glassPivot.visible = false;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);

      /* 第 2 遍：带着玻璃渲染到屏幕，玻璃采样离屏结果做折射 */
      glassPivot.visible = true;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);

      requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      clock.start();
      requestAnimationFrame(frame);
    }

    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    video.addEventListener("playing", start, { once: true });
    if (video.readyState >= 2) start();
    /* 兜底：视频被浏览器拦截自动播放时，也先把画面跑起来（首帧黑） */
    setTimeout(start, 1200);

    window.addEventListener("pagehide", function () {
      renderer.dispose();
      rt.dispose();
      tex.dispose();
    });
  }
})();
