# Hackuity Navbar

Standalone navbar component for the Hackuity Webflow site. No dependencies, no build step.

```
nav.css     ships to the CDN
nav.js      ships to the CDN
nav.html    structure reference — the one-time conversion source for Webflow
embed.html  demo host page (generated from nav.html)
webflow/htmltoflow.html  Code Embed payload for the fallback page — CDN link + markup + CDN script
preview.html  all three breakpoints side by side
fonts/      Aeonik Regular + Medium (woff2), Bold (otf)
NOTES.md    Figma measurements, decisions, verification log, porting map
```

## For Releasing a new version:
1. git add -A && git commit -m "vX.X.X Navbar CSS Update"
2. git push
3. git tag -a vX.X.X -m "vX.X.X Navbar CSS Update" && git push origin vX.X.X
4. URL will be like https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@vX.X.X/nav.css

## Testing the navbar locally
Open `embed.html` in a browser to see it. Resize past 1440 / 1280 / 768 / 480 to cross the breakpoints.

## The three-layer split

| Layer | Lives | Notes |
|---|---|---|
| **Structure** | Webflow | One-time conversion of `nav.html` into native elements |
| **CSS + JS** | this repo → jsDelivr | Version-tagged, edited here, never in Webflow |
| **Nav items** | static markup | CMS binding is **on hold** — seven hard-coded links |

## Install in Webflow

The navbar carries its own loaders, so there is nothing to add to Custom Code —
copy the **Hackuity Navbar** wrapper to a page and it works. Inside it, two HTML
embeds bracket the markup:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@v1.4.0/nav.css">
…the navbar…
<script defer src="https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@v1.4.0/nav.js"></script>
```

**Load these once per page.** Custom Code *and* the wrapper means two `nav.js`
instances fighting over the same inline height, which silently kills the
mega-menu height animation — NOTES.md § 12.9.

Pin a **tag**, never `@main` — jsDelivr caches aggressively and an untagged URL would let any push
edit the live site. To release: commit, `git tag v1.1.2`, `git push --tags`, bump the URLs.

`nav.css` loads Aeonik with relative URLs, so `fonts/` must ship inside the same tag. Delete that
`@font-face` block if Webflow hosts the font instead.

## What the port must preserve

Combo classes are **back** as of v1.1.0. The `data-nav-variant` flattening in
v1.0.1 existed only to survive the htmltoflow importer; the Webflow MCP creates
real style blocks, including combo chains up to three deep, so there is nothing
left to lose the second class:

```html
<a class="nv-btn nv-btn--ghost nv-login">   →   .nv-btn.nv-btn--ghost.nv-login
```

The MCP drops any class that is not already a Webflow style, so the styles are
created **first** — all 58 of them, with empty properties. The Style panel gets
the class; every declaration still comes from `nav.css` on the CDN. See
NOTES.md § 12.

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
| `data-nav-el="menu"` | the link list — a `div` with `role="list"` |
| `data-nav-el="item"` + `data-nav-panel="<key>"` | one row — a `div` with `role="listitem"` |
| `data-nav-el="link"` | the `<button>`/`<a>` inside an item |
| `data-nav-el="toggle"` / `"toggle-label"` | the hamburger and its text |
| `data-nav-el="scrim"` | the full-page dim layer |
| `data-nav-el="logo-standalone"` | the mobile logo above the drawer |

`data-nav-state` is written by JS and read by CSS to swap the hamburger / ✕ / back icons.
`data-nav-icon` marks the ~30 icon tiles for the SVG swap that is still outstanding.

### The component slot

Every `.nv-panel` opens with an empty `<div class="nv-panel-inner"></div>`. That is where a Webflow
component goes, so the mega-menu content stays editable in the Editor on a protected page and the
navbar picks the change up everywhere. Drop the component in, then delete the hand-built siblings
next to it.

The slot is deliberately styleless — no padding, no background, no layout — because the components
already carry their own. `nav.css` hides it with `:empty` while it is empty, so panels that have not
been converted yet render exactly as before, and `nav.js` never reaches inside it: it measures the
panel and animates the surface to whatever height the component turns out to be.

One thing to watch: the components are drawn at 1280. The slot is 1280 on desktop, but the tablet
rail leaves it **767px** and the mobile drawer **viewport − 32**, so the component has to be
responsive on its own.

Two more things Webflow must not undo:

- **Load `nav.css` after Webflow's own CSS.** It contains no reset — Webflow's normalize is the
  reset, and every rule here is scoped to an `nv-` class so it cannot reach outside the component.
- **Breakpoints match Webflow's own tiers** — the link row goes compact at `max-width:1439px`
  (12px link padding), collapses to the hamburger at `1279`, the bottom bar takes over at `767`,
  and `479` is the portrait tier. Webflow's `991` tier needs no rules; the 1279 block covers it.
  See NOTES.md § 15.4 for why 1280 is the floor.
- **The bar is a `.container-1280`, not a full-bleed pill.** `.nv-wrap` carries the 32px gutter
  (16px at ≤767) and `.nv-shell` caps at 1280px, so the pill's edges land on the page's own content
  edges. Delete any `.container-*` wrapper Webflow has around `.nv-wrap` — it would double the
  gutter. See NOTES.md § 15.

## Editing

Breakpoints are declared once, in `nav.css`:

```css
--nv-bp-tablet:1279;
--nv-bp-mobile:767;
```

So is the container the bar sits in, and the link spacing that makes 7 links fit it:

```css
--nv-container-max:1280px;   /* pill width — mirrors Webflow .container-1280 */
--nv-container-pad:32px;     /* gutter outside it; 16px at <=767 */
--nv-link-pad:16px;          /* horizontal only; 12px at <=1439, 24px on the rail */
--nv-menu-left:223.535px;    /* 24 bar padding + 175.535 logo + 24 gap */
```

`nav.js` reads those at runtime, so the script and the media queries cannot drift. Change the token
**and** the matching `@media` query together.

Everything downstream of `nav.html` is generated — `embed.html`,
`webflow/htmltoflow.html`, both Designer paste payloads, and the copies inside
`webflow-paste-extension/payload/`. Edit `nav.html`, then:

```
python3 tools/regen.py
```

## Getting it into Webflow

**Native elements, via the Webflow MCP.** Live on
`siegcourse.webflow.io/navbar-native`, built 2026-08-25. Webflow owns the
structure now — edit it in the Designer, not here. `nav.html` was the one-time
source and is not pushed into Webflow again.

The build order matters, because `data_whtml_builder` silently drops classes
that do not already exist as Webflow styles:

```
create_style × 58   →   whtml_builder × 4 roots   →   HtmlEmbed × 18 SVGs
```

Everything then went into one unstyled wrapper div — the four roots plus a CDN
`<link>` and `<script>` — so the whole navbar copies to another page as a single
element. The wrapper must stay classless and static: give it a `transform` or
`position:relative` and it becomes the containing block for the four
fixed/absolute roots. See NOTES.md § 12.8.

Verified on the published page: **zero diffs** against `nav.html` on every
attribute and tag count, all 14 combo chains intact, and
`css loaded: true | js booted: true | structure: OK`. Full log in NOTES.md § 12.

**The Code Embed fallback** still runs on `siegcourse.webflow.io/testing` — one
embed carrying the CDN `<link>`, the markup and the CDN `<script>` (the contents
of `webflow/htmltoflow.html`, 17.8k chars, under Webflow's 50k limit). Keep it.

Two routes that do **not** work, both measured (NOTES § 10.6 and § 11):

- **htmltoflow** deletes every `<button>`, every `data-*` attribute, 15 of the
  18 `<svg>`s and 8 of 9 `id`s.
- **The XscpData clipboard payload** is read by the Designer and silently
  discarded — including a control payload copied out of Webflow itself. Webflow's
  own copy writes nothing to the OS pasteboard; element paste goes through an
  in-memory store holding a 3.8 MB state snapshot. `webflow-paste-extension/`
  cannot work; it is kept only as a record.

See **NOTES.md** for the Figma source values, the porting map, the mobile-scroll root cause, and the
full verification log.
