// BLE smart-scale support — the STANDARD Bluetooth SIG Weight Scale
// profile only (service 0x181D, Weight Measurement characteristic
// 0x2A9D). Scales speaking proprietary protocols are out of scope and
// the UI says so; guessing at undocumented byte layouts would put
// invented numbers in a ledger.
//
// Weight Measurement layout (GATT spec):
//   byte 0     flags — bit0: 0 = SI (kg = raw × 0.005), 1 = imperial
//              (lb = raw × 0.01); bit1: timestamp present (+7 bytes);
//              bit2: user id (+1); bit3: BMI & height (+4)
//   bytes 1–2  weight, uint16 little-endian; 0xFFFF = measurement failed

export const WEIGHT_SCALE_SERVICE = '181d';
export const WEIGHT_MEASUREMENT_CHAR = '2a9d';

const LB_TO_KG = 0.45359237;

export type ScaleReading = { weightKg: number };

/** Parse a Weight Measurement payload; null when unparseable or failed. */
export function parseWeightMeasurement(bytes: Uint8Array): ScaleReading | null {
  if (bytes.length < 3) return null;
  const flags = bytes[0]!;
  const raw = bytes[1]! | (bytes[2]! << 8);
  if (raw === 0xffff) return null; // the scale itself says the reading failed
  const imperial = (flags & 0x01) === 0x01;
  const weightKg = imperial ? raw * 0.01 * LB_TO_KG : raw * 0.005;
  if (weightKg <= 0 || weightKg > 400) return null;
  return { weightKg: Math.round(weightKg * 100) / 100 };
}

/** Base64 → bytes without Buffer — RN's global atob handles the transport encoding. */
export function b64ToBytes(b64: string, atobImpl: (s: string) => string): Uint8Array {
  const bin = atobImpl(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
