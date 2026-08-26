# Basalt — Surface Layouts

Layout is a **per-surface** preference, not one global setting.

```ts
type SurfaceLayouts = {
  today:   'ledger' | 'tiles';   // v1 — ships now
  session: 'table'  | 'focus';   // specced, NOT built
  trends:  'chart'  | 'table';   // specced, NOT built
  // log: no second layout — see below
};
```

One column per surface (`today_layout` now; `session_layout`, `trends_layout` later) so
adding a surface is a new value, never a refactor. Layout is orthogonal to theme: no
theme-specific layout code anywhere.

## The rule for adding a layout

> A surface earns a second layout only when its content has **more than one genuinely valid
> shape**. Symmetry is not a reason.

| Surface | Content shape | Second layout? |
|---|---|---|
| **Today** | Independent scalar metrics | **Yes** — each metric is self-contained, so a grid of cells is a real alternative to a stacked ledger |
| **Session** | Repeated rows, fixed columns | **Yes, later** — `focus` shows one set at a time at size, better mid-set than a five-column grid |
| **Trends** | Time series | **Yes, later** — and the strongest case is accessibility: a chart has no good non-visual equivalent, a table is one |
| **Log** | Search + list + quantity form | **Considered and rejected** — see below |

### Why tiles does not generalise

Tiles suits Today because Today is scalars. Elsewhere it fails for content reasons, not
styling: you cannot tile a text input, tiling a set table destroys the column alignment that
makes it readable, and tiling charts makes each too narrow to read.

### Log — rejected option, recorded so it is not re-proposed

`recents-first` (quick-repeat grid at top, search demoted to the foot) was evaluated. The
argument for it is real — most logging is re-logging, and it costs nothing structurally,
being the same components in a different order. It was **rejected for this batch** as
lower value than the other work in flight, not because it is a bad idea. If Log ever gets a
second layout, this is the one.

## v1 scope — Today only

- **Ledger** — the current stacked-section view. Handles arbitrary-length content.
- **Tiles** — a grid of single-metric cells, each tappable, drilling into the matching
  ledger section.

Log, Session, Trends and Settings are **ledger-only in v1**.

### Tiles content model (fixed in v1)

| Slot | Metric | Span | Empty behaviour |
|---|---|---|---|
| 1 | Energy remaining | full | always present |
| 2 | Protein | half | hide if no target set |
| 3 | Steps | half | honest empty state if no source |
| 4 | Sleep | half | honest empty state if no source |
| 5 | Water | half | hide if hydration disabled |
| 6 | Training | full | "Rest day" or session name |

Fixed order. User-configurable tiles are a later feature — do not build reordering now.

**Empty tiles follow real-or-hidden.** No data shows the theme's `expression.emptyState`
treatment, never a zero. A metric the user switched off is removed from the grid entirely.

## How a layout reads the theme

Layout components take **no** theme-specific code:

| Token | Effect on a tile |
|---|---|
| `shape.container` | `card` filled · `bare` rules only · `boxed` bordered |
| `shape.elevation` | `border` · `hardShadow` (Brutalist) · `blur` (Depth) · `none` |
| `shape.radius.md` | Tile corner |
| `typography.display` | Tile numeral |
| `typography.data` | Secondary value and delta |
| `shape.align` | Atelier centres tile contents; everything else left |
| `expression.overCap` | How an over-cap tile states itself |
| `fill.mark` / `fill.markOn` | Any filled element and its label |

If a layout component needs `theme.id === '...'`, the contract is missing a token.

## Later surfaces — specced, not scheduled

**Do not build these in this batch.**

### Session · `focus`
One exercise, one set at a time: large target numbers, previous-set ghost, RIR as a tap row,
rest timer in place. Better at arm's length mid-session; worse for reviewing a whole session.
Needs no new tokens.

### Trends · `table`
The same series as dated rows with values and deltas. Better for exact figures and for screen
readers; worse for shape. Needs no new tokens.
