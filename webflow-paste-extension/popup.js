/* ============================================================================
   Popup controller.
   Loads a bundled payload, validates it, injects inject.js into the MAIN world
   of the active Webflow tab, arms it, and then polls for what actually got
   read. Nothing is armed without an explicit click here.
   ========================================================================= */
'use strict';

const $ = (id) => document.getElementById(id);
const elLog = $('log');
const elWhich = $('which');
const btnArm = $('arm');
const btnSynth = $('synth');
const btnDisarm = $('disarm');

let pollTimer = null;

function log(msg, cls) {
  elLog.className = cls || '';
  elLog.textContent = msg;
}
function append(msg) {
  elLog.textContent += '\n' + msg;
  elLog.scrollTop = elLog.scrollHeight;
}

/* ---------- find the Webflow Designer tab ---------- */
async function webflowTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab.');
  if (!/^https:\/\/([a-z0-9-]+\.)?webflow\.com\//i.test(tab.url || '')) {
    throw new Error('Not a Webflow tab.\nOpen the Designer, then click Arm.');
  }
  return tab;
}

/* ---------- load + validate the payload ---------- */
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

  /* integrity: every child and class reference must resolve */
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

/* ---------- inject + arm ---------- */
async function inject(tabId, payload) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    files: ['inject.js']
  });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    func: (json) => (typeof NV_ARM === 'function'
      ? NV_ARM(json, { timeoutMs: 90000 })
      : { ok: false, error: 'NV_ARM missing' }),
    args: [payload]
  });
  return result;
}

async function readState(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    func: () => (window.__nvState ? JSON.parse(JSON.stringify(window.__nvState)) : null)
  });
  return result;
}

function startPolling(tabId) {
  clearInterval(pollTimer);
  let ticks = 0;
  pollTimer = setInterval(async () => {
    ticks++;
    let s = null;
    try { s = await readState(tabId); } catch (e) { /* tab navigated away */ }
    if (!s) return;
    if (s.served && s.served.length) {
      clearInterval(pollTimer);
      log('✅ Webflow read the payload\n   via ' + s.served.join(', ') +
          '\n\nCheck the Navigator — the navbar should be there.', 'ok');
      btnSynth.disabled = true;
    } else if (!s.armed) {
      clearInterval(pollTimer);
      log('⚠️ Disarmed (' + s.disarmedBy + ') before anything was read.\n' +
          'Arm again and press Cmd+V with the canvas focused.', 'warn');
      btnSynth.disabled = true;
      btnDisarm.disabled = true;
    } else if (ticks % 10 === 0) {
      append('… still armed, waiting for a paste');
    }
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

    const armed = await inject(tab.id, pl.text);
    if (!armed || !armed.ok) throw new Error('Arm failed: ' + JSON.stringify(armed));

    append('✓ armed in the Webflow tab (90s)');
    append('\n→ Click the canvas, then press Cmd+V');
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
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      world: 'MAIN',
      func: () => (typeof window.__nvSynthetic === 'function'
        ? window.__nvSynthetic()
        : -1)
    });
    if (result === -1) append('❌ not armed — press Arm first');
    else append('→ fired synthetic paste at ' + result + ' target(s); check the Navigator');
  } catch (e) {
    append('❌ ' + e.message);
  }
});

btnDisarm.addEventListener('click', async () => {
  clearInterval(pollTimer);
  try {
    const tab = await webflowTab();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      world: 'MAIN',
      func: () => (window.__nvDisarm ? window.__nvDisarm('popup') : null)
    });
    log('Disarmed. Normal copy/paste restored.');
  } catch (e) {
    log('❌ ' + e.message, 'err');
  }
  btnSynth.disabled = true;
  btnDisarm.disabled = true;
});
