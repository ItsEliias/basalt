# Basalt — UI Design Contract

**Purpose:** the binding spec for implementing Basalt's UI. The prototype (`basalt-app-prototype.html`, v11.1) is the visual source of truth — when this document and the prototype disagree, the prototype wins, **except** for the type sizes, text colors, border color, bar thicknesses, and touch-target rules in §1–3 below: the 2026-08-22 legibility revision deliberately supersedes the prototype's smaller/dimmer static-mockup values for those specific properties (device feedback: too small, too dim, too fiddly to tap). The prototype file itself is unchanged and still shows the pre-revision numbers — treat this document as authoritative for legibility/touch-target properties until the prototype is regenerated to match. Everything else about the prototype (layout, components, honesty rules, forbidden list) still wins on conflict as before. Any screen not in the prototype must be composable from the components below. **Do not invent new visual language** beyond what's specified here.

## 1. Tokens

```
--bg:        #0F1115   app canvas (never pure black, never lighter)
--surface:   #16181D   cards
--surface2:  #1B1E24   nested/raised elements (timers, sheets, inputs)
--border:    #262B34   hairlines — 1px, solid, everywhere (OLED-safe floor)
--border2:   #2A2F38   interactive borders (buttons, inputs, chips)
--ink:       #F4F5F6   primary text & hero numerals
--ink2:      #C2C8D2   secondary text
--mute:      #9AA3AF   labels, units
--faint:     #7A828E   metadata, disabled, ghost values

--protein:   #C08432   protein · strength · training volume
--carbs:     #3E9B78   carbs · movement · positive delta · "on pace"
--fat:       #BE5540   fat · caloric load · caps exceeded · destructive
--recovery:  #5E72E4   recovery · sleep · water · mind
--recovery-deep:  #3B4BC8   (sleep stage: deep)
--recovery-light: #8B99F0   (sleep stage: light)
```

These four accents are CVD-validated on `#16181D` (OKLCH dark band, Machado 1.0, ≥3:1 contrast). **Do not add hues, do not brighten, do not use accents decoratively** — an accent appears only when it encodes its domain or a state. The remaining CVD floor-band pair (fat↔carbs, ΔE 7.5) is legal only because bars carry 2px surface gaps and values are always directly labeled — keep both mitigations.

**Contrast floor (2026-08-22 legibility revision):** every text token (`--ink`, `--ink2`, `--mute`, `--faint`) clears 4.5:1 against *both* `--bg` and `--surface` — `--surface` is the harder constraint since it's the lighter of the two. `--faint` is the tightest, ~4.5–4.8:1 by design (it's still the "quiet" tier); the other three clear it with wide margin. Pinned in `packages/ui/src/tokens.test.ts`. This revision moved every text color lighter and moved `--border` lighter for OLED survival — do not move any of them back down without re-running that test.

## 2. Typography

Sans: system neo-grotesque (`-apple-system / Inter / Segoe UI / Roboto`). Mono: `ui-monospace / SF Mono / JetBrains Mono` for **every numeral, timestamp, unit, and micro-label** — no exceptions. Columns of numbers use `font-variant-numeric: tabular-nums`; large standalone heroes use proportional figures. Hero numerals: 50–64px, weight ~640, letter-spacing −.03em, one per screen maximum — unchanged by the legibility revision below. Text never wears a data color except derived states (over-cap in `--fat`, on-pace in `--carbs`).

**Type floor (2026-08-22 legibility revision):** nothing in the app renders below 11px except two named exceptions that still moved up from their old 9.5px. Device feedback: too small, too dim, too fiddly to tap — the design language stays, the floors came up.

| Role | Old | New |
|---|---|---|
| Body text, receipt/row names | 13 | 14 |
| Right-aligned mono values (receipt value, set kg/reps) | 13 | 15 |
| Receipt/row meta line | 10.5 | 11.5 |
| Micro-labels (section headers, mono caps, `--mute`) | 9.5–10 | 11 |
| Chip labels, sub-nav (seg) labels | 9.5–10 | 11 |
| Srcnote footers (mono caps, `--faint`) | 9.5 | **10.5** (named exception) |
| Bottom tab-bar labels | 9.5 | **10.5** (named exception) |
| Hero / guided-timer numerals | 50–64 | unchanged |

Pinned in `packages/ui/src/tokens.test.ts`. Micro-labels keep 600 weight, 0.12em letter-spacing, uppercase, `--mute`.

**Font scaling:** `allowFontScaling` stays on (the default) everywhere so the OS accessibility text-size setting is respected — nothing in the app opts out of it globally. Two exceptions are capped, not disabled, at `maxFontSizeMultiplier={1.3}` so layouts hold at the largest system sizes: hero/guided numerals, and mono-tabular table columns (sets table, macro ratios, timer countdown, micro-nutrient bars). Everything else scales freely with the user's system setting. Settings → Display's own text-size preference (System/+1/+2) layers a small additional multiplier (1.0/1.08/1.16) on top of OS scaling for body text, row names/meta, and micro-labels/srcnotes — not on hero numerals or mono table columns, which stay anchored.

**Touch targets:** every tappable clears Android's 48dp minimum via `hitSlop`, not by growing the visible element — chips, sub-nav tabs, receipt rows, +/− steppers, the settings gear, and the water-tick row (one tap target for the whole row, not per-tick) all carry it. The visual size the prototype specifies is unchanged; only the invisible tap boundary grew.

**Density:** Settings → Display's Comfortable/Compact toggle adds +4dp vertical padding to every card and receipt row when Comfortable (the default for new installs). Compact restores the metrics above exactly.

## 3. Components (all exist in the prototype — copy them)

Card (surface, 1px border, radius 14, padding 16, +4dp when density=comfortable) · micro-label header row with right-aligned mono summary · **receipt row** (name + mono meta line left, right-aligned mono value + unit; 1px hairline separators; optional 30px thumb; +4dp vertical padding when density=comfortable) · meal-tag section headers (mono caps, not containers) · macro row (dotkey + name + `142 / 180 g` ratio + **4px** bar) · cap row (over-state: bar 100% in `--fat`, ratio text `--fat`, "· 5 over") · segmented macro stack (6px, 2px gaps) · stat tile (2-col grid, label + em source + mono value + delta + 26px sparkline) · water ticks (**18px**, 2.5px radius, 3px gap, whole row is one 48dp tap target) · sub-nav (`.seg` — mono caps, **2px** underline active) · chips (single-select rows + multi-select groups) · sets table (Set / Prev(ghost) / kg / Reps / RIR; PR mark in `--carbs`) · rest timer bar (surface2) · guided set timer (hero countdown, phase label, progress bar, set ticks, GO/STOP) · body map (thin-line SVG figures, fill-opacity = intensity, `--protein`) · sleep stage bar (26px segments, 2px gaps, indigo ramp + #3A4048 awake) · splits row (km + **4px** pace bar + mono pace + elevation) · micro row (2px bar, `--mute` fill, `--carbs` when target met — unchanged, distinct from the 3→4px bar family) · viewfinder (radial dark bg, 1.5px reticle corners, animated scanline, mono hint) · map card (dark tile, hairline street grid, 3px route in `--carbs`, LIVE pulse, scale bar) · consistency calendar (9px dots: filled/part/today-outline/future) · onboarding kit (ob-opt single/multi with round/square marks, ob-input, chip-label rows, dots progress) · quick-log sheet (bottom sheet, 3×3 mono-labeled grid) · srcnote (10.5px mono caps `--faint` — the honesty footer on every data card) · **bottom tab bar** (5 line icons, 1.5px stroke, above 10.5px mono-caps labels — no emoji, no filled icons).

## 4. Interaction rules

Every logging action ≤2 taps from the + sheet. Water +250 commits instantly with no confirmation screen. Set completion is a typographic state change — **no confetti, no bouncy checkmarks**. Timers: haptic pulse on phase change is primary; sound optional-off; legible at arm's length; keep running with screen off (Live Activity / foreground service); **every timed surface shows an unmistakable running state** (phase + countdown + session progress — a glance must answer "is this moving"). **Transition floor (2026-08-31):** any auto-advancing timed sequence gives at least `MIN_TRANSITION_S = 10` seconds to get into position, user-settable upward, engine-enforced (`guided-timer.ts`); protocol-defined work:rest cycles (Tabata's 20/10) are training structure, not transitions, and stay verbatim; an explicit zero lead-in ("work on tap") is user-initiated and exempt. Previous values are ghosted defaults, editable in place. Tab switch resets scroll; sub-nav switch preserves tab. View transitions: 180ms fade+4px rise, nothing springier.

## 5. Honesty rules (product-level, non-negotiable)

Real-or-hidden: no data → quiet typographic empty state ("No glucose data recorded for this period"), never a zero, never a placeholder chart. AI-derived values wear `~` until user-confirmed; AI flow is always capture → editable suggestion → confirm. Over-cap states are stated plainly ("41 / 36 g · 5 over") — never hidden, never scolded. Dietary conflicts are flagged with a swap suggestion, never filtered out silently. Correlations show their stats (`r`, `n`, threshold) plus a "checked, not shown" list; always "correlation, not cause". Streak gaps stay gray — no flames, no broken-streak shaming, dual milestones (streak + lifetime); rest days maintain training runs per the published rule (readiness-advised or planned rest counts; rest never *starts* a run — `streaks.ts`). Every synced datum shows its source (`SOURCE · GALAXY WATCH VIA HEALTH CONNECT`). Published formulas: any score links to its inputs and math.

### Amendment (2026-08-31) — five product laws from the competitive audit

Each carries the one-line reason it exists; the failures named are real, shipped failures
in this category, not hypotheticals.

1. **Capture is never paywalled.** Barcode, photo, voice, manual entry, export, and media
   transport controls (pause included) are permanently free. *Why: barcode-scan paywalls
   and a paywalled pause button are the category's most-hated moves — capture is the
   ledger's front door, and charging for the door poisons everything behind it.*
2. **No capture modality is ever mandatory.** Photo/AI/voice/barcode are lanes; manual
   entry is the floor and can never be removed or demoted to unreachable. *Why: a major
   competitor removed food search in Aug 2026 and users who log after eating simply
   couldn't log at all.*
3. **AI proposes, never narrates.** No AI summary of completed activity, ever — the
   ledger speaks for itself. AI may only propose a next action the user confirms. *Why:
   narration AI was uniformly rejected across the category; intervening AI was uniformly
   welcomed. This subsumes the existing "no AI summaries that displace data" ban and goes
   further: none at all.*
4. **Graded uncertainty.** Unconfirmed AI estimates display as low–high ranges, not
   points; confirming collapses to the user-accepted value. Charts visually distinguish
   measured/logged values (solid) from modelled/inferred values (dashed or banded). The
   `~` prefix survives as the inline shorthand. Range width comes from the model, never
   invented client-side. *Why: a tight wrong point is a lie with confidence; an honest
   range that contains the truth beats it every time.*
5. **Sleep stages are display-only.** Stages may be shown (coarse taxonomy, source
   named, accuracy ceiling stated) but never enter any score, suggestion, or derived
   number. Any composite Basalt ever ships publishes its weights. *Why: consumer staging
   runs κ 0.21–0.53 against PSG — dressing that up as an input is fabricated precision,
   and publishing weights is already this app's own standard (readiness).*

## 6. Forbidden

Rings/circular gauges · mascots, emoji in UI copy, motivational cheerleading ("You're crushing it!") · XP/levels/coins/badges-as-currency · big rounded card diaries (MFP-style) · dashboard-as-forced-home · upsells inside onboarding, countdown timers, pre-selected annual plans, ads to paying users · bright color without semantic meaning · AI summaries that displace data · localStorage in web builds.

**Glow, neon, glassmorphism, heavy shadows, new fonts, new hues, new radii** are forbidden
*per theme* (Minimal's own values are unchanged — the prototype is still its source of
truth), not forbidden absolutely. See the amendment below for why, and
`packages/ui/src/theme/contract.ts` / `docs/basalt-theme-contract.md` for what actually
governs a theme now.

### Amendment (2026-08-26) — scoping the visual-language bans per theme

These bans existed as a **proxy** for protecting text contrast — no principled way existed
to check whether a glow, a heavy shadow, or an off-palette hue would leave type unreadable,
so the spec forbade the whole category. The six-theme contract now asserts the actual
property directly, per theme, not per a single fixed palette: every `text.*` clears 4.5:1
on every surface, every `fill.*` clears 3.0:1, every on-colour clears 4.5:1 against its own
fill — enforced by `themeConformance.test.ts` across all six themes, not just Minimal.
Scoping the bans per theme is acceptable **precisely because** those assertions exist now;
without the contract and its tests, this amendment would not be justified.

This is not "the forbidden list no longer applies" — it is one theme (or a documented
group of themes) declaring a specific, contract-verified exception, recorded here rather
than silently violated:

- **Depth** uses `shape.elevation: 'blur'` (translucent cards over an ambient gradient
  ground) — a glassmorphism exception. **Caveat, not fully closed by this contract:**
  `themeConformance.test.ts` checks contrast against Depth's *flat* surface colours: a
  representative sample, not the actual gradient a card sits over on-device, whose
  effective backdrop varies by position and content. The test is necessary but not
  sufficient for Depth — passing it does not by itself prove the blur reads on a real
  device. Depth needs a device contrast check before it's called done, independent of
  the automated suite.
- **Brutalist** uses `shape.elevation: 'hardShadow'` (a flat, non-blurred drop shadow,
  distinct from the soft/glow shadows the ban originally targeted) and `accentRole:
  'ground'` (its yellow accent is a surface, not a mark).
- **Every non-Minimal theme** uses its own typography (`typography.ui/data/display`),
  hue palette (`surfaces`/`text`/`fill`), and radius scale (`shape.radius`) — the contract
  is what keeps six palettes one system rather than six forks: "if a theme needs a
  component override, the contract is missing a token — add the token, never branch the
  component."

**Accessibility corrections recorded alongside this amendment** (not aesthetic changes):
the pre-contract palette validated `--fat` and `--recovery` at the 3:1 graphical threshold,
correct for bars but not for the over-cap ratio, which renders as *text* — `--fat #BE5540`
scored as low as 3.63:1 as text on `surface2`, `--recovery #5E72E4` as low as 3.98:1. The
contract's `text.*` vs `fill.*` split fixes this: `text.fat`/`text.recovery` now clear 4.5:1
everywhere, `fill.fat`/`fill.recovery` keep the original 3:1-verified values for graphical
marks. A third, related correction the same per-surface checking caught: `--faint` (labels,
metadata, ghost values) cleared 4.5:1 on `bg` and `surface` but only 4.30:1 on `surface2`
(nested/raised elements) — `text.faint` is now `#848C98`, which clears all three. The
*fill* use of the same colour (a cap bar's neutral/under-cap state, which only needs 3.0:1)
keeps the original `#7A828E` unchanged — see `fill.faint` in the contract.

## 7. Reference files

`basalt-app-prototype.html` (v11 — source of truth: all components live, 5 tabs + settings + 8-step onboarding) · `basalt-master-roadmap.md` (scope & phasing) · `basalt-feature-adoption-matrix.md` (feature detail + sources) · `health-app-migration-report.md` (code audit: what ports from Arise/Oathbound) · `ui-benchmark-review.md` (market rationale).

**Implementation note for React Native:** tokens become the theme object consumed via the `ThemeProvider` pattern from `packages/ui-primitives` (keep the token-generic approach, rewrite the components). Hairlines: `StyleSheet.hairlineWidth` where 1px is intended. Mono stack maps to `Menlo`/`monospace` platform defaults or bundled JetBrains Mono. SVG components (sparklines, body map, stage bar, map) via `react-native-svg` — already a dependency.
