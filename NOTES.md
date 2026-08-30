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


---

# 8. Blank mega-menu column after crossing the breakpoint

**Reported:** "sometimes AI-Platform does not appear and shows a blank white div."
**Pre-existing** — reproduced on the original `navbar.js` as well, so this is not
fallout from the pass-3 refactor.

## 8.1 Cause

`applyHeight()` animates one element, and *which* element depends on the breakpoint:

```
desktop        sizer = .nv-panels     (the link row is lifted into the bar, so the
                                       body must not clip)
tablet/mobile  sizer = .nv-body       (the list lives inside the body)
```

It wrote the height **inline**. Nothing ever took it back off. So:

1. On desktop, open a mega-menu and close it again → `.nv-panels` is left with
   `style="height:0px"`.
2. Drag the window below 1620. The tablet rules want `.nv-panels{height:auto}`,
   but an inline declaration outranks any stylesheet rule, so it stays 0.
3. Open the drawer. `.nv-body` sizes itself correctly from the panel's content
   (704px at 1600x856), the rail renders, the head shows as active — and the
   mega-menu column inside it is clipped to zero. A tall, correct-looking drawer
   wrapped around nothing.

That is the whole "sometimes": it only bites after a desktop panel has been
opened *and closed*, and then only once you cross the breakpoint — which is
exactly what happens when the build is reviewed by dragging the window.

Crossing with a panel left **open** was the milder version of the same fault:
`.nv-panels` carried `height:508px` into tablet and the column was clipped short
rather than to nothing.

## 8.2 Fix

`applyHeight()` now hands back whatever the other element is holding before it
measures anything:

```js
if (panelsEl !== node) panelsEl.style.height = '';
if (body     !== node) body.style.height = '';
if (panelsEl !== sc)   panelsEl.classList.remove(CLS.scrollable);
if (body     !== sc)   body.classList.remove(CLS.scrollable);
```

Order matters — the reset has to happen before `naturalHeight()`, or the
measurement is taken through the stale height.

## 8.3 Verified

A randomised fuzz that exercises a breakpoint, tears the state down, crosses to a
different breakpoint and opens there. The detector asserts the scroll container
has a non-zero client height while the drawer is open.

| Build | Result |
|---|---|
| original `navbar.js` (positive control) | **3 failures in 14 runs** — every one `.navbar_panels` inline `height:0px`, clientHeight 0, on `desktop -> tablet` and `mobile -> tablet` |
| fixed `nav.js` | **0 failures in 16 runs** |

Deterministic check of the reported sequence — desktop, open a panel, close it,
resize to 1575, open the drawer:

```
before   .nv-panels  inline 0px    clientHeight 0      <- blank column
after    .nv-panels  inline (none) clientHeight 704    <- full mega-menu
```

Reverse direction (tablet -> desktop) also confirmed: panels 508, promo painted.

Section 7.3's whole table was re-run after the fix and is unchanged — 375 list
scrolls 124px with Company inside, 375 panel scrolls 1002px, 402 drawer bottom
794, 768 rail drift 0, 1440 panel top 98, 1920 panel top 94 / height 508.


---

# 9. The Webflow import — native clipboard JSON, not an HTML converter

## 9.1 Why the converter route failed

Flowboard (HTML -> Webflow, Chrome extension) was tried first.

- **Nav Mode "Native"** mapped the markup onto Webflow's own Navbar widget:
  `header.nv-wrap` became `w-nav`, `ul.nv-menu` became `w-nav-menu`, the seven
  `li` plus Login and the CTA collapsed into ten flat `w-nav-link`s. Every
  `data-nav-*` attribute was dropped. Total loss.
- **Nav Mode "Custom"** kept the tree correctly — `nv-wrap > nv-shell > nv-bar /
  nv-body > nv-menu > nv-item > nv-link` all survived, and so did the custom
  attributes. But it kept **only one class per element** and dropped every `id`.
  That loses all 15 combo classes: `nv-btn` off the buttons, `--standalone` /
  `--inbar` off the two logos, `--menu` / `--close` / `--back` off the three
  hamburger icons, `--thirds`, `--loose`, `--tight`, `--muted`, `--plain`.

Also relevant: the free plan caps a conversion at 8,000 characters, and the
markup is 16.4K.

## 9.2 What replaced it

Webflow's own copy/paste payload — `{"type":"@webflow/XscpData", ...}` — pasted
straight into the Designer. No extension, no size cap, exact fidelity.

`tools/nav-to-webflow.py` generates `webflow/navbar.webflow.json` from
`nav.html`. Regenerate after any markup change:

```
python3 tools/nav-to-webflow.py webflow/navbar.webflow.json
```

Schema, confirmed by copying sample elements out of the live Designer:

| Piece | Shape |
|---|---|
| base class | `{"comb":"", "children":[comboId, ...]}` |
| combo class | `{"comb":"&", "children":[]}` |
| id | `data.attr.id` |
| custom attribute | `data.xattr:[{"name":..,"value":..}]` |
| text | `data.text:true` + child node `{"text":true,"v":"..."}` |
| link | `type:"Link"`, `data.link:{"mode":"external","url":..}` |
| list / item | `type:"List"` tag `ul` · `type:"ListItem"` tag `li` |
| heading / para | `type:"Heading"` tag `h2` · `type:"Paragraph"` |
| tag override | `type:"Block"` with `tag:"header"` (or section) |
| inline SVG | `type:"HtmlEmbed"`, markup in `data.content` |

Generated: 194 nodes, 58 styles (43 base + 15 combo), 106 custom attributes,
9 ids, 18 SVG embeds, 4 roots. Validated by rebuilding HTML from the JSON and
diffing against `nav.html` — 135 class-carrying elements, class sets identical,
every `data-nav-*`, `aria-*` and `id` accounted for.

## 9.3 Two changes Webflow forced

**1. Webflow has no `<button>` element.** The six panel heads and the hamburger
become `<a href="#">`. `nav.js` used to gate its click wiring on
`tagName === 'BUTTON'`, which would have left the whole nav dead. It no longer
looks at tag names at all — `items` is already filtered to `[data-nav-panel]`,
so anything found there is a panel toggle whatever element it is. The toggle now
calls `preventDefault()` so the `#` never reaches the URL.

Consequence: the close-on-link-click rule had to learn the difference between a
head and a real link, or tapping "AI-Platform" on mobile would drill in *and*
close the drawer in the same gesture:

```js
if (a.closest(hook('item') + '[data-nav-panel]')) return;   // a head - never close
```

The compound selector matches only an `<li>` that owns a panel, so Pricing (an
item with no panel) and every in-panel card link still close the drawer.

**2. Webflow wraps every Embed in `<div class="w-embed">`.** The 18 icons are
Embeds after the port, so that wrapper sits between `.nv-ico` and its `<svg>`.
Left in flow the SVG measures `height:100%` of an auto-height div and collapses
to nothing. `nav.css` now drops it out of the layout:

```css
.nv-wrap .w-embed,.nv-logo--standalone .w-embed{display:contents}
```

Harmless outside Webflow — there is no `.w-embed` there.

Spans become divs across the board (Webflow's Span is inline-text only and
cannot nest). Every selector in `nav.css` is class-based, so this is invisible.
The one tag-qualified rule, `a.nv-card:hover`, still behaves: the disabled
Partners card is a div, and it should not have a hover state.

## 9.4 Verified

The JSON was rendered back to HTML in Webflow's exact output shape — `<a>`
instead of `<button>`, `.w-embed` around every icon, plus a stand-in for
Webflow's base CSS (`ul{padding-left:40px}`, `a{text-decoration:underline}`,
`h2{font-size:32px}`, the `.w-embed` clearfix) — and run through the full suite
beside the original markup:

| | original `<button>` | Webflow `<a>` + `.w-embed` |
|---|---|---|
| desktop bar / panel top / panel height | 74 / 94 / 508 | 74 / 94 / 508 |
| tablet body / rail width / rail drift | 704 / 193 / 0 | 704 / 193 / 0 |
| mobile drawer / scrolled / Company inside | 448 / 124 / yes | 448 / 124 / yes |
| mobile drill: drawer stays open, toggle | 448 / back | 448 / back |
| Pricing still closes the drawer | 0 | 0 |

**Identical on every measure.** Also checked: `location.hash` stays empty at all
three breakpoints (no `#` jump), the logo SVG measures 34px tall inside its
`.w-embed` (so `display:contents` does its job), and only one hamburger icon is
visible at a time (so the combo classes survive the round trip).

---

# 10. v1.0.1 — combo classes flattened into `data-nav-variant`

## 10.1 Cause

The port is going through the **htmltoflow** app (Webflow marketplace) rather
than the JSON paste route of § 9. It handles an element with two classes badly:
it keeps the **first** as the Webflow class and drops the rest into a custom
attribute literally named `class` —

```
<a class="nv-logo nv-logo--inbar">   →   Webflow class: nv-logo
                                          Attributes:   class = nv-logo--inbar
```

Every modifier rule in `nav.css` is a standalone selector (`.nv-logo--inbar{}`),
so the modifier silently stops applying on all 14 elements that carried a
second class. Nothing errors — the navbar just renders slightly wrong
everywhere, which is the worst failure mode to debug in the Designer.

## 10.2 Fix

**One class per element.** The second class became `data-nav-variant`, a
space-separated list matched with `~=`:

| was | now |
|---|---|
| `class="nv-logo nv-logo--inbar"` | `class="nv-logo" data-nav-variant="inbar"` |
| `class="nv-btn nv-btn--ghost nv-login"` | `class="nv-btn" data-nav-variant="ghost login"` |
| `class="nv-card nv-is-disabled"` | `class="nv-card" data-nav-variant="disabled"` |

15 CSS selectors were rewritten to match. There is now nothing for an importer
to lose: the class lands in Webflow's Style panel, the variant in the
Attributes panel, and neither can overwrite the other.

## 10.3 The specificity trap

The obvious rewrite is wrong:

```css
.nv-logo--standalone            /* (0,1,0) */
.nv-logo[data-nav-variant~="standalone"]   /* (0,2,0)  ← outranks base rules it used to lose to */
```

The first diff run caught it: the standalone logo went from `color:#5c5768`
(inherited from the host page) to `#202020`, because the shared
`.nv-wrap,.nv-logo--standalone,.nv-skip-link{}` reset at the top of the file
suddenly beat the later `.nv-logo{}` rule.

`:where()` contributes **zero** specificity, so this restores the old cascade
exactly:

```css
.nv-logo:where([data-nav-variant~="standalone"])   /* (0,1,0) — identical */
```

All 15 use that form except `disabled`, which replaced `.nv-card.nv-is-disabled`
— already (0,2,0), so it stays a bare attribute selector.

## 10.4 Verified

`_diff.html` (temporary) loaded the pre-change build and the new one in
same-origin iframes at the same width, then compared **34 computed properties
on every element** in the navbar subtree (~200 elements):

| width | closed | Platform open | Partners open (`thirds`) |
|---|---|---|---|
| 1920 | 0 diffs | 0 diffs | 0 diffs |
| 1620 | 0 diffs | — | — |
| 1024 | 0 diffs | — | 0 diffs |
| 768 | 0 diffs | — | — |
| 402 | 0 diffs | 0 diffs | 0 diffs |

Zero differences, closed and open, at every breakpoint. Also re-checked by hand:
ghost vs primary button, the greyed-out "Partner Program" card and its muted
icon tile, and one hamburger icon visible at a time.

## 10.5 Generated files

`embed.html` and `webflow/htmltoflow.html` are both copies of `nav.html`. After
any markup edit:

```
python3 tools/regen.py
```

`webflow/navbar.webflow.json` (§ 9 route) was regenerated too — combo count is
now **0**, which is the whole point. `webflow/navbar.webflow.singleroot.json`
is a hand-made variant and is **stale** as of v1.0.1.

`webflow/verify-port.js` is the console check to paste into the Webflow preview:
it counts every `data-nav-el`, every `data-nav-variant`, and flags any element
that still carries two classes.

## 10.6 htmltoflow — measured, rejected

The flattening in § 10.2 was done to survive the **htmltoflow** app. It wasn't
enough, and the app is not usable for this component at all. Measured against
the published output of a real import (`siegcourse.webflow.io/testing`):

| | `nav.html` | published |
|---|---|---|
| `<button>` | 7 | **0** |
| `<svg>` | 18 | **3** |
| `id` | 9 | **1** |
| `data-nav-el` | 31 | **0** |
| `data-nav-panel` | 12 | **0** |
| `data-nav-variant` | 14 | **0** |
| `data-nav-icon` | 7 | **0** |
| `aria-expanded` / `aria-controls` | 7 / 7 | **0** / **0** |

Webflow has no native button element, so all seven `<button>`s were discarded
outright — six menu items became literally `<li class="nv-item"></li>`, and the
hamburger vanished. Every panel lost `class="nv-panel"` while keeping `hidden`,
so nothing could ever open. With no `data-nav-*` left, `nav.js` finds nothing
and no variant rule matches — which is why both logos rendered at once.

The symptoms reported (dead hover, empty mega menus, two logos) were all one
cause. Nothing about the markup can fix it: the attributes and the buttons are
gone before Webflow ever sees them.

**Use the paste payload** (§ 9). It converts `<button>` → `<a>` and wraps icons
in `.w-embed` deliberately, carries all 120 custom attributes, and was verified
identical in § 9.4. The Designer will not take it from the OS clipboard —
"The clipboard is empty" is Webflow's own message, and the reason
`webflow-paste-extension/` exists.

## 10.7 One command, no stale copies

`webflow-paste-extension/payload/navbar.json` was a hand-made copy and was
still the pre-flattening build — combos and all — when the extension route came
back into play. `tools/regen.py` now owns every derived file:

```
nav.html ─┬─→ embed.html
          ├─→ webflow/htmltoflow.html
          ├─→ webflow/navbar.webflow.json          (194 nodes, 4 roots)
          ├─→ webflow/navbar.webflow.singleroot.json (195 nodes, 1 root)
          └─→ webflow-paste-extension/payload/{navbar,navbar-singleroot}.json
```

All four payloads now report 43 styles, **0 combos**, 31 `data-nav-el` and
14 `data-nav-variant`.

---

# 11. How the navbar actually got into Webflow

Done 2026-08-25, live on `siegcourse.webflow.io/testing`. Both converter routes
are dead; the thing that works is a single Code Embed.

## 11.1 The paste API is gone

§ 9 assumed the `@webflow/XscpData` clipboard payload would paste into the
Designer. Driving the Designer directly and instrumenting it proved otherwise:

- Patching `DataTransfer.prototype.getData` and pressing a real ⌘V, Webflow
  **does** ask for `text/plain` and **does** receive the payload — then silently
  discards it. No console error, nothing on canvas.
- The same happens with `webflow/control-sample.json`, three nodes copied out of
  Webflow itself. So the payload was never the problem.
- Webflow's own ⌘C writes **nothing** to the OS pasteboard (`pbpaste` → 0 bytes).
  Element copy/paste goes through an in-memory `ClipboardStore`, which after a
  copy holds `{clippedElement, ix2State, designerState, pageState, …}` — and
  `designerState` alone is **3.8 MB** of live state. It is not a construction
  target, and nothing is written to localStorage, sessionStorage, or IndexedDB,
  so it does not even survive a reload.

`webflow-paste-extension/` cannot work, and neither can any variation on it.
The XscpData payloads are kept only as a structural record.

## 11.2 `wf.addToCanvas` — a good probe, not a route

The Designer exposes `window.wf.addToCanvas(wfdl)` and
`window.wf.exportTrainingData()`. WFDL is Webflow's own printed element
language, and a round trip works:

```
<Basic::Block "uuid"> { text: false, tag: >div, styleBlockIds: [ ],
  xattr: [ { name: "class", value: "nv-logo", }, ], … } </Basic::Block>
```

`wf.validateWFDL()` gives a fast validate loop, and a generated tree for all
194 nodes validated clean. But `addToCanvas` assigns
`window._webflow.state.DesignerStore` directly instead of dispatching, so
nothing is persisted — **everything vanishes on reload.** Display only.

One genuinely useful finding survives from it: **an `xattr` named `class`
renders as a real `class` attribute**, with no Webflow style block behind it.
So the Style panel never has to know about `nv-*` at all.

## 11.3 What shipped: one Code Embed

Add panel → double-click **Code Embed** → paste `webflow/htmltoflow.html`
(17,863 chars, well under Webflow's 50,000 limit) into the code editor → Save &
Close. The OS clipboard works fine here — it was only Webflow's *element* paste
that ignored it.

The embed carries the CDN `<link>`, the markup, and the CDN `<script>`, so the
page needs nothing else.

## 11.4 Verified on the published page

`nav.html` vs the published HTML:

| | source | published |
|---|---|---|
| `data-nav-el` | 31 | **31** |
| `data-nav-panel` | 12 | **12** |
| `data-nav-variant` | 14 | **14** |
| `data-nav-icon` | 7 | **7** |
| `aria-expanded` / `aria-controls` | 7 / 7 | **7 / 7** |
| `<button>` | 7 | **7** |
| `<svg>` | 18 | **18** |
| combo classes | 0 | **0** |

Byte-faithful. Compare with § 10.6, where the same markup through htmltoflow
lost all 7 buttons, all 64 `data-nav-*`, and 15 of 18 SVGs.

`webflow/verify-port.js` on the live page:

```
css loaded: true | js booted: true | structure: OK
```

Behaviour checked live: mega menu opens on hover with full content, the
Partners `thirds` panel lays out as a real 3-column grid, the disabled card and
its muted icon tile render greyed, Escape closes and clears the scrim, and
exactly **one** logo is visible — the three symptoms from the htmltoflow import
are all gone.

## 11.5 What this costs

The navbar is one embed, not native Webflow elements: it cannot be restyled in
the Designer, and the Style panel stays empty. Given that the architecture
already puts CSS and JS in this repo, that is close to free — the structure now
comes from `nav.html` too, so all three layers have a single source. Editing
means: edit `nav.html`, `python3 tools/regen.py`, tag, then repaste the embed.

If native elements are ever genuinely required, neither converter nor clipboard
will get you there. Nor, it turns out, does it have to be done by hand — the
**Webflow MCP** builds them directly. See § 12.


---

# 12. v1.1.0 — native Webflow elements, built through the MCP

Done 2026-08-25, live on `siegcourse.webflow.io/navbar-native`. The Testing page
and its Code Embed are untouched and remain the fallback.

§ 11.5 said native elements would have to be built by hand. That is wrong: the
Webflow MCP's `data_whtml_builder` takes HTML directly and produces real
Designer elements. It is the third route tried and the first that gives Webflow
ownership of the structure.

## 12.1 The one thing that decides the whole route

`data_whtml_builder` **drops every class it does not already recognise.** A
first probe carrying `class="nv-btn nv-btn--ghost nv-login"` came back with the
tree, the tags and every `data-*` attribute intact — and `styleNames` empty.

Create the styles first and the same call returns:

```
styleNames: ["nv-btn", "nv-btn--ghost", "nv-login"]
```

Full combo chain, in order. So the sequence is **styles, then markup** — never
the other way round. `data_style_tool > create_style` accepts an empty
`properties: []`, which is exactly what is wanted here: the Style panel gets a
real class, and every declaration still comes from `nav.css` on the CDN.

58 styles: 43 base + 15 combos. The three-deep chain works —
`nv-login` with `parent_style_names: ["nv-btn", "nv-btn--ghost"]` yields
selector `.nv-btn.nv-btn--ghost.nv-login`.

Combo classes are therefore **back** in `nav.html` as of v1.1.0. The
`data-nav-variant` flattening of § 10 existed only to survive htmltoflow, and
htmltoflow is not in the pipeline any more.

## 12.2 What the builder preserves, and the two things it does not

Preserved with no special handling: `data-nav-el` / `data-nav-panel` /
`data-nav-icon`, every `aria-*`, `id`, and the tag map —
`header`/`section`/`ul`/`li`/`h2`/`p` all land as the right Webflow type, and
`<span>` stays a real Span rather than collapsing to a div as it did in § 9.3.

Two things needed work:

**1. SVGs become live DOM nodes, not embeds.** The builder turns `<svg>` into
`type:"DOM" tag:"svg"` with `path` children. That renders, but it puts 18 icons
beyond hand-editing in the Designer. Instead each `<svg>` was stripped out and
its parent tagged `data-svg-slot="N"`; after insertion the 18 slots were located
by that attribute, given an `HtmlEmbed` child, and the markup written to the
embed's `code` setting. The markers were then removed.

Take the SVG source **verbatim from `nav.html`**, not from a parsed tree —
Python's `HTMLParser` lowercases `viewBox` to `viewbox`. Browsers repair that
via the HTML5 SVG attribute-case table, so it renders either way, but there is
no reason to ship it broken.

**2. `hidden` does not survive publish.** The Designer stores it (`hidden: ""`)
and then emits nothing. Harmless — `nav.js` hides every panel at boot and
`.nv-panels{height:0;overflow:hidden}` clips them before that, so there is no
flash — but the published markup no longer matched the source. Setting
`hidden="hidden"` (a valid boolean-attribute form) publishes correctly.

## 12.3 Buttons

All 7 `<button>` became `<a href="#">`, as § 9.3 planned and § 9.4 measured.
`nav.js` already calls `preventDefault()` on the toggle and on every panel head,
and its close-on-link-click rule already excludes heads. `location.hash` stays
empty at all three breakpoints.

## 12.4 Verified — published HTML vs `nav.html`

Counted against the comment-stripped source, so the header comment's own
mentions of `data-nav-el` etc. do not inflate the totals:

| | source | published |
|---|---|---|
| `data-nav-el` | 31 | **31** |
| `data-nav-panel` | 12 | **12** |
| `data-nav-icon` | 7 | **7** |
| `aria-expanded` / `aria-controls` | 7 / 7 | **7 / 7** |
| `aria-hidden` / `aria-label` / `aria-disabled` | 29 / 3 / 1 | **29 / 3 / 1** |
| `id="nv-*"` | 9 | **9** |
| `hidden` | 7 | **7** |
| `<svg>` / `<path>` / `<line>` | 18 / 20 / 3 | **18 / 20 / 3** |
| `<ul>` / `<li>` / `<h2>` / `<section>` / `<header>` | 1/7/3/4/1 | **1/7/3/4/1** |
| `<button>` | 7 | **0** — all `<a href="#">`, by design |
| `nv-` class usages | 150 | **150** |
| combo-class elements | 14 | **14** |

**Zero diffs.** All 14 combo chains present, each modifier alongside its base.
18 `.w-embed` wrappers, `display:contents` doing its job.

`webflow/verify-port.js` on the published page:

```
css loaded: true | js booted: true | structure: OK
```

## 12.5 Verified — behaviour

Desktop measured directly; tablet and mobile in same-origin iframes, because
`mode()` reads `window.innerWidth` and the media queries apply per frame.

| | § 9.4 | this build |
|---|---|---|
| desktop bar / panel top / panel height | 74 / 94 / 508 | **74 / 94 / 508** |
| tablet rail width / rail drift | 193 / 0 | **193 / 0** |
| tablet bar height / panel height | — | 80 / 542 — identical to `/testing` |
| mobile drill: drawer stays open, toggle | open / back | **open / back** |
| `location.hash` | empty | **empty** |

Also checked live: logo SVG measures 34px inside its `.w-embed`; exactly one
logo visible at every width; exactly one hamburger icon at a time
(menu → close → back through the mobile drill); Partners `thirds` panel lays out
as three real columns; the disabled card and its muted tile render greyed
(`rgba(0,0,0,.27)` on a `rgba(0,0,0,.06)` tile against `#f0ebff` normal);
Escape closes and clears the scrim.

The empty purple card-icon tiles are **expected** — `data-nav-icon` still marks
them for the pass-2 SVG swap.

## 12.6 Order of operations

```
create_page (duplicateOf: Testing)      → new page, carries the old embed
remove_element                          → delete that embed
create_style × 58                       → 43 base + 15 combo, all empty
whtml_builder × 4                       → the 4 roots, SVGs stripped to slots
element_builder × 18                    → an HtmlEmbed per slot
set_settings × 18                       → the SVG markup, verbatim
remove_attribute × 18                   → drop the data-svg-slot markers
set_attributes × 7                      → hidden="hidden" on 6 panels + scrim
element_builder + move_element          → one wrapper div, everything inside (§ 12.8)
element_builder × 2 + set_settings × 2  → the CDN <link> and <script>, inside it
publish_site                            → publishToWebflowSubdomain, customDomains: []
```

Publishing with an empty `customDomains` array leaves the production domains
alone — `academy.siegpath.com` and `course.siegpath.com` both still report
`lastPublished: 2025-11-06`.

## 12.7 What this buys

Webflow now owns the structure. The Style panel lists all 58 classes, every
element is selectable in the Navigator, and the markup is edited in the Designer
from here on — `nav.html` was the one-time source and is not regenerated into
Webflow again. CSS and JS stay in this repo and ride the CDN, unchanged.


## 12.8 One wrapper, so the navbar travels

The four roots started as four siblings on `<body>`, with the CDN `<link>` and
`<script>` in the page's custom code. That works, but copying the navbar to
another page means copying four elements **and** remembering the custom code.

They are now one unit:

```
Body
└── div  "Hackuity Navbar"          ← copy this, get everything
    ├── HtmlEmbed   <link  … nav.css>
    ├── a.nv-skip-link
    ├── a.nv-logo.nv-logo--standalone
    ├── header.nv-wrap
    ├── div.nv-scrim
    └── HtmlEmbed   <script defer … nav.js>
```

Page-level custom code is now **empty** — the loaders moved into the wrapper.
Exactly one of the two may exist. Two copies of `nav.js` is not a harmless
duplicate: see § 12.9.

The wrapper carries **no class and no styles**, and that is load-bearing:

- `.nv-wrap` and `.nv-scrim` are `position:fixed`; `.nv-skip-link` and (on
  mobile) `.nv-logo--standalone` are `position:absolute` against the initial
  containing block. A wrapper with `transform`, `filter`, `will-change`,
  `contain` or `position:relative` would become their containing block and
  break all four. A plain static div does not.
- It also creates no stacking context, so the `z-index:100 / 99 / 98` ordering
  between bar, scrim and standalone logo survives untouched.

Verified after the move: `cssLoaded: true`, `jsBooted: true`, `structure: OK`,
one non-script child on `<body>`, wrapper `position: static` with 6 children,
and the published page still reports 31 `data-nav-el`, 12 `data-nav-panel`,
7 `data-nav-icon`, 18 `<svg>` and 150 `nv-` class usages.

A `<link rel="stylesheet">` inside `<body>` is valid — the spec marks it
body-ok — and it still lands after Webflow's own stylesheet, which is the one
ordering rule that matters (README, "What the port must preserve").

## 12.9 The duplicate-loader trap

Symptom: mega-menu heights snap instead of animating, on hover and on switching
between panels of different heights.

Cause: the page was loading **nav.js twice** — once from page custom code and
once from a pair of loader embeds. Two instances both bind to the same DOM and
fight over the same inline `height`:

- each instance's `applyHeight()` overwrites the value the other just set;
- each instance's `naturalHeight()` sets `transition:none` on the sizer to take
  a measurement, which cancels the other's in-flight transition.

Nothing errors. The structure is perfect, `verify-port.js` still says
`structure: OK`, and the only visible symptom is that the height animation is
gone.

`nav.js` has no re-entry guard, so this is worth checking first whenever the
animation misbehaves:

```js
document.querySelectorAll('script[src*="nav.js"]').length   // must be 1
document.querySelectorAll('link[href*="nav.css"]').length   // must be 1
```


---

# 13 · The link list is divs now, not `ul`/`li` (v1.2.0)

Done 2026-08-26 on the `testing-mcp` page (slug still `/navbar-native`).
`.nv-menu` is a Webflow **Div Block** with `role="list"`; each `.nv-item` is a
Div Block with `role="listitem"`. Zero `List` elements remain on the page.

## 13.1 Why — the Slot rule, not taste

The plan is a Slot inside `.nv-menu` and an `nv-item` **component** dropped into
it, so items can be added without touching the tree. A Webflow `List` cannot
host either:

- a Slot is created with `data_element_builder type:"ComponentSlot"` and only
  goes **inside a component definition**; and only component *instances* may
  live in a slot — never a plain element;
- `set_tag` on a `List` accepts **`ul|ol` only**. There is no List → Div
  conversion, which is why the 7 items had to be rebuilt rather than retagged.

Per-item `data-nav-panel` is not a blocker for the component step later:
`set_settings` takes an `attributes` entry with `value_binding`, so a `string`
prop can drive the attribute value per instance. Same for `aria-controls`.
The label is a `textContent` prop.

## 13.2 Nothing in the repo cared about the tags

- `nav.js` resolves everything through `[data-nav-el]`. The `li` in
  `items.forEach(function (li) …)` is a variable name, not a selector.
- `nav.css` is class-only. `.nv-menu{margin:0;padding:0;list-style:none}`
  existed to beat Webflow's `ul{padding-left:40px}` — a div never inherits that,
  so the div is the safer element. The rule stays; `list-style` is inert on it.
- `verify-port.js` counts by attribute (`menu:1, item:7`), so it is unaffected.

`role="list"`/`"listitem"` are not decoration: `.nv-menu` is `display:flex`,
which already strips list semantics in Safari/VoiceOver. The roles put them back,
so the div build is *more* consistent for screen readers than the `ul` was.

## 13.3 Order of operations

```
whtml_builder × 1        → the div menu, inserted `before` the old <ul>,
                           12 SVGs stripped to data-svg-slot markers
element_builder × 12     → an HtmlEmbed per slot
set_settings × 12        → the SVG markup (chevron ×6, caret ×6)
remove_attribute × 12    → drop the markers
remove_element × 1       → the old <ul>
publish_site             → publishToWebflowSubdomain, customDomains: []
```

Two details worth keeping:

**Take the embed markup from an existing embed, not from `nav.html`.** The live
embeds hold the SVG on one line; `nav.html` wraps its attributes across two.
Reading the old chevron embed's `code` setting first made the new twelve
byte-identical to the old.

**The builder keeps source whitespace as `String` nodes.** Newlines between the
spans inside each `.nv-link` became `textContent:" "` siblings — the § 12 build
has none. Harmless and deliberately left alone: a whitespace-only text run in a
flex container generates no flex item, so `gap` is untouched. Measured on the
published page: `.nv-menu` has exactly 7 flex children and `.nv-link` keeps its
`gap: 8px`.

## 13.4 Verified on the published page

`siegcourse.webflow.io/navbar-native`, published to the Webflow subdomain only —
`academy.siegpath.com` and `course.siegpath.com` untouched.

| | source | published |
|---|---|---|
| `data-nav-el` | 31 | **30** — the missing one is § 13.5 |
| `data-nav-panel` / `data-nav-icon` | 12 / 7 | **12 / 7** |
| `aria-expanded` / `aria-controls` | 7 / 7 | **7 / 7** |
| `aria-hidden` / `aria-label` / `id="nv-*"` | 29 / 3 / 9 | **29 / 3 / 9** |
| `<svg>` / `<path>` / `<line>` | 18 / 20 / 3 | **18 / 20 / 3** |
| `<ul>` / `<li>` | 0 / 0 | **0 / 0** |
| `role="list"` / `role="listitem"` | 1 / 7 | **1 / 7** |
| `<button>` | 7 | **0** — all `<a>`, § 12.3 |

In the browser: `cssLoaded: true`, `jsBooted: true`, one `nav.css` link and one
`nav.js` script (§ 12.9 clean). `.nv-menu` is `DIV[role=list]`, all 7 items are
`DIV[role=listitem]`, all 7 links are `A`, 12 SVGs inside the menu. Forcing one
icon visible at desktop measures 20×20 with the right `d` — carets
`m9 18 6-6-6-6`, chevrons `m15 18-6-6 6-6`.

Hover on desktop still drives the panel morph: hovering AI-Platform sets
`nv-is-active` on that item, unhides its panel and flips `aria-expanded`;
switching to Company moves both and animates the body height (0 → 508px);
`mouseleave` clears it.

## 13.5 Pre-existing gaps, NOT from this change

Three elements § 12.8 recorded are no longer on the page, all outside the menu
subtree that was rebuilt. They were removed in the Designer at some point after
§ 12 was written:

- `a.nv-skip-link` — gone
- `div.nv-scrim` (`data-nav-el="scrim"`) — gone. This is the only thing
  `verify-port.js` now reports (`scrim → 0, expected 1`). `nav.js` guards it
  (`if (scrim) …`), so nothing errors, but the drawer has no dim layer and
  click-outside-to-close is dead on tablet/mobile.
- the in-bar logo's `span.nv-logo-word` — gone, so the bar shows the mark
  without the word. The standalone (mobile) logo still has its word.

The wrapper div is down to 4 children from the 6 in § 12.8.

## 13.6 The repo mirrors it

`nav.html` is v1.2.0 and its derived files were regenerated by
`tools/regen.py`. `nav.css` and `nav.js` are unchanged, so the loaders on the
page still point at the **v1.1.1** CDN tag and that is correct — v1.2.0 has to be
tagged and pushed before anything references it.


---

# 14 · The bar is full-bleed — `--nv-bar-inset` is 0 (v1.2.1)

Done 2026-08-27. `.nv-wrap` now sits `left: 0 / right: 0` at every width.

## 14.1 What changed in nav.css

`--nv-bar-inset` was 64px desktop, overridden to 32px at `max-width:1619px`
and 16px at `max-width:767px`. The root value is now `0px` and both overrides
are deleted, so the token has one source of truth and no breakpoint can
reintroduce a side gap. `--nv-bar-top` (40px) and `--nv-panel-tuck` are
untouched — only the horizontal inset went away.

## 14.2 The tag was cut, unlike § 13.6

Unlike v1.2.0, this one had to ship: nav.css itself changed, and the CDN
pins an immutable tag. So `v1.2.1` is tagged and pushed, and every loader
(`README.md`, `nav.html`, `embed.html`, `webflow/htmltoflow.html`) points at
it. The derived files came from `tools/regen.py`, which reads the tag out of
the `nav.html` header comment — bump that line first or the regen re-emits
the old CDN URLs.


---

# 15 · The bar lives in Webflow's `.container-1280` (v1.3.0 → v1.3.1)

Done 2026-08-30. Full-bleed is gone again — but this time the bar is not inset
by an arbitrary token, it is *inside the same container the page content uses*.

## 15.1 What the reference page actually does

Measured on `https://hackuityai.webflow.io/book-a-demo` at a 1710px viewport:

```
.container-1280   width:100%; max-width:84rem (1344); padding-inline:2rem (32)
                  → 1280px content box, x=215 … 1495
.book-a-demo-wrap x=215  w=1280      ← every section on the page sits here
@media (max-width:767px) .container-1280 { padding-inline:1rem }
```

The page's own media queries are Webflow's stock tiers and nothing else:
`min-width 1920 / 1440 / 1280` and `max-width 991 / 767 / 479`. There is **no**
1619 anywhere on the page — that number was ours alone.

Note the page also has `.container-1792` (max-width 116rem, same 32px gutter),
and the *current* Webflow build wraps `.nv-wrap` in one. That wrapper is why the
bar reads as full-bleed. See § 15.5.

## 15.2 What changed in nav.css

`--nv-bar-inset` is deleted. Two tokens replace it:

```css
--nv-container-max: 1280px;   /* the content box — this IS the pill's width */
--nv-container-pad: 32px;     /* the gutter outside it; 16px at <=767 */
```

The gutter goes on `.nv-wrap` (still `fixed; left:0; right:0`) and the cap goes
on `.nv-shell`, not the other way round. That ordering is load-bearing:
`.nv-menu` (desktop) and `.nv-body` (mobile drawer) are absolutely positioned
against `.nv-shell`, and an abspos child resolves against the **padding box**.
Put the padding on `.nv-shell` and the drawer would spill 2 × 32px wider than
the pill it is tucked behind.

## 15.3 Making 7 links fit 1280 — this is NOTES § 2 option B

The desktop row needed 1466px inside the old full-bleed bar. The budget is now
a hard 1280. Two things give it back: the link type drops 18px → **16px** (593px
of text becomes 527px), and the horizontal link padding drops 24 → **16px**:

```
24 bar padding-left
175.535 logo
24 gap            (was 40 — --nv-space-7 → --nv-space-5)
751 links         (527 text at 16px + 14 × 16px --nv-link-pad; was 929)
32 slack
91 Login
8 actions gap
158 Book a Demo
16 bar padding-right
= 1280, with 32px of breathing room between the last link and Login
```

`--nv-menu-left` drops 239.535 → **223.535** (24 + 175.535 + 24) to match the
smaller bar gap. `--nv-link-pad` is horizontal only, and `line-height` stays
**26px** even though the font shrank — the link's vertical padding is still
`--nv-space-5`, and 24 + 26 + 24 is the 74px row height the active item's
square highlight is drawn off. Measured: the row is still exactly 74px.

The tablet block sets `--nv-link-pad: var(--nv-space-5)` to put 24px back; the
193px rail has the room and nothing there is width-constrained.

## 15.4 Why the collapse moved 1619 → 1279 (v1.3.1)

v1.3.0 collapsed at 1439, which cost the whole 1280–1439 band — every 1366 and
1440-class laptop got the hamburger. It does not have to.

The container caps at 1280 content from **1344px of viewport** up; below that it
is `vw − 64`, bottoming out at **1216** at exactly 1280px of viewport. So the
question is only whether the row fits 1216, and at 12px link padding it does:

```
24 padL + 175.535 logo + 24 gap + 695 links (527 text + 14 × 12) + 91 Login
+ 8 + 158 Demo + 16 padR = 1191.5   →  24px to spare inside 1216
```

Hence a **new § 5b block** in `nav.css`: `@media (max-width:1439px)` sets
`--nv-link-pad: 12px` and nothing else. It is one token, placed *before* the
collapse block so the collapse block's `24px` still wins on the rail.

`--nv-bp-tablet` is therefore `1279`, the media query is `max-width:1279px`, and
the three states line up with Webflow's stock tiers exactly:

| viewport | Webflow tier | nav |
|---|---|---|
| ≥1440 | 1440 / 1920 | row, 16px link padding |
| 1280–1439 | 1280 | row, 12px link padding |
| 992–1279 | Desktop base | hamburger + 193px rail |
| 768–991 | Tablet | hamburger + 193px rail |
| ≤767 / ≤479 | Mobile | bottom bar + drawer |

Below 1280 nothing saves it — the container keeps shrinking while the row's
floor stays ~1191, so 1279 is a real wall, not a chosen one.

`nav.js` reads the token, so only its fallback literal had to move.

Webflow's Tablet tier (≤991) needs no rules of its own — the `max-width:1439px`
block already covers it, exactly as the old 1619 block used to.

Verified in `embed.html` at 1920 / 1440 / 1439 / 1400 / 1344 / 1300 / 1281 /
1280 / 1279 / 1200 / 1024 / 992 / 991 / 768 / 767 / 480 / 479 / 402 / 375: zero
horizontal overflow anywhere, correct gutter (32 above 767, 16 below), a 74px
row at every width, and both flips landing exactly on their boundaries —
16px→12px padding at 1440/1439, row→hamburger at 1280/1279. Worst-case gap
between the last link and Login is **24px, at 1280**. Injected over the live
Book-a-Demo page the bar measures `x=215 w=1280`, identical to
`.book-a-demo-wrap`.

## 15.5 Two things the Webflow port has to do

1. **Delete the `.container-1792` wrapper** between `.nv-wrap` and `.nv-shell`.
   It is redundant now and its 32px padding would double the gutter.
2. **`.nv-menu` left is a Designer value, not the token.** On the live build
   `.nv-menu` computes `left:239.535px` even when `--nv-menu-left` is
   overridden — the native rebuild wrote the number into a Webflow style block.
   Set it to `223.535px` in the Designer or the link row sits 16px too far
   right and the gap to Login collapses to 6px.

## 15.6 The tag

`v1.3.0` — minor, not patch: the collapse breakpoint and the link type both
moved, so this is not a drop-in for v1.2.1. `v1.3.1` follows immediately with
§ 15.4's compact band, recovering 1280–1439. `nav.html` is byte-identical in
both, but its header comment carries the tag `tools/regen.py` reads, so it was
bumped and every derived file regenerated. Loaders repointed in `README.md`,
`nav.html`, `embed.html` and `webflow/htmltoflow.html`.

Nothing in § 15.5 changes for v1.3.1 — the Webflow markup is untouched, so the
port still only needs the `.container-1792` deletion, the `.nv-menu`
`left:223.535px` fix, and the two loaders repointed.
