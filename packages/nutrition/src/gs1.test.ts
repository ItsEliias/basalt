import { describe, it, expect } from 'vitest';
import { gs1CheckDigit, validateGs1 } from './gs1';

// Known-valid codes from the GS1 spec examples.
const VALID_EAN13 = '4006381333931';
const VALID_UPCA = '036000291452';
const VALID_EAN8 = '73513537';

describe('gs1CheckDigit', () => {
  it('computes the spec examples', () => {
    expect(gs1CheckDigit('400638133393')).toBe(1);
    expect(gs1CheckDigit('03600029145')).toBe(2);
    expect(gs1CheckDigit('7351353')).toBe(7);
  });
  it('rejects non-digits', () => {
    expect(gs1CheckDigit('40063a133393')).toBeNull();
  });
});

describe('validateGs1', () => {
  it('accepts valid EAN-13 / UPC-A / EAN-8', () => {
    expect(validateGs1(VALID_EAN13)).toEqual({ valid: true, format: 'EAN-13' });
    expect(validateGs1(VALID_UPCA)).toEqual({ valid: true, format: 'UPC-A' });
    expect(validateGs1(VALID_EAN8)).toEqual({ valid: true, format: 'EAN-8' });
  });

  it('rejects a flipped check digit with the expected digit named', () => {
    const r = validateGs1('4006381333932');
    expect(r.valid).toBe(false);
    expect(r.format).toBe('EAN-13');
    expect(r.reason).toContain('expected 1');
  });

  it('rejects transposed digits (the error class check digits exist for)', () => {
    // 4006381333931 with two adjacent digits swapped.
    expect(validateGs1('4006381333391').valid).toBe(false);
  });

  it('rejects junk cleanly', () => {
    expect(validateGs1('').valid).toBe(false);
    expect(validateGs1('123').valid).toBe(false);
    expect(validateGs1('abcdefgh').valid).toBe(false);
    expect(validateGs1('12345678901234567').valid).toBe(false);
  });

  it('trims whitespace from scanner output', () => {
    expect(validateGs1(` ${VALID_EAN13} `).valid).toBe(true);
  });
});
