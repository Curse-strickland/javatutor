/**
 * 拉普兰德看板娘 — 鼠标区域 → 表情联动 + 点击彩蛋
 *
 * 1. 鼠标在不同 UI 区域时，自动切换看板娘表情
 * 2. 快速连击身体触发隐藏彩蛋
 *
 * 表情同时兼容 Cubism 2（旧模型，按 expressions[name] 查找）
 * 和 Cubism 3/4/5（新模型，通过 setExpression 按 model3.json 里的 Name 触发）。
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════
  // 拉普兰德可用表情（model3.json 中注册的 Name）
  // ═══════════════════════════════════════════
  var EXPR = {
    GRIN: '咧嘴笑',      // 开心 / 得意
    STAR: '星星眼',      // 惊喜 / 赞叹
    SWEAT: '流汗',       // 紧张 / 复杂
    ANGRY: '生气嘴',     // 不满
    DARK: '脸黑',        // 严重错误 / 黑化
    VEIN: '青筋符号'     // 被惹恼
  };

  // ═══════════════════════════════════════════
  // Part 1: 区域 → 表情映射
  // ═══════════════════════════════════════════

  var ZONES = [
    // 系统状态（最高优先级）
    { sel: '.global-error',                expr: EXPR.DARK,   cooldown: 5000 },
    { sel: '.global-loading',              expr: EXPR.SWEAT,  cooldown: 3000 },

    // 运行/播放按钮
    { sel: "[title='运行代码']",            expr: EXPR.GRIN,   cooldown: 3000 },

    // AI 解说面板
    { sel: '.ai-tutor-panel',              expr: EXPR.STAR,   cooldown: 4000 },
    { sel: '.complexity-card',             expr: EXPR.SWEAT,  cooldown: 4000 },
    { sel: '.ai-explain-btn',              expr: EXPR.STAR,   cooldown: 3000 },
    { sel: '.ai-tag',                      expr: EXPR.GRIN,   cooldown: 3500 },

    // 编辑器 & 数据区
    { sel: '.editor-card',                 expr: EXPR.STAR,   cooldown: 5000 },
    { sel: '.variable-panel',              expr: EXPR.GRIN,   cooldown: 5000 },
    { sel: '.scalar-card',                 expr: EXPR.GRIN,   cooldown: 3000 },
    { sel: '.heap-stack-panel',            expr: EXPR.STAR,   cooldown: 5000 },
    { sel: '.hs-body',                     expr: EXPR.STAR,   cooldown: 4000 },
    { sel: '.stack-frame',                 expr: EXPR.GRIN,   cooldown: 3500 },
    { sel: '.console-panel',               expr: 'idle',      cooldown: 4000 },
    { sel: '.console-body',                expr: EXPR.GRIN,   cooldown: 3500 },

    // 数据结构可视化区
    { sel: '.ll-canvas',                   expr: EXPR.GRIN,   cooldown: 4000 },
    { sel: '.ll-node',                     expr: EXPR.GRIN,   cooldown: 3000 },
    { sel: '.rs-canvas',                   expr: EXPR.STAR,   cooldown: 4000 },
    { sel: '.rs-frame',                    expr: EXPR.GRIN,   cooldown: 3500 },

    // 进度 & 播放
    { sel: '.progress-track',              expr: EXPR.GRIN,   cooldown: 4000 },
    { sel: "[title='上一步'], [title='下一步']", expr: EXPR.SWEAT, cooldown: 2000 },

    // 控制栏
    { sel: "[title='跳到第一步'],[title='跳到最后']", expr: EXPR.GRIN, cooldown: 3000 },
    { sel: '.ai-toggle-btn',               expr: EXPR.STAR,   cooldown: 4000 },
    { sel: '.control-bar',                 expr: 'idle',      cooldown: 3000 },
  ];

  var DEFAULT_EXPR = 'idle';
  var POLL_INTERVAL = 200;
  var POLL_TIMEOUT = 10000;

  var currentZone = null;
  var lastExprChange = 0;
  var lastExpr = DEFAULT_EXPR;
  var pollTimer = null;
  var mouseHandler = null;

  // Cubism 2 旧通道（高松灯等 .moc 模型）
  function getCubism2Model() {
    var mgr = window.__live2dModel;
    if (!mgr) return null;
    var model = mgr.cubism2model && mgr.cubism2model.live2DMgr && mgr.cubism2model.live2DMgr.model;
    return model && model.expressions ? model : null;
  }

  // Cubism 3/4/5 新通道（拉普兰德 .moc3 模型）
  function getCubism5Model() {
    var mgr = window.__live2dModel;
    if (!mgr || !mgr.cubism5model) return null;
    try {
      var live2dMgr = mgr.cubism5model.subdelegates.at(0).getLive2DManager();
      var model = live2dMgr._models.at(0);
      return model && typeof model.setExpression === 'function' ? model : null;
    } catch (e) {
      return null;
    }
  }

  function setModelExpression(name) {
    try {
      // 新模型（拉普兰德）
      var m5 = getCubism5Model();
      if (m5) {
        // 'idle' / 'default'：Cubism 表情运动结束后会自然恢复默认脸，无需处理
        if (name === 'idle' || name === 'default') return true;
        m5.setExpression(name);
        return true;
      }

      // 旧模型（Cubism 2）
      var model = getCubism2Model();
      if (!model) return false;
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

  function isModelReady() {
    return !!(getCubism5Model() || getCubism2Model());
  }

  // ═══════════════════════════════════════════
  // Part 1.5: 气泡文字 → 表情联动
  //
  // 用 MutationObserver 监听 #waifu-tips 的内容变化，
  // 按台词关键词映射到对应表情，使"说的话"和"脸"一致。
  // 规则按数组顺序匹配，先中先得。
  // ═══════════════════════════════════════════

  var TEXT_EXPR_RULES = [
    { expr: EXPR.VEIN,  keys: ['后果自负', '警告', '得寸进尺', 'TouchException', '这笔账', '记账', '还手', '连狼都睡', '不打算睡'] },
    { expr: EXPR.ANGRY, keys: ['咬', '戳', '摸', '拿开', '胆子', '吵'] },
    { expr: EXPR.SWEAT, keys: ['编译中', '加载中', '等待', '犯困', '熬夜', '复杂', '跟得上', '睡着'] },
    { expr: EXPR.STAR,  keys: ['AI', '看看', '秘密', '灵魂', '揭晓', '登场', '范例', '信任', '面具', '真相', '想看看', '讲', '招式', '解剖', '底细'] },
    { expr: EXPR.GRIN,  keys: ['哈', '酒', '开演', '好戏', '有趣', '演出', '狂欢', '喝一杯', '精彩', '舞台', '猎物', '狩猎', '规则', '本事', '幕', '戏剧', '喜欢', '痛快', '懒', '敌人'] },
    { expr: EXPR.DARK,  keys: ['报错', '错误', 'NullPointer', 'Exception', '失败', 'bug', '灰烬', '火场', '背叛', '生死', '弱者'] }
  ];

  var msgExprUntil = 0;   // 台词表情生效期，期间区域联动不抢戏
  var tipsObserver = null;

  function classifyText(text) {
    for (var i = 0; i < TEXT_EXPR_RULES.length; i++) {
      var keys = TEXT_EXPR_RULES[i].keys;
      for (var j = 0; j < keys.length; j++) {
        if (text.indexOf(keys[j]) !== -1) return TEXT_EXPR_RULES[i].expr;
      }
    }
    return null;
  }

  function bindTipsObserver() {
    var tips = document.getElementById('waifu-tips');
    if (!tips || tipsObserver) return;
    tipsObserver = new MutationObserver(function () {
      if (!tips.classList.contains('waifu-tips-active')) return;
      var text = tips.textContent || '';
      if (!text) return;
      var expr = classifyText(text) || pickRandomExprName();
      if (setModelExpression(expr)) {
        lastExpr = expr;
        lastExprChange = Date.now();
        msgExprUntil = Date.now() + 4000;
      }
    });
    tipsObserver.observe(tips, {
      childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['class']
    });
  }

  function unbindTipsObserver() {
    if (tipsObserver) { tipsObserver.disconnect(); tipsObserver = null; }
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

    // 台词表情生效期内，区域联动不抢戏
    if (Date.now() < msgExprUntil) return;

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
      if (isModelReady()) {
        clearInterval(pollTimer);
        pollTimer = null;
        setModelExpression(DEFAULT_EXPR);
        lastExpr = DEFAULT_EXPR;
        mouseHandler = function (e) { onMouseMove(e); };
        document.addEventListener('mousemove', mouseHandler, { passive: true });
        bindCanvasTap();
        bindTipsObserver();
        return;
      }
      if (Date.now() - startTime > POLL_TIMEOUT) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, POLL_INTERVAL);
  }

  // ═══════════════════════════════════════════
  // Part 2: 点击彩蛋 — 连击系统 + 点击换表情
  //
  // 拉普兰德模型没有 .userdata3.json 点击热区文件，
  // 框架的 live2d:tapbody 事件不会触发，
  // 因此直接在 canvas 上监听点击（带拖拽阈值过滤）。
  // ═══════════════════════════════════════════

  var tapCount = 0;
  var tapTimer = null;
  var TAP_WINDOW = 2000;
  var DRAG_THRESHOLD = 6; // px，超过视为拖拽而非点击

  var canvasEl = null;
  var downX = 0;
  var downY = 0;

  var LAPPLAND_EXPRS = [EXPR.GRIN, EXPR.STAR, EXPR.SWEAT, EXPR.ANGRY, EXPR.DARK, EXPR.VEIN];

  function pickRandomExprName() {
    var pool = LAPPLAND_EXPRS.filter(function (n) { return n !== lastExpr; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function onCanvasPointerDown(e) {
    downX = e.clientX;
    downY = e.clientY;
  }

  function onCanvasPointerUp(e) {
    if (Math.abs(e.clientX - downX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - downY) > DRAG_THRESHOLD) return;
    onTapBody();
    // 让 waifu-tips.js 的 tapBody 台词触发（模型无热区，框架不会自己派发）。
    // 气泡弹出后由 MutationObserver 按台词内容自动配上对应表情。
    window.dispatchEvent(new Event('live2d:tapbody'));
  }

  function onCanvasMouseEnter() {
    window.dispatchEvent(new Event('live2d:hoverbody'));
  }

  function bindCanvasTap() {
    canvasEl = document.getElementById('live2d');
    if (!canvasEl) return;
    canvasEl.addEventListener('pointerdown', onCanvasPointerDown);
    canvasEl.addEventListener('pointerup', onCanvasPointerUp);
    canvasEl.addEventListener('mouseenter', onCanvasMouseEnter);
  }

  function unbindCanvasTap() {
    if (!canvasEl) return;
    canvasEl.removeEventListener('pointerdown', onCanvasPointerDown);
    canvasEl.removeEventListener('pointerup', onCanvasPointerUp);
    canvasEl.removeEventListener('mouseenter', onCanvasMouseEnter);
    canvasEl = null;
  }

  var EASTER_EGGS = [
    { count: 7,  text: '哈哈哈哈哈！很好很好，再用力点也没关系哦？' },
    { count: 5,  text: '喂喂，你这家伙…是想被我咬一口吗？（咧嘴）' },
    { count: 3,  text: '哦？戳我？胆子不小嘛，哈哈哈！' },
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
        showEasterMessage('十连击？！哈哈哈哈——我开始有点喜欢你这家伙了！');
        setModelExpression(EXPR.VEIN);
        setTimeout(function () { setModelExpression(EXPR.GRIN); }, 3000);
      }, 1500);
    }
    if (tapCount >= 15 && tapCount % 5 === 0) {
      setTimeout(function () {
        showEasterMessage('已经第 ' + tapCount + ' 下了……啧，再戳下去我可要动真格的了哦？');
      }, 1500);
    }
  }

  // ═══════════════════════════════════════════
  // Part 3: 启动与清理
  // ═══════════════════════════════════════════

  function destroy() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (mouseHandler) { document.removeEventListener('mousemove', mouseHandler); mouseHandler = null; }
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
    unbindCanvasTap();
    unbindTipsObserver();
  }

  window.addEventListener('beforeunload', destroy);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPolling);
  } else {
    startPolling();
  }
})();
