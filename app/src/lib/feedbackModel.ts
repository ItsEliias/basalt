// Send feedback — the pure half. Builds the mailto: URL for the closed-test
// feedback row. Facts only, no telemetry: everything in the body is visible
// to the user in the draft before they choose to send it.

export const FEEDBACK_EMAIL = 'itseliiasstudy@gmail.com';

export type FeedbackInput = {
  /** App version (expo config), e.g. "0.1.0". */
  version: string | null;
  /** Native build number (versionCode), e.g. "1". */
  build: string | null;
  /** Active theme id, e.g. "minimal". */
  theme: string;
  /** Device model, e.g. "Pixel 10 Pro". */
  model: string | null;
  /** Android release, e.g. "16". */
  androidRelease: string | null;
};

export function feedbackSubject(version: string | null): string {
  return `Basalt feedback v${version ?? 'unknown'}`;
}

export function feedbackBody(input: FeedbackInput): string {
  return [
    `App version: ${input.version ?? 'unknown'} (build ${input.build ?? '?'})`,
    `Theme: ${input.theme}`,
    `Device: ${input.model ?? 'unknown'}`,
    `Android: ${input.androidRelease ?? 'unknown'}`,
    '',
    '',
  ].join('\n');
}

/** The full mailto: URL, ready for Linking.openURL. */
export function buildFeedbackMailto(input: FeedbackInput): string {
  const subject = encodeURIComponent(feedbackSubject(input.version));
  const body = encodeURIComponent(feedbackBody(input));
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}
