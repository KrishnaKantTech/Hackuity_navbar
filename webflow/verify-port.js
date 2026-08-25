/* Paste in the browser console on the Webflow preview/published page. */
(function () {
  var q = function (n) { return [].slice.call(document.querySelectorAll('[data-nav-el="' + n + '"]')); };
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
  var wantVar = { standalone:1, inbar:1, ghost:1, login:1, primary:1, menu:1, close:1, back:1,
                  loose:1, tight:1, plain:1, thirds:1, disabled:1, muted:1, empty:1 };
  Object.keys(wantVar).forEach(function (v) {
    var n = document.querySelectorAll('[data-nav-variant~="' + v + '"]').length;
    if (n !== wantVar[v]) { console.error('✗ data-nav-variant~="' + v + '" → ' + n + ', expected ' + wantVar[v]); bad++; }
  });
  [].slice.call(document.querySelectorAll('[class*=" nv-"]')).forEach(function (e) {
    console.error('✗ combo class survived: "' + e.className + '" — should be one class + data-nav-variant'); bad++;
  });

  var css = [].slice.call(document.styleSheets).some(function (s) { return (s.href || '').indexOf('nav.css') > -1; });
  var js  = q('panel').length > 0 && q('panel').every(function (p) { return p.hidden; });
  console.log('css loaded:', css, '| js booted:', js, '| structure:', bad ? bad + ' problem(s)' : 'OK');
})();
