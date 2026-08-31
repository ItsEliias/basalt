# V3-C report — Phase 4 items 12–17

**Date:** 2026-08-31 · **Branch:** `v3-full-batch` · **Suite:** 882 green (was 837 at V3-B).
Commits: cooking `51d9705` · shoes `28802df` · BLE scale `0f81dea` · sharing design `3e3be53` +
implementation `4d6a203` · cycle `10966e2` · co-op `6ffb0cb`.

## 12 · Cooking mode (`51d9705`)

Pure engine (9 tests): durations come only from steps that state them (ranges take the
lower bound — you check early, food doesn't uncook); unscheduled steps are sequenced,
counted and said, never guessed; recipes offset so everything finishes together. Select
from saved recipes → merged-timeline sheet with two named wall-clock timers (a finished
timer speaks its name and vibrates) under keep-awake. **Deviation:** the Android timer FGS
is session-store-coupled, so kitchen timers use the screen-on path — the prompt's own
stated mechanism — rather than a second FGS lane.

## 13 · Shoe mileage (`28802df`)

`basalt_shoes` + nullable `shoe_id` on walks (applied live, advisors clean). Pick a shoe
before a walk; lifetime km accumulate. The entire editorial voice is one srcnote
("most published guidance suggests 500–800 km — set your own threshold"); past-threshold
copy is a fact with no imperative and no exclamation mark, pinned by test.

## 14 · BLE smart-scale (`0f81dea`)

Standard SIG Weight Scale profile only — proprietary byte-layout guessing would put
invented numbers in a ledger. GATT parser in core-data (7 tests: SI/imperial, the 0xFFFF
failure sentinel → null, junk rejected). react-native-ble-plx lazy-required (rides the
dev-client rebuild); readings stream into the weight sheet's editable field, so
correction is the default path — untouched readings log as `ble_scale`, edited ones are
the user's number and log as `manual`. Nothing pairs, nothing runs in background.

## 15 · Sharing (`3e3be53`, `4d6a203`) — STOP-POINT B honored

Design doc posted first; approved with the **route-stripping view** variant. One grants
table; one additional permissive SELECT policy per shared table re-checking the live
grant inside RLS (revocation cuts access at the next query by construction); no write
path references a grant; redemption via SECURITY DEFINER (enumeration-proof). Walks
share only through `basalt_walks_shared` — a security-barrier view with no route column;
sleep stages stay owner-only; **cycle is a first-class domain no preset bundles** (pinned).
Advisors: the `security_definer_view` ERROR and the redeem-function WARN are the two
findings the design predicted — both intentional and documented. **Committed live probe
(`pnpm eval:sharing-rls`): 15/15** with two real sessions — pre-claim closed, single-use
codes, owner can't self-claim, granted domains open / ungranted closed, view carries no
route while the table stays shut, writes bounce, revocation closes everything at the
next query.

## 16 · Cycle tracking (`10966e2`)

Facts (logged flow days, grouped periods, cycle day) and labelled estimates (next-period
window = median ± the user's own min–max spread over ≤6 cycles, floored ±2 days) kept
strictly apart; under two complete cycles the future stays blank. Implausible intervals
dropped, not averaged. **No phase-based training advice, ever** — the module never names
phases; pinned by banned-words test. Enters no score. The Recover card is itself opt-in
and hides again on demand; data shares only via the separately-granted 'cycle' domain.

## 17 · 1-v-1 co-op (`6ffb0cb`)

Built fresh. The privacy shape is the design: each phone computes its own daily
"showed up" booleans from its own ledger and publishes only those — the schema cannot
carry anything else. Invite-code pairing (SECURITY DEFINER join, expected WARN), both
members read dots, each writes their own, ending the pair closes reads inside RLS.
Forbidden-list re-check pinned hardest here: no comparisons, no points/XP/badges, no
cheerleading; presence lines are one fact per person; unpublished days render unknown,
never assumed inactive.

## Live objects created this phase

Migrations (all additive, all applied + advisor-checked): `basalt_shoes` (+walks.shoe_id),
`basalt_share_grants` (+18 grantee policies, view, redeem fn), `basalt_cycle_entries`,
`basalt_pairs` + `basalt_pair_days` (+join fn). New intentional advisor entries:
`basalt_walks_shared` (ERROR by design — the route-strip mechanism), `basalt_redeem_share_code`
and `basalt_join_pair` (WARNs — enumeration-proof redemption, same class as
`basalt_delete_my_data`).
