import { describe, it, expect } from 'vitest';
import { parseWeightMeasurement, b64ToBytes, WEIGHT_SCALE_SERVICE } from './ble-scale';

describe('parseWeightMeasurement', () => {
  it('SI: raw × 0.005 kg (80.00 kg = 16000 LE)', () => {
    // flags 0x00, 16000 = 0x3E80 → bytes 0x80 0x3E
    expect(parseWeightMeasurement(new Uint8Array([0x00, 0x80, 0x3e]))).toEqual({ weightKg: 80 });
  });

  it('imperial: raw × 0.01 lb converted to kg', () => {
    // flags 0x01, 17637 × 0.01 lb = 176.37 lb ≈ 80.00 kg
    const raw = 17637;
    const r = parseWeightMeasurement(new Uint8Array([0x01, raw & 0xff, raw >> 8]));
    expect(r!.weightKg).toBeCloseTo(80.0, 1);
  });

  it('0xFFFF is the scale saying the reading failed — null, never a number', () => {
    expect(parseWeightMeasurement(new Uint8Array([0x00, 0xff, 0xff]))).toBeNull();
  });

  it('extra fields (timestamp etc.) after the weight are ignored safely', () => {
    const withTs = new Uint8Array([0x02, 0x80, 0x3e, 0xe7, 0x07, 0x08, 0x1f, 0x07, 0x00, 0x00]);
    expect(parseWeightMeasurement(withTs)).toEqual({ weightKg: 80 });
  });

  it('junk and impossible values are rejected', () => {
    expect(parseWeightMeasurement(new Uint8Array([0x00]))).toBeNull();
    expect(parseWeightMeasurement(new Uint8Array([0x00, 0x00, 0x00]))).toBeNull();
  });
});

describe('b64ToBytes', () => {
  it('decodes via the supplied atob', () => {
    const atobImpl = (s: string) => Buffer.from(s, 'base64').toString('binary');
    expect([...b64ToBytes('AIA+', atobImpl)]).toEqual([0x00, 0x80, 0x3e]);
  });
});

describe('constants', () => {
  it('standard SIG identifiers, lowercase', () => {
    expect(WEIGHT_SCALE_SERVICE).toBe('181d');
  });
});
