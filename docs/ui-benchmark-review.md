# UI Benchmark Review — Should LEDGER Adopt Competitor Styles?

Research date: Aug 2026. Current (2025–26) UI of the key apps from the target list, verified against redesign announcements, teardowns, and user sentiment.

## Verdict

**Keep the Swiss-editorial direction. Do not adopt any competitor's overall style — borrow their proven interaction patterns.** Three market facts drive this:

1. **The most-hated nutrition UI decision of 2025–26 is exactly what we rejected.** MyFitnessPal's Oct 2025 redesign converted its dense diary into big rounded cards — users call it "ruined by gigantic, space-consuming cards," more taps per task, 13–15-year users quitting publicly. Our "editorial receipt" thesis is directly validated by this backlash.
2. **A visual-identity vacuum just opened.** Hevy rebuilt itself in July 2026 to platform-native chrome (iOS Liquid Glass / Material 3); most competitors are either platform-native, photography-led, or legacy-dated. Nobody in the category combines dark + editorial + bespoke discipline. The closest aesthetic occupant is WHOOP — hardware-locked and subscription-gated.
3. **Muted-but-meaningful color is the winning discipline.** Samsung Health's 2026 redesign is being criticized for "color for color's sake"; WHOOP is praised because every hue carries meaning. Our validated 4-accent semantic palette is on the right side of that line.

## Per-category findings (condensed)

### Strength (Hevy, Fitbod, StrengthLog, FitNotes, Caliber, BodBot, Gravl)
The spreadsheet-with-previous-values set table is the de-facto standard; every app that deviates is slower or less liked. Body-map visualizations (Fitbod recovery, Hevy volume, Caliber 3D balance) are the category's one universally praised pictorial element. Monetization gradient runs from FitNotes (none, and this absence is its most-praised "feature") to Fitbod (double paywall + confetti). BodBot is the cautionary tale: best-in-class algorithm, dated cluttered UI, and the UI is the #1 complaint.

### Nutrition (MFP, MacroFactor, Cronometer, MyNetDiary, Foodvisor, Flavorish)
MacroFactor is the benchmark: timeline food log (entries by time, not forced meal slots — the most user-praised diary structure), customizable dashboard tiles, zero gamification/judgment, and logging speed as the north-star metric. Cronometer's micronutrient bar wall (dozens of thin % bars) is the most defensible "serious user" screen and is already Swiss-compatible. Foodvisor's mascot ("Seed", a growing plant) and MFP's streak flames are the anti-pattern. Flavorish wins recipe-app shootouts partly on honest monetization (simple 5-recipe cap, no trial traps) — its share-sheet import → structured recipe with sticky Ingredients/Instructions/Nutrition tabs is the flow to match.

### Outdoor / Mind / Platforms (Strava, MapMyWalk, Runna, WalkFit, Insight Timer, BetterMe, Peloton, FitOn, Huawei, Samsung, WHOOP, Apple)
Strava (2024–25 refresh: Boathouse display type, Inter for data, dark mode): users love the data density and maps, and are openly hostile to feed-ification and AI garnish ("Athlete Intelligence = glorified spreadsheet auto-fill"; 2025 layout threads titled "beyond awful"). Its 2025 record screen — stats overlaid on the live map — is praised, except the pause button occupying ~20% of the screen. WHOOP: pure black, strictly semantic 3-color system, three-tier progressive disclosure (today's number → weekly trend → raw graphs), arm's-length hero numerals — the closest existing relative of our direction. Insight Timer buries its actual timer in the Profile tab and has accreted mood stories and clutter — mourned by its own users. WalkFit (Trustpilot ~1.9) and BetterMe demonstrate that quiz→paywall funnels taint perception of the entire UI regardless of visual quality.

## Borrow list (fold into LEDGER)

- **Hevy's set-table anatomy** — set # / previous / kg / reps / done in one row, previous session's values as ghosted input defaults. Already in our prototype; extend with prefill-as-default.
- **One-tap set completion** as a typographic state change (weight/rule fill) — no bouncy checkmarks, no confetti.
- **Per-exercise remembered rest timers** (StrengthLog) — legible at arm's length (FitNotes' tiny timer is the documented failure).
- **A muscle volume/recovery body map** rendered in our language: thin-stroke anatomical line figure, muted monochrome fill steps — not red/green glow.
- **MacroFactor's timeline log** — our receipt is already chronological; keep meal headers as light typographic tags, never containers.
- **Swipe-to-copy-yesterday** at meal level (MFP's one universally loved move).
- **Cronometer's micronutrient bar wall** as a Nutrition detail screen — hairline tracks, muted fills, % of target.
- **Customizable dashboard tiles + pinned metric strip** (MacroFactor v4 / new Samsung's praised bits) — customization by omission, not decoration.
- **Strava's stats-on-live-map recording** (already in prototype) with a modest pause control, and **splits-as-horizontal-pace-bars** on the post-walk screen.
- **Route polyline as the activity card's hero** — dark tile, single accent line.
- **WHOOP's three-tier progressive disclosure** and one oversized hero numeral per screen.
- **One unified filter sheet** (duration/intensity/equipment/muscle) — the only praised element of FitOn's UI.
- **Flavorish's import posture**: share-sheet paste → editable structured result; capture → editable AI suggestion → confirm, never auto-commit.
- **Scoring transparency**: if we ever ship a composite score, publish the formula (even Apple had to re-tune Sleep Score bands after complaints).

## Avoid list

- Big card diaries (MFP 2025), dashboard-as-forced-home without revert (MFP, Cronometer both burned).
- Rings (Apple equity can't be borrowed; Huawei's clones read derivative; WHOOP proves recovery needs none).
- Mascots and growth objects (Foodvisor's Seed), streak flames, confetti (Fitbod), gamified single-score badges (Caliber/Gravl).
- Decorative color without semantics (Samsung One UI 9's criticized "bright hues").
- Quiz→paywall funnels (Runna's 26+ screens, WalkFit, BetterMe), pre-selected annual plans, discount exit popups (Gravl), upsells shown to paying users (MFP Premium+).
- Social feed as home (Hevy feed; Gravl users explicitly praise its absence).
- Burying the primary tool (Insight Timer's timer in Profile).
- Oversized touch targets that hijack the screen (Strava's 2025 pause button).
- Platform-native-only chrome (Hevy's move leaves bespoke identity as open ground — take it).
- Legacy drift (MapMyWalk, FitOn, BodBot, MyNetDiary all read "frozen years ago" — version and enforce the design system).
- AI garnish that displaces data (Strava Athlete Intelligence).

## The one-line summary

The market's best-loved surfaces are already accidentally Swiss (Hevy's table, Cronometer's bar wall, Strava's splits, WHOOP's black + semantic color); its most-hated moves are the decorations we already excluded. LEDGER's style isn't contrarian — it's what the praised half of every category is converging toward, executed deliberately.
