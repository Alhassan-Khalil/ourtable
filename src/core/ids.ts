// 31 symbols, no I/L/O/0/1 so a code read aloud or typed from a phone is hard to get wrong.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10; // 31^10 is about 2^49.5: not guessable

const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export function newRoomCode(): string {
  let out = '';
  const limit = 256 - (256 % ALPHABET.length); // rejection sampling: no modulo bias
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit && out.length < CODE_LENGTH) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export const formatCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;

/** Accepts "abcde-fghjk", " ABCDEFGHJK " etc. */
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const isValidCode = (code: string) => CODE_RE.test(code);

export const peerIdFor = (code: string) => `ourtable-${code}`;

export function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
}
