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

Every logging action ≤2 taps from the + sheet. Water +250 commits instantly with no confirmation screen. Set completion is a typographic state change — **no confetti, no bouncy checkmarks**. Timers: haptic pulse on phase change is primary; sound optional-off; legible at arm's length; keep running with screen off (Live Activity / foreground service). Previous values are ghosted defaults, editable in place. Tab switch resets scroll; sub-nav switch preserves tab. View transitions: 180ms fade+4px rise, nothing springier.

## 5. Honesty rules (product-level, non-negotiable)

Real-or-hidden: no data → quiet typographic empty state ("No glucose data recorded for this period"), never a zero, never a placeholder chart. AI-derived values wear `~` until user-confirmed; AI flow is always capture → editable suggestion → confirm. Over-cap states are stated plainly ("41 / 36 g · 5 over") — never hidden, never scolded. Dietary conflicts are flagged with a swap suggestion, never filtered out silently. Correlations show their stats (`r`, `n`, threshold) plus a "checked, not shown" list; always "correlation, not cause". Streak gaps stay gray — no flames, no broken-streak shaming, dual milestones (streak + lifetime). Every synced datum shows its source (`SOURCE · GALAXY WATCH VIA HEALTH CONNECT`). Published formulas: any score links to its inputs and math.

## 6. Forbidden

Rings/circular gauges · glow, neon, glassmorphism, heavy shadows (the single phone-frame shadow on desktop is the only shadow) · mascots, emoji in UI copy, motivational cheerleading ("You're crushing it!") · XP/levels/coins/badges-as-currency · big rounded card diaries (MFP-style) · dashboard-as-forced-home · upsells inside onboarding, countdown timers, pre-selected annual plans, ads to paying users · bright color without semantic meaning · AI summaries that displace data · localStorage in web builds · new fonts, new hues, new radii.

## 7. Reference files

`basalt-app-prototype.html` (v11 — source of truth: all components live, 5 tabs + settings + 8-step onboarding) · `basalt-master-roadmap.md` (scope & phasing) · `basalt-feature-adoption-matrix.md` (feature detail + sources) · `health-app-migration-report.md` (code audit: what ports from Arise/Oathbound) · `ui-benchmark-review.md` (market rationale).

**Implementation note for React Native:** tokens become the theme object consumed via the `ThemeProvider` pattern from `packages/ui-primitives` (keep the token-generic approach, rewrite the components). Hairlines: `StyleSheet.hairlineWidth` where 1px is intended. Mono stack maps to `Menlo`/`monospace` platform defaults or bundled JetBrains Mono. SVG components (sparklines, body map, stage bar, map) via `react-native-svg` — already a dependency.
