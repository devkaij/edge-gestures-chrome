/**
 * Edge Gestures for Chrome — 手势表与默认配置（内容页与设置页共用）
 *
 * 手势集与 Edge 114+ 内置的 16 种右键手势 1:1 对齐（仅 4 个正方向，无对角线）。
 * 视觉默认值来自 2026-10-11 对本机 Edge 的录屏逐帧量测 + PNG 截图地面真值：
 *  - 轨迹颜色 #0078D4（PNG 确认）
 *  - 轨迹宽度 6.5 设备像素 @150% 缩放 ≈ 4.33 CSS px（恒定、圆头、无锥形）
 *  - 气泡底色 rgba(0,0,0,0.70)，尺寸 ≈300×148 CSS px，圆角 ≈26px
 *  - 气泡位置 = 视口正中心（与手势位置无关，5 样本验证）
 *  - 松手后轨迹与气泡同帧瞬间消失（无淡出动画）
 */
(function () {
  'use strict';
  var EG = (window.EdgeGest = window.EdgeGest || {});

  /** 方向单位向量（屏幕坐标系：y 向下为正） */
  EG.DIR_VEC = {
    R: [1, 0],
    L: [-1, 0],
    D: [0, 1],
    U: [0, -1],
  };

  /**
   * 16 种手势 → 动作映射（seq 为已提交笔画的方向序列）。
   * label 为气泡里显示的动作名（量测样本里出现过的写法保持一致）。
   */
  EG.GESTURES = [
    { seq: ['L'], action: 'back', label: '后退' },
    { seq: ['R'], action: 'forward', label: '前进' },
    { seq: ['U'], action: 'scrollUp', label: '向上滚动' },
    { seq: ['D'], action: 'scrollDown', label: '向下滚动' },
    { seq: ['D', 'R'], action: 'closeTab', label: '关闭标签页' },
    { seq: ['L', 'R'], action: 'closeTab', label: '关闭标签页' },
    { seq: ['L', 'U'], action: 'reopen', label: '恢复关闭的标签页' },
    { seq: ['R', 'L'], action: 'reopen', label: '恢复关闭的标签页' },
    { seq: ['R', 'U'], action: 'newTab', label: '打开新标签页' },
    { seq: ['R', 'D'], action: 'refresh', label: '刷新' },
    { seq: ['U', 'L'], action: 'prevTab', label: '切换到左侧标签页' },
    { seq: ['U', 'R'], action: 'nextTab', label: '切换到右侧标签页' },
    { seq: ['D', 'L'], action: 'stopLoading', label: '停止加载' },
    { seq: ['L', 'D'], action: 'closeAll', label: '关闭所有标签页' },
    { seq: ['U', 'D'], action: 'scrollBottom', label: '滚动到页面底部' },
    { seq: ['D', 'U'], action: 'scrollTop', label: '滚动到页面顶部' },
  ];

  /** 精确匹配：seq 与某条手势完全一致时返回该手势，否则 null。 */
  EG.matchGesture = function (seq) {
    if (!seq || !seq.length) return null;
    for (var i = 0; i < EG.GESTURES.length; i++) {
      var g = EG.GESTURES[i];
      if (g.seq.length !== seq.length) continue;
      var ok = true;
      for (var j = 0; j < seq.length; j++) {
        if (g.seq[j] !== seq[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return g;
    }
    return null;
  };

  /** 默认配置（chrome.storage.sync 可覆盖；设置页可修改） */
  EG.DEFAULTS = {
    enabled: true,
    trailColor: '#0078D4',
    trailWidth: 4.33, // CSS px（= 6.5 设备px / 1.5 缩放）
    showHint: true,
    startThreshold: 10, // 激活手势所需的最小位移（CSS px），Edge 手感：偏低
    turnThreshold: 48, // 判定「转向/提交一段」所需的垂直偏移（CSS px）
  };
})();
