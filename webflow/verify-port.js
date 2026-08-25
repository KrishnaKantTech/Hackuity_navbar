/* Paste into the browser console on the Webflow preview / published page.
   Frame-aware: the Designer canvas is its own iframe, so this hunts for the
   document that actually contains the navbar before checking anything. */
(function () {
  var docs = [], blocked = 0;
  (function walk(win, path) {
    try { docs.push({ doc: win.document, path: path, url: win.location.href }); }
    catch (e) { blocked++; return; }
    for (var i = 0; i < win.frames.length; i++) walk(win.frames[i], path + '/frame[' + i + ']');
  })(window.top || window, 'top');

  var hit = null;
  for (var i = 0; i < docs.length; i++)
    if (docs[i].doc.querySelector('[data-nav-el="root"]')) { hit = docs[i]; break; }

  if (!hit) {
    console.error('✗ no [data-nav-el="root"] in any reachable frame.');
    console.log('searched ' + docs.length + ' frame(s), ' + blocked + ' blocked cross-origin:');
    docs.forEach(function (d) { console.log('   ' + d.path + '  ' + d.url); });
    console.log(blocked
      ? 'The navbar is probably in a blocked frame — switch the DevTools context dropdown to it, or run this on the Preview / published page instead.'
      : 'Nothing was found anywhere reachable, so the import produced no navbar on this page.');
    return;
  }
  console.log('inspecting: ' + hit.path + '  ' + hit.url);

  var D = hit.doc;
  var q = function (n) { return [].slice.call(D.querySelectorAll('[data-nav-el="' + n + '"]')); };
  var want = { root:1, shell:1, bar:1, body:1, panels:1, panel:6, menu:1, item:7, link:7,
               toggle:1, 'toggle-label':1, scrim:1, logo:1, 'logo-standalone':1 };
  var bad = 0;
  Object.keys(want).forEach(function (k) {
    var n = q(k).length;
    if (n !== want[k]) { console.error('✗ data-nav-el="' + k + '" → ' + n + ', expected ' + want[k]); bad++; }
  });

  var pKeys = q('panel').map(function (e) { return e.getAttribute('data-nav-panel'); });
  q('item').forEach(function (li) {
    var k = li.getAttribute('data-nav-panel');
    if (k && pKeys.indexOf(k) < 0) { console.error('✗ item "' + k + '" has no matching panel'); bad++; }
  });

  var wantCls = { 'nv-logo--standalone':1, 'nv-logo--inbar':1, 'nv-btn--ghost':1, 'nv-login':1,
                  'nv-btn--primary':1, 'nv-ico--menu':1, 'nv-ico--close':1, 'nv-ico--back':1,
                  'nv-cards--loose':1, 'nv-cards--tight':1, 'nv-tag--plain':1, 'nv-panel--thirds':1,
                  'nv-is-disabled':1, 'nv-card-icon--muted':1, 'nv-group--empty':1 };
  Object.keys(wantCls).forEach(function (c) {
    var n = D.getElementsByClassName(c).length;
    if (n !== wantCls[c]) { console.error('X .' + c + ' -> ' + n + ', expected ' + wantCls[c]); bad++; }
  });
  // every modifier must sit alongside its base class, or nav.css will not match
  var pairs = [['nv-logo--standalone','nv-logo'], ['nv-logo--inbar','nv-logo'],
               ['nv-btn--ghost','nv-btn'], ['nv-login','nv-btn'], ['nv-btn--primary','nv-btn'],
               ['nv-ico--menu','nv-ico'], ['nv-ico--close','nv-ico'], ['nv-ico--back','nv-ico'],
               ['nv-cards--loose','nv-cards'], ['nv-cards--tight','nv-cards'],
               ['nv-tag--plain','nv-tag'], ['nv-panel--thirds','nv-panel'],
               ['nv-is-disabled','nv-card'], ['nv-card-icon--muted','nv-card-icon'],
               ['nv-group--empty','nv-group']];
  pairs.forEach(function (p) {
    [].slice.call(D.getElementsByClassName(p[0])).forEach(function (el) {
      if (!el.classList.contains(p[1])) { console.error('X .' + p[0] + ' is missing its base .' + p[1]); bad++; }
    });
  });

  var css = [].slice.call(D.styleSheets).some(function (s) { return (s.href || '').indexOf('nav.css') > -1; });
  var js  = q('panel').length > 0 && q('panel').every(function (p) { return p.hidden; });
  console.log('css loaded:', css, '| js booted:', js, '| structure:', bad ? bad + ' problem(s)' : 'OK');
})();
