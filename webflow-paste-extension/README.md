# Hackuity Navbar → Webflow

A one-purpose Chrome extension: hands `webflow/navbar.webflow.json` to the
Webflow Designer.

## Why it exists

Webflow's Designer does **not** read the OS clipboard for its native paste. Proven:
its own copy leaves the macOS pasteboard empty, `navigator.clipboard.read()`
returns an item with zero types, and pasting a payload that Webflow itself
generated — written to the clipboard from another tab — is rejected with
"The clipboard is empty."

Commercial HTML→Webflow extensions work because they run **inside** the Webflow
tab. This does the same thing, with our payload, without a size cap or a
per-conversion charge.

## Install

1. `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select this folder
4. Pin it

## Use

1. Open the Webflow **Designer** on the page that gets the navbar
2. Click the extension icon → **Arm paste**
3. Click the **canvas**, press **Cmd + V**
4. If nothing lands, hit **Fire synthetic paste**

The popup reports which path Webflow actually read from.

Start with the **Control — 3 nodes** payload if you want to prove the transport
before sending all 194.

## How it works

`inject.js` runs in the MAIN world of the Webflow tab and offers the payload
down three routes, because Webflow's paste path is not public:

| Route | Covers |
|---|---|
| `DataTransfer.getData` | a real Cmd+V — the event stays trusted, only the returned string is swapped |
| `clipboard.readText` / `read` | the async-clipboard path |
| synthetic `paste` event | last resort, fired at the canvas and every same-origin iframe |

Safety, all covered by the test suite:

- armed only by an explicit click in the popup
- returns **only** this payload, and **only** for `text/plain` reads
- auto-disarms after 90s, and can be disarmed manually
- disarm restores the original functions by identity, so normal copy/paste in
  the tab is never left altered
- re-arming disarms the previous arm first, so patches cannot stack

## Payloads

| File | Contents |
|---|---|
| `payload/navbar.json` | 194 nodes, 58 classes, 4 roots — the real thing |
| `payload/navbar-singleroot.json` | same, wrapped in one div, if 4 roots are rejected |
| `payload/control.json` | 3 nodes straight out of Webflow — transport test |

Regenerate after any markup change:

```
python3 tools/nav-to-webflow.py webflow/navbar.webflow.json
cp webflow/navbar.webflow.json webflow-paste-extension/payload/navbar.json
```

## Scope

`host_permissions` is limited to `webflow.com`. It cannot run anywhere else.
Nothing is uploaded; the payload ships inside the extension.
