/*
 * @Title: This is a  file for ……
 * @Author: JackieZheng
 * @Date: 2026-07-03 10:12:03
 * @LastEditTime: 2026-07-04 10:38:46
 * @LastEditors:
 * @Description:
 * @FilePath: \\src-tauri\\src\\inject\\view.js
 */

/* =============================================================
 *  ImageViewer — 图片预览插件
 *  功能：点击任意图片全屏预览，支持滚轮/键盘缩放、拖拽平移、
 *        双击适屏、左右切换多图、iframe 内图片代理
 * ============================================================= */
;(function (win, doc) {
  'use strict';

  // ===================== 配置 =====================
  var cfg = {
    zoomStep:   0.12,       // 每次滚轮缩放步进
    maxZoom:    8,
    minZoom:    0.1,
    // initZoom: 0 = 自动适屏，>0 = 以该比例初始显示
    initZoom:   0,
    overlayBg:  'rgba(0,0,0,.92)',
    closeColor: '#fff',
    transitionMs: 260,
    // 小图标过滤：宽或高小于此值跳过预览（设为 0 则全部收录）
    minPreviewPx: 150,
    autoBind:  false,
  };

  // ===================== 内部状态 =====================
  var ST = {
    active:   false,
    closing:   false,
    imgs:      [],          // 所有待预览图片元素
    index:     0,           // 当前显示的图片索引
    scale:     1,
    transX:    0,
    transY:    0,
    dragging:  false,
  };
  var D   = {};             // DOM 引用（overlay / wrap / imgEl / btn 等）
  var _inited = false;      // initIframeProxy 防重复执行标志（window变量，SPA路由切换后仍有效）
  var _opening = false;     // 防 open() 重复调用

  // ===================== 工具函数 =====================
  function stop(e) { e.stopPropagation(); e.preventDefault(); }
  function clamp(v, mn, mx) { return Math.min(mx, Math.max(mn, v)); }

  function getPos(e, el) {
    var r = el.getBoundingClientRect();
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - r.left, y: cy - r.top };
  }

  /** 计算图片在视口中的适屏缩放比 */
  function calcFitZoom(imgEl) {
    var vw = D.wrap ? D.wrap.clientWidth  : win.innerWidth;
    var vh = D.wrap ? D.wrap.clientHeight : win.innerHeight;
    var iw = imgEl.naturalWidth  || imgEl.width  || vw;
    var ih = imgEl.naturalHeight || imgEl.height || vh;
    return Math.min(vw / iw, vh / ih);
  }

  function updateTransform(animate) {
    if (!D.imgEl) return;
    D.imgEl.style.transition = animate
      ? 'transform ' + cfg.transitionMs + 'ms cubic-bezier(.25,.46,.45,.94)'
      : 'none';
    D.imgEl.style.transform =
      'translate(' + ST.transX + 'px,' + ST.transY + 'px) scale(' + ST.scale + ')';
  }

  // ===================== 小图标过滤 =====================
  function shouldSkip(img) {
    var src = (img.src || '').trim();
    // data:image 开头的迷你图标：宽或高 < minPreviewPx 就跳过（避免收录 UI 装饰图标）
    if (src.startsWith('data:')) {
      var w = img.naturalWidth  || img.width  || 0;
      var h = img.naturalHeight || img.height || 0;
      // naturalWidth 为 0 说明图片未加载，取 CSS applied width
      if (w && h && (w < cfg.minPreviewPx || h < cfg.minPreviewPx)) return true;
      return false;
    }
    // 普通图片：宽或高 < minPreviewPx 就跳过
    var w2 = img.naturalWidth  || img.width  || 0;
    var h2 = img.naturalHeight || img.height || 0;
    if (w2 && h2 && (w2 < cfg.minPreviewPx || h2 < cfg.minPreviewPx)) return true;
    return false;
  }

  /** 判断图片元素是否可见（不在隐藏区域，不会被遮挡）*/
  function isVisible(img) {
    if (!img) return false;
    // 已从 DOM 移除
    if (!doc.contains(img)) return false;
    // 宽高为 0
    var w = img.naturalWidth  || img.width  || 0;
    var h = img.naturalHeight || img.height || 0;
    if (w < 1 || h < 1) return false;
    var s = win.getComputedStyle(img);
    // display:none / visibility:hidden
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    // opacity:0（允许 opacity:0.01 等微透明）
    if (parseFloat(s.opacity) === 0) return false;
    // 在视口外（全部在视口外）
    var r = img.getBoundingClientRect();
    if (r.bottom <= 0 || r.right <= 0 || r.top >= win.innerHeight || r.left >= win.innerWidth) return false;
    return true;
  }

  function collectImgs(root) {
    root = root || doc;
    var list = root.querySelectorAll ? root.querySelectorAll('img') : [];
    var r = [];
    for (var i = 0; i < list.length; i++) {
      if (!shouldSkip(list[i]) && isVisible(list[i])) r.push(list[i]);
    }
    return r;
  }

  // ===================== 缩放 =====================
  function zoomAt(delta, cx, cy) {
    if (!ST.active) return;
    var oldS = ST.scale;
    var newS = clamp(oldS * delta, cfg.minZoom, cfg.maxZoom);
    if (newS === oldS) return;
    if (cx !== undefined && cy !== undefined) {
      var ratio = newS / oldS;
      // 图片居中在 wrap 中（flex 居中），transform-origin 在 wrap 中心
      // 所以坐标需要减去 wrap 中心，使缩放以鼠标指向的图片像素为中心
      var wcx = (D.wrap ? D.wrap.clientWidth  : win.innerWidth)  / 2;
      var wcy = (D.wrap ? D.wrap.clientHeight : win.innerHeight) / 2;
      ST.transX = (cx - wcx) * (1 - ratio) + ST.transX * ratio;
      ST.transY = (cy - wcy) * (1 - ratio) + ST.transY * ratio;
    }
    ST.scale = newS;
    updateTransform(false);
    showHint();
  }

  // ===================== 滚轮 =====================
  function onWheel(e) {
    if (!ST.active) return;
    stop(e);
    var delta = e.deltaY > 0 ? (1 - cfg.zoomStep) : (1 + cfg.zoomStep);
    zoomAt(delta, e.clientX, e.clientY);
  }

  // ===================== 拖拽（双击时不触发）=====================
  // 策略：记录 mousedown 位置，在 mousemove 中判断移动距离 >5px 才启动拖拽
  // 这样双击（点击→点击，中间没有 mousemove）永远不会进入 dragging 状态
  var _downX = 0, _downY = 0, _prevX = 0, _prevY = 0, _mouseDown = false;

  function onMouseDown(e) {
    // if (!ST.active || ST.scale <= 1.05) return;
    if (!ST.active ) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    _downX = e.clientX;
    _downY = e.clientY;
    _mouseDown = true;
  }

  function onMouseMove(e) {
    if (!ST.active) return;
    if (!_mouseDown) return;  // 鼠标没按下，忽略
    if (!ST.dragging) {
      var dx = e.clientX - _downX, dy = e.clientY - _downY;
      if (dx * dx + dy * dy <= 25) return;
      ST.dragging = true;
      _prevX = e.clientX; _prevY = e.clientY;
      if (D.imgEl) D.imgEl.style.cursor = 'grabbing';
    } else {
      e.stopPropagation();
      e.preventDefault();
      ST.transX += e.clientX - _prevX;
      ST.transY += e.clientY - _prevY;
      _prevX = e.clientX; _prevY = e.clientY;
      updateTransform(false);
    }
  }

  function onMouseUp() {
    if (!_mouseDown) return;
    _mouseDown = false;
    if (!ST.dragging) return;
    ST.dragging = false;
    if (D.imgEl) D.imgEl.style.cursor = 'grab';
  }

  // ===================== 双击适屏（只有非拖拽时才触发）=====================
  function onDblClick(e) {
    if (!ST.active || ST.dragging) return;
    stop(e);
    ST.scale  = clamp(calcFitZoom(D.imgEl), cfg.minZoom, cfg.maxZoom);
    ST.transX = 0;
    ST.transY = 0;
    updateTransform(true);
  }

  // ===================== 触摸拖拽 =====================
  var _touchStartX = 0, _touchStartY = 0;

  function onTouchStart(e) {
    if (!ST.active) return;
    if (e.touches.length !== 1) return;
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (!ST.active || ST.scale <= 1.05 || e.touches.length !== 1) return;
    e.stopPropagation();
    e.preventDefault();
    var dx = e.touches[0].clientX - _touchStartX;
    var dy = e.touches[0].clientY - _touchStartY;
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
    ST.transX += dx;
    ST.transY += dy;
    updateTransform(false);
  }

  // ===================== 切换图片 =====================
  function goTo(idx) {
    if (!ST.active || !ST.imgs.length) return;
    ST.index = ((idx % ST.imgs.length) + ST.imgs.length) % ST.imgs.length;
    loadCurrent();
  }

  function loadCurrent() {
    if (!D.imgEl || !ST.imgs.length) return;
    var img = ST.imgs[ST.index];
    D.imgEl.style.opacity = '0';
    var src = img.src || img.getAttribute('src') || '';
    D.imgEl.src = '';
    D.imgEl.src = src;
    // 轮询等待图片加载完成（兼容缓存和跨域）
    var t = null;
    function check() {
      if (D.imgEl.complete && D.imgEl.naturalWidth > 0) {
        showImg();
      } else {
        t = requestAnimationFrame(check);
      }
    }
    t = requestAnimationFrame(check);
  }

  function showImg() {
    if (!D.imgEl) return;
    var fit = calcFitZoom(D.imgEl);
    ST.scale  = cfg.initZoom > 0 ? cfg.initZoom : clamp(fit, cfg.minZoom, cfg.maxZoom);
    ST.transX = 0;
    ST.transY = 0;
    updateTransform(true);
    D.imgEl.style.opacity = '1';
    if (D.counter) D.counter.textContent = (ST.index + 1) + ' / ' + ST.imgs.length;
    if (D.prevBtn) D.prevBtn.style.opacity = ST.imgs.length > 1 ? '.75' : '.25';
    if (D.nextBtn) D.nextBtn.style.opacity = ST.imgs.length > 1 ? '.75' : '.25';
  }

  // ===================== 提示文字 =====================
  var _hintTimer = null;
  function showHint() {
    if (!D.hintEl) return;
    D.hintEl.textContent = Math.round(ST.scale * 100) + '%';
    D.hintEl.style.opacity = '1';
    clearTimeout(_hintTimer);
    _hintTimer = setTimeout(function () {
      if (D.hintEl) D.hintEl.style.opacity = '0';
    }, 1200);
  }

  // ===================== 关闭 =====================
  function close() {
    if (ST.closing) return;
    ST.closing = true;
    ST.active  = false;

    if (D.overlay) {
      D.overlay.style.opacity = '0';
      var ov = D.overlay;
      setTimeout(function () {
        var p = ov.parentNode;
        if (p) p.removeChild(ov);
        D = {};
        ST.closing = false;
      }, cfg.transitionMs + 50);
    }

    doc.body.style.overflow = '';
    _opening = false;
    win.removeEventListener('mousemove', onMouseMove);
    win.removeEventListener('mouseup',   onMouseUp);
    win.removeEventListener('touchmove', onTouchMove);
  }

  // ===================== 键盘快捷键 =====================
  function onKeyDown(e) {
    if (!ST.active) return;
    switch (e.key) {
      case 'Escape':    stop(e); close();                      break;
      case 'ArrowLeft':  stop(e); goTo(ST.index - 1);          break;
      case 'ArrowRight': stop(e); goTo(ST.index + 1);          break;
      case 'Home':       stop(e); goTo(0);                     break;
      case 'End':        stop(e); goTo(ST.imgs.length - 1);   break;
      case '+': case '=': stop(e); zoomAt(1 + cfg.zoomStep, win.innerWidth / 2, win.innerHeight / 2); break;
      case '-':          stop(e); zoomAt(1 - cfg.zoomStep, win.innerWidth / 2, win.innerHeight / 2); break;
    }
  }

  // ===================== 构建预览 DOM（仅执行一次）=====================
  function buildOverlay() {
    if (D.overlay) return;

    var overlay = doc.createElement('div');
    overlay.className = 'iv-overlay';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:' + cfg.overlayBg + ';' +
      'z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;' +
      'opacity:0;transition:opacity ' + cfg.transitionMs + 'ms ease;' +
      'cursor:default;';

    var wrap = doc.createElement('div');
    wrap.className = 'iv-wrap';
    wrap.style.cssText =
      'position:relative;width:100%;height:100%;overflow:hidden;' +
      'display:flex;align-items:center;justify-content:center;';

    var imgEl = doc.createElement('img');
    imgEl.className = 'iv-img';
    imgEl.draggable = false;
    imgEl.alt = '';
    imgEl.style.cssText =
      'max-width:none;max-height:none;' +
      'cursor:grab;user-select:none;-webkit-user-drag:none;' +
      'transition:transform ' + cfg.transitionMs + 'ms cubic-bezier(.25,.46,.45,.94),opacity .08s;';

    var closeBtn = doc.createElement('div');
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.style.cssText =
      'position:fixed;top:14px;right:20px;font-size:30px;' +
      'color:' + cfg.closeColor + ';cursor:pointer;z-index:2;' +
      'opacity:.55;transition:opacity .2s;line-height:1;padding:6px;';
    closeBtn.onmouseenter = function () { closeBtn.style.opacity = '1'; };
    closeBtn.onmouseleave = function () { closeBtn.style.opacity = '.55'; };

    var prevBtn = doc.createElement('div');
    prevBtn.innerHTML = '&#x2039;';
    prevBtn.style.cssText =
      'position:fixed;left:14px;top:50%;transform:translateY(-50%);' +
      'font-size:36px;color:' + cfg.closeColor + ';cursor:pointer;z-index:2;' +
      'background:rgba(0,0,0,0.3);border-radius:50%;' +
      'width:46px;height:46px;display:flex;align-items:center;justify-content:center;' +
      'opacity:.7;transition:opacity .2s;line-height:1;';
    prevBtn.onmouseenter = function () { prevBtn.style.opacity = '1'; };
    prevBtn.onmouseleave = function () { prevBtn.style.opacity = '.75'; };

    var nextBtn = doc.createElement('div');
    nextBtn.innerHTML = '&#x203a;';
    nextBtn.style.cssText =
      'position:fixed;right:14px;top:50%;transform:translateY(-50%);' +
      'font-size:36px;color:' + cfg.closeColor + ';cursor:pointer;z-index:2;' +
      'background:rgba(0,0,0,0.3);border-radius:50%;' +
      'width:46px;height:46px;display:flex;align-items:center;justify-content:center;' +
      'opacity:.7;transition:opacity .2s;line-height:1;';
    nextBtn.onmouseenter = function () { nextBtn.style.opacity = '1'; };
    nextBtn.onmouseleave = function () { nextBtn.style.opacity = '.75'; };

    var counter = doc.createElement('div');
    counter.style.cssText =
      'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);' +
      'color:' + cfg.closeColor + ';font-size:13px;font-family:sans-serif;' +
      'background:rgba(0,0,0,.45);padding:4px 18px;border-radius:20px;' +
      'pointer-events:none;letter-spacing:.5px;';

    var hintEl = doc.createElement('div');
    hintEl.style.cssText =
      'position:fixed;bottom:62px;left:50%;transform:translateX(-50%);' +
      'color:' + cfg.closeColor + ';font-size:12px;font-family:sans-serif;' +
      'background:rgba(0,0,0,.4);padding:3px 12px;border-radius:4px;' +
      'opacity:0;transition:opacity .2s;pointer-events:none;';

    // 组装层级
    overlay.appendChild(prevBtn);
    overlay.appendChild(nextBtn);
    overlay.appendChild(closeBtn);
    overlay.appendChild(wrap);
    overlay.appendChild(counter);
    overlay.appendChild(hintEl);
    wrap.appendChild(imgEl);
    doc.body.appendChild(overlay);

    D.overlay = overlay;
    D.wrap     = wrap;
    D.imgEl    = imgEl;
    D.closeBtn = closeBtn;
    D.prevBtn  = prevBtn;
    D.nextBtn  = nextBtn;
    D.counter  = counter;
    D.hintEl   = hintEl;

    // ---- 事件绑定 ----
    // 滚轮（放大/缩小）
    wrap.addEventListener('wheel', onWheel, { passive: false });

    // 鼠标拖拽 + 双击（用 mousedown/mousemove/mouseup 解耦，双击时不触发拖拽）
    imgEl.addEventListener('mousedown', onMouseDown);
    win.addEventListener('mousemove',   onMouseMove);
    win.addEventListener('mouseup',     onMouseUp);
    imgEl.addEventListener('dblclick',  onDblClick);

    // 触摸拖拽
    imgEl.addEventListener('touchstart', onTouchStart, { passive: false });
    win.addEventListener('touchmove',    onTouchMove,   { passive: false });

    // 左右切换
    prevBtn.addEventListener('click', function (e) { stop(e); goTo(ST.index - 1); });
    nextBtn.addEventListener('click', function (e) { stop(e); goTo(ST.index + 1); });

    // 关闭按钮
    closeBtn.addEventListener('click', function (e) { stop(e); close(); });

    // 点击遮罩背景关闭（点击按钮或图片本身不关闭）
    overlay.addEventListener('click', function (e) {
      // 如果点击目标是按钮/关闭按钮/图片/容器，则忽略
      var t = e.target;
      if (t === closeBtn || t === prevBtn || t === nextBtn || t === imgEl || t === wrap) return;
      stop(e);
      close();
    });

    // 键盘
    win.addEventListener('keydown', onKeyDown);

    // 淡入
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  }

  // ===================== 打开预览（统一入口）=====================
  function open(imgEl) {
    if (!imgEl) return;

    // 已打开：切换到该图片
    if (ST.active) {
      var idx = ST.imgs.indexOf(imgEl);
      if (idx >= 0) goTo(idx);
      return;
    }
    // 防重复调用
    if (_opening) return;
    _opening = true;

    // 收集页面所有图片 + iframe 内图片
    var allImgs = collectImgs(doc);
    collectIframeImgs(allImgs);

    // 目标图片未必在列表中（iframe 刚注入的等情况），追加
    if (allImgs.indexOf(imgEl) < 0) allImgs.push(imgEl);

    var idx = allImgs.indexOf(imgEl);
    if (idx < 0) return;

    ST.imgs  = allImgs;
    ST.index = idx;
    ST.active = true;
    _opening = false;

    doc.body.style.overflow = 'hidden';
    buildOverlay();
    loadCurrent();
  }

  /** 收集所有 iframe 内的图片（同源才能访问）*/
  function collectIframeImgs(out) {
    var iframes = doc.querySelectorAll ? doc.querySelectorAll('iframe') : [];
    for (var i = 0; i < iframes.length; i++) {
      try {
        var idoc = iframes[i].contentDocument || iframes[i].contentWindow && iframes[i].contentWindow.document;
        if (!idoc) continue;
        var list = idoc.querySelectorAll ? idoc.querySelectorAll('img') : [];
        for (var j = 0; j < list.length; j++) {
          if (!shouldSkip(list[j])) out.push(list[j]);
        }
      } catch (ex) { /* 跨域 iframe，忽略 */ }
    }
  }

  // ===================== 自动绑定（点击拦截）=====================
  function initIframeProxy() {
    // 使用 window 变量，SPA 路由切换后仍有效
    if (win._iv_proxy_inited) return;
    win._iv_proxy_inited = true;
    _inited = true;

    // ---- 方式 A：原生 dblclick 监听（capture 阶段），不拦截单击事件 ----
    doc.addEventListener('dblclick', function (e) {
      var target = e.target;
      if (!target || target.tagName !== 'IMG') return;
      // 如果点击目标在预览遮罩内，放行（交由 onDblClick / 按钮处理）
      if (D.overlay && D.overlay.contains(target)) return;

      // 判断是否来自 iframe
      var iframes = doc.querySelectorAll ? doc.querySelectorAll('iframe') : [];
      for (var i = 0; i < iframes.length; i++) {
        try {
          var idoc = iframes[i].contentDocument || iframes[i].contentWindow && iframes[i].contentWindow.document;
          if (idoc && idoc.contains && idoc.contains(target)) {
            stop(e);
            open(target);
            return;
          }
        } catch (ex) { /* 跨域忽略 */ }
      }

      if (!shouldSkip(target)) {
        stop(e);
        open(target);
      }
    }, true);

    // ---- 方式 B：向同域 iframe 注入完整 ImageViewer（独立预览，最高优先级）----
injectIframeScripts();
}

// ===================== iframe 注入代码（toString提取源码注入）=====================
// 独立命名函数，.toString() 可得完整源码，避免嵌套 IIFE 字符串问题
function iframeScriptSrc() {
  /* ---- IIFE开始 ---- */
  (function(w, d) {
    if (w._iv_iframe_inited) return;
    w._iv_iframe_inited = true;
    var S = {sc:1,tx:0,ty:0}, ov=null, img=null, cb=null;
    var _px=0,_py=0,_dr=false,_lx=0,_ly=0;
    function sk(el) {
      var src=(el.src||'').trim();
      var w2=el.naturalWidth||el.width||0, h2=el.naturalHeight||el.height||0;
      if(src.startsWith('data:')){if(w2&&h2&&(w2<50||h2<50))return true;return false;}
      if(w2&&h2&&(w2<50||h2<50))return true;return false;
    }
    function op(t) {
      if(!t||t.tagName!=='IMG')return;
      if(ov){try{cb&&cb.click();}catch(e){}return;}
      var Z=2147483647;
      ov=d.createElement('div');
      ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:'+Z+';cursor:default;';
      var wrap=d.createElement('div');
      wrap.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;';
      img=d.createElement('img');
      img.style.cssText='max-width:100%;max-height:100%;display:block;cursor:default;user-select:none;-webkit-user-drag:none;';
      img.src=t.src||t.getAttribute('src')||'';
      cb=d.createElement('div');
      cb.textContent=String.fromCharCode(10005);
      cb.style.cssText='position:fixed;top:14px;right:18px;font-size:26px;color:#fff;cursor:pointer;z-index:'+(Z+1)+';background:rgba(0,0,0,.4);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;opacity:.8;';
      cb.onclick=function(){
        try{if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);}catch(e){}
        try{if(cb&&cb.parentNode)cb.parentNode.removeChild(cb);}catch(e){}
        try{if(wrap&&wrap.parentNode)wrap.parentNode.removeChild(wrap);}catch(e){}
        ov=null;img=null;cb=null;
        try{d.body.style.overflow='';}catch(e){}
      };
      ov.onclick=function(e){if(e.target===ov||e.target===wrap)cb&&cb.click();};
      d.addEventListener('keydown',function(e){if(e.key==='Escape')cb&&cb.click();},true);
      d.body.style.overflow='hidden';
      ov.appendChild(wrap);wrap.appendChild(img);
      d.body.appendChild(ov);d.body.appendChild(cb);
      img.style.transition='transform .22s cubic-bezier(.25,.46,.45,.94)';
      img.style.transform='translate(0,0) scale(1)';
      S.sc=1;S.tx=0;S.ty=0;
      img.onload=function(){
        if(!img.naturalWidth)return;
        var z=Math.min(w.innerWidth/img.naturalWidth,w.innerHeight/img.naturalHeight,1);
        S.sc=z;img.style.transform='translate(0,0) scale('+z+')';
      };
      var _onD=function(e){_px=e.clientX;_py=e.clientY;_dr=false;_lx=e.clientX;_ly=e.clientY;};
      var _onM=function(e){
        if(!_px&&!_py)return;
        if(!_dr&&(Math.abs(e.clientX-_px)>4||Math.abs(e.clientY-_py)>4))_dr=true;
        if(!_dr)return;
        e.preventDefault();
        var dx=e.clientX-_lx,dy=e.clientY-_ly;_lx=e.clientX;_ly=e.clientY;
        S.tx+=dx;S.ty+=dy;img.style.transition='none';
        img.style.transform='translate('+S.tx+'px,'+S.ty+'px) scale('+S.sc+')';
      };
      var _onU=function(){_px=0;_py=0;};
      var _onW=function(e){
        e.preventDefault();
        var nr=S.sc*(e.deltaY<0?1.15:0.87);
        S.sc=Math.max(0.1,Math.min(5,nr));
        img.style.transition='transform .15s';
        img.style.transform='translate('+S.tx+'px,'+S.ty+'px) scale('+S.sc+')';
      };
      img.addEventListener('mousedown',_onD,true);
      w.addEventListener('mousemove',_onM);
      w.addEventListener('mouseup',_onU);
      img.addEventListener('wheel',_onW,{passive:false});
    }
    d.addEventListener('dblclick',function(e){
      var t=e.target;
      if(!t||t.tagName!=='IMG')return;
      if(ov&&ov.contains&&ov.contains(t))return;
      e.stopPropagation();
      if(!sk(t))op(t);
    },true);
  })(window,document);
  /* ---- IIFE结束 ---- */
}

/** 向所有同域iframe注入完整ImageViewer（独立预览，互不干扰）
 *  自带z-index:2147483647，优先级最高；用_iv_iframe_inited防重复注入
 */
function injectIframeScripts() {
  var iframes=doc.querySelectorAll?doc.querySelectorAll('iframe'):[];
  var injSrc=iframeScriptSrc.toString();
  for(var i=0;i<iframes.length;i++){
    (function(iframe){
      try{
        var idoc=iframe.contentDocument||iframe.contentWindow&&iframe.contentWindow.document;
        if(!idoc||!idoc.body)return;
        if(idoc.getElementById('_iv_inj_'))return;
        var s=idoc.createElement('script');
        s.id='_iv_inj_';
        s.textContent=injSrc;
        idoc.head.appendChild(s);
      }catch(ex){/*跨域iframe无法注入，忽略*/}
    })(iframes[i]);
  }
}

// ===================== postMessage 接收（iframe自行处理，无需父窗口转发）=====================
// ===================== postMessage 接收（iframe 注入了脚本时）=====================
  win.addEventListener('message', function (e) {
    if (!e.data || !e.data.ivImg) return;
    var src = e.data.src;
    if (!src) return;
    // 在当前页面 DOM 中找对应 src 的图片
    var imgs = doc.querySelectorAll ? doc.querySelectorAll('img') : [];
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].src === src || imgs[i].getAttribute('src') === src) {
        open(imgs[i]);
        return;
      }
    }
  });

  // ===================== 公开 API =====================
  win.ImageViewer = {
    open:  open,
    close: close,
    init:  initIframeProxy,
    reset: function () {
      if (!D.imgEl) return;
      ST.scale = clamp(calcFitZoom(D.imgEl), cfg.minZoom, cfg.maxZoom);
      ST.transX = 0; ST.transY = 0;
      updateTransform(true);
    },
    config: cfg,
  };

  // ===================== 初始化 =====================
  if (cfg.autoBind) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', initIframeProxy);
    } else {
      initIframeProxy();
    }
  }

})(window, document);
