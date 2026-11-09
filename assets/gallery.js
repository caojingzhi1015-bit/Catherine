/* 图库：全部走轻量 WebP，全部 eager（不用原生 lazy——瀑布流里未加载的图
   高度为 0 会撑不开页面，反而导致后续图永远不触发加载）。
   首屏 6 张立即发起、首图 high / 其余 auto；剩下的一批在首帧空闲后
   立即补齐并标 low 优先级，既优先首屏、又保证 33 张最终全部显示。 */
(function () {
  var EAGER = 6;
  var sets = window.__SETS__ || [];
  var index = 0;
  var deferred = [];
  sets.forEach(function (set) {
    var container = document.getElementById(set[0]);
    if (!container) return;
    set[2].forEach(function (name) {
      var src = set[1] + name;
      var first = index === 0;
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "eager";
      img.decoding = "async";
      img.fetchPriority = first ? "high" : (index < EAGER ? "auto" : "low");
      if (index < EAGER) img.src = src;
      else deferred.push([img, src]);
      index++;
      var item = document.createElement("div");
      item.className = "masonry-item";
      item.appendChild(img);
      container.appendChild(item);
    });
  });
  function flush() { deferred.forEach(function (d) { d[0].src = d[1]; }); }
  if (window.requestIdleCallback) requestIdleCallback(flush, { timeout: 800 });
  else setTimeout(flush, 200);
})();
