/**
 * Edge Gestures for Chrome — Background Service Worker
 *
 * 接收内容脚本的动消息，用 chrome.tabs / chrome.sessions 完成
 * 页面内做不到的动作（标签页管理、恢复关闭等）。
 * 所有标签页操作都锚定 sender.tab.windowId，多窗口下不会作用到别的窗口。
 */
'use strict';

// 点击工具栏图标 → 打开设置页
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  // 只接受本扩展自身内容脚本的消息
  if (!msg || msg.type !== 'edge-gestures' || !sender.tab) return;
  if (sender.id !== chrome.runtime.id) return;
  const tabId = sender.tab.id;
  const windowId = sender.tab.windowId;

  (async () => {
    switch (msg.action) {
      case 'newTab':
        // 在手势所在窗口、紧挨当前标签页新建（Ctrl+T 语义）
        await chrome.tabs.create({ windowId, index: sender.tab.index + 1 });
        break;

      case 'closeTab':
        await chrome.tabs.remove(tabId);
        break;

      case 'refresh':
        await chrome.tabs.reload(tabId, { bypassCache: false });
        break;

      case 'reopen': {
        // 恢复最近关闭的会话：优先标签页，其次整窗
        const items = await chrome.sessions.getRecentlyClosed();
        const item = items[0];
        if (!item) break;
        if (item.tab && item.tab.sessionId) {
          await chrome.sessions.restore(item.tab.sessionId);
        } else if (item.window && item.window.sessionId) {
          await chrome.sessions.restore(item.window.sessionId);
        } else {
          // 兜底：无 sessionId 信息时恢复最近一次会话
          await chrome.sessions.restore();
        }
        break;
      }

      case 'prevTab':
      case 'nextTab': {
        const all = await chrome.tabs.query({ windowId });
        all.sort((a, b) => a.index - b.index);
        const i = all.findIndex((t) => t.id === tabId);
        if (i < 0) break;
        const j =
          msg.action === 'prevTab'
            ? Math.max(0, i - 1)
            : Math.min(all.length - 1, i + 1);
        if (j !== i) await chrome.tabs.update(all[j].id, { active: true });
        break;
      }

      case 'closeAll':
        // 关闭手势所在窗口的所有标签页（窗口随之关闭）
        // ⚠️ 与 Edge「←↓ 关闭所有标签页」对齐；数据无提示直接丢弃，慎用
        {
          const all = await chrome.tabs.query({ windowId });
          await chrome.tabs.remove(all.map((t) => t.id));
        }
        break;
    }
  })().catch((err) => {
    console.warn('[edge-gestures] action failed:', msg.action, err);
  });
});
