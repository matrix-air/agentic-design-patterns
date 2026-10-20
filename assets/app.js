/* 全书搜索 + 移动端侧栏。零依赖。 */
(function () {
  var base = location.pathname.indexOf("/chapters/") >= 0 ? "../" : "";
  var box = document.getElementById("search-box");
  var panel = document.getElementById("search-results");
  var index = null;

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hl(text, q) {
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text.slice(0, 60));
    var s = Math.max(0, i - 22);
    return esc(text.slice(s, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length, i + q.length + 42));
  }
  function render(q, hits) {
    if (!q) { panel.style.display = "none"; return; }
    if (!hits.length) {
      panel.innerHTML = '<div class="sr-item"><span class="sr-snip">没有找到 “' + esc(q) + '”</span></div>';
    } else {
      panel.innerHTML = hits.map(function (h) {
        var snip = h.hit_kind === "head" ? "<i>" + esc(h.snip) + "</i>" : hl(h.snip, q);
        return '<a class="sr-item" href="' + base + 'chapters/' + h.slug + '.html"><span class="sr-label">' + esc(h.label) + '</span><span class="sr-snip">' + snip + "</span></a>";
      }).join("");
    }
    panel.style.display = "block";
  }

  box && box.addEventListener("input", function () {
    var q = box.value.trim();
    if (q.length < 2) { panel.style.display = "none"; return; }
    if (!index) {
      fetch(base + "search-index.json").then(function (r) { return r.json(); }).then(function (d) { index = d; search(q); });
    } else search(q);
    function search(qq) {
      var lq = qq.toLowerCase(), hits = [];
      index.forEach(function (e) {
        if (e.label.toLowerCase().indexOf(lq) >= 0) hits.push({ slug: e.slug, label: e.label, snip: e.headings[0] || "", hit_kind: "head" });
        for (var i = 0; i < e.headings.length && hits.length < 12; i++)
          if (e.headings[i].toLowerCase().indexOf(lq) >= 0) { hits.push({ slug: e.slug, label: e.label + " · " + e.headings[i], snip: e.headings[i], hit_kind: "head" }); break; }
        var pos = e.text.toLowerCase().indexOf(lq);
        if (pos >= 0 && hits.length < 12) hits.push({ slug: e.slug, label: e.label, snip: e.text.slice(Math.max(0, pos - 20), pos + 60), hit_kind: "body" });
      });
      render(qq, hits.slice(0, 10));
    }
  });
  document.addEventListener("click", function (e) {
    if (!panel.contains(e.target) && e.target !== box) panel.style.display = "none";
  });

  var btn = document.getElementById("menu-btn"), sb = document.getElementById("sidebar");
  btn && sb && btn.addEventListener("click", function () { sb.classList.toggle("open"); });
})();
