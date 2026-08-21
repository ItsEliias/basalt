// Home-screen widget snapshot — the pure half. The widget renders ONLY
// what the app last computed, and says when that was: a stale snapshot
// shows its age instead of posing as live data. Hide-the-numbers carries
// through — the widget goes log-only too.

export type WidgetSnapshot = {
  remainingKcal: number;
  over: boolean;
  waterFilled: number;
  waterTotal: number;
  entryCount: number;
  hideNumbers: boolean;
  at: string;
};

export function parseSnapshot(json: string | null): WidgetSnapshot | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    if (typeof p?.at !== 'string' || typeof p?.remainingKcal !== 'number') return null;
    return {
      remainingKcal: p.remainingKcal,
      over: !!p.over,
      waterFilled: Number(p.waterFilled ?? 0),
      waterTotal: Number(p.waterTotal ?? 0),
      entryCount: Number(p.entryCount ?? 0),
      hideNumbers: !!p.hideNumbers,
      at: p.at,
    };
  } catch {
    return null;
  }
}

export function widgetLines(snapshot: WidgetSnapshot | null, nowMs: number): {
  headline: string;
  sub: string;
  water: string;
} {
  if (!snapshot) {
    return { headline: 'Open Basalt', sub: 'no data yet — the widget fills after the first Today view', water: '' };
  }
  const ageMin = Math.max(0, Math.round((nowMs - Date.parse(snapshot.at)) / 60000));
  const ageText = ageMin < 2 ? 'just now' : ageMin < 60 ? `${ageMin} min ago` : `${Math.floor(ageMin / 60)} h ago`;
  const water =
    snapshot.waterTotal > 0
      ? `${'▮'.repeat(Math.min(snapshot.waterFilled, snapshot.waterTotal))}${'▯'.repeat(Math.max(0, snapshot.waterTotal - snapshot.waterFilled))}`
      : '';
  if (snapshot.hideNumbers) {
    return {
      headline: snapshot.entryCount > 0 ? `Logged — ${snapshot.entryCount} ${snapshot.entryCount === 1 ? 'item' : 'items'}` : 'Nothing logged yet',
      sub: `as of ${ageText}`,
      water,
    };
  }
  return {
    headline: `${Math.abs(snapshot.remainingKcal).toLocaleString('en-US')} kcal ${snapshot.over ? 'over' : 'left'}`,
    sub: `as of ${ageText}`,
    water,
  };
}
