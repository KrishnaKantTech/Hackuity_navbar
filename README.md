# Hackuity Navbar

Standalone navbar component for the Hackuity Webflow site. No dependencies, no build step.

```
nav.css     ships to the CDN
nav.js      ships to the CDN
nav.html    structure reference — the one-time conversion source for Webflow
embed.html  demo host page (generated from nav.html)
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/OWNER/REPO@v1.0.0/nav.css">
```

…and **Footer**:

```html
<script defer src="https://cdn.jsdelivr.net/gh/OWNER/REPO@v1.0.0/nav.js"></script>
```

Pin a **tag**, never `@main` — jsDelivr caches aggressively and an untagged URL would let any push
edit the live site. To release: commit, `git tag v1.0.1`, `git push --tags`, bump the URLs.

`nav.css` loads Aeonik with relative URLs, so `fonts/` must ship inside the same tag. Delete that
`@font-face` block if Webflow hosts the font instead.

## What the port must preserve

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

`embed.html` is generated from `nav.html` — edit `nav.html`, not the copy inside `embed.html`.

See **NOTES.md** for the Figma source values, the porting map, the mobile-scroll root cause, and the
full verification log.
