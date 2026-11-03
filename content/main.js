/**
 * Edge Gestures for Chrome — 主编排（事件状态机）
 *
 * 状态机：idle → armed（按下右键）→ active（位移超阈值，UI 出现）→ idle（松手/取消）
 *
 * 关键机制（方案成立的前提，已调研验证）：
 *  Windows 上 Chrome 的 contextmenu 在 mouseup 之后才触发，因此可以用
 *  「激活过手势 → 松手时置 suppressMenu 标志 → 吞掉紧随的 contextmenu」
 *  实现「拖动了不弹菜单、纯右键正常弹菜单」的 Edge 手感。
 */
(function () {
  'use strict';
  var EG = (window.EdgeGest = window.EdgeGest || {});

  var cfg = Object.assign({}, EG.DEFAULTS);
  var cfgLoaded = false;
  var state = 'idle'; // idle | armed | active
  var engine = null;
  var trail = null;
  var bubble = null;
  var suppressMenu = false;

  // ---- 配置加载与热更新 ----
  try {
    chrome.storage.sync.get(EG.DEFAULTS, function (stored) {
      if (chrome.runtime.lastError) return;
      Object.assign(cfg, stored || {});
      cfgLoaded = true;
    });
    // 兜底：storage 异常挂起时不能永久锁死手势
    setTimeout(function () {
      cfgLoaded = true;
    }, 1000);
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'sync') return;
      for (var k in changes) {
        if (!(k in cfg)) continue;
        if (changes[k].newValue === undefined) continue; // 键被删除时不污染
        cfg[k] = changes[k].newValue;
      }
    });
  } catch (_) {
    cfgLoaded = true;
  }

  function finishUI() {
    if (trail) trail.hide();
    if (bubble) bubble.hide();
    trail = null;
    bubble = null;
  }

  function cancelGesture() {
    finishUI();
    state = 'idle';
    engine = null;
  }

  /** 气泡内容 = 与执行判定一致的实时匹配 + 图标预览未提交段 */
  function updateBubble() {
    if (!bubble) return;
    var pv = engine.preview();
    var g = EG.matchGesture(pv.seq);
    bubble.update(engine.seq, pv.iconPartial, g ? g.label : '');
  }

  window.addEventListener(
    'mousedown',
    function (e) {
      if (!cfg.enabled || e.button !== 2) return;
      if (!cfgLoaded) return; // 配置未就绪，避免首手势用错阈值
      // 上一次手势丢失了 mouseup（如在 iframe 内松手）→ 残留状态，
      // 此时又来了一次新的右键按下：作废旧手势，按新手势处理
      if (state !== 'idle') cancelGesture();
      state = 'armed';
      engine = new EG.GestureEngine({
        startThreshold: cfg.startThreshold,
        turnThreshold: cfg.turnThreshold,
        minSegmentLen: 12,
      });
      engine.start(e.clientX, e.clientY);
    },
    true
  );

  window.addEventListener(
    'mousemove',
    function (e) {
      if (state === 'idle') return;
      // 右键已不在按下状态却还有 mousemove（mouseup 在 iframe 等处丢失）
      // → 作废旧手势，避免残留 seq 误触发动作
      if (!(e.buttons & 2)) {
        cancelGesture();
        return;
      }
      var ev = engine.feed(e.clientX, e.clientY);

      if (ev.activated && state === 'armed') {
        state = 'active';
        trail = new EG.Trail(cfg);
        trail.setPoints(engine.points);
        trail.show();
        if (cfg.showHint) {
          bubble = new EG.Bubble(cfg);
          bubble.show();
          updateBubble();
        }
      }
      if (state === 'active') {
        if (ev.committed || (bubble && engine.partialLen >= 12)) updateBubble();
      }
    },
    true
  );

  window.addEventListener(
    'mouseup',
    function (e) {
      if (e.button !== 2 || state === 'idle') return;
      var wasActive = state === 'active';
      var seq = engine.end();
      cancelGesture();

      if (!wasActive) return; // 纯右键：不吞菜单

      // 拖动手势成立：吞掉紧随其后的 contextmenu，并执行匹配的动作
      suppressMenu = true;
      setTimeout(function () {
        suppressMenu = false;
      }, 100);
      var g = EG.matchGesture(seq);
      if (g) EG.executeAction(g.action);
    },
    true
  );

  window.addEventListener(
    'contextmenu',
    function (e) {
      if (state === 'active') {
        // 防御：正常流程 contextmenu 前必有 mouseup，到这里说明时序异常
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (suppressMenu) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppressMenu = false;
      }
    },
    true
  );

  // 拖出窗口 / 失焦 / Esc：取消手势（不执行动作、不吞菜单）
  window.addEventListener('blur', function () {
    if (state !== 'idle') cancelGesture();
  });
  document.documentElement.addEventListener('mouseleave', function (e) {
    if (state === 'active' && e.buttons & 2) cancelGesture();
  });
  window.addEventListener(
    'keydown',
    function (e) {
      if (e.key === 'Escape' && state !== 'idle') cancelGesture();
    },
    true
  );
})();
