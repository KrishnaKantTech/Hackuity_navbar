/* ============================================================================
   Hackuity navbar -> Webflow  ·  in-page payload server
   ----------------------------------------------------------------------------
   Runs in the MAIN world of the Webflow Designer tab, which is the entire point
   of this extension: the Designer ignores the OS clipboard and reads its own
   in-page paths, so the payload has to be offered from inside the page. That is
   the same door the commercial HTML->Webflow extensions go through.

   Webflow's paste implementation is not public and has changed over releases,
   so three delivery paths are offered at once and whichever one the Designer
   reaches for gets the payload:

     1. DataTransfer.getData   - you press a REAL Cmd+V, so the paste event stays
                                 trusted; only the returned string is swapped.
     2. clipboard.readText/read - the async-clipboard path.
     3. a synthetic paste event - last resort, fired at the canvas.

   Scope and safety:
     · armed only on an explicit click in the extension popup
     · only ever returns THIS payload, only for text/plain reads
     · auto-disarms on the first successful read, and on a hard timeout
     · restores every original function on disarm, so normal copy/paste in the
       tab is never left altered
   ========================================================================= */
function NV_ARM(payload, opts) {
  var TAG = '[nv-paste]';
  var TIMEOUT = (opts && opts.timeoutMs) || 90000;

  /* never stack two arms on top of each other */
  try { if (window.__nvDisarm) window.__nvDisarm('re-armed'); } catch (e) {}

  var state = window.__nvState = {
    armed: true,
    served: [],
    calls: [],          /* full record: what was asked for, by whom, when */
    startedAt: Date.now(),
    lastError: null,
    disarmedBy: null,
    chars: payload.length
  };

  /* Who is asking? Webflow's paste handler and an incidental getData from some
     unrelated widget look identical unless we capture the caller. */
  function caller() {
    try {
      var lines = (new Error().stack || '').split('\n').slice(2, 6);
      return lines.map(function (l) { return l.trim().replace(/^at\s+/, ''); }).join(' | ');
    } catch (e) { return '(no stack)'; }
  }
  function record(what, type, gave) {
    state.calls.push({
      at: Date.now() - state.startedAt,
      what: what,
      type: type,
      gave: gave,
      from: caller()
    });
    if (state.calls.length > 40) state.calls.shift();
  }

  /* ---------- keep every original so disarm is exact ---------- */
  var oGetData   = DataTransfer.prototype.getData;
  var oTypesDesc = Object.getOwnPropertyDescriptor(DataTransfer.prototype, 'types');
  var clip       = navigator.clipboard;
  var oReadText  = clip && clip.readText;
  var oRead      = clip && clip.read;
  var timer      = null;

  function note(path) {
    if (state.served.indexOf(path) === -1) state.served.push(path);
    try { console.log(TAG, 'served via', path); } catch (e) {}
  }

  /* ---------- 1. the trusted paste event ---------- */
  var WANTED = { 'text/plain': true, 'text': true, '': true };
  DataTransfer.prototype.getData = function (type) {
    try {
      var t = String(type == null ? '' : type).toLowerCase();
      if (state.armed) {
        if (WANTED[t] === true) {
          note('DataTransfer.getData("' + t + '")');
          record('getData', t, 'payload');
          return payload;
        }
        /* not ours — still log it, so we can see everything Webflow probes for
           before it decides the clipboard is empty */
        var passed = oGetData.apply(this, arguments);
        record('getData', t, passed ? 'passthrough(' + passed.length + ')' : 'passthrough(empty)');
        return passed;
      }
    } catch (e) { state.lastError = String(e); }
    return oGetData.apply(this, arguments);
  };

  /* advertise text/plain even when the OS clipboard is empty, or Webflow may
     conclude there is nothing to paste before it ever calls getData */
  if (oTypesDesc && oTypesDesc.get) {
    try {
      Object.defineProperty(DataTransfer.prototype, 'types', {
        configurable: true,
        enumerable: oTypesDesc.enumerable,
        get: function () {
          var real;
          try { real = oTypesDesc.get.call(this); } catch (e) { real = []; }
          if (!state.armed) return real;
          var list = Array.prototype.slice.call(real || []);
          if (list.indexOf('text/plain') === -1) list.push('text/plain');
          record('types', '-', JSON.stringify(list));
          return Object.freeze(list);
        }
      });
    } catch (e) { state.lastError = String(e); }
  }

  /* ---------- 2. the async clipboard ---------- */
  if (clip) {
    if (oReadText) {
      try {
        clip.readText = function () {
          if (!state.armed) return oReadText.apply(clip, arguments);
          note('clipboard.readText');
          return Promise.resolve(payload);
        };
      } catch (e) { state.lastError = String(e); }
    }
    if (oRead) {
      try {
        clip.read = function () {
          if (!state.armed) return oRead.apply(clip, arguments);
          note('clipboard.read');
          var blob = new Blob([payload], { type: 'text/plain' });
          var item;
          try {
            item = new ClipboardItem({ 'text/plain': blob });
          } catch (e) {
            item = {
              types: ['text/plain'],
              getType: function (t) {
                return t === 'text/plain'
                  ? Promise.resolve(blob)
                  : Promise.reject(new Error('no ' + t));
              }
            };
          }
          return Promise.resolve([item]);
        };
      } catch (e) { state.lastError = String(e); }
    }
  }

  /* ---------- 3. synthetic paste, fired on demand ---------- */
  window.__nvSynthetic = function () {
    var dt = null;
    try {
      dt = new DataTransfer();
      dt.setData('text/plain', payload);
    } catch (e) { state.lastError = String(e); }

    var targets = [];
    try {
      if (document.activeElement) targets.push(document.activeElement);
      var frames = document.querySelectorAll('iframe');
      for (var f = 0; f < frames.length; f++) {
        try {
          var doc = frames[f].contentDocument;
          if (doc && doc.body) { targets.push(doc.body); targets.push(doc); }
        } catch (e) { /* cross-origin frame, skip */ }
      }
      targets.push(document.body, document);
    } catch (e) { state.lastError = String(e); }

    var fired = 0;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (!t || typeof t.dispatchEvent !== 'function') continue;
      try {
        var ev;
        try {
          ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        } catch (e) {
          ev = document.createEvent('Event');
          ev.initEvent('paste', true, true);
        }
        if (!ev.clipboardData && dt) {
          try { Object.defineProperty(ev, 'clipboardData', { value: dt, configurable: true }); } catch (e2) {}
        }
        t.dispatchEvent(ev);
        fired++;
      } catch (e) { state.lastError = String(e); }
    }
    note('synthetic paste x' + fired);
    return fired;
  };

  /* ---------- disarm: put everything back exactly ---------- */
  window.__nvDisarm = function (why) {
    if (!state.armed) return state;
    state.armed = false;
    state.disarmedBy = why || 'manual';
    try { clearTimeout(timer); } catch (e) {}
    try { DataTransfer.prototype.getData = oGetData; } catch (e) {}
    try { if (oTypesDesc) Object.defineProperty(DataTransfer.prototype, 'types', oTypesDesc); } catch (e) {}
    try { if (clip && oReadText) clip.readText = oReadText; } catch (e) {}
    try { if (clip && oRead) clip.read = oRead; } catch (e) {}
    try { console.log(TAG, 'disarmed:', state.disarmedBy, 'served:', state.served); } catch (e) {}
    return state;
  };

  timer = setTimeout(function () { window.__nvDisarm('timeout'); }, TIMEOUT);

  try {
    console.log(TAG, 'armed — ' + payload.length + ' chars, ' + Math.round(TIMEOUT / 1000) + 's window');
  } catch (e) {}

  return { ok: true, chars: payload.length, timeoutMs: TIMEOUT };
}
