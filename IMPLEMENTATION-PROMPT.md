# Implementation plan — six-theme system

**Review this before acting on it.** It is a plan written for a human to check, not an
instruction to follow unread. It asks for changes to `docs/basalt-design-spec.md`, which is
binding design law in this repo — that amendment is deliberate and explained below, but it
should be a conscious decision, not an automatic one.

---

Implement the six-theme system and the Tiles Today layout. Read these first, in order:

1. `docs/basalt-theme-contract.md` — the token contract and its invariants
2. `docs/basalt-layouts.md` — the per-surface layout model
3. `reference/themes-today.html` — visual source of truth, open at ~390px

`packages/ui/src/theme/` contains `contract.ts`, `contrast.ts`, six verified theme objects
and `__tests__/themeConformance.test.ts`. Do not re-derive the colour values — they are
contrast-verified and the test enforces it.

## Step 0 — resolve the theme.tsx / theme/ collision

`packages/ui/src/theme.tsx` already exists (ThemeProvider, density, text scale). The bundle
adds `packages/ui/src/theme/` as a directory. Both resolving to a similar import path is
legal but confusing.

Recommended: keep the directory as the home for token definitions, refactor the existing
provider to consume `Theme` from it, then move the provider to `theme/provider.tsx` and
update imports. Do this **before** anything else, in its own commit, with tests green.
If you think a different arrangement is better, say so before proceeding rather than after.

## This revises the design contract deliberately

`docs/basalt-design-spec.md` bans glow/glassmorphism and heavy shadows globally. Depth and
Brutalist both need them. Amend the spec to scope those bans **per theme** rather than
deleting them, and record the exception and its reasoning. Do not quietly violate the
forbidden list.

Also record the two corrected colours (see README). They are accessibility fixes, not
aesthetic changes.

## Order of work — report after each step, do not batch

**1 — Contract + Minimal.** Port Minimal onto the full `Theme` type. It must define every key
and produce **zero visual change** except the two corrected colours. Run the conformance test.
Report before continuing.

**2 — Humanist and Athletic.** These fit the shared skeleton. If either needs a component
override, the contract is missing a token — add the token and say which, rather than branching.

**3 — Brutalist and Depth.** `elevation: 'hardShadow'` and `'blur'`. Depth's contrast must be
checked against its **gradient** ground, not a flat colour. If the test cannot express that,
add a representative flat sample to the theme, test against it, and note the limitation.

**4 — Atelier.** The hardest. `typography.data` (mono for tables, serif for chrome) plus
`align: 'center'` carry most of it. Expect to add a token or two; that is correct.

**5 — Tiles layout.** Layout stored **per surface** (`today_layout` now; session and trends
are specced but NOT built). Today only. Fixed tile set per the layouts doc. The tile
component must contain **no** theme-specific branching — if you write `theme.id === '...'`,
stop and add a token.

**6 — Settings.** Theme picker and layout toggle under Settings → Display, beside text size
and density. Migrate `theme` and `today_layout` columns. Default `minimal` / `ledger` for new
and existing installs. **No onboarding picker in this batch.**

## Invariants — all six themes, not just Minimal

- Every `text.*` clears 4.5:1 on `bg`, `surface` and `surface2`
- Every `fill.*` clears 3.0:1 on every surface (a `ground` accent is exempt — see contract)
- Every on-colour clears 4.5:1 on its own fill (`accentOn`/`accent`, `markOn`/`mark`)
- No rendered font size below 11 at any density or text-scale setting
- Every tappable target clears 48dp including hit slop
- `expression.overCap` is never `'color'` — colour alone fails WCAG 1.4.1 and fails the
  honesty rule that over-cap is stated plainly
- Semantic data colours stay mutually distinguishable; **re-run CVD validation per theme**,
  since each has a different ground
- `allowFontScaling` honoured except hero numerals and mono columns, capped at 1.3x
- Real-or-hidden holds in every theme and both layouts — an empty tile uses the theme's
  `emptyState` treatment, never a zero

## Tests

- Parameterise `tokens.test.ts` over all six themes so contrast runs 6x automatically
- Keep `themeConformance.test.ts` green — it stops theme six drifting from theme one
- Snapshot Today (both layouts), Log, Session and Trends per theme
- Full suite green before each report

## Fonts

Bundle only the weights referenced by the theme objects: Nunito, Barlow, Barlow Condensed,
Archivo, Archivo Black, Manrope, Jost, IBM Plex Mono, Cormorant Garamond. Report the
app-size delta — I want the number.

## Instrumentation

Log theme selection, layout selection, and any subsequent change.

Write `docs/THEME-SYSTEM-REPORT.md` when all six are ported: what fitted through tokens, what
forced a new token, the app-size delta, and anything you compromised on.
