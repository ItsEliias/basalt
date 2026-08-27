# Basalt — Theme System Report

**Date:** 26–27 August 2026 · **Branch:** `m1-theme-system` (not merged, not pushed).
**Suite: 610/610 green** (ui 129, core-data 26, analytics 42, nutrition 139, training 151,
health-connect 31, app 92); `tsc --noEmit` clean in every package. Every step is its own
commit; history below.

```
46b79e7 Step 1: migrate CapRow onto the theme contract, port Minimal
8addfc0 Step 2: verify Humanist + Athletic — no new tokens needed
89aa475 Step 3: verify Brutalist + Depth, amend design-spec §6 (approved)
9157200 Step 4: verify Atelier — no new tokens, align deliberately unread
b18bf92 Step 5: Tiles Today layout, Ledger unchanged and still default
c2990f4 Step 6: Settings theme + layout picker, migration + instrumentation
1b4eb7d Expand reskin beyond Step 6's scope: core chrome is now theme-driven
74d4ce5 Bundle the nine theme typefaces; make resolveTypeface weight-aware
22ecd64 Add docs/THEME-SYSTEM-REPORT.md
a7a8982 Fix root/screen backgrounds still hardcoded to Minimal's static color.bg
fea4023 Update THEME-SYSTEM-REPORT.md with the on-device verification session
9446114 Theme progress bars: meter geometry was never migrated off Minimal
ef2d688 Depth: real ambient-glow background + glass blur cards (needs device verify)
d032f6e Depth glass blur: wire a real Android blur target, confirmed on-device
```

The commits after `74d4ce5` are not in the original six-step plan. They exist because live
on-device feedback after Step 6 showed the plan's own gate criteria hadn't actually been
met, and two follow-up on-device sessions found real bugs on top of that — see "Where this
stands, honestly" and "On-device verification" below before reading the rest as a clean
success story. Short version: as of `d032f6e`, every bug found through live device
verification (the original background bug, the missing ambient glow/glass blur, and the
never-migrated progress bars) is fixed and reconfirmed on real hardware, not just reasoned
about.

## What the contract is

`packages/ui/src/theme/` — a `Theme` interface (`surfaces` / `text` / `fill` / `typography`
/ `shape` / `expression`) with one governing rule: **if a theme needs a component override,
the contract is missing a token — add the token, never branch the component.** No
`component-name.tsx` file anywhere in this rollout contains `theme.id === '...'`.
`themeConformance.test.ts` enforces WCAG contrast across all six themes at once: every
`text.*` ≥ 4.5:1 on every surface, every `fill.*` ≥ 3.0:1, every on-colour ≥ 4.5:1 against
its own fill, no type step under 11px, `rowMinHeight` ≥ 48, `overCap` never `'color'`.

## Step 1: the Minimal port — before/after, demonstrated

CapRow (the macro cap row — Protein/Carbs/Fat/Fibre and the Added-sugar/Sodium caps) was
the first component migrated, chosen because it's the one row that exercises text colour,
fill colour, and the `overCap` wording token together. It was verified live, not asserted:
a disposable food entry was added through the real service layer to push sugar over its
cap, the over-cap CapRow was screenshotted (theme-driven "· 15 over" wording, `fill.fat`
colouring, bar to 100%) alongside the untouched Sodium row in the same frame, then the
entry was deleted and the clean state reconfirmed to match pre-migration pixels. (That
specific screenshot file did not survive this session's scratch directory intact enough to
re-attach here — `docs/DEVICE-TEST-PLAN.md`-style hardware verification of the full
expanded reskin is the pending item that supersedes it anyway; see below.)

The migration surfaced a real contract gap and a real pre-existing accessibility bug,
caught by moving from one flat palette to per-surface contrast checking:

- **New token forced: `fill.faint`.** The old flat `color.faint` did double duty as both
  the cap row's text colour and its neutral (under-cap) bar-fill colour. The contract
  splits `text.*` (needs 4.5:1) from `fill.*` (needs 3.0:1) — and there was no fill-side
  neutral colour at all. Added `fill.faint` to the contract and to all six themes. This
  was the **only** new token the entire six-theme rollout forced — every other theme (Steps
  2–4) fit the existing contract with zero additions.
- **A third accessibility correction, beyond the two the bundle's own contract amendment
  named.** `--fat` and `--recovery` were validated at the 3:1 graphical threshold, correct
  for bars but not for the over-cap ratio and any recovery figure rendered as *text*:
  `#BE5540` measured as low as 3.63:1 as text on `surface2`, `#5E72E4` as low as 3.98:1.
  Per-surface checking caught a third: `--faint` (labels, metadata, ghost values) cleared
  4.5:1 on `bg` and `surface` but only 4.30:1 on `surface2` — `text.faint` is now `#848C98`
  (was `#7A828E`). All three corrections and their measured ratios are recorded in
  `docs/basalt-design-spec.md`'s §6 amendment.

**What this means for "zero visual change."** The instruction asked for exactly two things
to differ on the Today screen: the over-cap ratio text and anywhere recovery is used as
text. In CapRow's specific scope, a *third* thing also differs — its non-over-cap "/ 55 g"
suffix text, which reads `text.faint`, shifted from `#7A828E` to `#848C98` (both readable
mid-greys; the difference is a few percent lightness, not a colour change). That's not a
missed instruction so much as the instruction's own premise being incomplete: the bundle
named two corrections, the contract's more thorough per-surface check found a third one
sitting in the same component. Flagged in the Step 1 commit at the time, not discovered
just now.

`fill.faint`'s Minimal value was deliberately set to the **old** `#7A828E` (not the
corrected `#848C98`) specifically to keep the bar/dot pixel-identical — a fill only needs
3.0:1, and `#7A828E` already clears that, so there was no accessibility reason to move it
and every reason not to (zero visual change where the contract allows it).

## Per theme: what fit, what forced a token

| Theme | Contract fit | New token forced |
|---|---|---|
| Minimal | — (the port) | `fill.faint` (see above) |
| Humanist | Full fit, zero branching | none |
| Athletic | Full fit, zero branching | none |
| Brutalist | Full fit, zero branching | none |
| Depth | Full fit, zero branching | none |
| Atelier | Full fit, zero branching | none |

Every theme after Minimal fit the contract CapRow already exercised — text/fill colour,
`typography.data`, `expression.overCap` — with no component-level branching and no new
token. That's the contract doing its job: the six palettes differ (`overCap` is `'all'`
for Minimal/Athletic/Depth, `'word'` for Humanist/Atelier, `'fill'` for Brutalist;
`elevation` is `'border'`/`'none'`/`'hardShadow'`/`'blur'`/`'none'` across the six;
`accentRole` is `'ground'` only for Brutalist) but none of that variation ever needed a
component to ask "which theme am I."

One deliberate non-consumption, verified rather than assumed: CapRow does **not** read
`shape.align` even though Atelier's is `'center'` (every other theme is `'left'`) —
checked against `reference/themes-today.html`, where every theme including Atelier keeps
list rows left-aligned; only hero/tile content centres. Documented in CapRow's own comment
so it doesn't read as an oversight later.

## Compromises, per theme

- **Depth** — *(resolved; originally shipped as a compromise, closed after the user flagged
  it against their own reference)*. `shape.elevation: 'blur'` now renders as a genuine
  `expo-blur` `BlurView` over a real two-radial-gradient ambient glow (`GroundGlow`,
  `packages/ui/src/components/groundGlow.tsx`, react-native-svg), not the flat
  `surfaces.surface2` fill this originally shipped with. Getting real blur on Android
  needed one more fix beyond adding the dependency: unlike iOS's `UIVisualEffectView`,
  Android's blur can't sample "whatever's behind this view" on its own — it needs an
  explicit `blurTarget` ref to a `BlurTargetView` wrapping the actual content
  (`BlurTargetProvider`/`useBlurTarget`, `packages/ui/src/theme/provider.tsx`; wired up in
  `app/App.tsx`). Confirmed live on a Samsung SM-S908E: Depth's Energy card and Settings'
  Profile card show genuine soft, colour-graded blur bleeding through, fading correctly to
  flat `surfaces.bg` further down the screen where the real gradient doesn't reach.
  `themeConformance.test.ts` still only checks contrast against Depth's *flat* surface
  colours — necessary, not sufficient, for the same reason as before — and this fix hasn't
  been checked on a pre-Android-12/SDK-31 device, where `blurMethod:
  'dimezisBlurViewSdk31Plus'` falls back to `'none'` (a flat tint, no real blur). Not
  blocking; worth a look if the app ever needs to support those devices.
- **Brutalist** — `shape.elevation: 'hardShadow'` renders as a flat, non-blurred offset
  shadow (`shadowOffset: {4,4}, shadowOpacity: 1, shadowRadius: 0`), explicitly distinct
  from the soft/glow shadow the pre-amendment ban targeted. `accentRole: 'ground'` means
  its yellow accent is a surface, not a text/fill mark — no compromise here, just a
  genuinely different accent role the contract already modeled.
- **Atelier** — `typography.data` is `'IBM Plex Mono'`, which wasn't bundled until the
  Fonts step (below); before that commit, Atelier's numerals silently fell back to the
  system default with no crash, just not the intended face. Resolved now that fonts are
  bundled.
- **Tiles layout (Step 5), all themes** — two judgment calls with no prior version to
  defer to:
  - `reference/themes-today.html`'s tile mockup shows **Fat** as the fifth tile
    (illustrating the "over" treatment); `docs/basalt-layouts.md`'s own content-model table
    documents **Water** as slot five, with real empty-state rules. Went with the doc table
    as authoritative (more detailed, more deliberate) and read the reference's Fat as
    illustrative rather than the literal spec. **Worth a second opinion** if the reference
    was meant to be taken literally.
  - `hydrationEnabled` has no backing setting anywhere in the app (the layouts doc assumes
    one exists). Treated as always-on, matching Ledger's current unconditional Water row —
    genuinely out of scope to invent here, not quietly skipped.
  - Training's tile shows one string ("Rest day" or the session title) at hero size; the
    reference's example splits a big value + small subtitle ("Rest" / "day 3 of block").
    Basalt doesn't track block/cycle position, so there's no second line to show — noted
    rather than fabricated.

## Where this stands, honestly

Steps 1–6 shipped a contract, six conformant themes, a Tiles layout, and a live
Settings picker — and then, on-device, picking a theme visibly changed almost nothing.
Only CapRow (Step 1's single migrated component) actually read from `useTheme()`; every
`Card`, the hero numeral, every receipt row, the nav bar, and the header were still
hardcoded to Minimal's static tokens regardless of the saved preference. That's a real gap
between "the six steps report done" and an app that resembles
`reference/themes-today.html` when you actually pick a theme up — not a scope violation of
the original plan (which only asked Step 1 to migrate "at least one" component), but not
what "done" should have meant either.

Commit `1b4eb7d` closes most of that gap: `Card` / `MicroLabel` / `KV` / `SrcNote` /
`HeroNumeral` / `EmptyState` / `Rule` (the primitives every screen composes from),
`ReceiptRow` / `ReceiptHeader` / `MealTag` (the dominant list component across Today, Log,
Train, Recover, Trends), `TabBar`, `AppHeader`, `CTA`, `Chip`, and `SubNav` are now all
theme-driven, still with zero `theme.id` branching. `useContainerStyle()` was extracted so
`Card` and `Tile` (Step 5) share one chrome implementation instead of drifting. Still
static Minimal tokens: `ChipGroup`'s other call sites, the sets table, the guided timer,
onboarding primitives, and the viz components — not touched, not urgent unless requested.

**Two things in that expansion are worth a second opinion, not just a note:**

- **CTA's fill colour changed for Minimal too**, not only the other five themes. Step 1's
  explicit "zero visual change" promise applied to Minimal; the current app's CTA (neutral
  `surface2` background, `ink` text) doesn't match
  `reference/themes-today.html`'s `.minimal .cta { background:#3E9B78; color:#0F1115 }` at
  all — a pre-existing mismatch between the shipped app and its own reference mockup, not
  something this rollout introduced. Since matching the mockup is the explicit point of
  this expansion, it was fixed for every theme including Minimal rather than left in place.
  Defensible, but it does mean CTA is not "zero visual change" the way CapRow was.
- **SubNav's active-state colour** (`text.accent`) has no reference-file precedent —
  `reference/themes-today.html` doesn't show a sub-nav in any theme. It's extrapolated from
  the nav-bar's own active-state pattern, not confirmed against anything.

## On-device verification — the bug that was still there

Once USB debugging was reauthorized, live verification found the reported bug still
reproduced: switching to **Brutalist** (a light theme) under **Tiles** layout rendered with
the Settings/Today header title invisible (dark-on-near-black) and a black rectangle
filling the space below the last tile — "placement and colour... out of whack," exactly as
originally reported, and not fixed by `1b4eb7d` after all.

**Root cause**: `1b4eb7d` migrated every component inside `packages/ui` onto `useTheme()`,
but never touched the app's own screen-container chrome, which lives in `app/`, outside
that package. `app/App.tsx`'s `MainShell` root `View`, both of its loading-state screens,
and the outermost `View`/`ScrollView` in **every one of the app's 12 screens** (Today, Log
+ its Recipes/Planner tabs, Train + its Outdoor tab and TemplateBuilder, Recover, Trends,
Settings, Auth, Onboarding) all still read the static, pre-theme-system `color.bg` token.
For the four dark themes this was invisible — their own dark tone happened to be close
enough, or fully covered by themed cards — which is exactly why it passed unnoticed through
Steps 1–6 and the `1b4eb7d` expansion: nobody was looking at a light theme. Fixed in
`a7a8982` — same mechanical change at all 13 sites: `useTheme()` in scope,
`backgroundColor: theme.surfaces.bg` overriding the static style.

**Confirmed on real hardware, not just reasoned about** — the device (`R5CT90NW3NN`,
Samsung SM-S908E) survived a laptop restart and a USB-debugging re-auth mid-session:

- Reproduced first: Brutalist + Tiles showed the invisible header and black gap exactly as
  reported.
- After the fix: Brutalist renders correctly everywhere the bug hit — header title visible,
  cream (`#F2F0E8`) background behind every card and the empty space below Tiles' last row,
  tab bar cream with the correct black inverted pill on the active tab and the yellow
  ground-accent `+` button.
- Humanist (the other light theme) confirmed clean on Ledger layout too — warm off-white
  background, filled white cards with no border (`elevation: 'none'`), Nunito visibly
  applied.
- Minimal reconfirmed pixel-identical to its pre-fix baseline — no regression for dark
  themes from touching this shared code path.
- Depth and Athletic were live-confirmed correctly re-themed (background, hero-numeral
  typeface, tab bar) in the same session, before the background bug was found — Depth's
  `shape.elevation: 'blur'` approximation read as intended on-device, though the
  gradient-backdrop caveat below still stands; a flat translucent card over a flat dark
  background isn't the same test as a real ambient gradient.

Live testing hit a real infrastructure snag worth recording: Supabase's shared project
(`ezsrwwfieihelfekgclz`) hit its egress/edge-function invocation quota mid-session, which
blocked auth entirely (this is also almost certainly why an earlier device session's saved
theme selection appeared to have changed on its own between sessions — it hadn't; a session
expiry plus a later real sign-in are the more mundane explanation once the quota message
showed up). Verification continued using a temporary local mock session/profile injected
directly into the Zustand store in `Gate()`, reverted before `a7a8982` was committed — that
commit is the theme fix only, nothing quota-related ships.

The two second-opinion items below (CTA, SubNav) and Tiles' fifth-slot judgment call are
still open — they're design calls, not bugs, and don't need a device to resolve.

## Second device session — Depth's real glow/blur, and progress bars nobody themed

A later session picked up two more things, both found by holding the app up against
concrete references rather than reasoning about the code in the abstract.

**Depth didn't match its own reference.** The user compared the live app against
`reference/themes-today.html` rendered directly (screenshots of the actual HTML/CSS) and it
was obviously wrong: no ambient glow, flat cards instead of glass. This was already a known,
named compromise (see "Compromises, per theme" above) — the fix (real `GroundGlow` +
`expo-blur`) is detailed there rather than repeated here. Two things worth recording that
aren't compromises so much as genuine debugging:

- The first blur attempt (commit `ef2d688`) shipped with tests green and typecheck clean
  but **did not actually blur anything on Android** — confirmed by cranking the glow's
  alpha/radius far past real values as a diagnostic and watching the cards stay completely
  flat while the separately-rendered header glow scaled up correctly. Root cause was in
  `expo-blur`'s own type definitions, not discoverable from React Native's cross-platform
  API surface alone: Android's blur needs an explicit `blurTarget` ref to a
  `BlurTargetView`, since it can't sample "whatever's behind this" the way iOS can. Fixed
  in `d032f6e` — see "Compromises" above for the mechanism.
- This is the clearest example in the whole rollout of "green tests, still visually wrong"
  — nothing about `BlurView` rendering flat instead of blurred throws, warns, or fails a
  type check. It only showed up by looking at the device. Worth remembering next time
  something native-rendering-shaped gets added: tests confirm the code runs, not that the
  pixels are right.

**Progress bars had never been touched.** Asked to "check the rest of the themes too"
against the same reference, found `shape.meter` (bar/pill/line/stepped) had existed in the
contract since the original six-step rollout with real per-theme geometry in the reference
CSS, but no component had ever read it — `Bar` (`macro.tsx`, backing both `MacroRow` and
`CapRow`) was 100% static regardless of theme the whole time. Fixed in `9446114` — full
detail in "Compromises"-adjacent commit message; the short version is `meterHeight`/
`meterRadius` added to the contract, track colour confirmed as `surfaces.surface2` across
all six themes' real reference values, fill colour left alone (still caller-supplied,
correctly theme-semantic per macro). This one shipped fully verified (pure JS/data, no
native rendering involved) and was later visually reconfirmed on-device (Brutalist's thick
yellow track, unmistakable against the old thin grey bar).

**Not part of this report**: the same session surfaced a real, separate bug — outdoor walk
GPS tracking is foreground-only (`OutdoorTab.tsx` uses `Location.watchPositionAsync` with no
background task or permission) and didn't log a walk taken with the phone locked. That's an
app-behavior bug, not a theme-system one; deliberately not fixed here, sequenced for its own
session per the user's explicit choice.

## Fonts

Nine `@expo-google-fonts/*` families cover every non-Minimal theme's `typography.ui` /
`data` / `display`: Nunito (Humanist), Barlow + Barlow Condensed (Athletic), Archivo +
Archivo Black (Brutalist), Manrope (Depth), Jost + IBM Plex Mono + Cormorant Garamond
(Atelier). Loaded via `expo-font`'s `useFonts()`, gating first paint in `App.tsx` the same
way session/profile loading already does.

**App-size delta: 25 font files, 4,333,988 bytes (≈4.13 MB), measured directly off disk**
(the honest proxy used here — a full production build wasn't run for this number, but this
is the exact byte weight the font assets themselves add to the bundle).

This step also fixed a real functional bug, not just packaged fonts: `resolveTypeface`
returned bare family names (`'Nunito'`) that don't match what `expo-font` actually
registers per weight (`'Nunito_700Bold'`) — every non-Minimal theme would have silently
fallen back to the system font forever, with no crash and no visible error, just the wrong
typeface everywhere. `resolveTypeface` now takes a numeric weight and returns the exact
registered string; the pure Google-Fonts-naming logic (`resolveFontFamily`) lives in
`format.ts`, RN-free, and is exercised in `format.test.ts` against every `(family, weight)`
combination all six themes can actually produce — the only way to unit-test this given the
repo's plain-Node vitest can't import anything that touches `react-native`.

That exhaustive test caught a second real gap before it shipped: Brutalist's `ui` role is
plain `'Archivo'` (not `'Archivo Black'`), and its bold weight is 900 — `Archivo_900Black`
wasn't in the original bundle plan, which had only accounted for `'Archivo Black'` covering
the 900 case via its own separate single-weight family. Added (+120KB, included in the
4.13MB total above). This is exactly the kind of thing "if a theme needs a component
override, the contract is missing a token" doesn't catch — the contract was correct, the
font bundle just hadn't been checked against every role×weight combination it implied.

## Instrumentation

`app/src/lib/instrumentation.ts` — `logThemeLayoutEvent()`, called from both Settings
Display pickers on change. No analytics vendor exists anywhere in this app, so this is
`console.log` with a structured event shape at one call site — the minimal, honest
implementation, trivial to point at a real analytics call later without touching either
`onChange` handler.

## Summary — anything for a second opinion

In one place, everything above flagged as needing outside judgment rather than an
automated check:

1. **CTA's Minimal-visible colour change** — defensible against the reference mockup, but
   breaks Step 1's "zero visual change" premise for a component outside Step 1's scope.
2. **SubNav's active-state colour** — my own extrapolation, no reference-file precedent.
3. **Tiles' fifth slot: Water (doc table) vs. Fat (reference mockup)** — went with the doc
   table; worth confirming that was the right call if the reference was meant literally.
4. **Depth's blur, on a pre-Android-12/SDK-31 device** — the real fix (`d032f6e`) is
   confirmed on real hardware (Samsung SM-S908E), but `blurMethod:
   'dimezisBlurViewSdk31Plus'` falls back to a flat, unblurred tint on older Android where
   that check fails. Not blocking; worth a look if the app ever needs to support those
   devices.

Two items from earlier drafts of this report are no longer open, both root-caused, fixed,
and confirmed live on-device rather than just reasoned about: the reported Tiles/theme-
carryover bug (across Brutalist, Humanist, and a Minimal regression check — see "On-device
verification" above) and Depth's flat-fill blur approximation (now genuine glass over a real
ambient glow — see "Compromises, per theme" and "Second device session" above).
