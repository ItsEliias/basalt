# Monetization — decision doc

Status: **undecided.** This captures the constraints, options, and
architecture so the decision can be made deliberately later. Nothing here is
implemented.

Date: 2026-09-10. Owner: ItsEliias.

---

## TL;DR

- **Do not monetize during the closed test.** Ship 0.2.1 free; validate the
  product first. The store listing, privacy policy, and site currently say
  "free plan" / "nothing hidden behind a paywall" — introducing a paywall to
  users who joined on that basis is costly and contradicts published copy.
- **Decide before open testing / production**, then update the listing,
  privacy policy, and site in the same move.
- Basalt's own product law draws hard lines: **capture is never paywalled**,
  and the core ledger, export, deletion, published formulas and crisis path
  are constitutional. A subscription can only sit on the **compute-heavy AI
  conveniences and premium integrations** — never on core honesty.
- **Recommended direction:** BYO-API-key + a small optional hosted-AI /
  integrations tier, rather than locking core features. It's the only model
  that doesn't require walking back promises already made.

---

## The hard lines (cannot be paywalled)

These are in the audit laws (spec §5), the Play listing, the privacy policy,
and basalt.itseliias.com. Paywalling any of them breaks the app's identity
and contradicts public commitments:

- **Capture is never paywalled** — barcode, photo, voice, AND manual. Manual
  entry is the floor; no capture modality is ever mandatory. (This means the
  AI *photo/voice capture* stays free — see the nuance under "AI cost".)
- **The core ledger** — food, training, sleep, vitals — recorded and shown.
- **Export** (JSON / CSV / per-table zip / doctor report) and **deletion**
  (full cascade). Your data is yours, always.
- **Published formulas** — every number the app shows remains explainable.
- **The crisis path** — on-device, always on, never gated by anything.
- **Themes, detail levels, honesty behaviours** — identity, not premium.

Also binding on any paywall UI: the forbidden list bans **upsells in
onboarding**, and the honesty laws forbid dark patterns, fake urgency, and
guilt mechanics. A paywall must be as honest as the rest of the app.

---

## What is fairly monetizable

Things that either cost real money to run or are clearly premium convenience,
and are NOT capture or core honesty:

| Surface | Why it's fair to charge | Note |
|---|---|---|
| **Pebble Coach** | Hits the Anthropic API per question — real marginal cost | Not "capture", so gating it doesn't break the capture law |
| **Daily AI summary** | Anthropic API per generation | Already an off-by-default Extra |
| **Connected services** (Strava / Garmin / Oura) | Integration + maintenance | Off-by-default Extras |
| **Cloud backup / multi-device / extended history** | Storage + infra | Not yet built |
| **Programme generator, advanced analytics** (correlations, year-in-review) | Premium depth | Borderline — see "Open questions" |

### The AI-cost nuance
The strongest honest case for charging is the **Anthropic API cost** of AI
features. But note the tension: **AI photo/voice/text *capture* is a capture
modality**, and "capture is never paywalled" is absolute. So you cannot put
AI *estimation-for-logging* behind a wall. What you *can* charge for is the
**non-capture** AI: Coach (answering questions) and the daily summary. If AI
capture cost becomes unsustainable at scale, the honest lever is **BYO key**
or a **generous free rate limit** (not a hard paywall) — anything that reads
as "capture is now paid" violates the law.

---

## Options

### 1. BYO-API-key + optional supporter tier  ← recommended
- Power users paste their **own Anthropic API key**; they cover their own AI
  cost. No paywall on capture, and you don't eat the API bill.
- A small monthly **supporter / hosted-AI tier** for people who don't want to
  manage a key (you run the AI, they pay for the convenience) + premium
  integrations.
- **Pros:** most on-brand; keeps every promise; caps your cost exposure.
- **Cons:** BYO-key is niche; supporter revenue is modest; two AI paths to
  maintain (hosted vs BYO).

### 2. Freemium (free ledger + paid AI/coach/integrations tier)
- Free forever: full honest ledger, all engines, export, deletion, themes.
- Paid: hosted Coach + daily summary + connected services + cloud/multi-device.
- **Pros:** conventional, predictable recurring revenue.
- **Cons:** only honest if the free tier stays genuinely complete (not bait);
  requires the most careful listing/privacy rewrite; Play billing complexity.

### 3. One-time purchase / "pro unlock"
- Single payment unlocks the premium (non-core) features.
- **Pros:** simplest; no recurring-billing UX; no subscription fatigue.
- **Cons:** doesn't cover ongoing AI/infra cost; revenue is one-shot.

### 4. Donation / "support Basalt"
- Everything free; optional support.
- **Pros:** zero conflict with any promise; simplest of all.
- **Cons:** rarely funds real infra/AI cost.

**Combinations are viable** — e.g. (1)+(4): BYO-key + hosted supporter tier +
a donate button. Recommendation stands: start from (1), avoid (2)'s
core-locking framing.

---

## Entitlement architecture (whenever it's built)

Basalt's current architecture already fits a clean, secrets-free
entitlement model:

- **Billing:** Google Play Billing (15–30% platform fee). **RevenueCat** over
  the Play Billing Library is the usual shortcut for receipt validation +
  cross-store later. iOS (V1.x) would add StoreKit via the same RevenueCat
  layer.
- **Entitlement store:** a `basalt_entitlements` (or `basalt_subscriptions`)
  table, `user_id`-keyed, RLS `auth.uid() = user_id`, written server-side
  from the validated purchase (never trusted from the client).
- **Server-side gate:** the AI features are already **Supabase Edge
  Functions** (`pebble-coach`, `ai-daily-summary`, …). Add an entitlement
  check at the top of each — the honest place to enforce it, since the client
  never holds the truth. A free/unentitled call returns a polite "this is a
  supporter feature" (the same shape as today's 503-without-key).
- **Client gate:** the **Extras registry** is the natural switch. Add an
  `entitlement: 'free' | 'supporter'` field per Extra; the ExtrasProvider
  shows a locked state (honest: "part of Basalt Supporter", one line, no
  onboarding upsell) instead of the toggle. Do NOT hide the feature exists.
- **No secrets in the client, ever** (existing law). BYO-key: the user's
  Anthropic key is stored securely and passed only to the edge function,
  never bundled.
- **Offline/grace:** entitlement cached with a grace window so a lapsed
  network doesn't lock a paying user out mid-session (mirrors the outbox
  philosophy).

---

## What each option requires updating (honesty debt)

If/when monetization ships, these must change **in the same release** so
nothing lies:

- **Play listing** (`docs/store-assets/listing.md`) — remove/adjust "free
  plan"; add the "contains in-app purchases / subscription" declaration; state
  plainly what's free vs paid.
- **Privacy policy** (`/privacy/`) — add the billing processor (Google Play /
  RevenueCat) to "what leaves your device", and BYO-key handling if used.
- **Site** (`basalt.itseliias.com`) — the landing "in closed testing" and the
  honesty-rules section reference "nothing behind a paywall"; reword to the
  honest new position (free ledger, paid conveniences).
- **In-app** — the Settings "free plan" line; the About/promise copy; the
  Extras locked-state copy.
- **Data safety** — if a billing SDK collects purchase history, disclose it.

---

## Open questions to settle before deciding

1. Is the **programme generator** free (it's deterministic, low marginal cost)
   or paid (premium depth)? Leaning **free** — it's core "what a coach does"
   and costs nothing to run.
2. Free **rate limit** on hosted AI (e.g. N Coach questions/day) vs hard
   BYO-key wall? A generous free limit is more honest than zero.
3. Price point + region (AU-first). Supporter tiers usually AUD 3–8/mo.
4. Grandfather closed-test / early users onto a permanent free-plus tier?
   (Recommended — rewards the people who tested honestly.)
5. iOS timing (StoreKit) — defer until the V1.x iOS work.

---

## Recommendation

Ship the closed test **free**. When ready to monetize, start from **BYO-key +
a small hosted-AI/integrations supporter tier**, keep the entire ledger +
capture + export + deletion + crisis path free forever, gate only the
non-capture AI and premium integrations via the Extras registry + edge-function
entitlement checks, and update the listing/privacy/site honestly in the same
release. Do not "lock down the free version" in the crippleware sense — it
would contradict the product you've built and everything you've published.
