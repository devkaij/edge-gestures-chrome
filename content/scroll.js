/**
 * Edge Gestures for Chrome — 平滑滚动
 *
 * Edge 的 ↑/↓ 滚动动画曲线尚未拿到补录样本（待校准），
 * 当前 225ms easeOutCubic 滚动一屏（用户要求在 450ms 基础上速度翻倍）。
 * 用户滚动输入（滚轮/触摸/按键）会立即打断动画。
 */
(function () {
  'use strict';
  var EG = (window.EdgeGest = window.EdgeGest || {});

  var DURATION = 225;

  function Scroller() {
    this.raf = 0;
    this._cancel = () => this.stop();
    this._bound = false;
  }

  Scroller.prototype.maxScroll = function () {
    // scrollingElement 兼容标准/怪异模式与以根元素为滚动容器的页面
    var se = document.scrollingElement;
    var doc = document.documentElement;
    var body = document.body;
    var h = Math.max(
      se ? se.scrollHeight : 0,
      Math.max(doc ? doc.scrollHeight : 0, body ? body.scrollHeight : 0)
    );
    return Math.max(0, h - window.innerHeight);
  };

  Scroller.prototype._listenCancel = function () {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener('wheel', this._cancel, { capture: true, passive: true });
    window.addEventListener('touchstart', this._cancel, { capture: true, passive: true });
    window.addEventListener('keydown', this._cancel, { capture: true });
  };

  Scroller.prototype._unlisten = function () {
    if (!this._bound) return;
    this._bound = false;
    window.removeEventListener('wheel', this._cancel, { capture: true });
    window.removeEventListener('touchstart', this._cancel, { capture: true });
    window.removeEventListener('keydown', this._cancel, { capture: true });
  };

  Scroller.prototype.stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this._unlisten();
  };

  Scroller.prototype._animate = function (target) {
    this.stop();
    var max = this.maxScroll();
    target = Math.max(0, Math.min(target, max));
    var from = window.scrollY || window.pageYOffset || 0;
    var delta = target - from;
    if (Math.abs(delta) < 1) return;
    this._listenCancel();
    var t0 = performance.now();
    var self = this;
    var step = function (t) {
      var k = Math.min(1, (t - t0) / DURATION);
      var e = 1 - Math.pow(1 - k, 3);
      window.scrollTo(0, Math.round(from + delta * e));
      if (k < 1) self.raf = requestAnimationFrame(step);
      else self.stop();
    };
    this.raf = requestAnimationFrame(step);
  };

  /** 滚动 dy 像素（带符号） */
  Scroller.prototype.by = function (dy) {
    var from = window.scrollY || window.pageYOffset || 0;
    this._animate(from + dy);
  };

  /** 滚动到绝对位置 y */
  Scroller.prototype.to = function (y) {
    this._animate(y);
  };

  var inst = null;
  EG.getScroller = function () {
    if (!inst) inst = new Scroller();
    return inst;
  };
})();
