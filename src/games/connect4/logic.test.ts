import { describe, expect, it } from 'vitest';
import { GameError } from '../../core/types';
import { apply, COLS, init, ROWS, type C4State } from './logic';

const play = (s: C4State, cols: number[]) => cols.reduce((st, col) => apply(st, { col }, st.turn), s);

describe('connect four', () => {
  it('stacks pieces from the bottom and alternates turns', () => {
    let s = init(0);
    s = apply(s, { col: 3 }, 0);
    expect(s.cells[(ROWS - 1) * COLS + 3]).toBe(0);
    expect(s.turn).toBe(1);
    s = apply(s, { col: 3 }, 1);
    expect(s.cells[(ROWS - 2) * COLS + 3]).toBe(1);
    expect(s.last).toBe((ROWS - 2) * COLS + 3);
  });

  it('rejects moves out of turn, bad columns and full columns', () => {
    const s = init(0);
    expect(() => apply(s, { col: 0 }, 1)).toThrow(GameError);
    expect(() => apply(s, { col: 7 }, 0)).toThrow(GameError);
    expect(() => apply(s, { col: 1.5 }, 0)).toThrow(GameError);
    const full = play(s, [0, 0, 0, 0, 0, 0]);
    expect(() => apply(full, { col: 0 }, full.turn)).toThrow('err.columnFull');
  });

  it('detects a horizontal win', () => {
    const s = play(init(0), [0, 0, 1, 1, 2, 2, 3]);
    expect(s.winner).toBe(0);
    expect(s.line).toHaveLength(4);
    expect(() => apply(s, { col: 4 }, s.turn)).toThrow('err.over');
  });

  it('detects a vertical win', () => {
    const s = play(init(1), [5, 6, 5, 6, 5, 6, 5]);
    expect(s.winner).toBe(1);
  });

  it('detects both diagonals', () => {
    // "/" diagonal for player 0 on columns 0..3
    const up = play(init(0), [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(up.winner).toBe(0);
    // "\" diagonal for player 0 on columns 3..0
    const down = play(init(0), [3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0]);
    expect(down.winner).toBe(0);
  });

  it('declares a draw on a full board with no line', () => {
    // Column order that fills the board without any four-in-a-row.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const s = play(init(0), order);
    expect(s.cells.every((c) => c !== null)).toBe(true);
    expect(s.winner).toBe('draw');
  });
});
