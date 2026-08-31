/* ============================================================================
   HACKUITY NAVBAR  ·  nav.js  ·  v1.0.0
   ----------------------------------------------------------------------------
   No dependencies, no jQuery, no build step. Drop it in before </body>:

   <script defer
     src="https://cdn.jsdelivr.net/gh/OWNER/REPO@v1.0.0/nav.js"></script>

   The bar pill never changes height. The panel surface behind it is animated to
   the active panel's height, so switching heads morphs the mega-menu rather
   than closing and reopening it.

     desktop (>1279)  hover / click a head -> panel surface grows to that panel,
                      and moving between two heads crossfades them: the old
                      panel fades out against the direction of travel while the
                      new one slides in. Timings and offsets are nav.css tokens
                      (--nv-swap-*); this file only writes `data-nav-swap` on
                      .nv-panels and toggles the three state classes.
     tablet  (<=1279) Menu -> Close; 193px rail on the RIGHT switches panels
     mobile  (<=767)  Menu -> list; tap a head -> that panel replaces the list,
                      and the button becomes a back chevron

   ── Webflow contract ──────────────────────────────────────────────────────
   This file NEVER selects by class name. Everything it finds, it finds through
   `data-nav-el` / `data-nav-panel` attributes, so you are free to rename any
   Webflow class without touching the script:

     data-nav-el="root"             the <header>
     data-nav-el="shell"            stacking wrapper inside it
     data-nav-el="bar"              the fixed-height pill (measured, not styled)
     data-nav-el="body"             the growing/drawer surface
     data-nav-el="panels"           the panel stack (nav.js writes
                                    data-nav-swap="next|prev|open|close" here)
     data-nav-el="panel"            one mega-menu   + data-nav-panel="<key>"
     data-nav-el="menu"             the link list   (div, role="list")
     data-nav-el="item"             one row         + data-nav-panel="<key>"
     data-nav-el="link"             the <button>/<a> inside an item
     data-nav-el="toggle"           the hamburger
     data-nav-el="toggle-label"     its text span
     data-nav-el="scrim"            the full-page dim layer
     data-nav-el="logo-standalone"  the mobile logo above the drawer

   The only class names in this file are in the CLS map below — the state hooks
   nav.css listens for. Rename them in ONE place if Webflow needs it.
   Breakpoints come from --nv-bp-tablet / --nv-bp-mobile in nav.css, so the
   media queries and this script cannot drift apart.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------- the only class names this file knows ---------- */
  var CLS = {
    open:       'nv-is-open',
    active:     'nv-is-active',
    drilled:    'nv-is-drilled',
    scrollable: 'nv-is-scrollable',
    scrolled:   'nv-is-scrolled',
    enter:      'nv-is-enter',    /* incoming panel, start state */
    leave:      'nv-is-leave',    /* outgoing panel, parked out of flow */
    out:        'nv-is-out'       /* outgoing panel, end state */
  };

  var HOVER_IN  = 90;    /* hover intent before a desktop panel opens */
  var HOVER_OUT = 200;   /* grace period before it closes again */
  var MIN_H     = 160;   /* never squeeze a panel below this */
  var GAP_EDGE  = 40;    /* desktop/tablet: clearance at the viewport bottom */
  var GAP_LOGO  = 16;    /* mobile: clearance under the standalone logo */
  var RESIZE_MS = 120;

  var el = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var all = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };
  var hook = function (name) { return '[data-nav-el="' + name + '"]'; };

  var root  = document.documentElement;
  var nav   = el(hook('root'));
  if (!nav) return;

  var shell    = el(hook('shell'), nav) || nav;
  var bar      = el(hook('bar'), nav);
  var body     = el(hook('body'), nav);
  var panelsEl = el(hook('panels'), nav);
  var menuBtn  = el(hook('toggle'), nav);
  var btnLabel = el(hook('toggle-label'), nav);
  var scrim    = el(hook('scrim'));
  var logo     = el(hook('logo-standalone'));
  var items    = all(hook('item') + '[data-nav-panel]', nav);
  var panels   = all(hook('panel'), nav);

  if (!bar || !body || !panelsEl) return;

  var activePanel = null;    /* panel key, or null */
  var drawerOpen  = false;   /* tablet / mobile */
  var hoverTimer  = null;
  var scrollY     = 0;

  /* ---------- breakpoints, read from nav.css ---------- */
  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }
  function mode() {
    var w = window.innerWidth;
    if (w > cssNum('--nv-bp-tablet', 1279)) return 'desktop';
    return w > cssNum('--nv-bp-mobile', 767) ? 'tablet' : 'mobile';
  }

  /* Durations live in nav.css too. The swap's cleanup timer has to outlast the
     transition it is waiting on, so it reads the same token rather than
     carrying a copy that would silently drift the day the CSS is retuned. */
  function cssMs(name, fallback) {
    var raw = getComputedStyle(root).getPropertyValue(name).trim();
    var n = parseFloat(raw);
    if (isNaN(n)) return fallback;
    return /ms$/.test(raw) ? n : n * 1000;
  }

  /* Which element carries the animated height, and which one actually scrolls.
     On tablet they differ on purpose: scrolling the body would drag the 193px
     rail along with the mega-menu, so only the panel column moves. */
  function sizer()    { return mode() === 'desktop' ? panelsEl : body; }
  function scroller() { return mode() === 'mobile'  ? body : panelsEl; }

  /* ---------- height ---------- */
  function naturalHeight(node) {
    var prevH = node.style.height;
    var prevT = node.style.transition;
    node.style.transition = 'none';
    node.style.height = 'auto';
    var h = node.scrollHeight;
    node.style.height = prevH;
    void node.offsetWidth;             /* flush, so the next set animates */
    node.style.transition = prevT;
    return h;
  }

  /* How tall the surface is allowed to get, measured off the live layout rather
     than hard-coded numbers — the bar's own rect is the source of truth, so a
     token change in nav.css cannot desync this. */
  function maxHeight() {
    var rect = bar.getBoundingClientRect();
    var tuck = cssNum('--nv-panel-tuck', 20);

    if (mode() === 'mobile') {
      /* The drawer hangs ABOVE the bar and its bottom edge is tucked `tuck` px
         into the pill. Its ceiling is the standalone logo, when that is on
         screen — otherwise just the top of the viewport. */
      var floorY = rect.top + tuck;
      var ceilY  = GAP_LOGO;
      if (logo) {
        var lr = logo.getBoundingClientRect();
        if (lr.height > 0 && lr.bottom > 0) ceilY = Math.max(ceilY, lr.bottom + GAP_LOGO);
      }
      return Math.max(MIN_H, floorY - ceilY);
    }

    /* desktop / tablet: the surface starts `tuck` px above the bar's bottom
       edge and must stop short of the viewport bottom */
    return Math.max(MIN_H, window.innerHeight - GAP_EDGE - (rect.bottom - tuck));
  }

  function applyHeight() {
    var node = sizer();
    var sc   = scroller();
    var open = mode() === 'desktop' ? !!activePanel : drawerOpen;

    /* Both the sizer and the scroller swap elements at a breakpoint, so before
       touching anything, hand back whatever the OTHER element was left holding.
       Skipping this is what produced the blank mega-menu column: closing a
       panel on desktop writes `height:0px` inline on .nv-panels, and that
       inline value outranks the tablet/mobile rule that wants it back at
       `height:auto`. Cross below 1280, open the drawer, and the drawer sizes
       itself correctly around a panel column collapsed to nothing. */
    if (panelsEl !== node) panelsEl.style.height = '';
    if (body     !== node) body.style.height = '';
    if (panelsEl !== sc)   panelsEl.classList.remove(CLS.scrollable);
    if (body     !== sc)   body.classList.remove(CLS.scrollable);

    if (!open) {
      node.style.height = '0px';
      sc.classList.remove(CLS.scrollable);
      return;
    }

    /* An absolutely positioned child still counts toward scrollHeight, so
       while the outgoing panel is parked mid-fade, measuring .nv-panels would
       return the TALLER of the two panels and a shrinking swap would never
       shrink. The incoming panel's own layout box is the honest number —
       .nv-panels carries no padding and .nv-panel no margin, so the two are
       the same. getBoundingClientRect over offsetHeight for the sub-pixel:
       the swap only ever translates a panel, and translation does not change
       a box's measured height. */
    var want = naturalHeight(node);    /* measured only after the reset above */
    if (mode() === 'desktop' && activePanel) {
      var live = panelByKey(activePanel);
      if (live) want = Math.ceil(live.getBoundingClientRect().height) || want;
    }
    var cap  = maxHeight();

    sc.classList.toggle(CLS.scrollable, want > cap);
    node.style.height = Math.min(want, cap) + 'px';
    sc.scrollTop = 0;                  /* every panel switch starts at the top */
  }

  /* ---------- panel swap (desktop) ----------
     Hovering from one head to the next crossfades the two panels instead of
     blinking between them: the outgoing one lifts out of flow and fades away
     against the direction of travel while the incoming one slides in behind
     it, and .nv-panels morphs its height between the two.

     nav.js owns only the choreography — every offset, duration and easing is a
     token in nav.css. It writes `data-nav-swap` on .nv-panels (next / prev /
     open / close) and toggles three classes; the CSS decides what those mean.

     Nothing here reaches inside `.nv-panel-inner`. The Webflow component in
     that slot is animated by being carried, never by being touched, so a
     component swapped in the Editor inherits the effect for free. */
  var byKey = {};
  panels.forEach(function (p) { byKey[p.getAttribute('data-nav-panel')] = p; });

  var order = {};
  items.forEach(function (li, i) { order[li.getAttribute('data-nav-panel')] = i; });

  var leavers = [];
  var SWAP_TAIL = 120;               /* grace on top of the CSS out-duration */

  function panelByKey(k) { return k ? (byKey[k] || null) : null; }

  /* Put a leaver back in the deck. `hidden` is decided against the CURRENT
     selection, not against what was leaving, so a panel re-hovered mid-fade
     comes back visible rather than being hidden out from under itself. */
  function finalizeLeaver(p) {
    clearTimeout(p._nvLeaveTimer);
    p._nvLeaveTimer = null;
    p.classList.remove(CLS.leave, CLS.out);
    p.hidden = p.getAttribute('data-nav-panel') !== activePanel;
    var i = leavers.indexOf(p);
    if (i > -1) leavers.splice(i, 1);
  }

  function finalizeLeavers() {
    leavers.slice().forEach(finalizeLeaver);
  }

  function startLeave(p) {
    p.hidden = false;
    p.classList.remove(CLS.enter);
    p.classList.add(CLS.leave);      /* out of flow, still at rest */
    void p.offsetWidth;              /* commit that, so the next line animates */
    p.classList.add(CLS.out);
    leavers.push(p);
    p._nvLeaveTimer = setTimeout(function () { finalizeLeaver(p); },
                                 cssMs('--nv-swap-out-dur', 180) + SWAP_TAIL);
  }

  function startEnter(p) {
    p.hidden = false;
    p.classList.remove(CLS.leave, CLS.out);
    p.classList.add(CLS.enter);      /* faded + offset, transition suppressed */
    void p.offsetWidth;              /* commit it — without this there is no
                                        before-change style to animate from */
    requestAnimationFrame(function () { p.classList.remove(CLS.enter); });
  }

  function swapPanels(prev, next) {
    if (prev === next) {             /* re-hovering the open head is not a swap */
      var same = panelByKey(next);
      if (same) same.hidden = false;
      return;
    }

    /* One leaver at a time. Hover intent already rate-limits switching to
       90ms, and letting three half-faded panels stack up reads as mud. */
    finalizeLeavers();

    var dir = 'open';
    if (prev && next) dir = (order[next] > order[prev]) ? 'next' : 'prev';
    else if (prev)    dir = 'close';
    panelsEl.setAttribute('data-nav-swap', dir);

    var out = panelByKey(prev);
    if (out) startLeave(out);

    panels.forEach(function (p) {
      if (p === out) return;         /* the leaver stays on screen to fade */
      p.hidden = p.getAttribute('data-nav-panel') !== next;
    });

    var into = panelByKey(next);
    if (into) startEnter(into);
  }

  /* ---------- panels ---------- */
  function setPanel(key, instant) {
    var prev = activePanel;
    activePanel = key;

    /* Desktop crossfades. Tablet and mobile switch outright — the rail and the
       drilldown are unchanged. `instant` is the breakpoint-crossing escape
       hatch: animating a panel the viewport is about to restyle is pointless
       and can strand it mid-fade. */
    if (!instant && mode() === 'desktop') {
      swapPanels(prev, key);
    } else {
      finalizeLeavers();
      panelsEl.removeAttribute('data-nav-swap');
      panels.forEach(function (p) {
        p.hidden = p.getAttribute('data-nav-panel') !== key;
      });
    }

    items.forEach(function (li) {
      var on = li.getAttribute('data-nav-panel') === key;
      li.classList.toggle(CLS.active, on);
      var ctrl = el(hook('link'), li);
      /* no tag check — Webflow cannot emit <button>, so a head may be an <a>.
         `items` is already filtered to [data-nav-panel], so every ctrl here
         is a panel toggle whatever element it happens to be. */
      if (ctrl) ctrl.setAttribute('aria-expanded', String(on));
    });

    body.classList.toggle(CLS.drilled, mode() === 'mobile' && !!key);
    shell.classList.toggle(CLS.open, mode() === 'desktop' ? !!key : drawerOpen);
    syncButton();
    applyHeight();
  }

  function clearPanel() { setPanel(null); }

  /* ---------- menu button ---------- */
  function syncButton() {
    if (!menuBtn) return;
    var m = mode();
    var state = 'menu';
    if (m === 'mobile')      state = drawerOpen ? (activePanel ? 'back' : 'close') : 'menu';
    else if (m === 'tablet') state = drawerOpen ? 'close' : 'menu';

    menuBtn.setAttribute('data-nav-state', state);
    menuBtn.setAttribute('aria-expanded', String(drawerOpen));
    menuBtn.setAttribute('aria-label',
      state === 'back' ? 'Back' : (state === 'close' ? 'Close menu' : 'Menu'));
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
    shell.classList.add(CLS.open);
    if (scrim) { scrim.hidden = false; void scrim.offsetWidth; scrim.classList.add(CLS.open); }
    lockScroll();
    trapFocus(true);
    /* tablet opens on the first menu so the left column is never blank;
       mobile opens on the link list */
    if (mode() === 'tablet' && items.length) setPanel(items[0].getAttribute('data-nav-panel'));
    else setPanel(null);
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    shell.classList.remove(CLS.open);
    if (scrim) { scrim.classList.remove(CLS.open); scrim.hidden = true; }
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
      var f = all('a[href],button:not([disabled])', shell).filter(function (n) {
        return n.getClientRects().length > 0;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapHandler);
  }

  /* ---------- wiring ---------- */
  if (menuBtn) {
    menuBtn.addEventListener('click', function (e) {
      e.preventDefault();                /* the toggle is an <a href="#"> in Webflow */
      if (mode() === 'mobile' && drawerOpen && activePanel) { setPanel(null); return; }  /* back */
      drawerOpen ? closeDrawer() : openDrawer();
    });
  }

  items.forEach(function (li) {
    var key  = li.getAttribute('data-nav-panel');
    var ctrl = el(hook('link'), li);

    li.addEventListener('mouseenter', function () {
      if (mode() !== 'desktop') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { setPanel(key); }, HOVER_IN);
    });

    if (ctrl) {
      ctrl.addEventListener('click', function (e) {
        e.preventDefault();
        clearTimeout(hoverTimer);
        if (mode() === 'desktop') { activePanel === key ? clearPanel() : setPanel(key); return; }
        setPanel(key);                 /* tablet: switch the rail selection
                                          mobile: drill into the sub-screen */
      });
    }
  });

  nav.addEventListener('mouseleave', function () {
    if (mode() !== 'desktop') return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(clearPanel, HOVER_OUT);
  });

  if (scrim) scrim.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (drawerOpen) {
      if (mode() === 'mobile' && activePanel) { setPanel(null); return; }
      closeDrawer();
      if (menuBtn) menuBtn.focus();
    } else if (activePanel) {
      clearPanel();
    }
  });

  body.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var a = e.target.closest('a[href]');
    if (!a || !drawerOpen) return;
    /* A panel head is a link too once Webflow renders it as <a href="#">.
       Tapping one drills into its panel — it must not also close the drawer.
       The compound selector matches only an <li> that owns a panel, so
       Pricing (an item with no panel) and every in-panel link still close. */
    if (a.closest(hook('item') + '[data-nav-panel]')) return;
    closeDrawer();
  });

  document.addEventListener('click', function (e) {
    if (mode() === 'desktop' && activePanel && !nav.contains(e.target)) clearPanel();
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
        shell.classList.remove(CLS.open);
        if (scrim) { scrim.classList.remove(CLS.open); scrim.hidden = true; }
        unlockScroll();
        trapFocus(false);
        setPanel(null, true);          /* instant: the swap is about to be
                                          restyled out from under itself */
      } else {
        applyHeight();                 /* content or viewport reflowed */
      }
      syncButton();
    }, RESIZE_MS);
  });

  /* keeps the drawer honest when the mobile URL bar slides away */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      if (drawerOpen || activePanel) applyHeight();
    });
  }

  /* ---------- scrolled-state hook ---------- */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      nav.classList.toggle(CLS.scrolled, (window.scrollY || 0) > 8);
      ticking = false;
    });
  }, { passive: true });

  /* ---------- boot ----------
     Hide every panel from the script rather than trusting the markup, so a
     Webflow build does not have to carry a `hidden` attribute on each one. */
  panels.forEach(function (p) { p.hidden = true; });
  syncButton();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyHeight);
})();
