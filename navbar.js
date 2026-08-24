/* ============================================================================
   Hackuity navbar — no dependencies.

   One growing container. The height is animated to the active panel's height,
   so switching menus morphs the navbar rather than closing and reopening it.

     desktop (>1619)  hover / click a head -> body grows to that panel
     tablet  (<=1619) Menu -> Close; 193px rail on the RIGHT switches panels
     mobile  (<=767)  Menu -> list; tap a head -> that panel replaces the list,
                      and the button becomes a back chevron
   ========================================================================= */
(function () {
  'use strict';

  var TABLET_MAX = 1619;    // keep in sync with styles.css
  var MOBILE_MAX = 767;
  var HOVER_IN   = 90;
  var HOVER_OUT  = 200;

  var navbar = document.getElementById('navbar');
  if (!navbar) return;

  var shell    = document.getElementById('navbar-shell');
  var body     = document.getElementById('navbar-body');
  var panelsEl = navbar.querySelector('.navbar_panels');
  var menuEl   = navbar.querySelector('.navbar_menu');
  var menuBtn  = navbar.querySelector('.navbar_menu-button');
  var btnLabel = navbar.querySelector('.navbar_menu-button-label');
  var scrim    = document.querySelector('.navbar_scrim');
  var items    = [].slice.call(navbar.querySelectorAll('.navbar_item[data-panel]'));
  var panels   = [].slice.call(navbar.querySelectorAll('.navbar_panel'));

  var activePanel = null;   // panel key or null
  var drawerOpen  = false;  // tablet / mobile
  var hoverTimer  = null;
  var scrollY     = 0;

  function mode() {
    var w = window.innerWidth;
    return w > TABLET_MAX ? 'desktop' : (w > MOBILE_MAX ? 'tablet' : 'mobile');
  }
  function sizer() { return mode() === 'desktop' ? panelsEl : body; }
  // what actually scrolls when the content is taller than the room available.
  // On tablet this is deliberately NOT the body — scrolling the body would drag
  // the 193px rail along with it. Only the mega-menu column moves.
  function scroller() { return mode() === 'mobile' ? body : panelsEl; }

  /* ---------- height ---------- */
  function naturalHeight(el) {
    var prevH = el.style.height;
    var prevT = el.style.transition;
    el.style.transition = 'none';
    el.style.height = 'auto';
    var h = el.scrollHeight;
    el.style.height = prevH;
    void el.offsetWidth;              // flush, so the next set animates
    el.style.transition = prevT;
    return h;
  }

  function maxHeight() {
    var vh = window.innerHeight;
    if (mode() === 'mobile') return vh - 180;      // logo + bar + breathing room
    return vh - 40 - (mode() === 'desktop' ? 74 : 80) - 40;
  }

  function applyHeight() {
    var el = sizer();
    var open = mode() === 'desktop' ? !!activePanel : drawerOpen;
    var sc = scroller();
    if (!open) {
      el.style.height = '0px';
      el.classList.remove('is-scrollable');
      sc.classList.remove('is-scrollable');
      return;
    }
    var want = naturalHeight(el);
    var cap  = maxHeight();
    var h    = Math.min(want, cap);
    if (sc !== el) el.classList.remove('is-scrollable');
    sc.classList.toggle('is-scrollable', want > cap);
    el.style.height = h + 'px';
    if (sc !== el) sc.scrollTop = 0;
  }

  /* ---------- panels ---------- */
  function setPanel(key) {
    activePanel = key;
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== key; });
    items.forEach(function (li) {
      var on = li.getAttribute('data-panel') === key;
      li.classList.toggle('is-active', on);
      var ctrl = li.querySelector('.navbar_link');
      if (ctrl && ctrl.tagName === 'BUTTON') ctrl.setAttribute('aria-expanded', String(on));
    });
    body.classList.toggle('is-drilled', mode() === 'mobile' && !!key);
    shell.classList.toggle('is-open', mode() === 'desktop' ? !!key : drawerOpen);
    syncButton();
    applyHeight();
  }

  function clearPanel() { setPanel(null); }

  /* ---------- menu button ---------- */
  function syncButton() {
    if (!menuBtn) return;
    var m = mode();
    var state = 'menu';
    if (m === 'mobile') state = drawerOpen ? (activePanel ? 'back' : 'close') : 'menu';
    else if (m === 'tablet') state = drawerOpen ? 'close' : 'menu';
    menuBtn.setAttribute('data-state', state);
    menuBtn.setAttribute('aria-expanded', String(drawerOpen));
    menuBtn.setAttribute('aria-label', state === 'back' ? 'Back' : (state === 'close' ? 'Close menu' : 'Menu'));
    if (btnLabel) btnLabel.textContent = state === 'close' ? 'Close' : 'Menu';
  }

  /* ---------- scroll lock ---------- */
  function lockScroll() {
    scrollY = window.scrollY || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = -scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  function unlockScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  /* ---------- drawer (tablet / mobile) ---------- */
  function openDrawer() {
    if (drawerOpen) return;
    drawerOpen = true;
    shell.classList.add('is-open');
    if (scrim) { scrim.hidden = false; void scrim.offsetWidth; scrim.classList.add('is-open'); }
    lockScroll();
    trapFocus(true);
    // tablet opens on the first menu so the left column is never blank;
    // mobile opens on the link list
    if (mode() === 'tablet' && items.length) setPanel(items[0].getAttribute('data-panel'));
    else setPanel(null);
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    shell.classList.remove('is-open');
    if (scrim) { scrim.classList.remove('is-open'); scrim.hidden = true; }
    unlockScroll();
    trapFocus(false);
    setPanel(null);
  }

  /* ---------- focus trap ---------- */
  var trapHandler = null;
  function trapFocus(on) {
    if (trapHandler) { document.removeEventListener('keydown', trapHandler); trapHandler = null; }
    if (!on) return;
    trapHandler = function (e) {
      if (e.key !== 'Tab') return;
      var all = shell.querySelectorAll('a[href],button:not([disabled])');
      var f = [].filter.call(all, function (el) { return el.getClientRects().length > 0; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapHandler);
  }

  /* ---------- wiring ---------- */
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var m = mode();
      if (m === 'mobile' && drawerOpen && activePanel) { setPanel(null); return; }  // back
      drawerOpen ? closeDrawer() : openDrawer();
    });
  }

  items.forEach(function (li) {
    var key  = li.getAttribute('data-panel');
    var ctrl = li.querySelector('.navbar_link');

    li.addEventListener('mouseenter', function () {
      if (mode() !== 'desktop') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { setPanel(key); }, HOVER_IN);
    });

    if (ctrl && ctrl.tagName === 'BUTTON') {
      ctrl.addEventListener('click', function (e) {
        e.preventDefault();
        clearTimeout(hoverTimer);
        if (mode() === 'desktop') { activePanel === key ? clearPanel() : setPanel(key); return; }
        setPanel(key);                       // tablet: switch rail selection
                                             // mobile: drill into the sub-screen
      });
    }
  });

  navbar.addEventListener('mouseleave', function () {
    if (mode() !== 'desktop') return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(clearPanel, HOVER_OUT);
  });

  if (scrim) scrim.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (drawerOpen) {
      if (mode() === 'mobile' && activePanel) { setPanel(null); return; }
      closeDrawer(); menuBtn && menuBtn.focus();
    } else if (activePanel) clearPanel();
  });

  body.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && drawerOpen) closeDrawer();
  });

  document.addEventListener('click', function (e) {
    if (mode() === 'desktop' && activePanel && !navbar.contains(e.target)) clearPanel();
  });

  /* ---------- breakpoint / resize ---------- */
  var lastMode = mode();
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var m = mode();
      if (m !== lastMode) {
        lastMode = m;
        drawerOpen = false;
        shell.classList.remove('is-open');
        if (scrim) { scrim.classList.remove('is-open'); scrim.hidden = true; }
        unlockScroll();
        trapFocus(false);
        setPanel(null);
      } else {
        applyHeight();                      // content reflowed — re-measure
      }
      syncButton();
    }, 120);
  });

  /* ---------- scrolled state hook ---------- */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      navbar.classList.toggle('is-scrolled', (window.scrollY || 0) > 8);
      ticking = false;
    });
  }, { passive: true });

  syncButton();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyHeight);
})();
