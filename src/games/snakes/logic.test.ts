import { describe, expect, it } from 'vitest';
import { GameError } from '../../core/types';
import { apply, init, LADDERS, LAST, rollDie, SNAKES, squareToCell, type SnakesMove, type SnakesState } from './logic';

const ROLL: SnakesMove = { type: 'roll' };

/** A random source that makes the die show exactly `d`. */
const dieShows = (d: number) => () => (d - 0.5) / 6;

/** A state with the tokens placed where the test needs them. */
const at = (p0: number, p1: number, turn: 0 | 1 = 0): SnakesState => ({ ...init(turn), pos: [p0, p1] });

describe('snakes and ladders: the board map', () => {
  it('has the classic 9 ladders and 10 snakes, all inside the board', () => {
    expect(Object.keys(LADDERS)).toHaveLength(9);
    expect(Object.keys(SNAKES)).toHaveLength(10);
    for (const [a, b] of [...Object.entries(LADDERS), ...Object.entries(SNAKES)].map(([k, v]) => [+k, v])) {
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThan(LAST);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(LAST);
    }
  });

  it('ladders go up and snakes go down', () => {
    for (const [foot, top] of Object.entries(LADDERS)) expect(top).toBeGreaterThan(+foot);
    for (const [head, tail] of Object.entries(SNAKES)) expect(tail).toBeLessThan(+head);
  });

  it('has no square that is both a ladder foot and a snake head', () => {
    const feet = Object.keys(LADDERS).map(Number);
    const heads = Object.keys(SNAKES).map(Number);
    expect(feet.filter((f) => heads.includes(f))).toEqual([]);
  });

  it('never chains: no ladder or snake ends on the start of another one', () => {
    const starts = new Set([...Object.keys(LADDERS), ...Object.keys(SNAKES)].map(Number));
    for (const end of [...Object.values(LADDERS), ...Object.values(SNAKES)]) {
      // a ladder may end exactly on 100 (that wins), nothing else may land on a start
      if (end !== LAST) expect(starts.has(end)).toBe(false);
    }
  });
});

describe('snakes and ladders: square to row / column', () => {
  it('puts 1 bottom-left and 10 bottom-right', () => {
    expect(squareToCell(1)).toEqual({ row: 9, col: 0 });
    expect(squareToCell(10)).toEqual({ row: 9, col: 9 });
  });

  it('puts 11 just above 10, then runs right to left', () => {
    expect(squareToCell(11)).toEqual({ row: 8, col: 9 });
    expect(squareToCell(20)).toEqual({ row: 8, col: 0 });
    expect(squareToCell(21)).toEqual({ row: 7, col: 0 });
  });

  it('puts 100 top-left', () => {
    expect(squareToCell(100)).toEqual({ row: 0, col: 0 });
    expect(squareToCell(91)).toEqual({ row: 0, col: 9 });
  });

  it('gives every square its own cell, and neighbours are always next to each other', () => {
    const seen = new Set<string>();
    for (let n = 1; n <= LAST; n++) {
      const { row, col } = squareToCell(n);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(10);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(10);
      seen.add(`${row},${col}`);
      if (n > 1) {
        const prev = squareToCell(n - 1);
        expect(Math.abs(prev.row - row) + Math.abs(prev.col - col)).toBe(1);
      }
    }
    expect(seen.size).toBe(100);
  });
});

describe('snakes and ladders: rolling', () => {
  it('starts off the board, with a random starter', () => {
    const s = init(1);
    expect(s.pos).toEqual([0, 0]);
    expect(s.turn).toBe(1);
    expect(s.winner).toBeNull();
    expect(s.last).toBeNull();
    expect(s.rolls).toBe(0);
    expect([0, 1]).toContain(init().turn);
  });

  it('maps the random source to 1..6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999999)).toBe(6);
    expect(rollDie(() => 1)).toBe(6); // never 7, even if a source returns exactly 1
    expect([1, 2, 3, 4, 5, 6].map((d) => rollDie(dieShows(d)))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('moves forward by the die and passes the turn', () => {
    const s = apply(init(0), ROLL, 0, dieShows(2));
    expect(s.pos).toEqual([2, 0]);
    expect(s.turn).toBe(1);
    expect(s.winner).toBeNull();
    expect(s.rolls).toBe(1);
    expect(s.last).toEqual({ by: 0, die: 2, from: 0, landed: 2, to: 2, via: null, stayed: false });
  });

  it('moves only the roller, and alternates turns', () => {
    let s = init(0);
    s = apply(s, ROLL, 0, dieShows(2)); // p0 → 2
    s = apply(s, ROLL, 1, dieShows(3)); // p1 → 3
    expect(s.pos).toEqual([2, 3]);
    expect(s.turn).toBe(0);
    s = apply(s, ROLL, 0, dieShows(5)); // p0 → 7
    expect(s.pos).toEqual([7, 3]);
    expect(s.turn).toBe(1);
    expect(s.rolls).toBe(3);
  });

  it('counts every roll, even when the same number comes up again', () => {
    let s = init(0);
    s = apply(s, ROLL, 0, dieShows(2));
    s = apply(s, ROLL, 1, dieShows(2));
    expect(s.rolls).toBe(2);
    expect(s.last?.die).toBe(2);
  });

  it('climbs a ladder', () => {
    const s = apply(init(0), ROLL, 0, dieShows(4)); // lands on 4 → 14
    expect(s.pos[0]).toBe(14);
    expect(s.last).toEqual({ by: 0, die: 4, from: 0, landed: 4, to: 14, via: 'ladder', stayed: false });
    expect(s.turn).toBe(1); // no extra turn
  });

  it('climbs the long first-square ladder', () => {
    const s = apply(init(1), ROLL, 1, dieShows(1)); // 1 → 38
    expect(s.pos).toEqual([0, 38]);
    expect(s.last?.via).toBe('ladder');
  });

  it('slides down a snake', () => {
    const s = apply(at(10, 0), ROLL, 0, dieShows(6)); // 16 → 6
    expect(s.pos[0]).toBe(6);
    expect(s.last).toEqual({ by: 0, die: 6, from: 10, landed: 16, to: 6, via: 'snake', stayed: false });
    expect(s.turn).toBe(1);
  });

  it('does not give an extra turn for a 6', () => {
    const s = apply(init(0), ROLL, 0, dieShows(6));
    expect(s.pos[0]).toBe(6);
    expect(s.turn).toBe(1);
  });

  it('wins by landing exactly on 100', () => {
    const s = apply(at(96, 5), ROLL, 0, dieShows(4));
    expect(s.pos[0]).toBe(100);
    expect(s.winner).toBe(0);
    expect(s.last?.to).toBe(100);
    expect(() => apply(s, ROLL, s.turn, dieShows(1))).toThrow('err.over');
  });

  it('wins by taking the ladder that ends on 100', () => {
    const s = apply(at(5, 74, 1), ROLL, 1, dieShows(6)); // 80 → 100
    expect(s.pos[1]).toBe(100);
    expect(s.winner).toBe(1);
    expect(s.last).toMatchObject({ landed: 80, to: 100, via: 'ladder' });
  });

  it('stays put when the roll would pass 100', () => {
    const s = apply(at(97, 5), ROLL, 0, dieShows(4)); // 101 is too far
    expect(s.pos[0]).toBe(97);
    expect(s.winner).toBeNull();
    expect(s.last).toEqual({ by: 0, die: 4, from: 97, landed: 97, to: 97, via: null, stayed: true });
    expect(s.turn).toBe(1);
    expect(s.rolls).toBe(1);
  });

  it('does not look up a ladder or snake when staying put', () => {
    // 95 + 6 = 101 stays at 95 (95 is itself a snake head, but you are not "landing" on it again)
    const s = apply(at(95, 5), ROLL, 0, dieShows(6));
    expect(s.pos[0]).toBe(95);
    expect(s.last?.via).toBeNull();
    expect(s.last?.stayed).toBe(true);
  });

  it('finishes with the exact number from 99', () => {
    expect(apply(at(99, 5), ROLL, 0, dieShows(2)).pos[0]).toBe(99);
    expect(apply(at(99, 5), ROLL, 0, dieShows(1)).winner).toBe(0);
  });

  it('rejects moves out of turn, unknown moves and moves after the game is over', () => {
    const s = init(0);
    expect(() => apply(s, ROLL, 1)).toThrow('err.notYourTurn');
    expect(() => apply(s, { type: 'jump' } as unknown as SnakesMove, 0)).toThrow('err.unknownMove');
    expect(() => apply(s, null as unknown as SnakesMove, 0)).toThrow(GameError);
    expect(() => apply(s, undefined as unknown as SnakesMove, 0)).toThrow(GameError);
    const won = apply(at(96, 5), ROLL, 0, dieShows(4));
    expect(() => apply(won, ROLL, 1)).toThrow('err.over');
    expect(() => apply(won, ROLL, 0)).toThrow('err.over');
  });

  it('does not mutate the previous state', () => {
    const s = at(10, 20);
    const before = JSON.stringify(s);
    const pos = s.pos;
    const next = apply(s, ROLL, 0, dieShows(6));
    expect(JSON.stringify(s)).toBe(before);
    expect(next.pos).not.toBe(pos);
    expect(s.pos).toEqual([10, 20]);
  });

  it('keeps the state JSON-serialisable, with no undefined values', () => {
    let s = init(0);
    s = apply(s, ROLL, 0, dieShows(4));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(JSON.parse(JSON.stringify(init(0)))).toEqual(init(0));
  });

  it('always finishes a game played with random dice', () => {
    // small deterministic generator, so the test never flakes
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let s = init(0);
    let guard = 0;
    while (s.winner === null && guard++ < 20000) s = apply(s, ROLL, s.turn, rng);
    expect(s.winner).not.toBeNull();
    expect(s.pos[s.winner!]).toBe(LAST);
    expect(s.rolls).toBe(guard);
  });
});
