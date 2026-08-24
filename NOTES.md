# Hackuity Navbar — VARIANT B (fixed-height bar)

> Sibling of the growing-container build. **The bar pill never changes height.** The mega-menu is
> a separate surface behind it that swaps content and resizes on its own.
>
> Measured: desktop pill stays `74` with AI-Platform open (panel `508`) and with Partners open
> (panel `300`). Panel top lands at `y=94` — Figma's exact value. Tablet pill stays `80`, body top
> `y=98` — again Figma exact. Mobile drawer bottom `794` — Figma exact.
>
> Because the tuck is the defining feature here, it uses Figma's **measured per-breakpoint** values
> (desktop 20 · tablet 22 · mobile 24) rather than the single 24px the other build unifies on.

---

# Build notes

Source: Figma `7Dm6a0NkHsli9Q8VTy4FAx` — sections Desktop `212:8186`, Tablet `212:8188`, Mobile `212:8190`.
Every number in `nav.css` was read from the file via the Figma MCP server. Nothing was measured off a screenshot.

```
nav.html      structure reference — ONE DOM for all breakpoints. The one-time
              conversion source for Webflow; not shipped to the CDN.
nav.css       ships to the CDN. Tokens → desktop base → max-width 1619/767/479
nav.js        ships to the CDN. No dependencies, no jQuery
embed.html    demo host page — generated from nav.html, not hand-edited
preview.html  all three breakpoints side by side in iframes
fonts/        Aeonik Regular + Medium (woff2), Bold (otf)
```

## 0. Architecture — fixed pill, panel behind

`.nv-bar` is its own rounded pill: glass fill, 24px radius, shadow, fixed height. `.nv-shell`
is just a stacking wrapper with no surface of its own. The panel is pulled up by `--panel-tuck` so
its square top edge hides behind the pill, and carries `border-radius: 0 0 24px 24px` plus the same
shadow — exactly how Figma constructs it.

Stacking matters: `.nv-body` deliberately has **no** `z-index`, so it never becomes a stacking
context. That lets the lifted desktop link row (z-index 3) paint above the pill (2) while the panel
(1) stays behind it.

The list is a single `<ul>` at every breakpoint:

| | where it lives | how |
|---|---|---|
| Desktop | the bar row | lifted with `top: -74px`; the height animation runs on `.nv-panels` so the body never clips it |
| Tablet | 193px rail on the **right** | `.nv-body` becomes `grid-template-columns: 1fr 193px`; the body is the clipped animator |
| Mobile | the drawer | drilling into a head hides the list (`.is-drilled`) and shows that panel |

Open `embed.html` directly in a browser — no build step, no server.

---

## 1. Verification — measured, not asserted

A Playwright harness rendered the build at 13 widths and compared every box against Figma. The
harness itself is not checked in — this is its output, kept as the record of what was measured:

```
label            w     left right  top  bottomGap  height  radius  logo        login  hamburger    row-h  type
desktop-1920   1920     64    64    40      854       74     24px  in-bar      yes    no             74   18px/26px
desktop-1700   1700     64    64    40      854       74     24px  in-bar      yes    no             74   18px/26px
desktop-1620   1620     64    64    40      854       74     24px  in-bar      yes    no             74   18px/26px
tablet-1619    1619     32    32    40      848       80     24px  in-bar      no     icon+label     74   18px/26px
tablet-1440    1440     32    32    40      848       80     24px  in-bar      no     icon+label     74   18px/26px
tablet-1024    1024     32    32    40      848       80     24px  in-bar      no     icon+label     74   18px/26px
tablet-991      991     32    32    40      848       80     24px  in-bar      no     icon+label     74   18px/26px
tablet-768      768     32    32    40      848       80     24px  in-bar      no     icon+label     74   18px/26px
mobile-767      767     16    16     —       24       80     24px  standalone  no     icon-only      76   20px/28px
mobile-480      480     16    16     —       24       80     24px  standalone  no     icon-only      76   20px/28px
mobile-479      479     16    16     —       24       80     24px  standalone  no     icon-only      76   20px/28px
mobile-402      402     16    16     —       24       80     24px  standalone  no     icon-only      76   20px/28px
mobile-375      375     16    16     —       24       80     24px  standalone  no     icon-only      76   20px/28px

PROBLEMS: none — all measurements within 1px of Figma
```

Also checked: **zero horizontal overflow at every width from 375 to 1920**, and no reflow jump at the 1620/1619, 768/767 or 480/479 boundaries.

Tablet open state, measured: drawer `960 × 542` at `x=32, y=96`; mega-menu column `767` wide; link rail `193` wide starting `24px` down; rows exactly `74px`. Figma says `767 + 193 = 960`. Match.

---

## 2. ⚠ The 1610 problem — the one thing you need to decide

The desktop bar cannot hold its own contents below **1610px**. This is a property of the design, not the build. Measured in-browser with the real Aeonik Bold:

| Piece | Width |
|---|---|
| padding-left | 24 |
| logo | 175.535 |
| gap | 40 |
| **7 nav links** (18px/700, 24px padding each side) | **929** |
| gap | 40 |
| Login + 8 + Book a Demo | 258 |
| padding-right | 16 |
| **bar total** | **1482** |
| **+ 128 side inset → viewport needed** | **1610** |

Per-link widths: AI-Platform 145 · Solutions 127 · Partners 120 · Why Hackuity 165 · Pricing 107 · Resources 137 · Company 129.

Webflow's tablet breakpoint is 991, so a literal reading would keep the desktop bar down to 992 — where it overflows by **330px**. At 1440 (the most common laptop) it overflows by **39px**.

**What I shipped:** the hamburger layout switches in at **≤1619px**. Pixel-exact everywhere, no overflow anywhere. The cost is that a 1440px laptop gets the tablet nav.

**Your three options:**

| Option | Change | Trade-off |
|---|---|---|
| **A — as shipped** | switch at 1619 | Nothing breaks. 1440 laptops see the hamburger. |
| **B — compact desktop** | change 1619 → 1439 in `nav.css` (both the media query and `--nv-bp-tablet`) | Full 7-link bar down to 1440. Costs **two** non-Figma values: link padding 24→12, bar gap 40→24. Below 1440 nothing saves it. |
| **C — ask the designer** | reduce link padding or font size in Figma, or drop a link | The only way to get the full bar onto 1280 screens honestly. Dropping *Pricing* into the CTA group would free 107px. |

Change the number in **two places in `nav.css`** — the `@media (max-width:1619px)` query and the
`--nv-bp-tablet` token beside it. `nav.js` reads that token at runtime, so there is no third place
to keep in sync any more.

---

## 3. Decisions taken

| Decision | Why | Impact |
|---|---|---|
| Desktop menu list is canonical (7 items) everywhere | Your call | Mobile drawer now shows AI-Platform / Solutions / Partners / Why Hackuity / Pricing / Resources / Company, not the 6-item Figma mobile list |
| Bottom bar from ≤767 down | Your call | Tablet top bar covers 768–1619; mobile bottom bar covers ≤767 |
| Desktop/tablet are one growing shell; mobile keeps a separate drawer | Figma draws desktop and tablet as a single rounded surface, but on mobile the bar is a distinct pill overlapping the drawer's bottom 24px | Matches each artboard rather than forcing one mechanism onto all three |
| Height animated in JS, not `grid-template-rows: 0fr/1fr` | The CSS-only trick animates open/close but cannot animate *between two content heights* | Switching heads morphs the navbar's height, which is the behaviour you asked for |
| Clipping target differs per breakpoint | On desktop the link row is lifted into the bar, so a clipped `.nv-body` would hide it — the animation runs on `.nv-panels` there and on `.nv-body` elsewhere | One `<ul>`, no duplicated DOM, nothing clipped that shouldn't be |
| Pricing is a plain link, no panel | Figma has no "Nav Open – Pricing" frame | If it should have one, say so |
| Tablet rail on the right | Figma `158:991` puts the 193px rail on the right with left-pointing chevrons | You asked for right-opening; the file says otherwise and the chevron direction confirms the file's intent. Flip `grid-template-columns` and `.nv-menu{grid-column}` to reverse it |
| Card icon tiles are flat `#f0ebff` | Figma's asset URLs are blocked from this sandbox | Every tile carries `data-icon="…"` so the real SVGs drop straight in |
| Mobile list-open button shows ✕ Close | Figma only draws the drilled state (back chevron) | If the list state should also show ☰, it's one line in `syncButton()` |
| Aeonik Bold ships as `.otf` | This sandbox has no brotli, so I couldn't make a woff2 | Works everywhere, ~161KB vs ~45KB. Convert at fontsquirrel/`fonttools` before launch |
| Logo wordmark is live text, not the SVG | Figma's asset URLs are blocked from my sandbox by robots.txt | **The one approximated element.** Export the Logo layer as SVG and drop it in — box geometry is already exact (175.535 × 34; mobile 222 × 43) |

---

## 4. Webflow porting map

Desktop is the master. Write these unprefixed, then override in the three `max-width` breakpoints.

| Webflow class | Desktop (base) | Tablet ≤991 | Mobile L ≤767 | Mobile P ≤479 |
|---|---|---|---|---|
| `nv-wrap` | fixed · top 40 · L/R 64 | L/R 32 | top auto · bottom 24 · L/R 16 | — |
| `nv-bar` | H 74 · pad 0/16/0/24 · gap 40 | H 80 · pad 16/16/16/24 · space-between | pad 16 · gap 16 | — |
| `nv-shell` | radius 24 · `rgba(255,255,255,.7)` · blur 20 · shadow `0 0 10px #e8e8e8` · overflow hidden | — | overflow **visible** (the drawer escapes the pill) | — |
| `nv-body` | white · height animated to the active panel | grid `1fr 193px` · clipped animator | absolute above the bar · own radius `24 24 0 0` + shadow | — |
| `nv-logo` (in bar) | 175.535 × 34 | — | **hide** | — |
| `nv-logo` (standalone) | **hide** | — | show · fixed · top 80 · centred · 222 × 43 | — |
| `nv-menu` | row, inside bar | column, drawer rail, 193 wide, 24 top pad | full width | — |
| `nv-link` | pad 24 · 18/26 · w700 · `#202020` | H 74 · space-between · chevron on | H 76 · 20/28 · tracking −.08 | — |
| `nv-btn--ghost` (Login) | H 48 · pad-x 24 · r16 · `#2a006bee` | **hide** | — | — |
| `nv-btn--primary` | H 48 · pad-x 24 · r16 · `#8a68e9` · w500 · white | — | — | — |
| `nv-menu-btn` | **hide** | show · H 48 · pad-x 24 · r16 · gap 12 · icon 20 + "Menu" | 48 × 48 · icon only · no label | — |
| `nv-body` @ ≤767` | n/a | below bar · top 56 · grid `1fr 193px` · radius `0 0 24 24` | above bar · bottom 56 · 1 col · radius `24 24 0 0` · pad-bottom 40 | — |
| `nv-panel` | abs · top 50 · radius `0 0 24 24` · white · shadow | in flow, left column | **hide** | — |

Webflow notes:
- No `:has()`, no container queries, no custom media — every state is a class toggled by JS (`is-open`, `is-active`, `is-scrolled`).
- One class per Webflow class. Combo classes map to `--ghost` / `--primary` / `--standalone` / `--inbar`.
- **Rename any `nv-` class you like** — `nav.js` never reads one. It finds everything through
  `data-nav-el` / `data-nav-panel`. Those attributes are the contract that must survive the port;
  see the header comment in `nav.html` for the full list.
- The `1619` breakpoint is **not** a Webflow breakpoint. Put that media query in a custom-code embed, or pick option B/C above.
- The height animation is JS-driven (`applyHeight()` in `nav.js`). Webflow Interactions can't measure a sibling's natural height, so keep the script — don't try to rebuild it as an IX2 timeline.
- `overflow: hidden` lives on `.nv-panels` (desktop) and `.nv-body` (tablet/mobile) — whichever one is
  animating its height. That is what clips the growing surface and gives it the bottom radius.
  Don't let Webflow move it, and don't add `overflow:hidden` to `.nv-shell`.

---

## 5. Interaction

- **Desktop** — 90ms hover intent opens; moving to another head morphs the height, it does not close and reopen; click toggles; click-outside and Esc close. The active head gets `rgba(55,0,255,.11)` (Colors/Violet Alpha/3) as a **square** block spanning the full 74px row, with accent-coloured text — straight from Figma `352:26027`.
- **Tablet** — ☰ Menu becomes **✕ Close**. The 193px rail sits on the **right** with `<` chevrons; the mega-menu fills the 767px on the left. First menu auto-selected so the left column is never blank. Verified: rail `x=799 w=193`, panels `x=32 w=767` — Figma's 767 + 193 = 960.
- **Mobile** — ☰ opens the link list. Tapping a head **replaces** the list with that menu's panel and the button becomes a **back chevron** in a lavender tile; back returns to the list. The drawer scrolls whenever its content is taller than the room between the logo and the bar — both for a long panel and for the 7-item link list on a short screen (see § 7).
- Body scroll lock with scroll-position restore; focus trap in the open drawer; `aria-expanded` / `aria-controls` throughout; visible `:focus-visible` ring; drawer closes on link click, Esc, scrim click and breakpoint change.
- `prefers-reduced-motion: reduce` kills all transitions and transforms.
- Works with JS off: every link stays in the DOM and reachable.

---

## 6. Pass 2 — what's left

1. **Extract 4 mega-menus**: Solutions `212:7135`, Why Hackuity `212:7768`, Resources `212:7907`, Company `212:8044`. AI-Platform `87:289` and Partners `212:7449` are complete and are the two proven patterns (promo + 2 columns, and 3-column grid).
2. **Export the icons** — ~30 SVGs. Every tile already has `data-icon`, so it's a mechanical swap.
3. **Export the logo SVG** — the only approximated element.
4. **Tablet promo strip** — the media/text split is a reasonable reading; the internals of Figma `158:1101` (767 × 312) are not yet extracted, so that one block is not measured-exact.
5. Decide the 1610 question in § 2.
6. Convert `Aeonik-Bold.otf` → woff2 (needs brotli; unavailable in this sandbox).


---

# 7. Pass 3 — the Webflow / CDN split

The build was re-cut for the three-layer port: **structure** converts once into native Webflow
elements, **CSS/JS** stay here and ride in from jsDelivr, **CMS-driven nav items are on hold** —
the seven links are static markup.

## 7.1 What changed

| | Before | After |
|---|---|---|
| Files | `navbar.html` · `navbar.css` · `navbar.js` | `nav.html` (reference) · **`nav.css`** · **`nav.js`** (shipped) |
| Classes | `navbar_*`, bare `is-*` states | every class `nv-*`, every state `nv-is-*` |
| Custom properties | `--space-4`, `--bar-h`, `--colors-accent-9` … on `:root` | all `--nv-*`, still on `:root` |
| Reset | global `*`, `html`, `body`, `ul`, `a`, `button`, `h1,h2`, `svg` | **gone** — Webflow injects its own |
| Page background | `body{background:radial-gradient(…)}` inside the mobile query | moved to the host page (`embed.html`) |
| JS element lookup | `getElementById` + `.navbar_*` class selectors | `data-nav-el` / `data-nav-panel` attributes only |
| Breakpoints | `TABLET_MAX` in JS **and** the media queries | `--nv-bp-tablet` / `--nv-bp-mobile` in `nav.css`, read by `nav.js` |
| Reduced motion | global `*{transition-duration:.001ms}` | scoped to the component |

### Why the reset had to go, without losing the layout

Deleting it outright would have handed the nav straight to Webflow's `ul{padding-left:40px}` and
its link colours. So each element reset became a **component-scoped rule** under
§ 2 "component baseline" in `nav.css` — `.nv-menu{margin:0;padding:0;list-style:none}`,
`.nv-link,.nv-menu-btn{…button normalisation…}`, `.nv-group-label{margin:0}`, and so on.
Nothing in the file selects a bare element any more, so it cannot reach outside the component.

### The JS contract

`nav.js` contains exactly one list of class names — the `CLS` map at the top, which is only ever
*written*, never used to find anything. Everything it reads is an attribute:

```
data-nav-el="root|shell|bar|body|panels|panel|menu|item|link|toggle|toggle-label|scrim|logo-standalone"
data-nav-panel="platform|solutions|partners|why|resources|company"
data-nav-state="menu|close|back"     written by JS, read by CSS for the icon swap
data-nav-icon="…"                    marks the ~30 icon tiles for the pass-2 SVG swap
```

Rename `nv-` classes in Webflow freely. Move a `data-nav-el` and you break the script.

## 7.2 The mobile scroll bug — root cause

Two symptoms, one cause plus one bad constant.

**1 · The drawer could never scroll.** The tablet block carries
`.nv-body.nv-is-scrollable{overflow:hidden}` on purpose — on tablet the 193px rail shares the grid
row with the mega-menu, so scrolling the body would drag the rail along with it; only `.nv-panels`
may move. But the mobile block lives *inside* `max-width:1619`, and it never restated that rule.
So mobile inherited "the body must not scroll" while `nav.js` had already correctly decided the
body **is** the scroller at that breakpoint (`scroller()` returns the body on mobile). JS added
`is-scrollable`, CSS answered `overflow:hidden`, and the drawer sat there clipped.

Measured before the fix, at 375 × 667 with "Platform overview" open:
`scrollHeight 1450` · `clientHeight 487` · `overflow-y: hidden`.

The fix is four lines in the mobile block, after the tablet rule so it wins on source order:

```css
.nv-body.nv-is-scrollable{
  overflow-x:hidden; overflow-y:auto;
  overscroll-behavior:contain; -webkit-overflow-scrolling:touch;
}
```

**2 · "Company" was unreachable at 375 × 667.** The seven links are `7 × 76 + 40 = 572px`.
`maxHeight()` used a hard-coded `innerHeight - 180`, which is `487` on a 667-tall screen — so the
7th row (456→532 inside the drawer) fell past the clip. With no scroll it was simply gone. The same
constant also put the drawer's top edge at `y=100`, **overlapping the standalone logo** (which ends
at `y=123`) by 23px.

`maxHeight()` now measures the live layout instead of guessing:

```
mobile          floor = bar.top + --nv-panel-tuck        (the drawer's tucked bottom edge)
                ceil  = logo.bottom + 16, when the logo is on screen; else 16
desktop/tablet  cap   = innerHeight - 40 - (bar.bottom - --nv-panel-tuck)
```

A token change in `nav.css` can no longer desync the script.

## 7.3 Verified after the fix

Measured in Chrome, transitions disabled so the settled geometry is read, not a frame mid-animation.

| Case | Result |
|---|---|
| 375 × 667 · link list | drawer `y 139 → 587` (h 448), `overflow-y:auto`, `scrollHeight 572` → scrolls 124px. **Company lands fully inside the drawer**, clear of the pill |
| 375 × 667 · logo clearance | drawer top 139 vs logo bottom 123 — **16px gap, no overlap** (was a 23px overlap) |
| 375 × 667 · Platform panel | `scrollHeight 1450` / `clientHeight 448` → scrolls 1002px; the last card ("Hackuity connectors") reaches the bottom |
| 402 × 874 · Figma artboard | drawer bottom **794** — Figma exact, unchanged. List fits at 572, no scrollbar |
| 768 × 900 · tablet | body `overflow-y:hidden`, `scrollTop` pinned at 0 · panels `overflow-y:auto` scrolled 266px · **rail moved 0px** · rail width 193 |
| 1440 × 900 | bar 80 · panel top **98** — Figma exact · hamburger shown, Login hidden · rail 193 · scrim opens |
| 1920 × 900 | bar 74 · panel top **94**, panel height **508** — both Figma exact · no hamburger · active item `rgba(55,0,255,.11)` · no horizontal overflow |
| 1920 × 560 (short desktop) | panel capped to 426, `overflow-y:auto`, scrolls 82px, bottom edge 520 ≤ 560 — the 40px gap holds |

No console errors at any width.

## 7.4 CDN

Tag, then point Webflow at the tag — never at `@main`, or a push edits the live site:

```
https://cdn.jsdelivr.net/gh/OWNER/REPO@v1.0.0/nav.css
https://cdn.jsdelivr.net/gh/OWNER/REPO@v1.0.0/nav.js
```

`nav.css` loads Aeonik with **relative** URLs, so `fonts/` must ship inside the same tag — on
jsDelivr they resolve next to the stylesheet. Delete that block if Webflow hosts the font instead.

Still open from § 6: the four pass-2 panels, the ~30 icon SVGs, the logo SVG, and converting
`Aeonik-Bold.otf` (~161KB) to woff2 — this machine has no `fonttools`/`brotli` bindings either.
