import { describe, it, expect } from 'vitest';
import {
  encodeHcSource, isHcSource, packageFromSource, labelForPackage, labelForSource, HC_SOURCE_PREFIX,
} from './origin';

describe('encodeHcSource', () => {
  it('encodes a package name into the tagged form', () => {
    expect(encodeHcSource('com.sec.android.app.shealth')).toBe('health_connect:com.sec.android.app.shealth');
  });

  it('falls back to the bare prefix for empty / null / whitespace origins', () => {
    expect(encodeHcSource('')).toBe(HC_SOURCE_PREFIX);
    expect(encodeHcSource(null)).toBe(HC_SOURCE_PREFIX);
    expect(encodeHcSource(undefined)).toBe(HC_SOURCE_PREFIX);
    expect(encodeHcSource('   ')).toBe(HC_SOURCE_PREFIX);
  });
});

describe('isHcSource', () => {
  it('accepts bare and tagged HC sources', () => {
    expect(isHcSource('health_connect')).toBe(true);
    expect(isHcSource('health_connect:com.strava')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isHcSource('manual')).toBe(false);
    expect(isHcSource('barcode')).toBe(false);
    expect(isHcSource('')).toBe(false);
    expect(isHcSource(null)).toBe(false);
    // A prefix-collision must not match: not "health_connect" and not tagged.
    expect(isHcSource('health_connected')).toBe(false);
  });
});

describe('packageFromSource', () => {
  it('extracts the package part of a tagged source', () => {
    expect(packageFromSource('health_connect:com.strava')).toBe('com.strava');
  });

  it('returns "" for bare / empty sources', () => {
    expect(packageFromSource('health_connect')).toBe('');
    expect(packageFromSource('')).toBe('');
    expect(packageFromSource(null)).toBe('');
  });
});

describe('labels', () => {
  it('maps known packages to friendly names', () => {
    expect(labelForPackage('com.sec.android.app.shealth')).toBe('Samsung Health');
    expect(labelForPackage('com.strava')).toBe('Strava');
    expect(labelForPackage('com.whoop.mobile')).toBe('WHOOP');
  });

  it('never leaks a raw package name for unknown apps', () => {
    expect(labelForPackage('com.example.mystery')).toBe('Synced');
    expect(labelForPackage('')).toBe('Synced');
    expect(labelForPackage(null)).toBe('Synced');
  });

  it('labelForSource goes straight from a stored tag', () => {
    expect(labelForSource('health_connect:com.garmin.android.apps.connectmobile')).toBe('Garmin Connect');
    expect(labelForSource('health_connect')).toBe('Synced');
  });
});
