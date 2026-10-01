import { describe, expect, it } from 'vitest';
import { formatCode, isValidCode, newRoomCode, normalizeCode } from './ids';

describe('room codes', () => {
  it('are 10 unambiguous characters and valid', () => {
    for (let i = 0; i < 200; i++) {
      const c = newRoomCode();
      expect(c).toMatch(/^[A-Z2-9]{10}$/);
      expect(c).not.toMatch(/[ILO01]/);
      expect(isValidCode(c)).toBe(true);
    }
  });

  it('are not repeated', () => {
    const codes = new Set(Array.from({ length: 2000 }, newRoomCode));
    expect(codes.size).toBe(2000);
  });

  it('survive formatting and sloppy typing', () => {
    const c = newRoomCode();
    expect(normalizeCode(formatCode(c))).toBe(c);
    expect(normalizeCode(` ${formatCode(c).toLowerCase()} `)).toBe(c);
    expect(isValidCode('ABCDE')).toBe(false);
    expect(isValidCode('ABCDEFGHIJ')).toBe(false); // I is not in the alphabet
  });
});
