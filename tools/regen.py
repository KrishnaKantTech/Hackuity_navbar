#!/usr/bin/env python3
"""Regenerate every file derived from nav.html.

    python3 tools/regen.py

  embed.html                        demo host page — nav.html spliced in
  webflow/htmltoflow.html           CDN <link> + markup + CDN <script>
  webflow/navbar.webflow.json       Designer paste payload (4 roots)
  webflow/navbar.webflow.singleroot.json   same, wrapped in one div
  webflow-paste-extension/payload/  both payloads, copied in

The extension payloads used to be copied by hand and went stale — the whole
point of doing it here is that they cannot drift from nav.html again.
"""
import copy, json, pathlib, re, subprocess, sys, uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
CDN  = "https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@{tag}/{f}"

nav = (ROOT / "nav.html").read_text()
tag = re.search(r"nav\.html\s+·\s+(v[\d.]+)", nav).group(1)

# ── embed.html ──────────────────────────────────────────────────────────────
embed = (ROOT / "embed.html").read_text()
head, _, rest = embed.partition("<body>\n")
_, main, tail = rest.partition('<main id="main"')
(ROOT / "embed.html").write_text(f"{head}<body>\n\n{nav.strip()}\n\n{main}{tail}")

# ── webflow/htmltoflow.html ─────────────────────────────────────────────────
body = nav.split("-->", 1)[1].strip()          # drop the header comment block
(ROOT / "webflow" / "htmltoflow.html").write_text(
    f'<link rel="stylesheet" href="{CDN.format(tag=tag, f="nav.css")}">\n\n'
    f'{body}\n\n'
    f'<script defer src="{CDN.format(tag=tag, f="nav.js")}"></script>\n'
)
# ── webflow paste payloads ──────────────────────────────────────────────────
full = ROOT / "webflow" / "navbar.webflow.json"
subprocess.run([sys.executable, str(ROOT / "tools" / "nav-to-webflow.py"), str(full)],
               check=True, stdout=subprocess.DEVNULL)

doc = json.loads(full.read_text())
pay = doc["payload"]
child = {c for n in pay["nodes"] for c in n.get("children", [])}
roots = [n["_id"] for n in pay["nodes"] if n["_id"] not in child]

# Webflow rejects a multi-root paste in some contexts; this is the fallback.
sr = copy.deepcopy(doc)
wrapper = {
    "_id": str(uuid.uuid4()), "type": "Block", "tag": "div",
    "classes": [], "children": roots,
    "data": {"devlink": {"runtimeProps": {}, "slot": ""}, "displayName": "",
             "attr": {"id": ""}, "xattr": [], "search": {"exclude": False},
             "visibility": {"conditions": []}},
}
sr["payload"]["nodes"].insert(0, wrapper)
(ROOT / "webflow" / "navbar.webflow.singleroot.json").write_text(json.dumps(sr))

ext = ROOT / "webflow-paste-extension" / "payload"
if ext.is_dir():
    (ext / "navbar.json").write_text(full.read_text())
    (ext / "navbar-singleroot.json").write_text(json.dumps(sr))

print(f"regenerated at {tag}: embed.html, webflow/htmltoflow.html, "
      f"{len(pay['nodes'])} nodes / {len(pay['styles'])} styles "
      f"({len(roots)} roots), extension payloads synced")
