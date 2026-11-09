/* 图库：全部走轻量 WebP，首图高优先级，其余低优先级并行加载。
   总量约 1.6MB，不再使用滚动懒加载——进页面即全部可见，无需等待。 */
(function () {
  var sets = window.__SETS__ || [];
  var first = true;
  sets.forEach(function (set) {
    var container = document.getElementById(set[0]);
    if (!container) return;
    var base = set[1];
    set[2].forEach(function (name) {
      var src = base + name;
      var item = document.createElement("div");
      item.className = "masonry-item";
      var img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.loading = "eager";
      img.decoding = "async";
      img.fetchPriority = first ? "high" : "low";
      first = false;
      item.appendChild(img);
      container.appendChild(item);
    });
  });
})();
