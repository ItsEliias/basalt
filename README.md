# Basalt Theme Bundle

Drop-in scaffolding for the six-theme system plus the Tiles Today layout.
Every colour value here is contrast-verified — see `docs/basalt-theme-contract.md`.

## Provenance

Produced in a working session with the Basalt maintainer, alongside the design reviews that
selected these six themes. It contains **no executable code beyond TypeScript token objects
and a Jest test**, and `IMPLEMENTATION-PROMPT.md` is a plan for a human to review, not an
instruction to act on unread. Read it before running it.

## Manifest — 15 files

```
README.md
IMPLEMENTATION-PROMPT.md               the plan; review before following
docs/
  basalt-theme-contract.md             token contract, invariants, testing strategy
  basalt-layouts.md                    per-surface layout model
packages/ui/src/theme/
  contract.ts                          TypeScript types for the contract
  contrast.ts                          WCAG luminance + ratio, no dependencies
  themes/minimal.ts humanist.ts athletic.ts brutalist.ts depth.ts atelier.ts
  themes/index.ts                      registry, THEME_IDS, DEFAULT_THEME
  __tests__/themeConformance.test.ts   invariants asserted across all six
reference/
  themes-today.html                    visual reference: 6 themes x 2 layouts
```

If any file above is missing from your copy, the archive is incomplete — say so rather than
working around it.

## Two defects this bundle fixes

**1. Over-cap text fails WCAG.** `--fat #BE5540` scores 4.11 / 3.86 / 3.63 against the three
surfaces as **text**. It was validated at the 3:1 graphical threshold — correct for bars, not
for the over-cap ratio, which is type. `--recovery #5E72E4` fails on two surfaces. The
contract's `fill` / `text` split fixes both.

**2. A filled control can render its label invisibly.** `fill.accent` pairs with
`accentOn`, but a theme whose accent is a *ground* (Brutalist's yellow) needs a different
colour for *marks*. Without a separate `fill.mark` / `fill.markOn` pair, a filled button took
black on black — contrast ratio 1.0. The pair now exists and the test asserts every
on-colour against its own fill.

## Integration note

`packages/ui/src/theme.tsx` already exists as a file (the ThemeProvider from the density and
text-scale work). This bundle adds `packages/ui/src/theme/` as a directory. Both can coexist
on disk but it is confusing — decide deliberately. Recommended: the directory holds token
definitions, and the existing provider is refactored to consume from it, then moved to
`theme/provider.tsx`. `IMPLEMENTATION-PROMPT.md` covers this as step 0.

## Order of work

1. Resolve `theme.tsx` vs `theme/`, land the contract, port **Minimal** — zero visual change
   except the two corrected colours above.
2. Humanist and Athletic — these already fit.
3. Brutalist and Depth — `elevation: hardShadow` / `blur`.
4. Atelier last — `typography.data` + `align: center` carry most of it.
5. Tiles layout.
6. Settings picker. Onboarding **later**, once the themes are stable.

## What is deliberately not here

- No component implementations — those belong against your own primitives.
- No onboarding picker. Settings switcher first.
- No user-configurable tile order. Fixed set in v1.
