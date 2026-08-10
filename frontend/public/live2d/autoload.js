/*!
 * Live2D Widget
 * https://github.com/stevenjoezhang/live2d-widget
 */

// Recommended to use absolute path for live2d_path parameter
// live2d_path 参数建议使用绝对路径
const live2d_path = '/live2d/';
// const live2d_path = '/dist/';

// Method to encapsulate asynchronous resource loading
// 封装异步加载资源的方法
function loadExternalResource(url, type) {
  return new Promise((resolve, reject) => {
    let tag;

    if (type === 'css') {
      tag = document.createElement('link');
      tag.rel = 'stylesheet';
      tag.href = url;
    }
    else if (type === 'js') {
      tag = document.createElement('script');
      tag.type = 'module';
      tag.src = url;
    }
    if (tag) {
      tag.onload = () => resolve(url);
      tag.onerror = () => reject(url);
      document.head.appendChild(tag);
    }
  });
}

(async () => {
  // If you are concerned about display issues on mobile devices, you can use screen.width to determine whether to load
  // 如果担心手机上显示效果不佳，可以根据屏幕宽度来判断是否加载
  // if (screen.width < 768) return;

  // Avoid cross-origin issues with image resources
  // 避免图片资源跨域问题
  const OriginalImage = window.Image;
  window.Image = function(...args) {
    const img = new OriginalImage(...args);
    img.crossOrigin = "anonymous";
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;
  // Load waifu.css and waifu-tips.js
  // 加载 waifu.css 和 waifu-tips.js
  await Promise.all([
    loadExternalResource(live2d_path + 'waifu.css', 'css'),
    loadExternalResource(live2d_path + 'waifu-tips.js', 'js')
  ]);
  // For detailed usage of configuration options, see README.en.md
  // 配置选项的具体用法见 README.md
  initWidget({
    waifuPath: live2d_path + 'waifu-tips.json',
    // cdnPath: 'https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/',
    cubism2Path: live2d_path + 'live2d.min.js',
    cubism5Path: live2d_path + 'live2dcubismcore.min.js',
    tools: [],  // 不显示工具栏，保持看板娘干净
    logLevel: 'warn',
    drag: false,
  });
  // 加载鼠标区域→表情联动
  loadExternalResource(live2d_path + 'expression-zones.js', 'js');
})();

console.log(`\n%cLive2D%cWidget%c\n`, 'padding: 8px; background: #cd3e45; font-weight: bold; font-size: large; color: white;', 'padding: 8px; background: #ff5450; font-size: large; color: #eee;', '');

/*
く__,.ヘヽ.        /  ,ー､ 〉
         ＼ ', !-─‐-i  /  /´
         ／｀ｰ'       L/／｀ヽ､
       /   ／,   /|   ,   ,       ',
     ｲ   / /-‐/  ｉ  L_ ﾊ ヽ!   i
      ﾚ ﾍ 7ｲ｀ﾄ   ﾚ'ｧ-ﾄ､!ハ|   |
        !,/7 '0'     ´0iソ|    |
        |.从"    _     ,,,, / |./    |
        ﾚ'| i＞.､,,__  _,.イ /   .i   |
          ﾚ'| | / k_７_/ﾚ'ヽ,  ﾊ.  |
            | |/i 〈|/   i  ,.ﾍ |  i  |
           .|/ /  ｉ：    ﾍ!    ＼  |
            kヽ>､ﾊ    _,.ﾍ､    /､!
            !'〈//｀Ｔ´', ＼ ｀'7'ｰr'
            ﾚ'ヽL__|___i,___,ンﾚ|ノ
                ﾄ-,/  |___./
                'ｰ'    !_,.:
*/

// ===== Waifu Badge Injection — fold / expand toggle =====
(function injectBadge() {
  var hideTimer = null;
  var STORAGE_KEY = 'waifu-folded';
  var BADGE_OFFSET = 33;

  function syncBadgePosition(waifu, badge) {
    if (!waifu || !badge || waifu.classList.contains('waifu-folded')) return;
    var rightPx = parseFloat(waifu.style.right);
    if (Number.isNaN(rightPx)) {
      var rect = waifu.getBoundingClientRect();
      rightPx = Math.max(0, window.innerWidth - rect.right);
    }
    badge.style.right = (rightPx + BADGE_OFFSET) + 'px';
    badge.style.bottom = '';
  }

  function applyFoldState(waifu, badge, folded) {
    waifu.classList.toggle('waifu-folded', folded);
    badge.classList.toggle('waifu-badge-folded', folded);
    badge.title = folded ? '展开看板娘' : '折叠看板娘';
    if (folded) {
      // Clear drag inline styles so CSS can pin badge to corner
      badge.style.right = '';
      badge.style.bottom = '';
      badge.classList.add('waifu-badge-visible');
    } else {
      badge.classList.remove('waifu-badge-visible');
      syncBadgePosition(waifu, badge);
    }
    try {
      localStorage.setItem(STORAGE_KEY, folded ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  const tryInject = function() {
    const waifu = document.getElementById('waifu');
    if (!waifu) { setTimeout(tryInject, 100); return; }
    if (document.getElementById('waifu-badge')) return;

    const badge = document.createElement('button');
    badge.id = 'waifu-badge';
    badge.type = 'button';
    badge.setAttribute('aria-label', '折叠看板娘');
    badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    badge.title = '折叠看板娘';

    document.body.appendChild(badge);
    syncBadgePosition(waifu, badge);

    // Restore persisted fold
    var savedFolded = false;
    try {
      savedFolded = localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) { /* ignore */ }
    if (savedFolded) applyFoldState(waifu, badge, true);

    function showBadge() {
      clearTimeout(hideTimer);
      badge.classList.add('waifu-badge-visible');
    }

    function hideBadge() {
      if (waifu.classList.contains('waifu-folded')) return;
      hideTimer = setTimeout(function() {
        badge.classList.remove('waifu-badge-visible');
      }, 180);
    }

    waifu.addEventListener('mouseenter', function() {
      if (!waifu.classList.contains('waifu-folded')) showBadge();
    });
    waifu.addEventListener('mouseleave', hideBadge);
    badge.addEventListener('mouseenter', showBadge);
    badge.addEventListener('mouseleave', hideBadge);

    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      clearTimeout(hideTimer);
      applyFoldState(waifu, badge, !waifu.classList.contains('waifu-folded'));
    });

    // Expose for Live2DWidget drag sync
    window.__waifuSyncBadge = function() {
      syncBadgePosition(waifu, badge);
    };
  };
  setTimeout(tryInject, 50);
})();
