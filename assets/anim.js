/* 《智能体设计模式》动画演示播放器：解析 data-spec JSON，SVG 舞台 + 步进剧本 + 播放控制。零依赖。 */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, parent, text) {
    var d = document.createElement("div");
    d.className = cls;
    if (text != null) d.textContent = text;
    if (parent) parent.appendChild(d);
    return d;
  }

  var SPEEDS = [0.5, 1, 2];

  function Player(container, spec) {
    this.box = container;
    this.spec = spec;
    this.speedIdx = 1;
    this.build();
    this.reset();
  }

  Player.prototype.build = function () {
    var s = this.spec;
    this.stage = el("svg", {
      viewBox: "0 0 " + (s.w || 760) + " " + (s.h || 260),
      class: "adp-svg",
      preserveAspectRatio: "xMidYMid meet",
    });
    this.box.querySelector(".adp-stage").appendChild(this.stage);
    var gEdges = el("g", { class: "adp-edges" }, this.stage);
    var gNodes = el("g", { class: "adp-nodes" }, this.stage);
    this.edgeEls = {};
    var self = this;
    (s.edges || []).forEach(function (e) {
      var a = self.nodeById(e[0]), b = self.nodeById(e[1]);
      if (!a || !b) return;
      var line = el("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        class: "adp-edge", "marker-end": "url(#adp-arrow)",
      }, gEdges);
      self.edgeEls[e[0] + ">" + e[1]] = line;
    });
    var defs = el("defs", {}, this.stage);
    var mk = el("marker", { id: "adp-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "adp-arrowhead" }, mk);
    (s.nodes || []).forEach(function (n) {
      var cls = "adp-node adp-" + (n.shape || "rect");
      var g = el("g", { class: cls, "data-id": n.id }, gNodes);
      if (n.shape === "diamond") {
        el("polygon", {
          points: (n.x - n.w / 2) + "," + n.y + " " + n.x + "," + (n.y - n.h / 2) + " " +
                  (n.x + n.w / 2) + "," + n.y + " " + n.x + "," + (n.y + n.h / 2),
        }, g);
      } else {
        el("rect", {
          x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: n.shape === "pill" ? n.h / 2 : 8,
        }, g);
      }
      var t = el("text", { x: n.x, y: n.y + 4.5, "text-anchor": "middle" }, g);
      t.textContent = n.label;
      n._g = g;
    });
    this.token = el("circle", { r: 7, class: "adp-token", opacity: "0" }, this.stage);
    this.noteEl = this.box.querySelector(".adp-note");
    this.stepEl = this.box.querySelector(".adp-step");
    // 控制条
    var ctrl = this.box.querySelector(".adp-ctrl");
    var self2 = this;
    function btn(txt, fn, cls) {
      var b = document.createElement("button");
      b.className = "adp-btn " + (cls || "");
      b.innerHTML = txt;
      b.addEventListener("click", fn);
      ctrl.appendChild(b);
      return b;
    }
    this.playBtn = btn("▶ 播放", function () { self2.toggle(); }, "adp-primary");
    btn("↺", function () { self2.reset(); });
    this.speedBtns = [];
    SPEEDS.forEach(function (sp, i) {
      var b = btn(sp + "×", function () {
        self2.speedIdx = i;
        self2.speedBtns.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      }, "adp-speed" + (i === 1 ? " on" : ""));
      self2.speedBtns.push(b);
    });
  };

  Player.prototype.nodeById = function (id) {
    if (!this._nmap) {
      this._nmap = {};
      var self = this;
      (this.spec.nodes || []).forEach(function (n) { self._nmap[n.id] = { x: n.x, y: n.y }; });
    }
    return this._nmap[id];
  };

  Player.prototype.reset = function () {
    this.paused = true;
    this.i = 0;
    this.playBtn.innerHTML = "▶ 播放";
    if (this.timer) clearTimeout(this.timer);
    if (this.raf) cancelAnimationFrame(this.raf);
    var self = this;
    this.spec.nodes.forEach(function (n) {
      if (n._g) n._g.setAttribute("class", "adp-node adp-" + (n.shape || "rect"));
    });
    Object.values(this.edgeEls).forEach(function (l) { l.classList.remove("adp-edge-hot"); });
    this.token.setAttribute("opacity", "0");
    this.setNote("点「▶ 播放」观看执行过程");
    this.setStep(0);
  };

  Player.prototype.setNote = function (t) { this.noteEl.textContent = t || ""; };
  Player.prototype.setStep = function (n) { this.stepEl.textContent = "步 " + n + "/" + this.spec.steps.length; };

  Player.prototype.toggle = function () {
    if (this.playing()) { this.paused = true; this.playBtn.innerHTML = "▶ 继续"; return; }
    this.paused = false;
    this.playBtn.innerHTML = "⏸ 暂停";
    this.next();
  };
  Player.prototype.playing = function () { return !this.paused && this.i < this.spec.steps.length; };

  Player.prototype.next = function () {
    if (this.paused || this.i >= this.spec.steps.length) {
      if (!this.paused && this.i >= this.spec.steps.length) {
        this.paused = true;
        this.playBtn.innerHTML = "↺ 重播";
        this.setNote("演示结束 —— 点 ↺ 重播");
      }
      return;
    }
    var self = this;
    var st = this.spec.steps[this.i++];
    this.setStep(this.i);
    var speed = SPEEDS[this.speedIdx];
    function done(ms) { self.timer = setTimeout(function () { self.next(); }, (ms || 250) / speed); }
    if (st.t === "note") { this.setNote(st.text); done(st.ms || 500); }
    else if (st.t === "hl") {
      var n = this.spec.nodes.find(function (x) { return x.id === st.node; });
      if (n && n._g) n._g.setAttribute("class", "adp-node adp-" + (n.shape || "rect") + " adp-" + (st.cls || "hl"));
      if (st.note) this.setNote(st.note);
      done(st.ms || 600);
    } else if (st.t === "tok") {
      var a = this.nodeById(st.from), b = this.nodeById(st.to);
      if (!a || !b) { done(0); return; }
      if (st.note) this.setNote(st.note);
      var line = this.edgeEls[st.from + ">" + st.to];
      if (line) line.classList.add("adp-edge-hot");
      var dur = (st.dur || 750) / speed, t0 = performance.now();
      var tok = this.token;
      tok.setAttribute("opacity", "1");
      tok.setAttribute("class", "adp-token" + (st.cls ? " adp-token-" + st.cls : ""));
      function frame(now) {
        if (self.paused) { self.timer = setTimeout(function () { self.frameResume = frame; self.next(); }, 200); return; }
        var p = Math.min(1, (now - t0) / dur);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        tok.setAttribute("cx", a.x + (b.x - a.x) * e);
        tok.setAttribute("cy", a.y + (b.y - a.y) * e);
        if (p < 1) self.raf = requestAnimationFrame(frame);
        else {
          tok.setAttribute("opacity", "0");
          if (line) setTimeout(function () { line.classList.remove("adp-edge-hot"); }, 300);
          done(160);
        }
      }
      this.raf = requestAnimationFrame(frame);
    } else if (st.t === "wait") { done(st.ms || 400); }
    else done(0);
  };

  window.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".anim-demo").forEach(function (box) {
      try {
        var spec = JSON.parse(box.getAttribute("data-spec"));
        new Player(box, spec);
      } catch (e) {
        box.querySelector(".adp-note").textContent = "演示配置解析失败: " + e.message;
      }
    });
  });
})();
