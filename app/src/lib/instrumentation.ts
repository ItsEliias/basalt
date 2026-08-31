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

// Logging-speed pass (V3 Phase 3) — same honest console pattern; the point
// is usage data before deciding what to invest in next.
export type LoggingEvent =
  | { type: 'tray_commit'; items: number }
  | { type: 'favorite_relog'; via: 'tap' | 'longpress_edit' }
  | { type: 'copy_yesterday'; meal: string; entries: number }
  | { type: 'entry_saved'; source: string; viaTray: boolean }
  | { type: 'fill_gap_add'; source: 'own' | 'off' }
  | { type: 'voice_capture' };

export function logLoggingEvent(event: LoggingEvent): void {
  console.log('[basalt:logging]', event);
}
