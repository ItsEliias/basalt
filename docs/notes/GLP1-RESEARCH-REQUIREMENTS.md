# GLP-1 / diabetes modes — research requirements (NOT built, by V3 instruction)

One page on what would have to be true before Basalt ships either mode. Flagged, not
built; nothing in the app references these today.

## Why the bar is different here

Everything else in Basalt is wellness-adjacent; these two are disease-adjacent. A wrong
number in a protein gap is annoying; a wrong number near insulin dosing or a
rapidly-shrinking appetite is dangerous. The honesty laws (real-or-hidden, published
formulas, no invented values) are necessary but not sufficient — the open questions are
clinical and regulatory, not typographic.

## GLP-1 companion mode — what needs answering first

1. **What the mode actually is.** The defensible scope is a *logging* companion:
   injection-day tracking (a date, a dose the user types, never suggested), appetite
   and nausea as check-in factors, protein and fluid emphasis on the Today view during
   dose weeks, and muscle-preservation framing in training (weight loss on GLP-1s is
   ~25–40% lean mass without resistance training — citable, but the citation set must
   be current before any copy ships).
2. **Regulatory line.** Where is the boundary between "wellness logging" and a
   therapeutic claim in AU (TGA) and US (FDA general wellness guidance)? A mode *named
   after a drug class* may itself cross it. Legal review required before naming.
3. **Rate-of-loss guardrails.** The app already refuses aggressive deficits; on GLP-1s
   users can undershoot maintenance without trying. Does the TDEE loop need a
   floor-warning specific to involuntary undereating, and what's the citable threshold?
4. **No dosing math, ever — is that tenable?** Users will ask for titration reminders.
   Decide now: reminders about *user-entered* schedules only, zero dose calculation.
5. **Evidence review cadence.** The literature is moving fast; any shipped copy needs a
   dated citation block and a review date, like the readiness weights.

## Diabetes mode — what needs answering first

1. **CGM data is already syncable** (blood-glucose read permission exists in the
   manifest). The question is display ethics: glucose curves next to food logs invite
   causal reading. What does the chart *withhold* (no "spike blame" annotations)?
2. **Hypo/hyper thresholds are clinical.** Displaying bands means choosing numbers with
   a medical source and a disclaimer posture — or displaying none and only the user's
   own percentile bands (the Basalt-native answer; needs validation with clinicians).
3. **Insulin logging = medical record.** Storage classification, export guarantees, and
   the sharing domain question (its own domain like cycle, never in a preset).
4. **Scope test:** if a feature would change what a user *doses*, it is out. If it
   changes what they *log or notice*, it may be in. Every proposal gets this test.

## Decision needed from you before any build

- Whether either mode is wanted at all post-V3.
- Budget for a clinical/regulatory consult (both modes fail the publish-formulas law
  without one — we'd be publishing formulas we aren't qualified to write).
