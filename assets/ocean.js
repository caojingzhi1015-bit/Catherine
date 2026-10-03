/* ══════════════════════════════════════════════════════════════════
   ocean.js — WebGL 海洋场景
   · 海浪视频作为底层画布（THREE.VideoTexture）
   · 顶点/片元级水波扭曲 + 冷色去饱和 + 暗角
   · 一个漂浮在海里的透明玻璃体：真实折射海浪 + 轻微色散 + 边缘高光
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

    /* ── 环境贴图：程序化的「天空→深海」渐变，给玻璃体高光 ── */
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    var envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader:
        "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "varying vec3 vP;",
        "void main(){",
        "  float h = normalize(vP).y * 0.5 + 0.5;",
        "  vec3 top = vec3(0.62, 0.80, 0.88);",       /* 天光 */
        "  vec3 mid = vec3(0.10, 0.36, 0.46);",       /* 海面 */
        "  vec3 bot = vec3(0.015, 0.075, 0.105);",    /* 深海 */
        "  vec3 c = mix(bot, mid, smoothstep(0.0, 0.5, h));",
        "  c = mix(c, top, smoothstep(0.52, 1.0, h));",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"
      ].join("\n")
    });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 24), envMat));
    var envRT = pmrem.fromScene(envScene, 0);
    scene.environment = envRT.texture;
    envMat.dispose();

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

    /* 视频尺寸未知时先按 16:9 处理 */
    var aspect16x9 = 16 / 9;

    var uniforms = {
      uTex: { value: tex },
      uTime: { value: 0 },
      uAspectCorr: { value: 1 }
    };

    var bgMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      depthWrite: false,
      vertexShader:
        "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "uniform sampler2D uTex;",
        "uniform float uTime;",
        "uniform float uAspectCorr;",
        "varying vec2 vUv;",
        "vec3 toSRGB(vec3 c){",
        "  c = max(c, vec3(0.0));",
        "  return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(vec3(0.0031308), c));",
        "}",
        "void main(){",
        "  vec2 uv = vUv;",
        /* 三层正弦叠加：缓慢、克制的水面呼吸 */
        "  float w1 = sin(uv.y * 8.0 + uTime * 0.52) * 0.0044;",
        "  float w2 = sin(uv.x * 6.2 - uTime * 0.39) * 0.0037;",
        "  float w3 = sin((uv.x + uv.y) * 14.0 + uTime * 0.86) * 0.0016;",
        "  vec2 o = vec2(w1 + w2, w2 * 0.75 + w3);",
        /* RGB 采样点微错位 → 水下的轻微色散 */
        "  float r = texture2D(uTex, uv + o * 1.00).r;",
        "  float g = texture2D(uTex, uv + o * 1.22).g;",
        "  float b = texture2D(uTex, uv + o * 1.46).b;",
        "  vec3 c = vec3(r, g, b);",
        /* 去饱和 + 压向深蓝，统一电影感 */
        "  float l = dot(c, vec3(0.299, 0.587, 0.114));",
        "  c = mix(c, vec3(l), 0.26);",
        "  c = mix(c, vec3(0.018, 0.120, 0.170), 0.30);",
        "  c *= 0.90;",
        /* 暗角，把视线收进画面中心 */
        "  float vig = smoothstep(1.20, 0.16, length((vUv - 0.5) * vec2(1.02, 1.12)) * 1.5);",
        "  c *= mix(0.50, 1.0, vig);",
        "  gl_FragColor = vec4(toSRGB(c), 1.0);",
        "}"
      ].join("\n")
    });

    var bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
    bg.position.z = -2;
    scene.add(bg);

    /* ── 玻璃体：漂浮在海中的透明观察窗口 ────────────────── */
    var glassGeo = new RoundedBoxGeometry(1.16, 1.16, 1.16, 8, 0.23);
    var glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.055,
      transmission: 1,
      thickness: 1.55,
      ior: 1.36,
      envMapIntensity: 1.25,
      clearcoat: 0.7,
      clearcoatRoughness: 0.14,
      iridescence: 0.28,
      iridescenceIOR: 1.28,
      attenuationColor: new THREE.Color(0x1e7280),
      attenuationDistance: 3.2,
      specularIntensity: 1
    });
    /* 色散（RGB 分离）在 r167+ 支持，做能力检测后再赋值 */
    if ("dispersion" in glassMat) glassMat.dispersion = 4.2;

    var glass = new THREE.Mesh(glassGeo, glassMat);
    var glassPivot = new THREE.Group();
    glass.position.set(0, 0, 0);
    glassPivot.add(glass);
    glassPivot.position.set(1.52, 0.12, 0);
    scene.add(glassPivot);

    /* 一层极薄的柔光壳，模拟玻璃边缘的高光溢出 */
    var glowMat = new THREE.MeshBasicMaterial({
      color: 0x8fd2e0,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var glow = new THREE.Mesh(new RoundedBoxGeometry(1.34, 1.34, 1.34, 6, 0.3), glowMat);
    glow.position.set(0, 0, 0);
    glassPivot.add(glow);

    /* ── 尺寸 ─────────────────────────────────────────────── */
    var stage = hero.querySelector(".hero__stage") || hero;
    function resize() {
      var w = stage.clientWidth || window.innerWidth;
      var h = stage.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

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
      uniforms.uAspectCorr.value = camera.aspect;
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

    /* ── 主循环 ───────────────────────────────────────────── */
    var clock = new THREE.Clock();
    var running = false;

    function frame() {
      if (!visible || pageHidden) { running = false; return; }
      var t = clock.getElapsedTime();
      uniforms.uTime.value = t;

      mx += (tmx - mx) * 0.045;
      my += (tmy - my) * 0.045;

      /* 玻璃体：缓慢自转 + 鼠标视差 + 随滚动上浮 */
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
      tex.dispose();
      setDirty();
    });

    function setDirty() { /* 预留 */ }
  }
})();
