/**
 * Edge Gestures for Chrome — 操作提示气泡
 *
 * 对标量测结果：
 *  - 固定在视口正中心（与手势位置无关），尺寸 ≈300×148 CSS px，圆角 ≈26px
 *  - 底色 rgba(0,0,0,0.70)，层级在轨迹之上
 *  - 内容：白色方向图标（实时绘制笔画路径，含箭头）+ 白色动作名文字，
 *    垂直居中排列；文字 ≈21 CSS px
 *  - 随笔画实时更新（提交一段 / 部分段足够长时重绘图标与文字）
 *  - 与轨迹同帧瞬间消失
 */
(function () {
  'use strict';
  var EG = (window.EdgeGest = window.EdgeGest || {});

  var BOX = 60; // 图标视口（SVG viewBox）
  var TARGET = 38; // 路径在视口内的目标包围尺寸（留出线帽/箭头余量）
  var STROKE = 5; // 图标线宽
  var WING = 9; // 箭头翼长

  function Bubble(opts) {
    this.o = opts;
    this.el = null;
    this.svg = null;
    this.label = null;
    this.key = '';
  }

  Bubble.prototype.show = function () {
    if (this.el) return;
    var d = document.createElement('div');
    d.id = '__eg_bubble';
    var st = d.style;
    st.position = 'fixed';
    st.left = '50%';
    st.top = '50%';
    st.transform = 'translate(-50%, -50%)';
    st.width = '300px';
    st.height = '148px';
    st.borderRadius = '26px';
    st.background = 'rgba(0, 0, 0, 0.70)';
    st.zIndex = '2147483647'; // 盖在轨迹上方
    st.pointerEvents = 'none';
    st.display = 'flex';
    st.flexDirection = 'column';
    st.alignItems = 'center';
    st.justifyContent = 'center';
    st.gap = '8px';
    st.color = '#fff';
    st.font =
      '500 21px/1.2 "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif';

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(BOX));
    svg.setAttribute('height', String(BOX));
    svg.setAttribute('viewBox', '0 0 ' + BOX + ' ' + BOX);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#fff');
    svg.setAttribute('stroke-width', String(STROKE));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    d.appendChild(svg);

    var label = document.createElement('div');
    d.appendChild(label);

    (document.body || document.documentElement).appendChild(d);
    this.el = d;
    this.svg = svg;
    this.label = label;
  };

  /**
   * 更新气泡内容。
   * @param {string[]} seq 已提交方向序列
   * @param {string|null} partialDir 当前未提交段的方向（足够长时一并画入）
   * @param {string} text 动作名（无匹配时为空串 → 隐藏文字）
   */
  Bubble.prototype.update = function (seq, partialDir, text) {
    if (!this.el) return;
    var dirs = seq.slice();
    if (partialDir) dirs.push(partialDir);

    var key = dirs.join('') + '|' + text;
    if (key === this.key) return;
    this.key = key;

    // 文字
    if (text) {
      this.label.textContent = text;
      this.label.style.display = '';
    } else {
      this.label.textContent = '';
      this.label.style.display = 'none';
    }

    // 图标：无任何方向时隐藏
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    if (!dirs.length) {
      this.svg.style.display = 'none';
      return;
    }
    this.svg.style.display = '';

    // 由方向序列生成理想化路径点（单位步长）
    var pts = [[0, 0]];
    for (var i = 0; i < dirs.length; i++) {
      var v = EG.DIR_VEC[dirs[i]];
      var last = pts[pts.length - 1];
      pts.push([last[0] + v[0], last[1] + v[1]]);
    }

    // 归一化到图标视口（等比、居中）
    var minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (var j = 0; j < pts.length; j++) {
      if (pts[j][0] < minX) minX = pts[j][0];
      if (pts[j][0] > maxX) maxX = pts[j][0];
      if (pts[j][1] < minY) minY = pts[j][1];
      if (pts[j][1] > maxY) maxY = pts[j][1];
    }
    var w = Math.max(maxX - minX, 0.001);
    var h = Math.max(maxY - minY, 0.001);
    var s = TARGET / Math.max(w, h);
    var offX = (BOX - w * s) / 2 - minX * s;
    var offY = (BOX - h * s) / 2 - minY * s;
    var P = function (p) {
      return [p[0] * s + offX, p[1] * s + offY];
    };

    var NS = 'http://www.w3.org/2000/svg';
    var path = document.createElementNS(NS, 'path');
    var a = P(pts[0]);
    var dAttr = 'M ' + a[0].toFixed(2) + ' ' + a[1].toFixed(2);
    for (var k = 1; k < pts.length; k++) {
      var b = P(pts[k]);
      dAttr += ' L ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
    }
    path.setAttribute('d', dAttr);
    this.svg.appendChild(path);

    // 箭头：每段终点（除起点外的每个顶点）画一个，朝向该段方向
    for (var m = 1; m < pts.length; m++) {
      var dir = EG.DIR_VEC[dirs[m - 1]];
      var tip = P(pts[m]);
      var ang = Math.atan2(dir[1], dir[0]);
      for (var wv = -1; wv <= 1; wv += 2) {
        var t = ang + Math.PI + wv * 0.5; // 向后 ±~28.6°
        var hx = tip[0] + Math.cos(t) * WING;
        var hy = tip[1] + Math.sin(t) * WING;
        var line = document.createElementNS(NS, 'path');
        line.setAttribute(
          'd',
          'M ' +
            hx.toFixed(2) +
            ' ' +
            hy.toFixed(2) +
            ' L ' +
            tip[0].toFixed(2) +
            ' ' +
            tip[1].toFixed(2)
        );
        this.svg.appendChild(line);
      }
    }
  };

  Bubble.prototype.hide = function () {
    if (this.el) this.el.remove();
    this.el = null;
    this.svg = null;
    this.label = null;
    this.key = '';
  };

  EG.Bubble = Bubble;
})();
