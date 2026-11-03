/**
 * Edge Gestures for Chrome — 设置页逻辑
 * 修改即保存（300ms 防抖，避免撞 chrome.storage.sync 写配额），
 * 内容脚本通过 storage.onChanged 热更新。
 * 注意：设置页不注入内容脚本，这里内联一份与 shared/gestures.js 相同的默认值。
 */
'use strict';

const DEFAULTS = {
  enabled: true,
  showHint: true,
  trailColor: '#0078D4',
  trailWidth: 4.33,
  startThreshold: 10,
  turnThreshold: 24,
};

const NUMBER_KEYS = ['trailWidth', 'startThreshold', 'turnThreshold'];
const FIELDS = [
  'enabled',
  'showHint',
  'trailColor',
  'trailWidth',
  'startThreshold',
  'turnThreshold',
];
const $ = (id) => document.getElementById(id);

function load() {
  // get 传入对象时，缺失的键会以对象里的值为默认值
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    if (chrome.runtime.lastError) cfg = DEFAULTS;
    for (const key of FIELDS) {
      const el = $(key);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!cfg[key];
      else el.value = cfg[key];
      el.addEventListener('input', scheduleSave);
    }
  });
}

let saveTimer = 0;
let statusTimer = 0;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

function flashStatus(text) {
  const el = $('status');
  el.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (el.textContent = ''), 1500);
}

function save() {
  const cfg = {};
  for (const key of FIELDS) {
    const el = $(key);
    if (el.type === 'checkbox') {
      cfg[key] = el.checked;
    } else if (el.type === 'number') {
      // 空值/非法值回落默认，绝不写入 0（0 会导致轨迹消失或阈值失效）
      const n = parseFloat(el.value);
      cfg[key] = Number.isFinite(n) ? n : DEFAULTS[key];
    } else {
      cfg[key] = el.value;
    }
  }
  chrome.storage.sync.set(cfg, () => {
    if (chrome.runtime.lastError) {
      flashStatus('保存失败：' + chrome.runtime.lastError.message);
      return;
    }
    // 修正输入框显示（如空值回填默认）
    for (const key of NUMBER_KEYS) {
      const el = $(key);
      if (document.activeElement !== el) el.value = cfg[key];
    }
    flashStatus('已保存 ✓（即时生效）');
  });
}

load();
