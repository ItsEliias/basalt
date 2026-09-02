// Walk-screen weather line (V3.1 item 7) — Open-Meteo, which is free for
// non-commercial use with attribution and NEEDS NO KEY OR ACCOUNT (their
// published terms; Basalt is non-commercial by product law). ONLY the
// coordinates go out, rounded to 2 dp (~1 km) — no identifier, no
// ledger, nothing else — and only after the user themselves tapped
// Check GPS. Real-or-hidden: no network or a bad response = no line.

export type WeatherLine = { line: string };

export function formatWeatherLine(
  tempC: number,
  windKmh: number,
  sunsetIso: string | null,
): string {
  const parts = [`${Math.round(tempC)}°C`, `wind ${Math.round(windKmh)} km/h`];
  if (sunsetIso) {
    const d = new Date(sunsetIso);
    const h24 = d.getHours();
    const ampm = h24 < 12 ? 'am' : 'pm';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    parts.push(`sunset ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`);
  }
  return parts.join(' · ');
}

export async function fetchWeatherLine(lat: number, lng: number): Promise<string | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
      `&current=temperature_2m,wind_speed_10m&daily=sunset&forecast_days=1&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    const temp = j?.current?.temperature_2m;
    const wind = j?.current?.wind_speed_10m;
    if (typeof temp !== 'number' || typeof wind !== 'number') return null;
    return formatWeatherLine(temp, wind, j?.daily?.sunset?.[0] ?? null);
  } catch {
    return null; // no network, no line — never a cached guess
  }
}

export const WEATHER_ATTRIBUTION = 'Weather by Open-Meteo (open-meteo.com) · only your rounded coordinates are sent';
