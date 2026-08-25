/* ============================================================================
   Popup controller.

   Injects into EVERY frame of the Webflow tab, not just the top one. This
   matters: the Designer canvas is an iframe, and each frame is its own JS realm
   with its own DataTransfer.prototype and its own navigator.clipboard. Patching
   only the top frame leaves the canvas — where the paste actually lands —
   completely untouched, which is why the first build never intercepted
   anything.
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const elLog = $('log');
const elWhich = $('which');
const btnArm = $('arm');
const btnSynth = $('synth');
const btnDisarm = $('disarm');
const btnDiag = $('diag');
const btnFind = $('find');

let pollTimer = null;

function log(msg, cls) { elLog.className = cls || ''; elLog.textContent = msg; }
function append(msg) { elLog.textContent += '\n' + msg; elLog.scrollTop = elLog.scrollHeight; }

/* Designer URLs carry more than one subdomain label — the live one looks like
   https://kcm-en.design.webflow.com/?pageId=… — so every label has to be
   optional and repeatable, not just one. */
const WEBFLOW_URL = /^https:\/\/([a-z0-9-]+\.)*webflow\.(com|io)(\/|$)/i;

async function webflowTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab.');
  if (!WEBFLOW_URL.test(tab.url || '')) {
    let host = '(unparseable)';
    try { host = new URL(tab.url).host; } catch (e) {}
    throw new Error('Not a Webflow tab — host is:\n' + host + '\n\nOpen the Designer, then Arm.');
  }
  return tab;
}

/* ---------- payload ---------- */
async function loadPayload(name) {
  const res = await fetch(chrome.runtime.getURL('payload/' + name));
  if (!res.ok) throw new Error('Payload missing: ' + name);
  const text = await res.text();

  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new Error('Payload is not valid JSON: ' + e.message); }

  if (data.type !== '@webflow/XscpData') throw new Error('Wrong payload type: ' + data.type);
  const p = data.payload;
  if (!p || !Array.isArray(p.nodes) || !Array.isArray(p.styles)) {
    throw new Error('Payload is missing nodes/styles.');
  }
  const ids = new Set(p.nodes.map((n) => n._id));
  const styleIds = new Set(p.styles.map((s) => s._id));
  const referenced = new Set();
  for (const n of p.nodes) {
    for (const c of n.children || []) {
      if (!ids.has(c)) throw new Error('Dangling child ref ' + c);
      referenced.add(c);
    }
    for (const c of n.classes || []) {
      if (!styleIds.has(c)) throw new Error('Dangling class ref ' + c);
    }
  }
  const roots = p.nodes.filter((n) => !referenced.has(n._id)).length;
  return { text, nodes: p.nodes.length, styles: p.styles.length, roots };
}

/* ---------- frame-wide injection ---------- */
async function runInAllFrames(tabId, spec) {
  const results = await chrome.scripting.executeScript(
    Object.assign({ target: { tabId, allFrames: true }, world: 'MAIN' }, spec)
  );
  return results || [];
}

async function frameReport(tabId) {
  const frames = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: () => ({
      url: (location.href || '').slice(0, 90),
      top: window === window.top,
      armed: !!(window.__nvState && window.__nvState.armed),
      served: (window.__nvState && window.__nvState.served) || [],
      calls: (window.__nvState && window.__nvState.calls) || [],
      hasArm: typeof NV_ARM === 'function',
      err: (window.__nvState && window.__nvState.lastError) || null
    })
  });
  return frames.map((f) => Object.assign({ frameId: f.frameId }, f.result || {}));
}

/* The canvas iframes rebuild themselves, which wipes anything injected a moment
   earlier. Inject and arm, then check, then repeat for the frames that came up
   empty — a couple of passes is enough to catch a frame mid-rebuild. */
async function armEverywhere(tabId, payload, passes = 3) {
  let report = [];
  for (let i = 0; i < passes; i++) {
    await runInAllFrames(tabId, { files: ['inject.js'] });
    await runInAllFrames(tabId, {
      func: (json) => (typeof NV_ARM === 'function'
        ? NV_ARM(json, { timeoutMs: 120000 })
        : { ok: false, error: 'NV_ARM missing' }),
      args: [payload]
    });
    report = await frameReport(tabId);
    if (report.every((f) => f.armed)) break;
    await new Promise((r) => setTimeout(r, 350));
  }
  return report;
}

/* ---------- polling ---------- */
function startPolling(tabId) {
  clearInterval(pollTimer);
  let ticks = 0;
  pollTimer = setInterval(async () => {
    ticks++;
    let frames = [];
    try { frames = await frameReport(tabId); } catch (e) { return; }
    const hit = frames.filter((f) => f.served && f.served.length);
    if (hit.length) {
      clearInterval(pollTimer);
      log('✅ Webflow read the payload\n' +
        hit.map((f) => '   frame ' + f.frameId + (f.top ? ' (top)' : '') + ' → ' + f.served.join(', ')).join('\n') +
        '\n\nCheck the Navigator.', 'ok');
      btnSynth.disabled = true;
      return;
    }
    if (!frames.some((f) => f.armed)) {
      clearInterval(pollTimer);
      log('⚠️ All frames disarmed before anything was read.\nArm again, click the canvas, then Cmd+V.', 'warn');
      btnSynth.disabled = true;
      btnDisarm.disabled = true;
      return;
    }
    if (ticks % 8 === 0) append('… armed in ' + frames.filter((f) => f.armed).length + ' frame(s), waiting');
  }, 1000);
}

/* ---------- buttons ---------- */
btnArm.addEventListener('click', async () => {
  btnArm.disabled = true;
  try {
    const tab = await webflowTab();
    log('Loading ' + elWhich.value + ' …');
    const pl = await loadPayload(elWhich.value);
    append('✓ valid · ' + pl.text.length.toLocaleString() + ' chars · ' +
      pl.nodes + ' nodes · ' + pl.styles + ' classes · ' + pl.roots + ' root(s)');

    const frames = await armEverywhere(tab.id, pl.text);
    const good = frames.filter((f) => f.armed);
    if (!good.length) throw new Error('Armed 0 frames — injection is being blocked.');
    append('✓ armed in ' + good.length + ' of ' + frames.length + ' frame(s), 120s window');
    for (const f of frames) {
      append('   [' + f.frameId + ']' + (f.top ? ' top ' : '     ') + (f.armed ? '✓ ' : '✗ ') + f.url);
    }
    append('\n→ Click the CANVAS, then Cmd+V');
    elLog.className = 'ok';
    btnSynth.disabled = false;
    btnDisarm.disabled = false;
    startPolling(tab.id);
  } catch (e) {
    log('❌ ' + e.message, 'err');
  } finally {
    btnArm.disabled = false;
  }
});

btnSynth.addEventListener('click', async () => {
  try {
    const tab = await webflowTab();
    const out = await runInAllFrames(tab.id, {
      func: () => (typeof window.__nvSynthetic === 'function' ? window.__nvSynthetic() : -1)
    });
    const fired = out.map((r) => r.result).filter((n) => n > 0);
    append('→ synthetic paste fired in ' + fired.length + ' frame(s) at ' +
      fired.reduce((a, b) => a + b, 0) + ' target(s)');
  } catch (e) { append('❌ ' + e.message); }
});

btnDiag.addEventListener('click', async () => {
  try {
    const tab = await webflowTab();
    const frames = await frameReport(tab.id);
    log('Frames in this tab: ' + frames.length);
    for (const f of frames) {
      append('\n[' + f.frameId + ']' + (f.top ? ' TOP' : '') +
        '\n   url    ' + f.url +
        '\n   NV_ARM ' + (f.hasArm ? 'present' : 'not injected') +
        '\n   armed  ' + f.armed +
        '\n   served ' + JSON.stringify(f.served) +
        (f.err ? '\n   error  ' + f.err : ''));
      if (f.calls && f.calls.length) {
        append('   calls  ' + f.calls.length);
        for (const c of f.calls) {
          append('     +' + c.at + 'ms  ' + c.what + '("' + c.type + '") → ' + c.gave +
                 '\n        from ' + (c.from || '').slice(0, 150));
        }
      }
    }
  } catch (e) { log('❌ ' + e.message, 'err'); }
});

/* The popup is a fresh document every time it opens, so it starts out knowing
   nothing about a page that may already be armed. Ask the tab on load, and
   re-enable the buttons that act on an existing arm. */
(async function initFromPage() {
  try {
    const tab = await webflowTab();
    const frames = await frameReport(tab.id);
    const armed = frames.filter((f) => f.armed);
    const served = frames.filter((f) => f.served && f.served.length);
    if (armed.length) {
      btnSynth.disabled = false;
      btnDisarm.disabled = false;
      log('Already armed in ' + armed.length + ' of ' + frames.length +
          ' frame(s).\nClick the canvas and press Cmd+V, or Arm again to reset.', 'ok');
      startPolling(tab.id);
    } else if (served.length) {
      log('Previous run served: ' +
          served.map((f) => f.served.join(', ')).join(' / ') +
          '\nArm again to retry.', 'warn');
    }
  } catch (e) {
    log(e.message);
  }
})();

/* ---------- where does Webflow actually keep a copied element? ----------
   If its clipboard is an internal store rather than the OS one, the payload has
   to be sitting somewhere reachable: localStorage, sessionStorage, IndexedDB,
   or a global on window. Copy an element in the Designer, then run this. */
btnFind.addEventListener('click', async () => {
  try {
    const tab = await webflowTab();
    log('Scanning all frames for a stored payload…\n(copy an element in the Designer first)');
    const out = await runInAllFrames(tab.id, {
      func: async () => {
        const NEEDLES = ['XscpData', 'zz-base', 'zz-combo', 'xscp'];
        const hits = [];
        const looksRight = (s) =>
          typeof s === 'string' && s.length > 40 &&
          NEEDLES.some((n) => s.toLowerCase().includes(n.toLowerCase()));

        for (const [label, store] of [['localStorage', localStorage], ['sessionStorage', sessionStorage]]) {
          try {
            for (let i = 0; i < store.length; i++) {
              const k = store.key(i);
              const v = store.getItem(k);
              if (looksRight(v)) hits.push({ where: label, key: k, len: v.length, head: v.slice(0, 120) });
            }
          } catch (e) { hits.push({ where: label, error: String(e) }); }
        }

        try {
          for (const k of Object.keys(window)) {
            if (!/clip|paste|copy|xscp/i.test(k)) continue;
            let v = null;
            try { v = window[k]; } catch (e) { continue; }
            const s = typeof v === 'string' ? v : null;
            hits.push({ where: 'window', key: k, type: typeof v, len: s ? s.length : null,
                        head: s ? s.slice(0, 120) : null });
          }
        } catch (e) { hits.push({ where: 'window', error: String(e) }); }

        let dbs = [];
        try {
          if (indexedDB.databases) dbs = (await indexedDB.databases()).map((d) => d.name + ' v' + d.version);
        } catch (e) { dbs = ['(enumeration blocked)']; }

        return {
          url: location.href.slice(0, 70),
          lsKeys: (() => { try { return localStorage.length; } catch (e) { return -1; } })(),
          ssKeys: (() => { try { return sessionStorage.length; } catch (e) { return -1; } })(),
          idb: dbs,
          hits
        };
      }
    });

    let any = 0;
    for (const r of out) {
      const f = r.result;
      if (!f) continue;
      append('\n[' + r.frameId + '] ' + f.url +
             '\n   localStorage ' + f.lsKeys + ' keys · sessionStorage ' + f.ssKeys + ' keys' +
             '\n   indexedDB: ' + (f.idb.length ? f.idb.join(', ') : 'none'));
      for (const h of f.hits) {
        any++;
        append('   ★ ' + h.where + (h.key ? ' [' + h.key + ']' : '') +
               (h.len != null ? ' len=' + h.len : '') +
               (h.error ? ' ERROR ' + h.error : '') +
               (h.head ? '\n     ' + h.head : ''));
      }
    }
    if (!any) append('\n→ No stored payload found. Webflow is not keeping it anywhere reachable.');
    elLog.className = any ? 'ok' : 'warn';
  } catch (e) { log('❌ ' + e.message, 'err'); }
});

btnDisarm.addEventListener('click', async () => {
  clearInterval(pollTimer);
  try {
    const tab = await webflowTab();
    await runInAllFrames(tab.id, {
      func: () => (window.__nvDisarm ? window.__nvDisarm('popup') : null)
    });
    log('Disarmed everywhere. Normal copy/paste restored.');
  } catch (e) { log('❌ ' + e.message, 'err'); }
  btnSynth.disabled = true;
  btnDisarm.disabled = true;
});
