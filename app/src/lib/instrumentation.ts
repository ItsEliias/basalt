// Minimal instrumentation for theme/layout selection (IMPLEMENTATION-PROMPT.md's
// "log theme selection, layout selection, and any subsequent change"). No
// analytics vendor is configured anywhere in this app — there was nothing to
// wire this into. console.log is the honest, minimal implementation: a
// single, structured call site that's trivial to point at a real analytics
// call later without touching the callers below.

export type ThemeLayoutEvent =
  | { type: 'theme_selected'; theme: string; previous: string }
  | { type: 'layout_selected'; surface: 'today'; layout: string; previous: string };

export function logThemeLayoutEvent(event: ThemeLayoutEvent): void {
  console.log('[basalt:display]', event);
}
