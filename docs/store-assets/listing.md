# Play listing copy — closed testing (0.1.0)

Transcribe verbatim; nothing here promises what the app doesn't do.

## App name (30 chars max)

Basalt: Health & Fitness

## Short description (80 chars max)

The honest health ledger — food, training, sleep and vitals, no games, no noise.

## Full description (4000 chars max)

Basalt is a health ledger, not a health game. Food, training, sleep, water
and vitals live in one quiet place, written down the way a ledger writes
things down: real numbers or honest absence — never a fabricated chart, a
streak guilt-trip or a motivational speech.

WHAT IT DOES
• Food — barcode scan, photo, voice or plain typing; AI estimates are
  marked ~ until you confirm them, and over-caps are stated plainly
  ("41 / 36 g · 5 over"), never scolded.
• Training — an 873-movement library, sessions with sets, RPE and honest
  progression suggestions from your own history.
• Recovery — sleep, readiness and vitals from Health Connect, every synced
  value labeled with its source. Sleep stages are display-only; they never
  enter any score.
• Walks — GPS-tracked outdoor walks with live route maps.
• Trends — rolling analytics computed from your data with the formulas
  published in the app. No number appears that Basalt can't explain.

EXTRAS — OFF UNTIL YOU SAY OTHERWISE
Streaks, XP and badges, friends and challenges, a daily AI summary,
home-screen widgets, meal planning, a fasting timer, programmes, a
number-grounded coach and more all exist — every one an Extra: off by
default, offered once, switchable any time in Settings › Extras. With
everything off, Basalt is exactly the quiet core ledger. Formulas for
streaks and XP are published in-app; no Extra ever changes a number the
core app shows.

WHAT IT REFUSES TO DO
No ads, no analytics SDKs, no tracking. No AI narration that talks over
your data (the one summary Extra is labelled as generated, and it's off
by default). Nothing is hidden behind a paywall — capture is never paid.

MIND, WITHOUT SCORES
An optional daily check-in (mood, energy, stress — words, not faces), an
optional local-only journal, and quiet wind-down tools. No mental-health
score, no diagnosis, no screening questionnaires. If your words sound
like crisis, Basalt steps aside and puts real crisis lines one tap away
(Lifeline 13 11 14 in Australia; local numbers by region).

YOUR DATA IS YOURS
Everything exports (JSON, CSV, printable doctor report). Account deletion
is in-app, immediate and total — every row, then the sign-in record
itself. Privacy policy: https://basalt.itseliias.com/privacy/

Eleven visual themes, from the quiet default to five fully expressive
ones — every colour contrast-verified, previewed live in your own numbers
before you switch.

## Closed-testing track note (Console → Testing → Closed testing)

- Track name: `closed-alpha-1`
- This is a 14-day closed test on the current backend; the production
  promotion is gated on the infrastructure move (docs/DECOMMISSION.md —
  "before production access").
- Tester list: email list managed in the Console; testers join via the
  opt-in link the Console generates.

## Instructions for testers (paste into the tester email / opt-in page)

- Sign up with any email; every question in onboarding is skippable.
- Log honestly for a few days — food (scan, photo, voice or typing),
  a workout, water, sleep if you wear something that syncs.
- Try Settings → Display → Theme: previews render in your own numbers.
- **Send feedback from inside the app: Settings → Account → Send
  feedback** — it opens your mail app with the version, theme and device
  pre-filled, and nothing is sent unless you hit send.
- Deleting your account (Settings → bottom) really deletes everything,
  immediately. Use a throwaway account if you only want to poke around.

## Asset inventory (this directory)

| File | Purpose | Spec |
|---|---|---|
| `icon-512.png` | Play store icon | 512×512 PNG (placeholder pillars mark) |
| `feature-graphic.png` | Feature graphic | 1024×500 PNG (placeholder) |
| `screenshots/01…06` | Phone screenshots | cropped to 2:1 from device captures, 1280×2560 |

Both graphics are the PLACEHOLDER pillars mark — swap when the real logo
lands; the in-app icons update in the same commit (`app/assets/`).
