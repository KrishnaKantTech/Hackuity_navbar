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
Every number in `styles.css` was read from the file via the Figma MCP server. Nothing was measured off a screenshot.

```
index.html    semantic markup, one DOM for all breakpoints
styles.css    tokens → desktop base → max-width 1619 / 767 / 479
script.js     no dependencies, no jQuery
verify.js     Playwright harness — measures the build against Figma
fonts/        Aeonik Regular + Medium (woff2), Bold (otf)
shots/        rendered proof, closed + open, every breakpoint
```

## 0. Architecture — fixed pill, panel behind

`.navbar_bar` is its own rounded pill: glass fill, 24px radius, shadow, fixed height. `.navbar_shell`
is just a stacking wrapper with no surface of its own. The panel is pulled up by `--panel-tuck` so
its square top edge hides behind the pill, and carries `border-radius: 0 0 24px 24px` plus the same
shadow — exactly how Figma constructs it.

Stacking matters: `.navbar_body` deliberately has **no** `z-index`, so it never becomes a stacking
context. That lets the lifted desktop link row (z-index 3) paint above the pill (2) while the panel
(1) stays behind it.

The list is a single `<ul>` at every breakpoint:

| | where it lives | how |
|---|---|---|
| Desktop | the bar row | lifted with `top: -74px`; the height animation runs on `.navbar_panels` so the body never clips it |
| Tablet | 193px rail on the **right** | `.navbar_body` becomes `grid-template-columns: 1fr 193px`; the body is the clipped animator |
| Mobile | the drawer | drilling into a head hides the list (`.is-drilled`) and shows that panel |

Open `index.html` directly in a browser — no build step, no server.

---

## 1. Verification — measured, not asserted

`node verify.js` renders at 13 widths and compares against Figma. Current result:

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
| **B — compact desktop** | uncomment the block in `styles.css` above the mobile section, change 1619 → 1439 | Full 7-link bar down to 1440. Costs **two** non-Figma values: link padding 24→12, bar gap 40→24. Below 1440 nothing saves it. |
| **C — ask the designer** | reduce link padding or font size in Figma, or drop a link | The only way to get the full bar onto 1280 screens honestly. Dropping *Pricing* into the CTA group would free 107px. |

Change **one number** in `styles.css` (line ~`@media (max-width:1619px)`) and the matching `TABLET_MAX` in `script.js` to switch options.

---

## 3. Decisions taken

| Decision | Why | Impact |
|---|---|---|
| Desktop menu list is canonical (7 items) everywhere | Your call | Mobile drawer now shows AI-Platform / Solutions / Partners / Why Hackuity / Pricing / Resources / Company, not the 6-item Figma mobile list |
| Bottom bar from ≤767 down | Your call | Tablet top bar covers 768–1619; mobile bottom bar covers ≤767 |
| Desktop/tablet are one growing shell; mobile keeps a separate drawer | Figma draws desktop and tablet as a single rounded surface, but on mobile the bar is a distinct pill overlapping the drawer's bottom 24px | Matches each artboard rather than forcing one mechanism onto all three |
| Height animated in JS, not `grid-template-rows: 0fr/1fr` | The CSS-only trick animates open/close but cannot animate *between two content heights* | Switching heads morphs the navbar's height, which is the behaviour you asked for |
| Clipping target differs per breakpoint | On desktop the link row is lifted into the bar, so a clipped `.navbar_body` would hide it — the animation runs on `.navbar_panels` there and on `.navbar_body` elsewhere | One `<ul>`, no duplicated DOM, nothing clipped that shouldn't be |
| Pricing is a plain link, no panel | Figma has no "Nav Open – Pricing" frame | If it should have one, say so |
| Tablet rail on the right | Figma `158:991` puts the 193px rail on the right with left-pointing chevrons | You asked for right-opening; the file says otherwise and the chevron direction confirms the file's intent. Flip `grid-template-columns` and `.navbar_menu{grid-column}` to reverse it |
| Card icon tiles are flat `#f0ebff` | Figma's asset URLs are blocked from this sandbox | Every tile carries `data-icon="…"` so the real SVGs drop straight in |
| Mobile list-open button shows ✕ Close | Figma only draws the drilled state (back chevron) | If the list state should also show ☰, it's one line in `syncButton()` |
| Aeonik Bold ships as `.otf` | This sandbox has no brotli, so I couldn't make a woff2 | Works everywhere, ~161KB vs ~45KB. Convert at fontsquirrel/`fonttools` before launch |
| Logo wordmark is live text, not the SVG | Figma's asset URLs are blocked from my sandbox by robots.txt | **The one approximated element.** Export the Logo layer as SVG and drop it in — box geometry is already exact (175.535 × 34; mobile 222 × 43) |

---

## 4. Webflow porting map

Desktop is the master. Write these unprefixed, then override in the three `max-width` breakpoints.

| Webflow class | Desktop (base) | Tablet ≤991 | Mobile L ≤767 | Mobile P ≤479 |
|---|---|---|---|---|
| `navbar_wrap` | fixed · top 40 · L/R 64 | L/R 32 | top auto · bottom 24 · L/R 16 | — |
| `navbar_bar` | H 74 · pad 0/16/0/24 · gap 40 | H 80 · pad 16/16/16/24 · space-between | pad 16 · gap 16 | — |
| `navbar_shell` | radius 24 · `rgba(255,255,255,.7)` · blur 20 · shadow `0 0 10px #e8e8e8` · overflow hidden | — | overflow **visible** (the drawer escapes the pill) | — |
| `navbar_body` | white · height animated to the active panel | grid `1fr 193px` · clipped animator | absolute above the bar · own radius `24 24 0 0` + shadow | — |
| `navbar_logo` (in bar) | 175.535 × 34 | — | **hide** | — |
| `navbar_logo` (standalone) | **hide** | — | show · fixed · top 80 · centred · 222 × 43 | — |
| `navbar_menu` | row, inside bar | column, drawer rail, 193 wide, 24 top pad | full width | — |
| `navbar_link` | pad 24 · 18/26 · w700 · `#202020` | H 74 · space-between · chevron on | H 76 · 20/28 · tracking −.08 | — |
| `navbar_btn-ghost` (Login) | H 48 · pad-x 24 · r16 · `#2a006bee` | **hide** | — | — |
| `navbar_btn-primary` | H 48 · pad-x 24 · r16 · `#8a68e9` · w500 · white | — | — | — |
| `navbar_menu-button` | **hide** | show · H 48 · pad-x 24 · r16 · gap 12 · icon 20 + "Menu" | 48 × 48 · icon only · no label | — |
| `navbar_drawer` | n/a | below bar · top 56 · grid `1fr 193px` · radius `0 0 24 24` | above bar · bottom 56 · 1 col · radius `24 24 0 0` · pad-bottom 40 | — |
| `navbar_panel` | abs · top 50 · radius `0 0 24 24` · white · shadow | in flow, left column | **hide** | — |

Webflow notes:
- No `:has()`, no container queries, no custom media — every state is a class toggled by JS (`is-open`, `is-active`, `is-scrolled`).
- One class per Webflow class. Combo classes map to `--ghost` / `--primary` / `--standalone` / `--inbar`.
- The `1619` breakpoint is **not** a Webflow breakpoint. Put that media query in a custom-code embed, or pick option B/C above.
- The height animation is JS-driven (`applyHeight()` in `script.js`). Webflow Interactions can't measure a sibling's natural height, so keep the script — don't try to rebuild it as an IX2 timeline.
- `overflow: hidden` on `navbar_shell` is what clips the growing body and gives it the bottom radius. Don't let Webflow move it.

---

## 5. Interaction

- **Desktop** — 90ms hover intent opens; moving to another head morphs the height, it does not close and reopen; click toggles; click-outside and Esc close. The active head gets `rgba(55,0,255,.11)` (Colors/Violet Alpha/3) as a **square** block spanning the full 74px row, with accent-coloured text — straight from Figma `352:26027`.
- **Tablet** — ☰ Menu becomes **✕ Close**. The 193px rail sits on the **right** with `<` chevrons; the mega-menu fills the 767px on the left. First menu auto-selected so the left column is never blank. Verified: rail `x=799 w=193`, panels `x=32 w=767` — Figma's 767 + 193 = 960.
- **Mobile** — ☰ opens the link list. Tapping a head **replaces** the list with that menu's panel and the button becomes a **back chevron** in a lavender tile; back returns to the list. Drawer scrolls when the panel is taller than the viewport allows.
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
