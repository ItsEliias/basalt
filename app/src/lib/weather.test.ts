import { describe, it, expect } from 'vitest';
import { formatWeatherLine, WEATHER_ATTRIBUTION } from './weather';

describe('weather line', () => {
  it('temp, wind, sunset in walk-screen mono style', () => {
    expect(formatWeatherLine(13.6, 19.4, '2026-09-01T17:49:00')).toBe('14°C · wind 19 km/h · sunset 5:49 pm');
  });

  it('no sunset in the payload → no sunset in the line, never a guess', () => {
    expect(formatWeatherLine(21.2, 8, null)).toBe('21°C · wind 8 km/h');
  });

  it('attribution names the provider and what leaves the device', () => {
    expect(WEATHER_ATTRIBUTION).toContain('Open-Meteo');
    expect(WEATHER_ATTRIBUTION).toContain('rounded coordinates');
  });
});
