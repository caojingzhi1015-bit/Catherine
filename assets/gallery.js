/* 图库：全部走轻量 WebP。首屏 6 张立即加载，其余由浏览器按视口距离
   提前预取（Chrome 会在进入视口前约 1250-2500px 就开始下载）。
   避免 33 张同时抢连接把首屏拖慢；所有图片都不需要点击即可显示。 */
(function () {
  var EAGER = 6;
  var sets = window.__SETS__ || [];
  var index = 0;
  sets.forEach(function (set) {
    var container = document.getElementById(set[0]);
    if (!container) return;
    var base = set[1];
    set[2].forEach(function (name) {
      var first = index === 0;
      var eager = index < EAGER;
      var item = document.createElement("div");
      item.className = "masonry-item";
      var img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.loading = eager ? "eager" : "lazy";
      img.fetchPriority = first ? "high" : (eager ? "auto" : "low");
      img.src = base + name;
      index++;
      item.appendChild(img);
      container.appendChild(item);
    });
  });
})();
