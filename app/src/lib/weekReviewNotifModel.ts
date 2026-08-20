// Week in Review delivery — the pure half, kept free of expo imports so
// it stays testable. The notification never carries data: a local weekly
// trigger can't run the composer at delivery time, so the honest shape is
// a fixed factual prompt; the digest is composed from the ledger when the
// user opens Trends. Opt-in only — Basalt never nags by default.

export const WEEK_REVIEW_NOTIF_ID = 'week-in-review';
export const WEEK_REVIEW_STORAGE_KEY = 'basalt.weekReviewNotif';
export const WEEK_REVIEW_CHANNEL_ID = 'week-review';

/** Sunday 18:00, weekly. expo weekday numbering: 1 = Sunday. */
export const WEEK_REVIEW_TRIGGER = {
  type: 'weekly',
  weekday: 1,
  hour: 18,
  minute: 0,
} as const;

export const WEEK_REVIEW_CONTENT = {
  title: 'Week in review',
  body: 'Written from your data — open Trends to read it.',
} as const;
