import { describe, expect, it } from 'vitest';
import { GameError } from '../../core/types';
import { apply, init, type DotsMove, type DotsState } from './logic';

/** Play moves in order; each move is made by whoever's turn it is. */
const play = (s: DotsState, moves: DotsMove[]) => moves.reduce((st, m) => apply(st, m, st.turn), s);

// In a 2×2 game: h has 3 rows × 2 = 6 lines, v has 2 rows × 3 = 6 lines.
const H = (r: number, c: number, n = 2): DotsMove => ({ o: 'h', i: r * n + c });
const V = (r: number, c: number, n = 2): DotsMove => ({ o: 'v', i: r * (n + 1) + c });

describe('dots and boxes', () => {
  it('starts empty with the right number of lines and boxes', () => {
    const s = init(0, 5);
    expect(s.h).toHaveLength(30);
    expect(s.v).toHaveLength(30);
    expect(s.boxes).toHaveLength(25);
  });

  it('alternates turns when no box is closed', () => {
    let s = init(0, 2);
    s = apply(s, H(0, 0), 0);
    expect(s.h[0]).toBe(0);
    expect(s.turn).toBe(1);
    expect(s.last).toEqual({ o: 'h', i: 0, by: 0, closed: 0 });
  });

  it('rejects bad moves', () => {
    const s = init(0, 2);
    expect(() => apply(s, H(0, 0), 1)).toThrow('err.notYourTurn');
    expect(() => apply(s, { o: 'h', i: 6 }, 0)).toThrow('dots.err.badLine');
    expect(() => apply(s, { o: 'x' as 'h', i: 0 }, 0)).toThrow('dots.err.badLine');
    expect(() => apply(s, { o: 'v', i: 1.5 }, 0)).toThrow(GameError);
    const s2 = apply(s, H(0, 0), 0);
    expect(() => apply(s2, H(0, 0), 1)).toThrow('dots.err.taken');
  });

  it('closing a box scores and gives another turn', () => {
    // three sides of box (0,0), then the fourth by whoever's turn it is
    let s = play(init(0, 2), [H(0, 0), H(1, 0), V(0, 0)]); // turns: 0, 1, 0 → now 1
    expect(s.turn).toBe(1);
    s = apply(s, V(0, 1), 1);
    expect(s.boxes[0]).toBe(1);
    expect(s.scores).toEqual([0, 1]);
    expect(s.turn).toBe(1); // goes again
    expect(s.last?.closed).toBe(1);
  });

  it('one line can close two boxes at once', () => {
    // box (0,0) and (0,1) share the vertical line v(0,1)
    let s = play(init(0, 2), [H(0, 0), H(1, 0), V(0, 0), H(0, 1), H(1, 1), V(0, 2)]);
    const mover = s.turn;
    s = apply(s, V(0, 1), mover);
    expect(s.last?.closed).toBe(2);
    expect(s.scores[mover]).toBe(2);
  });

  it('ends when every box is closed and picks the winner', () => {
    const all: DotsMove[] = [
      ...[0, 1, 2].flatMap((r) => [H(r, 0), H(r, 1)]),
      ...[0, 1].flatMap((r) => [V(r, 0), V(r, 1), V(r, 2)]),
    ];
    const s = play(init(0, 2), all);
    expect(s.boxes.every((b) => b !== null)).toBe(true);
    expect(s.scores[0] + s.scores[1]).toBe(4);
    const expected = s.scores[0] === s.scores[1] ? 'draw' : s.scores[0] > s.scores[1] ? 0 : 1;
    expect(s.winner).toBe(expected);
    expect(() => apply(s, H(0, 0), s.turn)).toThrow('err.over');
  });

  it('does not mutate the previous state', () => {
    const s = init(0, 2);
    const before = JSON.stringify(s);
    apply(s, H(0, 0), 0);
    expect(JSON.stringify(s)).toBe(before);
  });
});
