# V4 report — Extras

Branch `v4-extras` off main (`8323e32`). Baseline before any code:
**1063 tests green**. The governing rule: every Extra off by default (the
registry's sanctioned exceptions aside), switchable in Settings › Extras,
offered once in onboarding — and with everything off the app is
pixel-identical to main, enforced by the all-off snapshot diff below.

## All-off baseline

The baseline debug APK was built from the exact branch point with all V4
work stashed (the bundle carries zero V4 code) and archived before any
V4 code ran. **The screen capture + diff could not be completed this
session:** the emulator's system process ANRs on every app cold start
after a full day of builds — sign-in became impossible (input events
land in invisible ANR dialogs). Deferred, not skipped: the protocol is
tooled (`scripts/readme-shots/diffdir.sh`) and improved over the naive
version — baseline shots and phase all-off shots will be captured
back-to-back in one device session (same live data, same status bar) by
stashing/unstashing what Metro serves, which is *more* honest than
day-apart captures. First candidate session: the pre-testers device
pass. Until the diff runs, Phase 0 is code-complete but its gate is
open.

## Phase 0 — the Extras framework (code complete; suite 1063 → 1075)

- **Registry** (`packages/core-data/src/extras/registry.ts`): id, title,
  oneLiner, group, default, onboarding copy, requires, permissions,
  groupOnboarding — plus the state model (defaults, parse, `extraOn`,
  `setExtra` with two-way dependency enforcement) and the derived
  onboarding screen list. 10 tests: shape, default-off rule (exceptions
  only in sanctioned groups), acyclic requires, cascade-off-with-report,
  refuse-child-without-parent, yes/no round-trip, screens-from-registry.
- **`<ExtraSlot id>`** + `useExtra` + `ExtrasProvider` — renders nothing
  while the Extra (or anything it requires) is off. Lint-as-test pins
  `packages/extras/*` imports to the gate and the registry.
- **Settings › Extras**: grouped switches from the registry, oneLiner
  under each, disabled-with-reason when a requirement is off, an alert
  naming dependents that a parent turn-off also turned off.
- **Onboarding**: offer screens after the theme step, one per flagged
  entry/group — live preview, registry question, Yes / Not now; the
  footer CTA is the one-tap skip-all ("Skip the extras — build my
  targets"). Existing users: the same sequence once, as the dismissable
  "New in Basalt" modal; every finish path marks it seen.
- **Pebble is the first Extra.** Its master toggle IS the extra (both
  Settings surfaces stay in sync; a pre-V4 device with Pebble on
  migrates once); voice + data-screen prefs unchanged; Today's
  PebbleSlot sits inside `<ExtraSlot id="pebble">`.
- **Contract**: design-spec §6 gains the *Extras-only* list ("never on
  by default, never affects a core number") and §8 records the four
  binding rules.

## Phase 1 — Capture (STOPPED at STOP POINT A)

Discovery that reshapes the phase: **photo-to-meal, voice logging and
label capture already exist in core Basalt** (V2/V3): `ai-photo-food`
(Anthropic vision, `claude-sonnet-5`, per-item portion *ranges* under
the graded-uncertainty law, modes meal/label/recipe/routine),
voice → `ai-quick-add`, and the barcode scanner. The provider
abstraction the prompt asks about is these Edge Functions — the key
lives server-side as the `ANTHROPIC_API_KEY` Supabase secret, never in
`app/.env` (the no-secrets-in-client law). Phase 1's remaining work is
therefore: registry entries + ExtraSlot gating for the capture methods
(on by default), the genuinely new plate builder, and a decision on
ML Kit on-device OCR vs the existing server-side label mode — all
pending the stop-point answer.
