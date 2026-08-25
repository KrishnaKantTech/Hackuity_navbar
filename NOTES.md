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
will get you there — it would have to be built by hand in the Designer.
