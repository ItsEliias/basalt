// GS1 check-digit validation — on-device, before any network lookup.
// Covers EAN-8, UPC-A (GTIN-12), EAN-13 and GTIN-14 with the standard
// mod-10 algorithm: from the rightmost digit excluding the check digit,
// weight alternately 3, 1, 3, 1…; check = (10 − sum mod 10) mod 10.

export type Gs1Format = 'EAN-8' | 'UPC-A' | 'EAN-13' | 'GTIN-14';

const LENGTH_TO_FORMAT: Record<number, Gs1Format> = {
  8: 'EAN-8',
  12: 'UPC-A',
  13: 'EAN-13',
  14: 'GTIN-14',
};

export function gs1CheckDigit(digitsWithoutCheck: string): number | null {
  if (!/^\d+$/.test(digitsWithoutCheck)) return null;
  let sum = 0;
  let weight = 3; // rightmost digit (excluding check) always carries weight 3
  for (let i = digitsWithoutCheck.length - 1; i >= 0; i--) {
    sum += Number(digitsWithoutCheck[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function validateGs1(
  barcode: string,
): { valid: boolean; format: Gs1Format | null; reason?: string } {
  const trimmed = barcode.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, format: null, reason: 'Barcode must be digits only.' };
  }
  const format = LENGTH_TO_FORMAT[trimmed.length];
  if (!format) {
    return { valid: false, format: null, reason: `Unsupported length (${trimmed.length}).` };
  }
  const expected = gs1CheckDigit(trimmed.slice(0, -1));
  const actual = Number(trimmed[trimmed.length - 1]);
  if (expected !== actual) {
    return { valid: false, format, reason: `Check digit mismatch (expected ${expected}).` };
  }
  return { valid: true, format };
}
