import { describe, expect, it } from 'vitest';
import { GameError, type Player } from '../../core/types';
import { apply, init, MAX_LEN, TOTAL, view, type StoryState } from './logic';

/** Distinctive text for sentence i. The trailing "x" keeps "mk1x" from matching inside "mk10x". */
const mk = (i: number) => `mk${i}x`;

const write = (s: StoryState, text: string, by: Player = s.turn) => apply(s, { type: 'write', text }, by);

/** Write `n` sentences (mk0x, mk1x, …), each by whoever's turn it is. */
const play = (s: StoryState, n: number, from = s.lines.length) => {
  let st = s;
  for (let i = from; i < from + n; i++) st = write(st, mk(i));
  return st;
};

const json = (v: unknown) => JSON.stringify(v);

describe('our story: rules', () => {
  it('starts empty, with the chosen player to write, and 10 sentences to go', () => {
    const s = init(1);
    expect(s).toEqual({ lines: [], turn: 1, total: TOTAL, done: false });
    expect(TOTAL).toBe(10);
  });

  it('alternates turns and records who wrote each sentence', () => {
    let s = init(0);
    for (let i = 0; i < 4; i++) {
      const who = s.turn;
      s = write(s, mk(i));
      expect(s.lines[i]).toEqual({ by: who, text: mk(i) });
      expect(s.turn).toBe(who === 0 ? 1 : 0);
    }
    expect(s.lines.map((l) => l.by)).toEqual([0, 1, 0, 1]);
  });

  it('trims the sentence and turns newlines / repeated spaces into single spaces', () => {
    const s = write(init(0), '  Hello \n\n  there   world  ');
    expect(s.lines[0].text).toBe('Hello there world');
  });

  it('rejects a move from the wrong player', () => {
    const s = init(0);
    expect(() => write(s, 'hi', 1)).toThrow('err.notYourTurn');
    expect(() => write(write(s, 'a'), 'b', 0)).toThrow('err.notYourTurn');
  });

  it('rejects empty, blank and non-text sentences', () => {
    const s = init(0);
    expect(() => write(s, '')).toThrow('story.err.empty');
    expect(() => write(s, '   \n\t ')).toThrow('story.err.empty');
    expect(() => apply(s, { type: 'write', text: 42 as unknown as string }, 0)).toThrow(GameError);
  });

  it('rejects unknown moves', () => {
    const s = init(0);
    expect(() => apply(s, { type: 'skip' } as never, 0)).toThrow('err.unknownMove');
    expect(() => apply(s, null as never, 0)).toThrow('err.unknownMove');
  });

  it('accepts exactly 200 characters and rejects 201', () => {
    const s = init(0);
    expect(write(s, 'a'.repeat(MAX_LEN)).lines).toHaveLength(1);
    expect(() => write(s, 'a'.repeat(MAX_LEN + 1))).toThrow('story.err.tooLong');
  });

  it('counts an emoji as one character, and measures after trimming', () => {
    const s = init(0);
    expect(write(s, '😀'.repeat(MAX_LEN)).lines).toHaveLength(1);
    expect(write(s, `   ${'a'.repeat(MAX_LEN)}   `).lines).toHaveLength(1);
    expect(() => write(s, '😀'.repeat(MAX_LEN + 1))).toThrow('story.err.tooLong');
  });

  it('finishes after `total` sentences and refuses more', () => {
    const almost = play(init(0), TOTAL - 1);
    expect(almost.done).toBe(false);
    const s = write(almost, mk(TOTAL - 1));
    expect(s.done).toBe(true);
    expect(s.lines).toHaveLength(TOTAL);
    expect(() => write(s, 'one more')).toThrow('err.over');
    expect(() => write(s, 'one more', s.turn === 0 ? 1 : 0)).toThrow('err.over');
  });

  it('each player writes half of the sentences', () => {
    const s = play(init(1), TOTAL);
    expect(s.lines.filter((l) => l.by === 0)).toHaveLength(TOTAL / 2);
    expect(s.lines.filter((l) => l.by === 1)).toHaveLength(TOTAL / 2);
  });

  it('does not mutate the previous state', () => {
    const s = play(init(0), 3);
    const before = json(s);
    const lines = s.lines;
    const next = write(s, 'something new');
    expect(json(s)).toBe(before);
    expect(next.lines).not.toBe(lines);
    expect(s.lines).toHaveLength(3);
    expect(next.lines).toHaveLength(4);
  });
});

describe('our story: hidden information', () => {
  it('shows nothing at the very start, to either player', () => {
    const s = init(0);
    for (const p of [0, 1] as const) {
      const v = view(s, p);
      expect(v.prev).toBeNull();
      expect(v.lines).toBeNull();
      expect(v.written).toBe(0);
    }
  });

  it('on my turn I see only my partner’s last sentence; on theirs I see nothing', () => {
    // mk0x by 0, mk1x by 1, mk2x by 0, mk3x by 1 → now it is 0's turn
    const s = play(init(0), 4);
    expect(s.turn).toBe(0);

    const mine = json(view(s, 0));
    expect(mine).toContain(mk(3)); // the partner's last sentence
    for (const i of [0, 1, 2]) expect(mine).not.toContain(mk(i)); // including my own earlier ones

    const theirs = json(view(s, 1));
    for (const i of [0, 1, 2, 3]) expect(theirs).not.toContain(mk(i));
    expect(view(s, 1).prev).toBeNull();
  });

  it('never leaks more than the last sentence, at any point of the game', () => {
    let s = init(1);
    for (let i = 0; i < TOTAL - 1; i++) {
      s = write(s, mk(i));
      for (const p of [0, 1] as const) {
        const v = view(s, p);
        const text = json(v);
        expect(v.lines).toBeNull();
        for (let k = 0; k <= i; k++) {
          const visible = k === i && p === s.turn; // only the last one, only on my turn
          expect(text.includes(mk(k))).toBe(visible);
        }
        expect(v.prev).toBe(p === s.turn ? mk(i) : null);
      }
    }
  });

  it('exposes progress only as numbers', () => {
    const s = play(init(0), 3);
    const v = view(s, 1);
    expect(v.written).toBe(3);
    expect(v.total).toBe(TOTAL);
    expect(v.turn).toBe(s.turn);
    expect(v.done).toBe(false);
  });

  it('reveals every sentence, with its author, once the story is finished', () => {
    const s = play(init(0), TOTAL);
    for (const p of [0, 1] as const) {
      const v = view(s, p);
      expect(v.done).toBe(true);
      expect(v.prev).toBeNull();
      expect(v.lines).toEqual(s.lines);
      const text = json(v);
      for (let i = 0; i < TOTAL; i++) expect(text).toContain(mk(i));
    }
    expect(view(s, 0).lines?.map((l) => l.by)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it('only reveals the story after the last sentence, not before', () => {
    const almost = play(init(0), TOTAL - 1);
    for (const p of [0, 1] as const) expect(view(almost, p).lines).toBeNull();
  });

  it('views are JSON-serialisable with every key present (null, never undefined)', () => {
    const states = [init(0), play(init(0), 3), play(init(1), TOTAL)];
    for (const s of states)
      for (const p of [0, 1] as const) {
        const v = view(s, p);
        expect(Object.keys(v).sort()).toEqual(['done', 'lines', 'prev', 'total', 'turn', 'written']);
        expect(Object.values(v).every((x) => x !== undefined)).toBe(true);
        expect(JSON.parse(json(v))).toEqual(v);
      }
  });

  it('keeps the revealed story under one array reference, so it is only synced once', () => {
    const s = play(init(0), TOTAL);
    expect(view(s, 0).lines).toBe(view(s, 1).lines);
    expect(view(s, 0).lines).toBe(view(s, 0).lines);
  });
});
