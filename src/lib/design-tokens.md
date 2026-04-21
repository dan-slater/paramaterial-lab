# paramaterial · design tokens

A one-page reference for the "lab-report" design system introduced in v0.1.4.
All tokens live in `src/app.css` under `@theme { … }` (Tailwind v4 CSS-native
syntax). Components consume tokens via CSS custom properties or Tailwind
utility classes like `font-serif`, `text-plasma-400`, etc.

---

## Direction

The app is a **live engineering report**. Reading should feel like reading an
academic paper: a bold serif title, an italic caption, and a figure or table
that follows. Interactive controls should feel clean and modern, never loud.

Reserved palettes keep that separation crisp:

- **Plasma** — data viz only (curves, scatter points, axis accents).
- **Warm slate ("chrome")** — every interactive UI surface (buttons, borders,
  chips, focus rings). Muted, not saturated.
- **Serif (Source Serif 4)** — long-form prose, block titles, captions.
- **Sans (Inter)** — UI controls, table cells, numeric readouts.

---

## Fonts

| Token          | Purpose                      | Family                  |
| -------------- | ---------------------------- | ----------------------- |
| `--font-sans`  | UI controls, tables, numbers | `Inter`, system-ui      |
| `--font-serif` | Titles, captions, prose      | `Source Serif 4`, Georgia |
| `--font-mono`  | IDs, keys, `test_id` values  | `ui-monospace`          |

Source Serif 4 is loaded from Google Fonts in `src/app.html` (one extra
request, acceptable). Supports optical sizing from 8 to 60 plus an italic axis.

## Type scale

Purposeful line-heights (tight for display, generous for prose):

| Token         | Size       | Leading | Use                          |
| ------------- | ---------- | ------- | ---------------------------- |
| `--text-xs`   | 11px       | 16px    | captions, eyebrows           |
| `--text-sm`   | 13px       | 19px    | helper text, chips           |
| `--text-base` | 15px       | 1.55    | body prose (serif)           |
| `--text-lg`   | 17px       | 1.5     | secondary headings           |
| `--text-xl`   | 20px       | 1.35    | sub-figure titles            |
| `--text-2xl`  | 24px       | 1.3     | block titles                 |
| `--text-3xl`  | 30px       | 1.2     | report masthead              |

## Spacing

4-pt rhythm via Tailwind's v4 `--spacing: 0.25rem`. Use semantic multiples
(`gap-2`, `gap-4`, `gap-6`) consistently — never ad-hoc half-steps.

## Radii

| Token           | Px  | Use                        |
| --------------- | --- | -------------------------- |
| `--radius-sm`   | 4   | chips, swatches            |
| `--radius-md`   | 6   | inputs, buttons            |
| `--radius-lg`   | 10  | **cards (default)**        |
| `--radius-xl`   | 14  | tool palette, modals       |

## Shadows

| Token           | Recipe                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `--shadow-sm`   | `0 1px 2px rgb(0 0 0 / .2)`                                            |
| `--shadow-md`   | `0 4px 10px rgb(0 0 0 / .28)`                                          |
| `--shadow-card` | inset top-highlight + subtle drop (`inset 0 1px 0 #ffffff0a`, tiny y)  |

## Colors

### Plasma (data viz)

`--color-plasma-50` … `--color-plasma-950`, a perceptual purple→yellow ramp.
Used for stress-strain curves, scatter points, and callouts in body prose
(e.g., the current colorBy value). **Never** use for a button background or
border — reserve for data ink.

### Chrome / warm slate (UI)

`--color-chrome-50` … `--color-chrome-950`. A warm-tinted slate. Used via the
semantic `--accent-ui` and `--accent-ui-strong` vars so that the same component
looks right in both dark and light themes.

### Semantic surfaces

These swap between themes via `[data-theme]` selectors in `app.css`.

| Token                 | Dark           | Light          | Role                         |
| --------------------- | -------------- | -------------- | ---------------------------- |
| `--surface-page`      | `#0b0a09`      | `#faf8f3`      | root background              |
| `--surface-raised`    | `#141310`      | `#f3efe4`      | header, tool palette         |
| `--surface-card`      | `#15130f`      | `#fffdf7`      | report cards                 |
| `--surface-sunk`      | `#0a0907`      | `#ffffff`      | plot/table frame             |
| `--surface-chip`      | `#201c16`      | `#efeadb`      | chips, table headers         |
| `--border-default`    | `rgb(255 .07)` | `rgb(60 .14)`  | card + input borders         |
| `--border-strong`     | `rgb(255 .12)` | `rgb(60 .25)`  | menus, hover                 |
| `--text-primary`      | `#efece4`      | `#1b1a15`      | body text                    |
| `--text-secondary`    | `#bcb5a3`      | `#4e4a3d`      | captions, sub-titles         |
| `--text-muted`        | `#7e7865`      | `#807a68`      | table meta, axis labels      |
| `--text-subtle`       | `#555042`      | `#a8a290`      | disabled, empty states       |
| `--accent-ui`         | chrome-400     | chrome-600     | hover ring, eyebrow color    |
| `--accent-ui-strong`  | chrome-300     | chrome-700     | focus ring, active state     |
| `--paper-texture`     | noise overlay  | noise overlay  | body background texture      |

## Theme toggle

`document.documentElement` carries `data-theme="dark"` (default) or
`data-theme="light"`. Choice persists in `localStorage` under
`paramaterial:theme:v1`. Applied before first paint via a tiny inline script in
`app.html` to prevent flash.

## Usage rules

- **Plasma is for data.** Use `--color-plasma-400/500/600` on curves, scatter
  points, inline badges that refer to a live value. Do not use plasma for a
  primary button border or hover background.
- **Chrome is for chrome.** Buttons, card borders, focus rings, dropdown
  hovers. The reader's eye should never be drawn to the UI before the figure.
- **Serif is for sense.** Use `font-family: var(--font-serif)` for block
  titles (`h2.block-title`), the report masthead (`h1.report-title`), italic
  captions, the note textarea. Everything else is Inter.
- **`caption-eyebrow` before every block.** Sets the "FIGURE 3 · STRESS–STRAIN"
  small-caps pattern. The figure number itself is emitted by `BlockRenderer`.
- **Numbered captions.** BlockRenderer categorises each block:
  - `stress-strain`, `foot-correction`, `representative-curves`, `scatter`,
    `ramberg-osgood`, `zener-hollomon` → **Figure N**
  - `property-table`, `dataset-summary` → **Table N**
  - `note` → **Note N**

## Example: a typeset block

```
──────────────────────────────────────────────────────────────────
FIGURE 3                                                      #4  ▲▼⎘✕
STRESS–STRAIN

All tests: stress vs strain                         ← serif, 24px
    120 curves, color-mapped by temperature.        ← serif italic caption
                                                    ← controls (sans)
    ┌─ plot (uPlot, inter axes, plasma strokes) ─┐
    │                                            │
    └────────────────────────────────────────────┘
    Hover a curve for details · click to isolate.
──────────────────────────────────────────────────────────────────
```

## Print (`@media print`)

- `@page { size: A4; margin: 18mm 16mm; }`
- `header`, `aside`, `#tool-palette`, block toolbars → hidden
- Every `article` gets `break-inside: avoid` + `widows: 3; orphans: 3`
- Exported HTML report (`ExportMenu.printReady`) uses Source Serif 4 + Inter
  via Google Fonts, cream paper background, small-caps table headers.

## Example components

```html
<!-- Eyebrow + serif title + italic caption -->
<p class="caption-eyebrow">Figure 2 · Parameter scatter</p>
<h2 class="block-title text-2xl">UTS vs temperature</h2>
<p class="caption-note">28 points from basic-usage preset.</p>

<!-- Ghost button (chrome, not plasma) -->
<button
  class="rounded-md border px-2 py-1 text-xs transition-colors"
  style="border-color: var(--border-default); color: var(--text-secondary);"
>
  Template ▾
</button>

<!-- Stat card -->
<div
  class="rounded-md border px-3 py-2"
  style="background: var(--surface-sunk); border-color: var(--border-default);"
>
  <p class="caption-eyebrow" style="font-size: 10px;">E</p>
  <p class="mt-1 text-lg font-semibold tabular-nums">69420</p>
</div>
```
