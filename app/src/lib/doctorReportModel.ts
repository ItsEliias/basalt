// Doctor report — the pure HTML composer (no RN imports, tested). This is
// the one deliberately LIGHT surface in Basalt: it renders for paper, in a
// clinic. Every section names its source, every value is the user's own
// recorded data, and a section with nothing recorded says so instead of
// disappearing — a clinician should know what wasn't tracked.

export type DoctorReportInput = {
  monthLabel: string;
  generatedAtIso: string;
  weight: { entries: { date: string; kg: number }[]; source: string } | null;
  sleep: { nights: number; avgMin: number; source: string } | null;
  activity: { stepDays: number; stepsAvg: number; sessions: number; volumeKg: number; walks: number; walkKm: number } | null;
  vitals: {
    hrv: { min: number; median: number; max: number; days: number } | null;
    rhr: { min: number; median: number; max: number; days: number } | null;
    source: string;
  };
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function section(title: string, body: string): string {
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

const NO_DATA = (what: string) => `<p class="nodata">No ${what} recorded this month.</p>`;

export function buildDoctorReportHtml(input: DoctorReportInput): string {
  const w = input.weight;
  const weightBody =
    w && w.entries.length > 0
      ? (() => {
          const first = w.entries[0]!;
          const last = w.entries[w.entries.length - 1]!;
          const delta = Math.round((last.kg - first.kg) * 10) / 10;
          const rows = w.entries
            .map((e) => `<tr><td>${esc(e.date)}</td><td class="num">${e.kg.toFixed(1)} kg</td></tr>`)
            .join('');
          return `<p>${w.entries.length} weigh-ins · ${first.kg.toFixed(1)} → ${last.kg.toFixed(1)} kg (${delta >= 0 ? '+' : ''}${delta} kg)</p>
<table><thead><tr><th>Date</th><th>Weight</th></tr></thead><tbody>${rows}</tbody></table>
<p class="src">Source: ${esc(w.source)}</p>`;
        })()
      : NO_DATA('body weight');

  const s = input.sleep;
  const sleepBody =
    s && s.nights > 0
      ? `<p>${s.nights} nights recorded · average ${Math.floor(s.avgMin / 60)} h ${String(Math.round(s.avgMin % 60)).padStart(2, '0')} min</p><p class="src">Source: ${esc(s.source)}</p>`
      : NO_DATA('sleep');

  const a = input.activity;
  const activityBody =
    a && (a.stepDays > 0 || a.sessions > 0 || a.walks > 0)
      ? `<ul>
${a.stepDays > 0 ? `<li>Steps: average ${Math.round(a.stepsAvg).toLocaleString('en-US')}/day over ${a.stepDays} recorded days</li>` : ''}
${a.sessions > 0 ? `<li>Strength training: ${a.sessions} sessions · ${Math.round(a.volumeKg).toLocaleString('en-US')} kg total volume</li>` : ''}
${a.walks > 0 ? `<li>Recorded walks: ${a.walks} · ${a.walkKm.toFixed(1)} km (GPS)</li>` : ''}
</ul><p class="src">Sources: user log · Health Connect where synced</p>`
      : NO_DATA('activity');

  const v = input.vitals;
  const vitalRow = (label: string, band: { min: number; median: number; max: number; days: number } | null, unit: string) =>
    band
      ? `<tr><td>${esc(label)}</td><td class="num">${Math.round(band.min)}–${Math.round(band.max)} ${unit}</td><td class="num">${Math.round(band.median)} ${unit}</td><td class="num">${band.days}</td></tr>`
      : `<tr><td>${esc(label)}</td><td colspan="3" class="nodata">not recorded</td></tr>`;
  const vitalsBody = `<table><thead><tr><th>Vital</th><th>Range</th><th>Median</th><th>Days</th></tr></thead>
<tbody>${vitalRow('Heart-rate variability (rMSSD)', v.hrv, 'ms')}${vitalRow('Resting heart rate', v.rhr, 'bpm')}</tbody></table>
<p class="src">Source: ${esc(v.source)}</p>`;

  return `<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 32px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .sub { color: #666; font-size: 11px; margin-bottom: 20px; }
  h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin: 22px 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid #eee; }
  .num { font-variant-numeric: tabular-nums; }
  .src { color: #777; font-size: 10.5px; margin-top: 6px; }
  .nodata { color: #999; font-style: italic; }
  .foot { color: #999; font-size: 10px; margin-top: 28px; border-top: 1px solid #ccc; padding-top: 8px; }
</style>
<h1>Health summary — ${esc(input.monthLabel)}</h1>
<p class="sub">Generated ${esc(input.generatedAtIso.slice(0, 10))} from the patient's own Basalt ledger. Self-recorded and consumer-device data — not a clinical measurement record.</p>
${section('Body weight', weightBody)}
${section('Sleep', sleepBody)}
${section('Activity', activityBody)}
${section('Vitals (30-day)', vitalsBody)}
<p class="foot">Basalt records what the user logged and what their devices reported, with sources named. Absent sections mean absent data — nothing in this report is estimated or filled in.</p>`;
}
