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
· `domainGround?` · `domainGroundOn?` (V3.4, theme-scoped: pastel tile ground + on-colour
per domain, pair-checked at 4.5:1 because the on-colour is text)

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
`radius` (`none|sm|md|lg|pill`) · `borderWidth` · `container` (`card|bare|boxed`) ·
`elevation` (`none|border|hardShadow|blur` + theme-scoped `softShadow|clay|halo|gloss`
with `elevationParams`) · `tilt` (degrees, ≤ 2°, 0 with a mono data face) · `meter`
(`bar|pill|line|stepped` + theme-scoped `ticks|ring|dial|blob`) · `align` (`left|center`)

`surfaces` may also declare `gradient?` (`{from,to,angle}`, Gummy only): every text colour
is then contrast-checked against BOTH ends.

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
9. (V3.4) `domainGround`/`domainGroundOn` pairs clear 4.5:1; a `surfaces.gradient` carries
   every text colour at both ends; `meter: ring|dial` forces over-cap in words (a ring can
   only show 100%); `tilt` ≤ 2° and 0 on mono-data themes.

## The forbidden-list split (V3.4)

The design-spec's §6 is now two lists. Globally-forbidden items (XP, confetti, streak
shaming, fake precision, narration, hidden formulas, capture paywalls, mandatory capture
modality, scored sleep stages) bind every theme forever. Theme-scoped expression — rings,
gradients, glow/gloss, soft shadow, tilt, pastel domain grounds, halo — is legal exactly
where a theme declares the corresponding token above, and the conformance suite holds each
declaration to the honesty floor. The six original themes declare none of them; the rule
stands: **if a theme needs a component override, the contract is missing a token — add the
token, never the branch.**

## Making six affordable

Six manual QA passes per feature is the real cost. Convert them to assertions:

- `themeConformance.test.ts` loops all six — contrast runs 6x automatically.
- The conformance test stops theme six drifting from theme one.
- Snapshot each of Today / Log / Session / Trends per theme (24 snapshots).
- One **device** pass per theme, not per screen. Automate the measurable part so the human
  pass is only about whether it feels right.
