/**
 * Edge Gestures for Chrome — 手势识别引擎（纯逻辑，无 DOM 依赖）
 *
 * 识别模型（对照 Edge 实测行为设计）：
 *  - 按下右键后位移超过 startThreshold 才「激活」（激活即显示轨迹+气泡）；
 *    纯右键点击（未激活）不干预，正常弹菜单。
 *  - 激活后维护「当前段方向 dir」与锚点，每个点做正交投影：
 *      along = 沿当前方向的有符号位移；perp = 垂直偏移；
 *      reach = 本段内沿当前方向到达过的最远处。
 *  - 三种「段边界」事件：
 *      ① 垂直转向：|perp| ≥ turnThreshold
 *         - |along| ≥ minSegmentLen → 提交当前段（seq.push），
 *           锚点移到当前点在旧轴线上的投影，新方向 = 逃逸的垂直轴
 *         - 否则视为初始方向误判 → 直接替换方向（不产生段）
 *      ② 同轴折返：along < reach - max(turnThreshold, reach*0.4)
 *         （滞回阈值防止长笔画中途抖动误切向；垂直轴折返减半——
 *         ↑↓ 滚到底 / ↓↑ 滚到顶 的第二笔只需一半长度）
 *         - reach ≥ minSegmentLen → 提交当前段，锚点移到折返点，
 *           方向取反（↓↑、←→ 类手势靠它切向）
 *         - 否则仅取反方向（初始方向误判的折返形态）
 *      ③ 松手：end() 返回已提交序列，并追加「最后一段」——
 *         激活且当前段长度 ≥ finalMin 时把 dir 追加进序列
 *         （不追加会导致每条手势都缺最后一笔；finalMin 随段出生方式变化，
 *         垂直折返产生的末段按半阈值计）。
 *  - 部分段长度（partialLen）用于气泡实时预览，阈值与执行判定保持一致，
 *    保证「松手时提示的动作 = 实际执行的动作」。
 */
(function () {
  'use strict';
  var EG = (window.EdgeGest = window.EdgeGest || {});

  var DIR_VEC = EG.DIR_VEC;
  var OPPOSITE = { R: 'L', L: 'R', U: 'D', D: 'U' };

  function isVertical(dir) {
    return dir === 'U' || dir === 'D';
  }

  function dominantAxis(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'R' : 'L';
    return dy >= 0 ? 'D' : 'U';
  }

  /**
   * @param {object} opts { startThreshold, turnThreshold, minSegmentLen }（CSS px）
   */
  function GestureEngine(opts) {
    this.o = opts;
    if (!this.o.minSegmentLen) this.o.minSegmentLen = 12;
  }

  /** 相对当前锚点/方向的正交投影 */
  GestureEngine.prototype._proj = function (x, y) {
    var rdx = x - this.anchorX;
    var rdy = y - this.anchorY;
    var vert = isVertical(this.dir);
    var v = DIR_VEC[this.dir];
    return {
      along: vert ? rdy * v[1] : rdx * v[0],
      perp: vert ? rdx : rdy,
    };
  };

  GestureEngine.prototype.start = function (x, y) {
    this.sx = x;
    this.sy = y;
    this.anchorX = x;
    this.anchorY = y;
    this.dir = null; // 当前段方向
    this.seq = []; // 已提交的方向序列
    this.partialLen = 0; // 当前段 |along|
    this.reach = 0; // 当前段沿方向的最远到达
    this.finalMin = this.o.turnThreshold; // 末段计入序列所需的最小长度
    this.activated = false;
    this.points = [[x, y]]; // 原始轨迹点（画线用）
    this.lastX = x;
    this.lastY = y;
  };

  /**
   * 喂入一个鼠标位置。
   * @returns {{activated:boolean, committed:string|null, seq:string[],
   *            partialDir:string|null, partialLen:number}}
   */
  GestureEngine.prototype.feed = function (x, y) {
    var res = {
      activated: false,
      committed: null,
      seq: this.seq,
      partialDir: this.dir,
      partialLen: this.partialLen,
    };
    if (x === this.lastX && y === this.lastY) return res;
    this.lastX = x;
    this.lastY = y;
    this.points.push([x, y]);

    if (!this.activated) {
      var ddx = x - this.sx;
      var ddy = y - this.sy;
      var len = Math.hypot(ddx, ddy);
      if (len >= this.o.startThreshold) {
        this.activated = true;
        this.dir = dominantAxis(ddx, ddy);
        this.anchorX = this.sx;
        this.anchorY = this.sy;
        this.partialLen = len;
        this.reach = len;
        res.activated = true;
        res.partialDir = this.dir;
        res.partialLen = len;
      }
      return res;
    }

    var p = this._proj(x, y);

    // —— ② 同轴折返（带滞回）——
    // 滚动类手势（↑↓ 滚到底 / ↓↑ 滚到顶）的第二笔减半：垂直轴的折返阈值与
    // 末段最小长度都取一半；水平轴（←→ 关标签 / →← 恢复标签）保持原样。
    var verticalFlip = isVertical(this.dir);
    var reverseTrigger = Math.max(this.o.turnThreshold, this.reach * 0.4);
    if (verticalFlip) reverseTrigger *= 0.5;
    if (this.reach > 0 && p.along < this.reach - reverseTrigger) {
      if (this.reach >= this.o.minSegmentLen) {
        // 折返点前的那一段成立
        res.committed = this.dir;
        this.seq = this.seq.concat([this.dir]);
        res.seq = this.seq;
        var vOld = DIR_VEC[this.dir];
        this.anchorX += vOld[0] * this.reach; // 锚点 = 折返点
        this.anchorY += vOld[1] * this.reach;
        this.finalMin = verticalFlip
          ? this.o.turnThreshold * 0.5
          : this.o.turnThreshold;
      } else {
        // 未成熟折返 = 首笔方向修正，末段阈值不变
        this.finalMin = this.o.turnThreshold;
      }
      this.dir = OPPOSITE[this.dir];
      p = this._proj(x, y);
      this.reach = Math.max(0, p.along);
      this.partialLen = Math.abs(p.along);
      res.partialDir = this.dir;
      res.partialLen = this.partialLen;
      return res;
    }

    if (p.along > this.reach) this.reach = p.along;
    this.partialLen = Math.abs(p.along);

    // —— ① 垂直转向 ——
    if (Math.abs(p.perp) >= this.o.turnThreshold) {
      if (Math.abs(p.along) >= this.o.minSegmentLen) {
        // 正常转向：提交当前段
        res.committed = this.dir;
        this.seq = this.seq.concat([this.dir]);
        res.seq = this.seq;
        // 锚点 = 当前点在旧方向轴线上的投影
        if (isVertical(this.dir)) this.anchorY = y;
        else this.anchorX = x;
        this.dir = isVertical(this.dir)
          ? p.perp > 0 ? 'R' : 'L'
          : p.perp > 0 ? 'D' : 'U';
        this.finalMin = this.o.turnThreshold;
      } else {
        // 初始方向误判：替换方向，锚点不动
        this.dir = dominantAxis(x - this.anchorX, y - this.anchorY);
        this.finalMin = this.o.turnThreshold;
      }
      p = this._proj(x, y);
      this.reach = Math.max(0, p.along);
      this.partialLen = Math.abs(p.along);
      res.partialDir = this.dir;
      res.partialLen = this.partialLen;
    }
    return res;
  };

  /**
   * 松手：已提交序列 + 满足最小长度的最后一段。
   * （若只返回已提交段，每条手势都会缺最后一笔。）
   * finalMin 通常是 turnThreshold；垂直轴折返 born 的末段（↑↓ / ↓↑ 的第二笔）减半。
   */
  GestureEngine.prototype.end = function () {
    var seq = this.seq.slice();
    if (this.activated && this.dir && this.partialLen >= this.finalMin) {
      seq.push(this.dir);
    }
    return seq;
  };

  /** 手势进行中的实时预览（气泡用）：匹配用序列 + 图标预览方向 */
  GestureEngine.prototype.preview = function () {
    return {
      seq: this.end(), // 与执行判定完全一致
      iconPartial:
        this.activated && this.dir && this.partialLen >= 12 ? this.dir : null,
    };
  };

  EG.GestureEngine = GestureEngine;
})();
