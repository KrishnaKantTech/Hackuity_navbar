#!/usr/bin/env python3
"""Regenerate the two files that are copies of nav.html.

    python3 tools/regen.py

  embed.html            demo host page — nav.html spliced between <body> and <main>
  webflow/htmltoflow.html  paste target for the htmltoflow app — CDN <link> +
                        nav.html (header comment stripped) + CDN <script>
"""
import pathlib, re, sys

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
print(f"regenerated embed.html + webflow/htmltoflow.html at {tag}")
