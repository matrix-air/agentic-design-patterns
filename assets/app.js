/* 全书搜索 + 移动端侧栏 + Mermaid 双主题 + 阅读三小件。零依赖。 */
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
        if (hits.length >= 12) return;
        if (e.label.toLowerCase().indexOf(lq) >= 0) hits.push({ slug: e.slug, label: e.label, snip: e.headings[0] || "", hit_kind: "head" });
        for (var i = 0; i < e.headings.length && hits.length < 12; i++)
          if (e.headings[i].toLowerCase().indexOf(lq) >= 0) { hits.push({ slug: e.slug, label: e.label + " · " + e.headings[i], snip: e.headings[i], hit_kind: "head" }); break; }
        if (hits.length < 12) {
          var pos = e.text.toLowerCase().indexOf(lq);
          if (pos >= 0) hits.push({ slug: e.slug, label: e.label, snip: e.text.slice(Math.max(0, pos - 20), pos + 60), hit_kind: "body" });
        }
      });
      render(qq, hits.slice(0, 10));
    }
  });
  document.addEventListener("click", function (e) {
    if (!panel.contains(e.target) && e.target !== box) panel.style.display = "none";
  });

  var btn = document.getElementById("menu-btn"), sb = document.getElementById("sidebar");
  btn && sb && btn.addEventListener("click", function () { sb.classList.toggle("open"); });

  /* 键盘翻页：← 上一章 / → 下一章（章节页） */
  var pagers = document.querySelectorAll(".pagers a.pager");
  document.addEventListener("keydown", function (e) {
    if (!pagers.length) return;
    var t = e.target || {};
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
    if (e.key === "ArrowLeft" && pagers[0]) location.href = pagers[0].href;
    if (e.key === "ArrowRight" && pagers[pagers.length - 1]) location.href = pagers[pagers.length - 1].href;
  });

  /* 阅读进度条 + 返回顶部 */
  var prog = document.createElement("div"); prog.id = "progress"; document.body.appendChild(prog);
  var backtop = document.createElement("button"); backtop.id = "backtop"; backtop.textContent = "↑";
  backtop.title = "回到顶部"; backtop.setAttribute("aria-label", "回到顶部");
  backtop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  document.body.appendChild(backtop);
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0).toFixed(2) + "%";
      backtop.classList.toggle("show", h.scrollTop > 600);
      ticking = false;
    });
  }, { passive: true });

  /* Mermaid 双主题渲染（本地内置，跟随系统深浅色，切换即重绘） */
  var darkMQ = window.matchMedia("(prefers-color-scheme: dark)");
  if (window.mermaid && document.querySelector(".mermaid")) {
    var boxes = Array.prototype.slice.call(document.querySelectorAll(".mermaid"));
    boxes.forEach(function (el) { el.setAttribute("data-src", el.textContent.trim()); });
    var paint = function () {
      try {
        window.mermaid.initialize({
          startOnLoad: false, securityLevel: "loose",
          theme: darkMQ.matches ? "dark" : "default",
          flowchart: { useMaxWidth: true, htmlLabels: true },
        });
        window.mermaid.run({ querySelector: ".mermaid" });
      } catch (e) { console.error("mermaid render failed", e); }
    };
    paint();
    var onChange = function () {
      boxes.forEach(function (el) { el.innerHTML = el.getAttribute("data-src"); });
      paint();
    };
    darkMQ.addEventListener ? darkMQ.addEventListener("change", onChange) : darkMQ.addListener(onChange);
  }
})();
