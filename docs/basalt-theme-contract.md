# Basalt — Theme Contract

Six themes ship as **one system**, not six implementations.

> **The rule:** if a theme needs a component override, the contract is missing a token.
> Add the token. Never branch the component.

## Why the contract is wider than colour

Three themes (Atelier, Depth, Brutalist) look like forks under a colour-only token set.
They are not. They were failing on four tokens that did not exist:

| Token | Rescues | How |
|---|---|---|
| `typography.data` | **Atelier** | Cormorant for chrome, a lining mono for the set table. Serif figures are unreadable in a five-column grid; this splits the two jobs. |
| `shape.elevation` | **Depth, Brutalist** | `blur` and `hardShadow` become values of one component, not two forks. |
| `shape.container` | **Atelier, Athletic** | `bare` groups with rules instead of cards. |
| `shape.align` | **Atelier** | The only theme that centres its body. |

## Colour is split by use, not by name

```
fill.*   graphical marks (bars, dots, tiles)   >= 3.0:1 on every surface
text.*   rendered type                          >= 4.5:1 on every surface
```

The same hue usually needs two values.

**This split fixes a live defect.** The pre-contract palette validated accents at >= 3:1,
which is correct for bars. But the over-cap state renders its ratio *in* `--fat`, making it
type. Measured on the old values:

| Token | Surface | Ratio | Verdict |
|---|---|---|---|
| `--fat #BE5540` | `#0F1115` | 4.11 | fail |
| `--fat #BE5540` | `#16181D` | 3.86 | fail |
| `--fat #BE5540` | `#1B1E24` | 3.63 | fail |
| `--recovery #5E72E4` | `#16181D` | 4.23 | fail |
| `--recovery #5E72E4` | `#1B1E24` | 3.98 | fail |

The single state the honesty rules care most about was the one failing contrast. Phase 1
missed it because it tested `ink / ink2 / mute / faint`, not the accents.

## Token groups

### `surfaces`
`bg` · `surface` · `surface2` · `border` · `borderStrong`

### `text` — all >= 4.5:1
`ink` · `ink2` · `mute` · `faint` · `accent` · `protein` · `carbs` · `fat` · `recovery` · `warn`

### `fill` — all >= 3.0:1
`accent` · `accentOn` · `mark` · `markOn` · `faint` · `protein` · `carbs` · `fat` · `recovery` · `warnBg`

`faint` is the neutral/unfilled state of a graphical mark (a cap bar's track before it's
over) — added in Step 1 when the macro-row migration needed it and found the contract
didn't have one. Distinct from `text.faint`: reusing the text value here would be a
stronger (and for Minimal, unwanted) visual change than a 3.0:1 mark actually needs.

`accentRole: 'ground'` exempts `fill.accent` from the mark test — Brutalist's yellow *is* a
surface, so testing it as a mark on a surface is the wrong test. `accentOn` and `markOn` are
text drawn on a fill, not marks meant to read against the app background — they're checked
against their own fill (invariant 3) instead of every surface.

### `typography`
`ui` · `data` · `display` · `scale` (8 fixed steps) · `weight` · `tracking` · `labelCase`

### `shape`
`radius` · `borderWidth` · `container` (`card|bare|boxed`) · `elevation`
(`none|border|hardShadow|blur`) · `meter` (`bar|pill|line|stepped`) · `align` (`left|center`)

### `expression`
`overCap` (`color|fill|word|all`) · `emptyState` · `nav` · `rowMinHeight`

## Invariants — asserted for all six

1. Every `text.*` clears **4.5:1** on `bg`, `surface` and `surface2`.
2. Every `fill.*` clears **3.0:1** on every surface (except a `ground` accent).
3. `fill.accentOn` clears 4.5:1 on `fill.accent`; `fill.markOn` clears 4.5:1 on `fill.mark`.
4. No type step below **11**.
5. `rowMinHeight` >= **48**.
6. `overCap` is never `'color'` — colour alone fails WCAG 1.4.1 and fails the honesty rule
   that over-cap is stated plainly.
7. `allowFontScaling` honoured except hero numerals and mono columns, capped at 1.3x.
8. Every theme implements every key. A missing token is a failing test, not a fallback.

## Making six affordable

Six manual QA passes per feature is the real cost. Convert them to assertions:

- `themeConformance.test.ts` loops all six — contrast runs 6x automatically.
- The conformance test stops theme six drifting from theme one.
- Snapshot each of Today / Log / Session / Trends per theme (24 snapshots).
- One **device** pass per theme, not per screen. Automate the measurable part so the human
  pass is only about whether it feels right.
