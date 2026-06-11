/**
 * 高松灯看板娘 — 鼠标区域 → 表情联动 + 点击彩蛋
 *
 * 1. 鼠标在不同 UI 区域时，自动切换看板娘表情
 * 2. 快速连击身体触发隐藏彩蛋（咕咕嘎嘎！）
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════
  // Part 1: 区域 → 表情映射
  // ═══════════════════════════════════════════

  var ZONES = [
    // 系统状态（最高优先级）
    { sel: '.global-error',                expr: 'sad01',       cooldown: 5000 },
    { sel: '.global-loading',              expr: 'surprised01', cooldown: 3000 },

    // 运行/播放按钮
    { sel: "[title='运行代码']",            expr: 'kime01',     cooldown: 3000 },

    // AI 解说面板
    { sel: '.ai-tutor-panel',              expr: 'kandou01',   cooldown: 4000 },
    { sel: '.complexity-card',             expr: 'serious02',   cooldown: 4000 },
    { sel: '.ai-explain-btn',              expr: 'kime02',     cooldown: 3000 },
    { sel: '.ai-tag',                      expr: 'smile01',    cooldown: 3500 },

    // 编辑器 & 数据区
    { sel: '.editor-card',                 expr: 'thinking01',  cooldown: 5000 },
    { sel: '.variable-panel',             expr: 'serious01',   cooldown: 5000 },
    { sel: '.scalar-card',                expr: 'smile01',    cooldown: 3000 },
    { sel: '.heap-stack-panel',            expr: 'thinking02',  cooldown: 5000 },
    { sel: '.hs-body',                     expr: 'thinking02',  cooldown: 4000 },
    { sel: '.stack-frame',                 expr: 'serious01',   cooldown: 3500 },
    { sel: '.console-panel',               expr: 'idle',        cooldown: 4000 },
    { sel: '.console-body',                expr: 'smile01',    cooldown: 3500 },

    // 数据结构可视化区
    { sel: '.ll-canvas',                   expr: 'smile02',    cooldown: 4000 },
    { sel: '.ll-node',                     expr: 'smile02',    cooldown: 3000 },
    { sel: '.rs-canvas',                   expr: 'thinking01',  cooldown: 4000 },
    { sel: '.rs-frame',                    expr: 'serious01',   cooldown: 3500 },

    // 进度 & 播放
    { sel: '.progress-track',              expr: 'smile01',    cooldown: 4000 },
    { sel: "[title='上一步'], [title='下一步']", expr: 'serious02', cooldown: 2000 },

    // 控制栏
    { sel: "[title='跳到第一步'],[title='跳到最后']", expr: 'smile02', cooldown: 3000 },
    { sel: '.ai-toggle-btn',               expr: 'kandou01',   cooldown: 4000 },
    { sel: '.control-bar',                 expr: 'idle',        cooldown: 3000 },
  ];

  var DEFAULT_EXPR = 'idle';
  var POLL_INTERVAL = 200;
  var POLL_TIMEOUT = 10000;

  var currentZone = null;
  var lastExprChange = 0;
  var lastExpr = DEFAULT_EXPR;
  var pollTimer = null;
  var mouseHandler = null;

  function setModelExpression(name) {
    try {
      var mgr = window.__live2dModel;
      if (!mgr) return false;
      var model = mgr.cubism2model && mgr.cubism2model.live2DMgr && mgr.cubism2model.live2DMgr.model;
      if (!model || !model.expressions) return false;
      if (!model.expressions[name]) {
        var fallbacks = ['idle', 'default', 'smile01'];
        for (var i = 0; i < fallbacks.length; i++) {
          if (model.expressions[fallbacks[i]]) {
            model.setExpression(fallbacks[i]);
            return true;
          }
        }
        return false;
      }
      model.setExpression(name);
      return true;
    } catch (e) {
      return false;
    }
  }

  function onMouseMove(e) {
    if (!window.__live2dModel) return;

    var matched = null;
    for (var i = 0; i < ZONES.length; i++) {
      if (e.target.closest(ZONES[i].sel)) {
        matched = ZONES[i];
        break;
      }
    }

    var zoneName = matched ? matched.sel : null;
    if (zoneName === currentZone) return;
    currentZone = zoneName;

    var now = Date.now();

    if (matched) {
      if (now - lastExprChange < matched.cooldown) return;
      if (setModelExpression(matched.expr)) {
        lastExpr = matched.expr;
        lastExprChange = now;
      }
    } else {
      if (lastExpr === DEFAULT_EXPR) return;
      if (now - lastExprChange < 2000) return;
      if (setModelExpression(DEFAULT_EXPR)) {
        lastExpr = DEFAULT_EXPR;
        lastExprChange = now;
      }
    }
  }

  function startPolling() {
    var startTime = Date.now();
    pollTimer = setInterval(function () {
      if (window.__live2dModel &&
          window.__live2dModel.cubism2model &&
          window.__live2dModel.cubism2model.live2DMgr &&
          window.__live2dModel.cubism2model.live2DMgr.model) {
        clearInterval(pollTimer);
        pollTimer = null;
        setModelExpression(DEFAULT_EXPR);
        lastExpr = DEFAULT_EXPR;
        mouseHandler = function (e) { onMouseMove(e); };
        document.addEventListener('mousemove', mouseHandler, { passive: true });
        return;
      }
      if (Date.now() - startTime > POLL_TIMEOUT) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, POLL_INTERVAL);
  }

  // ═══════════════════════════════════════════
  // Part 2: 点击彩蛋 — 咕咕嘎嘎连击系统 🐧
  // ═══════════════════════════════════════════

  var tapCount = 0;
  var tapTimer = null;
  var TAP_WINDOW = 2000;

  var EASTER_EGGS = [
    { count: 7,  text: '啊啊啊…！不要再戳了啦…代码还在等着你呢…（脸红到耳根）' },
    { count: 5,  text: '咕咕嘎嘎！！…你、你是戳戳星人吗！(╯>□<)╯' },
    { count: 3,  text: '不要一直戳我啦…虽然不痛但是很害羞的…(*/ω＼*)' },
  ];

  function showEasterMessage(msg) {
    try {
      var tips = document.getElementById('waifu-tips');
      if (!tips) return;
      tips.innerHTML = msg;
      tips.classList.add('waifu-tips-active');
      setTimeout(function () {
        tips.classList.remove('waifu-tips-active');
      }, 4000);
    } catch (e) { /* 静默 */ }
  }

  function onTapBody() {
    var now = Date.now();
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);

    tapTimer = setTimeout(function () {
      tapCount = 0;
      tapTimer = null;
    }, TAP_WINDOW);

    for (var i = 0; i < EASTER_EGGS.length; i++) {
      if (tapCount === EASTER_EGGS[i].count) {
        (function (msg) {
          setTimeout(function () { showEasterMessage(msg); }, 1500);
        })(EASTER_EGGS[i].text);
        return;
      }
    }

    if (tapCount === 10) {
      setTimeout(function () {
        showEasterMessage('十连击！！你赢了…我认输啦！(oT-T)ノ 咕咕嘎嘎…以后还请对我温柔一点哦…');
        setModelExpression('shame01');
        setTimeout(function () { setModelExpression('idle'); }, 3000);
      }, 1500);
    }
    if (tapCount >= 15 && tapCount % 5 === 0) {
      setTimeout(function () {
        showEasterMessage('已经第 ' + tapCount + ' 下了…求求你别戳了，再戳我就变成企鹅肉饼了！🐧');
      }, 1500);
    }
  }

  window.addEventListener('live2d:tapbody', onTapBody);

  // ═══════════════════════════════════════════
  // Part 3: 启动与清理
  // ═══════════════════════════════════════════

  function destroy() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (mouseHandler) { document.removeEventListener('mousemove', mouseHandler); mouseHandler = null; }
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
    window.removeEventListener('live2d:tapbody', onTapBody);
  }

  window.addEventListener('beforeunload', destroy);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPolling);
  } else {
    startPolling();
  }
})();
