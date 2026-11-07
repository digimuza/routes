---
name: Maršrutai
description: Dispatch planner's survey sheet. A delivery day drawn onto a topographic map, ending in printed route sheets.
colors:
  paper: "#eceee8"
  sheet: "#f8f9f6"
  field: "#ffffff"
  rule: "#cfd5cb"
  rule-soft: "#e2e6de"
  ink: "#1c211e"
  ink-2: "#48514c"
  ink-3: "#636c66"
  hydro-blue: "#1d5d8f"
  hydro-blue-press: "#164a73"
  hydro-blue-wash: "#e1ebf3"
  contour-brown: "#84501f"
  contour-brown-wash: "#f4eadd"
  contour-brown-ink: "#5e3713"
  vegetation-green: "#2f6a3c"
  bad: "#b3261e"
  bad-wash: "#fbe9e7"
  map-ground: "#e8ebe5"
  priority-1: "#d32f2f"
  priority-2: "#f9a825"
  priority-3: "#9e9e9e"
typography:
  headline:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.47rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.07rem"
    fontWeight: 700
    letterSpacing: "-0.005em"
  figure:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.27rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.87rem"
    fontWeight: 400
  label:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    fontFeature: "tnum"
  label-sm:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.hydro-blue}"
    textColor: "{colors.field}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.hydro-blue-press}"
  button-primary-lg:
    backgroundColor: "{colors.hydro-blue}"
    textColor: "{colors.field}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-active:
    backgroundColor: "{colors.hydro-blue-wash}"
    textColor: "{colors.hydro-blue-press}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.field}"
    rounded: "{rounded.md}"
    height: "36px"
  segmented-option:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  segmented-option-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.field}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  row-selected:
    backgroundColor: "{colors.hydro-blue-wash}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  inspector:
    backgroundColor: "{colors.field}"
    rounded: "{rounded.lg}"
    width: "380px"
  stale-banner:
    backgroundColor: "{colors.contour-brown-wash}"
    textColor: "{colors.contour-brown-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  map-notice:
    backgroundColor: "{colors.contour-brown-wash}"
    textColor: "{colors.contour-brown-ink}"
    rounded: "{rounded.sm}"
    padding: "5px 10px"
  tag-late:
    backgroundColor: "{colors.bad-wash}"
    textColor: "{colors.bad}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
---

# Design System: Maršrutai

## Overview

**Creative North Star: "The Survey Sheet"**

The dashboard is a topographic survey sheet, and a delivery day gets drawn onto it. The map sits desaturated inside a black neatline with a graduated black/white border and coordinate labels on all four margins. The title bar is the sheet's title block, and the side panel reads as its legend: a symbol, a label and a figure on each row. The ground is paper, not a dark sidebar. There are no floating white cards over a full-bleed colourful map.

Colour follows map convention. Ink is black. Hydrography blue means "act here" or "this is selected". Contour brown carries coordinates and anything stale. Vegetation green means saved and OK. Every hue keeps its job, so a projector audience can read the screen at a distance. Figures are set in tabular columns, right-aligned, so the plan can be checked line by line.

**Key Characteristics:**
- Paper ground, black ink, and colour used only by role.
- A neatline frame with live coordinates around a desaturated map (Leaflet tiles at grayscale 0.92).
- Barlow for text, Barlow Semi Condensed for labels and figures, tabular numerals everywhere.
- Each priority has one symbol, repeated identically at every size.
- Each stop is a numbered control on the map, paired with a row in the courier's stop table.

## Colors

The palette is a restrained topographic set: neutral paper and ink, three role hues, and a fixed priority triad shared with the PDF.

### Primary
- **Hydrography Blue** (`hydro-blue`): the primary button ("Sudaryti maršrutus", "Išsaugoti"), the focus ring, the active tab underline, the selected row or route (wash fill plus a 1px blue inset), the selected package marker outline, the draft crosshair, the download progress bar and text links. Press/hover uses `hydro-blue-press`; selection fill uses `hydro-blue-wash`.

### Secondary
- **Contour Brown** (`contour-brown`): neatline coordinate labels, the cursor lat/lng readout, the inspector's coordinate subline, the stale-plan banner and badge, skip reasons, "full" capacity figures, the Mock badge. Banners use `contour-brown-wash` with `contour-brown-ink` text and a `#dcc3a4` border.

### Tertiary
- **Vegetation Green** (`vegetation-green`): the "Išsaugota" save state. Nothing else.
- **Error Red** (`bad`, wash `bad-wash`): the overload bar, the late tag and late strip tick, field errors, destructive actions and the server-down alert. It is a darker red than priority 1 so the two never read as the same signal.

### Fixed data colours
- **Priority 1 / 2 / 3** (`priority-1` red, `priority-2` yellow, `priority-3` grey): fixed by PRODUCT.md and `PRIORITY_COLORS` in `@marsrutai/shared`, and shared with the PDF route sheets. Never retune them.
- **Courier palette** (`lib/palette.ts`, 12 hues): `#2e7d32 #7b3fa0 #00838f #8d5524 #689f38 #ad5cc7 #37474f #5e35b1 #00695c #9e7b2f #4e6b2e #6d4c41`. Text on any courier or priority fill is chosen by `inkOn()` (white or ink, whichever has higher contrast).

### Neutral
- **Paper** (`paper`): the title bar and the margin around the map. **Sheet** (`sheet`): the side panel. **Field** (`field`): inputs, the inspector, popups, toasts and the stop table.
- **Ink** (`ink`, `ink-2`, `ink-3`): primary text and frame lines, secondary text, then muted text and axis labels.
- **Rule** (`rule`, `rule-soft`): control borders and table lines, then block dividers and bar tracks.

### Named Rules
**The Hydrography Rule.** Blue means action or selection, nothing else. If an element is neither pressable nor the current selection, it is not blue.

**The Reserved Hue Rule.** Courier colours never include red, yellow, light grey (priority) or blue (action). A new courier colour must keep that exclusion. Colours that arrive from data (server defaults, old datasets) and clash, or duplicate another courier, are remapped for display only by `displayColors()` in `lib/palette.ts` (farthest free palette colour); the stored dataset is not rewritten unless the planner edits that courier.

**The Contour Rule.** Brown marks coordinates and staleness. A plan that no longer matches the scenario turns brown (banner, tab badge, dashed route lines at 0.4 opacity). It does not turn red.

## Typography

**Body Font:** Barlow 400/500/600/700 (fallback system-ui), self-hosted via @fontsource.
**Label Font:** Barlow Semi Condensed 500/600, used for field labels, counts, figures, badges, coordinates, table headers and marker numerals.

**Character:** A DIN-like engineering sans, like the lettering on a map. The condensed cut does the work of map annotation: it fits figures into tight columns without shrinking them.

### Hierarchy
The root is 15px (16px at ≥1700px for projectors). All sizes are in rem.
- **Headline** (700, 1.47rem): server-down heading only.
- **Figure** (600, 1.27rem, tabular): plan metrics.
- **Brand / Inspector title** (700, 1.2rem / 1.13rem): the "Maršrutai" wordmark and the inspector heading.
- **Title** (700, 1.07rem): block titles in the side panel, with the count in label type beside them.
- **Body** (400–600, 1rem): rows, forms and popups. Button text runs 0.93rem/600, tabs 0.98rem/600.
- **Body-sm** (0.87rem): row sublines, hints, footers, tooltips.
- **Label** (600, 0.85rem, condensed): field labels, neatline labels, xs buttons. **Label-sm** (600, 0.8rem): tab counts, badges, stop table headers.

### Named Rules
**The Tabular Rule.** Every time, weight, count and coordinate uses `font-variant-numeric: tabular-nums` (the `.num` class, inputs, and the popup grid), right-aligned in columns.

## Layout

The page fills the viewport: a title bar (min 64px, 2px ink bottom rule), then a two-column work area with the side panel at `clamp(360px, 26vw, 440px)` and the map stage taking the rest. The design target is 1280–1920px. At 1360px and below, the brand subline is hidden and the large button loses its 232px minimum. At 960px and below, the map stacks above the panel (55vh).

- **Title bar:** brand mark + name/subline, city segmented switch, spacer, save state, mode segmented (Google API / Mock), primary "Sudaryti maršrutus", "Atsisiųsti visus PDF".
- **Tabs:** "Paketai" and "Kurjeriai" (editing) sit left of a 1px divider, "Maršrutai" (the plan) sits right of it. Each tab is 48px tall with a 3px underline.
- **Panel blocks:** padding 16px 18px, separated by `rule-soft`. List blocks use 8px padding.
- **Map frame:** padding 32px top, 36px right, 72px bottom, 40px left. That margin is the sheet's paraštė. Inside it sit a 1px ink outline and 5px graduated bands offset 7px out. Coordinate labels sit 27px out on all four sides (rotated on left and right).
- **Sheet foot:** the bottom margin, 28px tall. It holds the cursor readout on the left and the legend on the right, both outside the map.
- **Over-map chrome:** zoom (top-left), the selection bar (top centre), the straight-line notice (top-left, beside zoom), the inspector (top-right, 380px), the download toast (top-right, 330px).

## Elevation & Depth

The sheet is flat. Depth goes only to things that float over the map. Panels, rows and blocks use rules and tonal grounds, never shadows.

- **Pop** (`0 6px 24px rgba(28,33,30,.16), 0 1px 3px rgba(28,33,30,.12)`): the inspector, Leaflet popups, the download toast, the optimizing label.
- **Bar** (`0 2px 8px rgba(28,33,30,.14)`): the on-map selection bar.
- **Marker lift** (`drop-shadow(0 1px 1.5px rgba(0,0,0,.35))`, depot `0 2px 3px`): map symbols, so they read on any tile.

**The Floating-Only Rule.** A shadow means the element floats over the map. Anything docked to the sheet stays flat.

## Shapes

Corners are gently radiused: 4px for tags, segmented options and small notices, 6px for buttons, inputs and rows, 10px for floating panels, banners and empty states. Tracks and bars are near-square (1px). Lines are 1px rules, except where the frame itself speaks: 1px ink outlines on floating panels, the 2px ink rule under the title bar, and the neatline. Map symbols are geometric: diamond, square, circle, a rounded-square depot with a house, and a survey crosshair for a draft point.

## Components

### Buttons
- **Primary:** hydro blue with white text, 36px (lg 42px, min-width 232px). Hover deepens to press blue; active nudges down 1px. Disabled is 0.45 opacity with a not-allowed cursor and an explanation in the title.
- **Secondary:** a field ground with a rule border; hover darkens the border to `ink-3`. Active (toggled) gets the blue wash with a blue border.
- **Ghost / xs:** transparent `ink-2` text with a 6% ink hover. The xs size (26px, condensed) is for per-route actions (PDF, Google Maps); active is the blue wash.
- **Danger:** solid `bad` for confirmations. Danger-text is red text with a wash hover.
- **Icon button:** 32px, transparent.

### Segmented control
A field ground in a 3px-padded, rule-bordered track. Options are 32px (sm 28px). The **on** state is solid ink with white text. It is a setting (city, mode, priority), not an object selection, so it is not blue. Focus is a 2px blue outline. In priority segmenteds, the option carries its priority mark.

### Tabs
Tabs are `ink-2` and turn `ink` on hover. The active tab gets a 3px blue underline, and its count chip turns blue-wash. A stale plan badge stays brown even on the active tab.

### Rows (packages, couriers)
A 4-column grid: symbol (priority mark or courier swatch), title with ID and subline, figures (condensed, right-aligned), action. Hover is a 5% ink fill. Selected is the blue wash with a 1px blue inset. Editing is a 1px `ink-3` inset. An autoservice recipient shows a wrench tag (`rtag`), which stays secondary to priority.

### Route row and stop table
Each courier row has a checkbox, a select button (swatch, name, figures), and actions (PDF, Google Maps parts). Under it is the time strip: every courier is drawn on the same 08:00–18:00 axis, with the shift band, the run bar in the courier colour, stop ticks, and late ticks in red at 16px tall. Selected is the blue wash and inset. Unselected routes dim to 0.55 opacity in the list, and on the map they fade to 0.14 and lose their stops. The selected row expands into a **stop table** on a field ground with a rule border. Its seq pill (22px, courier colour) matches the numbered circle on the map, and its ETA is bold tabular. Late and wait tags show only when ≥ 1 min.

### Inspector
A floating editor at the top-right of the map: 380px, field ground, 1px ink border, 10px radius, Pop shadow. It enters with a 0.2s rise. The title is 1.13rem/700 and the subline is the brown coordinate ("54.6872, 25.2797"). Courier colour is chosen with a radiogroup of 22px swatches; the selected swatch gets a 2px field ring plus a 2px ink ring.

### Popups and tooltips
Popups use the 10px radius and the Pop shadow. The head holds the seq pill (or, for a skipped stop, a white pill with an ink ring), the package ID at 1rem/700, and the priority mark pushed right. Under it come the recipient, the address, and a dt/dd grid (condensed labels, tabular values). Stale and skip-reason notes sit on the brown wash. Tooltips have a 1px ink border and 4px radius.

### Map markers
- **Package:** the priority mark, 22px normal or 28px on hover/select, with a white outline and a digit inside. 1 is a diamond, 2 a rounded square, 3 a circle. The selected marker gets a 2px blue outline. Autoservice adds a **wrench badge** at the top-right: a 13px (15px) ink circle with a white ring and a white wrench.
- **Stop:** a numbered circle in the courier colour, 24px (28px on hover), with a 2px white border and `inkOn` numerals. It pairs with its stop-table row.
- **Skipped:** a white circle with an ink ring and an ink ×. **Depot:** an ink rounded square with a white house. **Draft:** a blue survey crosshair with a white halo.
- **Routes:** road geometry in the courier colour at 4px (6px highlighted) over a white casing. Stale routes are dashed `6 8` at 0.4 opacity with no casing.

### Banners, notices and toasts
- **Stale banner:** in the plan panel, on the brown wash with a 10px radius, an icon, an explanation and a re-run button.
- **Straight-line notice:** a small brown-wash notice on the map reading "Kelių geometrija nepasiekiama – rodomos tiesės". It appears whenever a route lacks road geometry.
- **Selection bar:** a white bar with an ink border at the top centre of the map: swatch, "Rodomas tik {name}", and "Rodyti visus".
- **Optimizing:** a 3px blue sweep across the top of the stage, plus an ink label pill.
- **Download toast:** 330px, Pop shadow, `role="status"`. It reads "Atsisiunčiama N iš M", shows a 4px blue progress bar, a multi-file permission hint, a ZIP fallback link and any failures in red. It auto-closes after 7s when everything succeeded.
- **Alert:** an error on the red wash with a 10px radius.

### Motion
Easing is `cubic-bezier(0.16, 1, 0.3, 1)`. State changes take 0.12–0.15s; bar widths 0.2–0.3s; the inspector and toast rise in 0.2s; a draft marker drops in at 0.25s (from scale 1.6). Under `prefers-reduced-motion`, entrances and transitions are removed, the progress sweep becomes a static 0.6 blue bar, and the spinner slows to 2s.

## Do's and Don'ts

### Do:
- **Do** pair every colour with a second code: the priority mark has shape and digit, a courier has name and stop numbers, the stale state has text and a dashed line.
- **Do** keep focus visible: a 2px blue outline (offset 2px); inputs get a blue border plus a 3px blue-wash ring.
- **Do** use the same priority SVG (`priorityMarkSvg`) wherever priority appears: map, legend, list, form, popup.
- **Do** set figures in Barlow Semi Condensed with tabular numerals, right-aligned.
- **Do** say it in text when the map is degraded (straight lines, stale plan). Never let it fail silently.
- **Do** keep chrome in the sheet margins (readout, legend, coordinates), not floating over the map.
- **Do** write all copy in Lithuanian logistics vocabulary, with times as HH:MM.

### Don't:
- **Don't** use blue for status, information or decoration.
- **Don't** add a courier colour from the red, yellow, grey or blue families.
- **Don't** retune the priority colours. The PDF uses the same values.
- **Don't** put shadows on docked panels or rows. Shadows are for things that float over the map.
- **Don't** show the map in full colour. Tiles stay desaturated so routes and symbols lead.
- **Don't** signal staleness in red. Red is for late, overload, errors and destruction.
