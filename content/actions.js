/**
 * Edge Gestures for Chrome — 动作执行
 *
 * 页面内可完成的动作直接执行（history/window.stop/滚动）；
 * 涉及标签页/会话的动转发给 background service worker。
 */
(function () {
  'use strict';
  var EG = (window.EdgeGest = window.EdgeGest || {});

  /** 需要在 background 里用 chrome.tabs/chrome.sessions 完成的动作 */
  EG.REMOTE_ACTIONS = [
    'newTab',
    'closeTab',
    'reopen',
    'refresh',
    'prevTab',
    'nextTab',
    'closeAll',
  ];

  EG.executeAction = function (action) {
    switch (action) {
      case 'back':
        history.back();
        return;
      case 'forward':
        history.forward();
        return;
      case 'stopLoading':
        try {
          window.stop();
        } catch (_) {}
        return;
      case 'scrollUp':
        EG.getScroller().by(-window.innerHeight);
        return;
      case 'scrollDown':
        EG.getScroller().by(window.innerHeight);
        return;
      case 'scrollTop':
        EG.getScroller().to(0);
        return;
      case 'scrollBottom':
        EG.getScroller().to(EG.getScroller().maxScroll());
        return;
      default:
        if (EG.REMOTE_ACTIONS.indexOf(action) !== -1) {
          try {
            var p = chrome.runtime.sendMessage({ type: 'edge-gestures', action: action });
            if (p && p.catch) p.catch(function () {});
          } catch (_) {
            // 扩展上下文失效（如刚被更新），忽略
          }
        }
    }
  };
})();
