# Hackuity Navbar

Standalone navbar component for the Hackuity Webflow site. No dependencies, no build step.

```
nav.css     ships to the CDN — the half Webflow's Style panel cannot express
nav-panel.css  GENERATED mirror of the Webflow half; local previews only, never shipped
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

## The four-layer split

As of **v1.7.0** the CSS is split in two. The look is in Webflow; the machinery
is still here.

| Layer | Lives | Notes |
|---|---|---|
| **Structure** | Webflow | One-time conversion of `nav.html` into native elements |
| **Look** | Webflow Style panel | 93 rules — layout, spacing, radius, type, colour — bound to the `Nav` and `Color` variable collections. **Edit in the Designer.** |
| **Machinery** | this repo → jsDelivr | `nav.css` + `nav.js`. Baseline, state, motion, transitions, `@font-face`. Version-tagged, never edited in Webflow. |
| **Nav items** | static markup | CMS binding is **on hold** — seven hard-coded links |

What could not move, and why: the component baseline has to load *after*
Webflow's normalize to do its job; `[data-nav-swap]` / `[data-nav-state]` /
descendant selectors have no Style-panel equivalent; transition durations and
easings come from `--nv-*` tokens Webflow has no type for. Full list and
reasons: `webflow/import-plan.json`, and NOTES.md § 21.

**Eleven tokens are declared in both places** — `--nv-bar-h`, `--nv-blur`,
`--nv-font`, `--nv-link-pad`, `--nv-panel-tuck`, `--nv-radius-6`, `--nv-rail-w`,
`--nv-space-5/7/8/10` — because rules on both sides use them. Change one,
change the other.

### Testing standalone

`embed.html` loads `nav-panel.css` before `nav.css`, in the same order Webflow
serves them, so the local preview matches the site. `nav-panel.css` is a
generated snapshot — after editing styles in the Designer, regenerate it.

## Install in Webflow

The navbar carries its own loaders, so there is nothing to add to Custom Code —
copy the **Hackuity Navbar** wrapper to a page and it works. Inside it, two HTML
embeds bracket the markup:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@v1.7.0/nav.css">
…the navbar…
<script defer src="https://cdn.jsdelivr.net/gh/KrishnaKantTech/Hackuity_navbar@v1.7.0/nav.js"></script>
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

The MCP drops any class that is not already a Webflow style, so the styles were
created **first** — all 58 of them, originally with empty properties. As of
v1.7.0 they carry the real declarations; see NOTES.md § 12 and § 21.

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
`data-nav-swap` is written by JS onto `data-nav-el="panels"` and read by CSS to
point the desktop panel crossfade — see below.

### The desktop panel crossfade

Moving from one head to another on desktop does not blink between panels. The
outgoing one lifts out of flow and fades away against the direction of travel;
the incoming one slides in behind it; `.nv-panels` morphs its height between
the two. Below 1280 nothing changes — the tablet rail and the mobile drilldown
still switch outright.

`nav.js` owns only the choreography. It writes one attribute and toggles three
classes; every offset, duration and easing is a token in `nav.css`:

| Token | Default | |
|---|---|---|
| `--nv-swap-shift` | `40px` | horizontal travel between two heads. Above ~56px the incoming column arrives visibly clipped by `.nv-panels`' overflow |
| `--nv-swap-rise` | `8px` | vertical travel when the menu opens from closed |
| `--nv-swap-in-dur` | `260ms` | incoming panel |
| `--nv-swap-in-delay` | `80ms` | what makes the two overlap instead of queue |
| `--nv-swap-out-dur` | `180ms` | outgoing panel — **`nav.js` reads this one** for its cleanup timer, so it cannot drift |
| `--nv-swap-in-ease` | `cubic-bezier(.22, 1, .36, 1)` | |
| `--nv-swap-out-ease` | `cubic-bezier(.4, 0, 1, 1)` | |

`data-nav-swap` on `.nv-panels` is `next` (moved right along the link row),
`prev` (moved left), `open` (from closed) or `close`. The direction comes from
the two heads' positions in the DOM, so reordering the link row in Webflow
reorders the animation with it — nothing to keep in sync.

The effect is applied to `.nv-panel`, never to `.nv-panel-inner`. A Webflow
component in that slot is animated by being carried, so swapping it in the
Editor inherits the crossfade for free, and the height still measures off the
live content.

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

### Colour and Dark mode

Every `--nv-*` colour is bound to Webflow's **Color** variable collection, so the Variables panel
is the single source of truth — a client retinting a colour retints the navbar, in both modes,
with no code change here. Dark mode needs no JS and no media query: the navbar flips because it
sits inside `.dark-theme`.

The tokens are declared on `.nv-skip-link, .nv-logo--standalone, .nv-wrap, .nv-scrim` — **never on
`:root`**. A `var()` resolves against the element it is declared on, so a `:root` declaration
freezes at the Base value and `.dark-theme` (which lives below `:root`) can never reach it. Keep
them on the component roots or dark mode silently stops working.

Each is written `var(--_color---<name>, <figma-fallback>)`. The fallbacks are the original Figma
values, so `embed.html`, `preview.html` and any non-Webflow host still render correctly.

Two Webflow variables carry a Dark value that exists only for the navbar, taken from the dark Figma
frame (`4423:6218`): **White Alpha 9** → `rgba(253,253,234,.1)` (the bar fill) and **Gray 4** →
`#323232` (the pill glow and `.nv-split`). Both keep their original Base values. See NOTES.md § 18.

Two colours are literal on purpose: `--nv-accent-contrast` (white label on Accent 9, which does not
flip, so it must not either) and `--nv-scrim-bg` (a dark scrim reads right in both modes).

Two more things Webflow must not undo:

- **Load `nav.css` after Webflow's own CSS.** It contains no reset — Webflow's normalize is the
  reset, and every rule here is scoped to an `nv-` class so it cannot reach outside the component.
- **Breakpoints map 1:1 onto Webflow's own tiers, and the file is written desktop-up.** The base
  (no media query) is the *collapsed* layout — hamburger, one-column mega-menu, 193px rail — and
  desktop is an override on top of it. Webflow has no max-width tier between 992 and 1279, so a
  `max-width:1279px` block would have nowhere to land in the Designer:

  | `nav.css` | Webflow | what it is |
  |---|---|---|
  | base | `main` | collapsed |
  | `min-width:1280px` | `large` | horizontal row (§ 6) |
  | `min-width:1440px` | `xl` | link padding back to 16 (§ 6b) |
  | `max-width:767px` | `small` | bottom bar + drawer (§ 7) |
  | `max-width:479px` | `tiny` | portrait (§ 8) |

  Webflow's `991` tier needs no rules — 768–991 and 992–1279 are styled identically.
  Read the desktop values in § 6, not at the top of a rule. See NOTES.md § 20.
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
--nv-link-pad:24px;          /* horizontal only; 12px at >=1280, 16px at >=1440 */
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
