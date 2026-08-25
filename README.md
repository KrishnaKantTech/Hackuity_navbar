# Hackuity Navbar

Standalone navbar component for the Hackuity Webflow site. No dependencies, no build step.

```
nav.css     ships to the CDN
nav.js      ships to the CDN
nav.html    structure reference — the one-time conversion source for Webflow
embed.html  demo host page (generated from nav.html)
webflow/htmltoflow.html  paste target for the htmltoflow app — CDN link + markup + CDN script
preview.html  all three breakpoints side by side
fonts/      Aeonik Regular + Medium (woff2), Bold (otf)
NOTES.md    Figma measurements, decisions, verification log, porting map
```

Open `embed.html` in a browser to see it. Resize past 1620 / 768 / 480 to cross the breakpoints.

## The three-layer split

| Layer | Lives | Notes |
|---|---|---|
| **Structure** | Webflow | One-time conversion of `nav.html` into native elements |
| **CSS + JS** | this repo → jsDelivr | Version-tagged, edited here, never in Webflow |
| **Nav items** | static markup | CMS binding is **on hold** — seven hard-coded links |

## Install in Webflow

Project Settings → Custom Code → **Head**:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@v1.0.1/nav.css">
```

…and **Footer**:

```html
<script defer src="https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@v1.0.1/nav.js"></script>
```

Pin a **tag**, never `@main` — jsDelivr caches aggressively and an untagged URL would let any push
edit the live site. To release: commit, `git tag v1.0.1`, `git push --tags`, bump the URLs.

`nav.css` loads Aeonik with relative URLs, so `fonts/` must ship inside the same tag. Delete that
`@font-face` block if Webflow hosts the font instead.

## What the port must preserve

Every element carries **exactly one** class — no combos. Anything that used to be a BEM modifier or
a second class is now `data-nav-variant`, matched in `nav.css` with `~=`:

```html
<a class="nv-btn" data-nav-variant="ghost login">        →  .nv-btn[data-nav-variant~="ghost"]
```

That is deliberate: HTML→Webflow importers (htmltoflow and friends) keep the first class and drop the
rest into a bogus `class` attribute, which silently kills every modifier. One class per element means
there is nothing to lose, and the variant lands in Webflow's **Attributes** panel where it belongs.

Rename any `nv-` class you like — **`nav.js` never reads one.** It finds every element through
data attributes, and those must survive the conversion:

| Attribute | On |
|---|---|
| `data-nav-el="root"` | the `<header>` |
| `data-nav-el="shell"` | stacking wrapper inside it |
| `data-nav-el="bar"` | the fixed-height pill (measured by JS, never resized) |
| `data-nav-el="body"` | the growing surface / mobile drawer |
| `data-nav-el="panels"` | the panel stack |
| `data-nav-el="panel"` + `data-nav-panel="<key>"` | one mega-menu |
| `data-nav-el="menu"` | the `<ul>` |
| `data-nav-el="item"` + `data-nav-panel="<key>"` | one `<li>` |
| `data-nav-el="link"` | the `<button>`/`<a>` inside an item |
| `data-nav-el="toggle"` / `"toggle-label"` | the hamburger and its text |
| `data-nav-el="scrim"` | the full-page dim layer |
| `data-nav-el="logo-standalone"` | the mobile logo above the drawer |
| `data-nav-variant="…"` | the 14 elements that used to carry a second class |

`data-nav-state` is written by JS and read by CSS to swap the hamburger / ✕ / back icons.
`data-nav-icon` marks the ~30 icon tiles for the SVG swap that is still outstanding.

Two more things Webflow must not undo:

- **Load `nav.css` after Webflow's own CSS.** It contains no reset — Webflow's normalize is the
  reset, and every rule here is scoped to an `nv-` class so it cannot reach outside the component.
- **The 1619px breakpoint is not a Webflow breakpoint.** It lives in `nav.css` only. See NOTES.md § 2
  for why the desktop bar cannot survive below 1610px, and the three options for what to do about it.

## Editing

Breakpoints are declared once, in `nav.css`:

```css
--nv-bp-tablet:1619;
--nv-bp-mobile:767;
```

`nav.js` reads those at runtime, so the script and the media queries cannot drift. Change the token
**and** the matching `@media` query together.

`embed.html` and `webflow/htmltoflow.html` are generated from `nav.html` — edit `nav.html`, then:

```
python3 tools/regen.py
```

One trap worth knowing if you touch `applyHeight()`: the element that carries the animated height
**changes with the breakpoint** — `.nv-panels` on desktop, `.nv-body` on tablet and mobile. Whichever
one is not in use must have its inline `height` cleared, or it walks across the breakpoint and
overrides the stylesheet. See NOTES.md § 8.

See **NOTES.md** for the Figma source values, the porting map, the mobile-scroll root cause, and the
full verification log.
