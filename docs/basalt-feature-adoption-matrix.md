# Basalt — Feature Adoption Matrix

The definitive per-app extraction: every app from the target list researched for what it actually *does*, with a verdict on what Basalt adopts, adapts, or rejects. Compiled from six parallel deep-dives (Aug 2026) over official feature pages, help docs, store listings, and hands-on reviews.

Legend: **V1** = launch · **V1.x** = fast-follow · **V2** = later · **✗** = deliberately excluded.

---

## 1. Onboarding & personalization

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| Goal-first intake (lose / build / recomp / health) driving all targets | MFP, MacroFactor, everyone | Already in prototype; goal sets calorie delta + macro split + cap nutrients | V1 |
| Habits questionnaire (eating, drinking, sleep, social habits, habits-you-want-to-change) | BetterMe (its one good idea), Foodvisor | Short, skippable; feeds targets (e.g. alcohol habits → realistic sugar/energy caps) — never body-shaming framing | V1 |
| Equipment inventory + per-location profiles ("Workout Spaces": home/gym/travel, each with kit + quiet/limited-space flags) | Freeletics Spaces, Fitbod gym profiles, Gravl verified-gym DB | Onboarding asks home/gym/both + home kit (in prototype); Spaces model in schema so switching location rebuilds the session | V1 (basic) / V1.x (spaces) |
| Injury/mobility screening biasing exercise selection | Caliber, BodBot | Simple checklist at onboarding ("shoulder issues" → swap list), not a medical quiz | V1.x |
| Cold-start priors from similar-user cohort before personal data exists | Freeletics | Conservative starting weights from demographics + experience, ramping fast off logged data | V1.x |
| Coaching-style choice: Coached / Collaborative / Manual | MacroFactor | One onboarding question deciding how bossy the app is — the cheapest personalization with the biggest perceived-respect payoff | V1 |
| 26-screen quiz→paywall funnel | Runna, WalkFit, BetterMe | **✗** — onboarding ≤ 5 steps, no paywall inside it | ✗ |

## 2. Adaptive engines (the "AI roadmap")

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| **Adaptive TDEE from weight trend + logged intake** (recalculates expenditure continuously; weekly auto check-in adjusts targets; no formula-only targets after week 2) | MacroFactor (gold standard), MyNetDiary AutoPilot | The nutrition engine's core loop. Mifflin-St Jeor only as day-1 seed; trend-weight smoothing; weekly target adjustment with a one-line explanation of *why* | V1 |
| **Per-muscle recovery/freshness model** (0–100% from logged volume + wearable signals, manual override, drives exercise selection) | Fitbod (benchmark) | Feeds the body map (already in prototype) and session generation; inputs: set history, sleep, HRV where available; always overridable | V1.x |
| Per-exercise post-set feedback (RIR prompt / too-easy–right–too-hard) driving next session's loads | Fitbod RiR, SHRED 3-point, Freeletics 5-point RPE | One-tap after final set of each exercise; the cheapest useful adaptation signal | V1 |
| Next-session load auto-recalculation ("every set, every rep, every kilo" prescribed; +2.5 kg or +1 rep rules) | Gravl, StrengthLog %-programs | Deterministic, explainable rules — publish the logic ("algorithm, not AI black box" à la Hevy Trainer) | V1.x |
| Missed-workout plan realignment (gap-length-scaled options: skip / redistribute / extend / rebuild) | Runna (best-in-class), BodBot | Monday prompt after misses; never silent rescheduling, never guilt copy | V1.x |
| "Adapt this session" constraint menu: less time / no equipment / no space / **train quietly (no jumps)** / exclude sore muscle | Freeletics | The full menu on any generated session; quiet mode is rare and loved | V1.x |
| Break detection → automatic ramp-back after time off | Fitbod | Reduce prescriptions after gaps; say so plainly | V1.x |
| Sleep/activity-reactive daily adjustment (poor night → lighter suggestion; big hike → more carbs) | BodBot, WHOOP | Cross-pillar suggestions in Today — the payoff of one ledger; suggestion, never mandate | V2 |
| Walking/running plans from one editable knob (estimated race/goal time → all paces recompute) | Runna | For the walking/running plans: goal pace or "get fitter"; volume + difficulty preference sliders rebuild plan | V2 |
| Fake mesocycle counters, hardcoded "readiness" | Arise phase10 code | **✗** — rebuilt from real per-set history only | ✗ |

## 3. Food logging

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| Barcode scan (free, always) with GS1 validation | everyone; MFP gates it — don't | In prototype; never paywalled | V1 |
| **AI photo → verified-DB ingredients** (maps to real database entries, editable, never a hallucinated blob) | MacroFactor's anti-Cal-AI pipeline | The photo-capture standard: capture → editable suggestion list → confirm; never auto-commit | V1.x |
| Optional photo attached to any food entry | Trainerize meal photos, user request | In prototype (thumb on entry); photos private by default | V1 |
| Freeform sentence logging ("2 eggs and a banana") + voice on the same field | Nutritionix Track | Same AI pipeline as photo; voice input via OS dictation | V1.x |
| Nutrition-label OCR to create custom foods | MacroFactor | Camera mode #4; huge for AU products missing from OFF | V1.x |
| "Photo now, log later" deferred queue | MFP 2026 | Snap at lunch, confirm at night — protects the log's completeness | V1.x |
| Favorites / recents / meals-as-templates, frequency-and-time-aware ("frequent at this hour") | MFP saved meals + our design | In prototype | V1 |
| Swipe-to-copy yesterday's meal | MFP | In prototype (hint shown) | V1 |
| Per-meal macro budgets; training-day vs rest-day targets | MFP Premium, MacroFactor | Targets can differ by day type — pairs with the training engine | V1.x |
| Traffic-light instant verdict on scan (fits your plan / caution / conflicts) | Slimming World's classification verdict, reframed honestly | Small line under scan result: "fits your day" / "uses 80% of your remaining sugar cap" — numbers stay visible, verdict is derived not moralized | V1.x |
| **Allergen/diet conflict flagging on scanned + imported foods** | Gap in ALL 12 nutrition apps researched | OFF allergen tags + per-ingredient recipe checks vs onboarding dietary flags; flag + swap suggestion, never hide. **Open differentiator — nobody does this.** | V1 |
| Restaurant chain menu database | Nutritionix (760+ US chains) | AU coverage is thin everywhere; V2 investigation, not a promise | V2 |
| Fasting timer with metabolic-stage visualization + binary streaks | Zero (zones), Fastic | Optional module; timer + stages, no pseudo-science claims beyond documented ranges | V1.x |
| GLP-1 / diabetes condition modes (dose, injection-site rotation, side-effect-aware targets) | MyNetDiary (best-in-class), MFP | Real user need, real liability — V2 with proper research, or never; not a checkbox feature | V2 |

## 4. Recipes & meal planning

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| Import from **URL + TikTok + Instagram + YouTube + Facebook**, pulling steps, quantities, AND the cover image/thumbnail | Flavorish (category winner) | In prototype incl. thumbnails; JSON-LD scraper already exists in your code for URLs; social = server-side caption+transcript parse, marked "~" until macros confirmed | V1.x (URL V1) |
| OCR import of handwritten cards / cookbook pages / menus | Flavorish | Same vision pipeline, later | V2 |
| Serving scaling that recomputes ingredient quantities live | Flavorish, all | In prototype (working stepper) | V1 |
| Ingredient check-off ("what I already have") → "Add N to grocery list" | Flavorish | In prototype | V1 |
| Aisle-grouped, quantity-consolidated, unit-normalised grocery list, checkable in-store, **collaborative/shared** | Flavorish | In prototype (solo); shared lists V1.x | V1 / V1.x |
| Weekly meal planner with plan-ahead-then-tick-off flow | Slimming World planner, Freeletics tick-off | In prototype; "planned vs actually eaten" reconciliation feeds the diary | V1.x |
| AI "suggest food to fill my remaining macros today" | MyNetDiary | Uses saved recipes + favorites first — suggestions from *your* food, not a generic list | V2 |
| Ingredients-on-hand recipe generation | Flavorish AI | V2, via the same AI layer | V2 |
| Workout-aware same-day portion scaling (logged session → bigger dinner target) | Freeletics Nutrition | Falls out of the shared ledger naturally | V1.x |
| Multi-recipe cooking mode (two timers, two ingredient lists at once) | Flavorish | Nice V2 | V2 |

## 5. Strength training & logging

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| Set table with ghosted previous values as input defaults | Hevy (category standard) | In prototype (Prev column) | V1 |
| **Plate calculator** (per-side barbell loading) | Hevy, FitNotes | On the weight field | V1 |
| **%-based warm-up set calculator** with editable formula | Hevy | One tap from working weight | V1.x |
| Smart superset scrolling (auto-advance to paired exercise) | Hevy | With our superset chaining | V1.x |
| Set types: warm-up / drop / failure; AMRAP, EMOM, Tabata, circuits | Hevy, StrengthLog | Warm-up/drop/failure V1; timed protocols V1.x | V1 / V1.x |
| Live in-workout PR notification | Hevy | Quiet typographic toast, no confetti | V1.x |
| **Rep-PR matrix** (records at every rep count, not just e1RM) | StrengthLog | The Records screen's backbone; "this weight = your 6RM territory" contextual hint while typing | V1.x |
| Per-set comments + per-exercise notes (machine seat settings) | FitNotes | Cheap, loved by serious lifters | V1 |
| Per-exercise remembered rest timers, legible at arm's length | StrengthLog, Hevy | In prototype (timer); per-exercise memory V1 | V1 |
| Strength Balance score (cross-muscle-group development %) | Caliber | V2, derived from the volume map data | V2 |
| Import a routine from screenshot / PDF / Instagram post | Gravl | Same vision pipeline as recipes — one capability, two products | V2 |
| Big-Three (S/B/D) total tile | BurnFit | Optional stat tile for the powerlifting-inclined | V1.x |
| Multiple concurrent logs per day (gym + walk + stretch as separate sessions) | BurnFit | Sessions are first-class rows anyway — free | V1 |
| Exercise pages with muscle-activation %, common mistakes, form cues | FitAI, Fitbod | free-exercise-db gives instructions/images now; enrich over time | V1 (basic) |
| Camera rep counting | Keep (China), Peloton hardware | **✗** for now — hardware-bound, gimmick risk | ✗ |

## 6. Outdoor / walking

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| Live map recording with stats-on-map, auto-pause, splits, elevation | Strava 2025 record screen | In prototype; modest pause button (Strava's 20%-of-screen pause is the documented failure) | V1 |
| Splits as horizontal pace bars, best split highlighted | Strava, Peloton | In prototype | V1 |
| "Generate me a loop of X km from my door" | Strava Suggested Routes, MapMyWalk Route Genius | From OSM footpath data (in prototype as Routes near you) | V1.x |
| Personal route history → "your usual loop" suggestions + Matched-Runs PR comparison per route | Strava matched activities | Route-matching on saved walks; "your median on this loop: 39:40" | V1.x |
| **Beacon** — live location link to a chosen contact | Strava, MapMyWalk MVP | Safety feature, cheap (a URL), high trust value | V1.x |
| Configurable voice announcements (which stats, how often) | MapMyWalk | During recorded walks | V1.x |
| Audio-guided interval walks ("Japanese walking" 3-min alternations), RPE-based so any pace works | WalkFit, Peloton outdoor | Guided audio sessions = TTS/scripted intervals, not filmed content — no content-studio cost | V2 |
| Shoe/gear mileage tracker with wear-out alert | MapMyWalk Gear Tracker | Tiny, charming, retention-positive | V2 |
| Adaptive step goals from personal baseline (not fixed 10k) + tiered intra-day milestones | Apple, WeWard (mechanic only) | Step goal recomputed from trailing baseline; quiet milestone ticks | V1.x |
| Night-safety route layer | Strava Night Heatmaps | Needs data we won't have — revisit if ever | ✗ (for now) |
| Steps-for-cash rewards | WeWard, Sweatcoin | **✗** — wrong incentives, wrong brand | ✗ |

## 7. Recovery, sleep, vitals & the morning number

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| **One morning readiness number** from sleep-time HRV + RHR + sleep quality + prior-day load, with bands and ONE actionable sentence | WHOOP Recovery, Fitbit Readiness, Samsung Energy Score | The Recover tab's hero when wearable data exists; hidden entirely when it doesn't (real-or-hidden rule); **published formula** — every input listed, tap to see the math | V1.x |
| Everything framed vs. **personal baseline**, never population norms | WHOOP, Fitbit Health Metrics, Apple Trends | Already our correlation philosophy; extend to all vitals tiles ("within your 30-day range") | V1 |
| Sleep score decomposed into named sub-factors (duration, consistency, interruptions, breathing quality) | Huawei TruSleep, Apple Sleep Score | Show the sub-factors, skip the composite until the formula is defensible | V1.x |
| Sleep **need** (baseline + debt + prior-day strain) instead of flat 8h | WHOOP | Honest, computable from data we hold | V2 |
| Vitals-deviation illness early-warning (respiratory rate / RHR / temp outside your range) | WHOOP Health Monitor | Alert with "3 of 5 vitals outside your typical range" — no diagnosis language | V2 |
| **Journal → correlation engine** (log behaviors: alcohol, late meal, magnesium, sauna → monthly impact report on YOUR recovery) | WHOOP Journal (best-in-class) | Perfect fit for our gated-Pearson engine: behaviors become boolean series correlated against recovery/sleep — same |r| ≥ 0.45, n ≥ 30 gates | V2 |
| Baseline-range table of all vitals (breathing rate, HRV, skin temp, RHR, SpO2 vs your normal band) | Fitbit Health Metrics | A Recover detail screen — hairline bars again | V1.x |
| Smart scale flow: auto user recognition, unclaimed-reading inbox, per-metric trend bands, girth measurements | Fitdays | BLE scale support V2; girth measurements V1 (manual) | V1 / V2 |
| Cycle tracking feeding the engines (weight-trend interpretation, phase-aware training) | MacroFactor, BetterMe, Apple | Do it properly or not at all — V2 with care | V2 |
| Menstrual/medication/BP/glucose manual logging | Apple, Samsung | Glucose/BP land via Health Connect already; manual entry V1.x | V1.x |

## 8. Mind

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| Timer spec: named saveable presets, interval bells, real-instrument sounds, ambient bed or silence, warm-up delay | Insight Timer (benchmark) | The Mind tab's timer; prototype has presets + pacer | V1 |
| Breathing pacer with phase animation (box, 4-7-8, coherent 5.5) | prototype already | Ship as is; haptic phase pulses | V1 |
| **Dual milestones: streak-based AND lifetime-total** (lapsed users still progress) | Insight Timer | Applies app-wide, not just Mind — pairs with our no-guilt calendar | V1.x |
| SOS 3-minute interventions incl. night-waking | Headspace | Small library of scripted emergency downshifts | V2 |
| Post-session journal/reflection prompt; mood check-in with contributing factors | Calm Check-Ins, Insight Timer | Mood + factors feed the correlations engine (same journal mechanism as WHOOP behaviors) | V1.x |
| Mindful-minutes sync to Health Connect/HealthKit | Insight Timer, Headspace | Table stakes | V1 |
| Celebrity sleep stories / content library | Calm, Insight Timer | **✗** — content business, not our product | ✗ |

## 9. Progress photos & body tracking

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| 3-pose capture (front/side/back) with **camera alignment guides** | Trainerize (best capture) | The photo vault's capture flow | V1.x |
| **Ghost overlay of previous photo in the camera** | Nobody verified does this — open gap | Our differentiator (was already in the original spec) | V1.x |
| Angle tags, batch upload with shared date/weight, drag side-by-side compare with zoom | Everfit (best management) | Compare view in the vault | V1.x |
| Scheduled photo-day reminders (monthly, program start/end) | Trainerize | Opt-in cadence | V1.x |
| Private-by-default, encrypted, never leaves device without explicit export | Gap across all platforms (coach-visible by default) | Non-negotiable posture | V1.x |
| Weekly-average weight graphing (Mon–Sun means alongside dailies) | Trainerize, MacroFactor trend weight | Already implied by trend smoothing; show both | V1 |
| 13-point tape measurements + calipers | Trainerize | Manual measurements V1 (schema has it) | V1 |
| Mood + accomplishment journal beside training data | Bodylura wellness journal | Same journal surface as Mind check-ins | V1.x |
| **Hide-the-numbers mode** (calories/macros hidden, log-only, ED-sensitive) | Bodylura | Cheap, humane, almost nobody does it | V1.x |

## 10. Retention & engagement (the honest set)

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| Weekly digest: what improved, one gap named, food-group insights incl. alcohol, streak prediction | MFP Weekly Digest, BurnFit AI report, Hevy monthly | In prototype (Week in Review); generated from the ledger | V1 |
| **Year in Review** shareable recap | Strava Year in Sport, Hevy | Annual editorial recap card — the one big share moment | V1.x |
| Shareable summary cards (workout / walk / PR) — clean editorial image, no watermark spam | Hevy, Strava, Gravl stickers | Share-sheet render of the receipt | V1.x |
| Dual milestones (streak + lifetime totals) + no-guilt calendar (gaps gray, never red) | Insight Timer + our design | In prototype | V1 |
| Personalized monthly challenge from YOUR baseline ("beat your own November") | Apple monthly challenges | Computed, private, optional | V1.x |
| 1-v-1 friend competition / co-op quests | Apple, Fitbit family quests | V2 social-lite: compete or co-op with ONE friend, no public feed | V2 |
| Widgets + watch complications + Live Activity during workouts | Hevy, Apple | Glanceable macros/water/rest-timer | V1.x |
| Loyalty points for showing up (not performance) | Peloton Club | Fold into lifetime milestones instead of a currency | ✗ (as currency) |
| Paid medal events, sweepstakes tickets, XP/coins | Keep, Gymondo | **✗** — that's Arise's lane, not Basalt's | ✗ |
| Growing-plant mascot, streak flames, confetti | Foodvisor Seed, Fastic, Fitbod | **✗** | ✗ |

## 11. Sharing, family & clinical

| Feature | Source | Basalt implementation | Phase |
|---|---|---|---|
| **Doctor-shareable PDF report** (clean monthly summary: weight trend, BP, sleep, activity, meds) | Fitbit Wellness Report, WHOOP, Apple ECG PDF — rare and valued | Falls out of the export engine; a differentiator vs Apple's unusable XML | V1.x |
| Caregiver/partner sharing with chosen topics + alert thresholds | Apple Health Sharing | V2 | V2 |
| Coach/professional read-only portal | Nutritionix Track Pro, Trainerize | V2 — also the future bridge if you ever add human coaching | V2 |
| Kids mode | Fitbit Ace | **✗** — different product, heavy compliance | ✗ |
| Data export (JSON/CSV) + full wipe, visible in settings | our spec; FitNotes CSV; absence is a complaint everywhere | V1, non-negotiable | V1 |

## 12. Monetization posture (validated by the research)

Generous free tier (all logging, barcode, manual everything — free forever); one visible price; no quiz-funnel, no countdown timers, no discount exit-popups, no upsells shown to paying users. Premium gates the expensive-to-run and the advanced: AI capture pipelines, adaptive engines' full depth, correlations + journal engine, doctor PDF, route generation. Modeled on: Hevy (reputational winner), MacroFactor (honest paid-only), Flavorish (clean cap); explicitly rejecting: MFP (paywalling old free features, ads to subscribers), WalkFit/BetterMe (funnel), Fitbod (double paywall).

---

## The build-cost reality check

Cheap because the ledger already exists: workout-aware portion scaling, training/rest-day targets, matched-route PRs, weekly digest, readiness inputs, journal-correlations. Expensive and staged accordingly: social-video recipe parsing (server pipeline), photo-food AI done the MacroFactor way (DB-mapping, not LLM blobs), per-muscle recovery model, plan realignment engine. Every AI feature ships behind the same rule: **capture → editable suggestion → confirm; uncertain values marked "~"; formulas published.**
