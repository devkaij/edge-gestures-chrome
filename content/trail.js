/**
 * Edge Gestures for Chrome — 轨迹渲染层
 *
 * 对标量测结果：
 *  - 全视口 canvas 覆盖层，pointer-events:none，z-index 仅次于气泡
 *  - 固定颜色（默认 #0078D4）、固定线宽、圆头圆角连接、无锥形无渐变
 *  - 普通覆盖混合（非正片叠底）
 *  - 松手即整体移除（下一帧全无，无淡出动画）
 */
(function () {
  'use strict';
  var EG = (window.EdgeGest = window.EdgeGest || {});

  function Trail(opts) {
    this.o = opts;
    this.canvas = null;
    this.ctx = null;
    this.points = [];
    this.raf = 0;
  }

  Trail.prototype.setPoints = function (points) {
    // 直接持有引擎的数组引用（引擎持续 push，避免拷贝）
    this.points = points;
  };

  Trail.prototype.show = function () {
    if (this.canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var c = document.createElement('canvas');
    c.id = '__eg_trail';
    c.width = Math.max(1, Math.ceil(window.innerWidth * dpr));
    c.height = Math.max(1, Math.ceil(window.innerHeight * dpr));
    var st = c.style;
    st.position = 'fixed';
    st.left = '0';
    st.top = '0';
    st.width = '100vw';
    st.height = '100vh';
    st.zIndex = '2147483646'; // 气泡在其上
    st.pointerEvents = 'none';
    (document.body || document.documentElement).appendChild(c);
    this.canvas = c;
    var ctx = (this.ctx = c.getContext('2d'));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.o.trailColor;
    ctx.lineWidth = this.o.trailWidth;

    var self = this;
    var loop = function () {
      self.draw();
      self.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };

  Trail.prototype.draw = function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var pts = this.points;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };

  Trail.prototype.hide = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.canvas) this.canvas.remove();
    this.canvas = null;
    this.ctx = null;
    this.points = [];
  };

  EG.Trail = Trail;
})();
