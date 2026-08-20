// Onboarding layout contract — the CTA-reachability guarantee.
//
// The bug this file exists to prevent: an earlier intake put the Continue
// button INSIDE the scrollable content; on short viewports it rendered
// below the fold and the flow dead-ended. Basalt's onboarding pins the CTA
// as a fixed footer, a sibling of the scroll area — these constants are the
// screen's actual layout values, and the test asserts the fixed chrome
// leaves usable scroll space at every common viewport height.

export type ObLayout = {
  safeTop: number;
  topRow: number;
  dots: number;
  question: number;
  sub: number;
  ctaFooter: number;
  minScrollArea: number;
};

export const OB_LAYOUT: ObLayout = {
  /** Safe-area top allowance (largest common notch/dynamic island). */
  safeTop: 59,
  /** Brand + skip row incl. its top padding. */
  topRow: 42,
  /** Progress dots incl. margin-top 26. */
  dots: 28,
  /** Question block: up to two lines at 30px line height + 34 margin-top. */
  question: 94,
  /** Sub copy: up to three lines at 20px + 10 margin-top. */
  sub: 70,
  /** Fixed footer: CTA (13+13 padding + ~16 text) + 12 margin-top + 34 margin-bottom. */
  ctaFooter: 88,
  /** The scroll region must keep at least this much height to be usable. */
  minScrollArea: 140,
};

/** Total fixed vertical chrome around the scrollable answers region. */
export function fixedChromeHeight(l: ObLayout = OB_LAYOUT): number {
  return l.safeTop + l.topRow + l.dots + l.question + l.sub + l.ctaFooter;
}

/**
 * True when the CTA is on-screen with a usable answers region at the given
 * viewport height. Because the CTA is a fixed footer, it is on-screen
 * exactly when the chrome + minimum scroll area fit the viewport.
 */
export function ctaReachableAt(viewportHeight: number, l: ObLayout = OB_LAYOUT): boolean {
  return viewportHeight >= fixedChromeHeight(l) + l.minScrollArea;
}

/** The common phone viewport heights (logical px) the contract must hold at. */
export const COMMON_VIEWPORT_HEIGHTS = [568, 640, 667, 736, 780, 812, 844, 896, 926, 932] as const;
