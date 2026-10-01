import { describe, expect, it } from 'vitest';
import { GameError, type Player } from '../../core/types';
import { apply, init, type Small, type UtttState } from './logic';

/** Cell index from (board, cell). */
const at = (board: number, cell: number) => board * 9 + cell;

/** Play cell indexes in order; each move is made by whoever's turn it is. */
const play = (s: UtttState, moves: number[]) => moves.reduce((st, i) => apply(st, { i }, st.turn), s);

/** A fresh game with some cells and fields set by hand, so each rule can be tested on its own. */
const mk = (marks: Record<number, Player>, patch: Partial<UtttState> = {}): UtttState => {
  const s = init(0);
  const cells = s.cells.slice();
  for (const [i, p] of Object.entries(marks)) cells[Number(i)] = p;
  return { ...s, cells, ...patch };
};

const smalls = (set: Record<number, Small>): Small[] => {
  const a = Array<Small>(9).fill(null);
  for (const [b, v] of Object.entries(set)) a[Number(b)] = v;
  return a;
};

/** Board 0..7 filled like this (✕=0, ◯=1) with the last cell empty: whoever fills it makes a drawn board. */
//  ✕ ◯ ✕
//  ✕ ◯ ◯
//  ◯ ✕ _
const almostDrawn = (board: number): Record<number, Player> => ({
  [at(board, 0)]: 0,
  [at(board, 1)]: 1,
  [at(board, 2)]: 0,
  [at(board, 3)]: 0,
  [at(board, 4)]: 1,
  [at(board, 5)]: 1,
  [at(board, 6)]: 1,
  [at(board, 7)]: 0,
});

describe('ultimate tic-tac-toe', () => {
  it('starts empty, with the first move free', () => {
    const s = init(1);
    expect(s.cells).toHaveLength(81);
    expect(s.cells.every((c) => c === null)).toBe(true);
    expect(s.small).toEqual(Array(9).fill(null));
    expect(s.turn).toBe(1);
    expect(s.next).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.line).toBeNull();
    expect(s.last).toBeNull();
    // any cell of any board is allowed on the first move
    expect(apply(s, { i: at(7, 2) }, 1).cells[at(7, 2)]).toBe(1);
  });

  it('sends the opponent to the board named by the cell just played', () => {
    let s = init(0);
    s = apply(s, { i: at(0, 4) }, 0);
    expect(s.cells[at(0, 4)]).toBe(0);
    expect(s.next).toBe(4);
    expect(s.turn).toBe(1);
    expect(s.last).toBe(at(0, 4));

    s = apply(s, { i: at(4, 7) }, 1);
    expect(s.cells[at(4, 7)]).toBe(1);
    expect(s.next).toBe(7);
    expect(s.turn).toBe(0);
    expect(s.last).toBe(at(4, 7));
  });

  it('lets the opponent play anywhere when the target board is already won', () => {
    // board 3 belongs to ◯; ✕ plays cell 3 of board 0, which points at board 3
    const s = mk({ [at(3, 0)]: 1, [at(3, 1)]: 1, [at(3, 2)]: 1 }, { small: smalls({ 3: 1 }), turn: 0, next: 0 });
    const after = apply(s, { i: at(0, 3) }, 0);
    expect(after.next).toBeNull();
    expect(after.turn).toBe(1);
    // ...so ◯ may pick any unfinished board, for example 8 or 5
    expect(apply(after, { i: at(8, 0) }, 1).cells[at(8, 0)]).toBe(1);
    expect(apply(after, { i: at(5, 5) }, 1).cells[at(5, 5)]).toBe(1);
  });

  it('lets the opponent play anywhere when the target board is a drawn (full) board', () => {
    const s = mk({ ...almostDrawn(1), [at(1, 8)]: 0 }, { small: smalls({ 1: 'draw' }), turn: 0, next: 0 });
    const after = apply(s, { i: at(0, 1) }, 0);
    expect(after.next).toBeNull();
  });

  it('still refuses a finished board when playing anywhere', () => {
    const s = mk({ [at(3, 0)]: 1, [at(3, 1)]: 1, [at(3, 2)]: 1 }, { small: smalls({ 3: 1 }), turn: 1, next: null });
    expect(() => apply(s, { i: at(3, 5) }, 1)).toThrow('uttt.err.boardDone');
    const drawn = mk(almostDrawn(2), { small: smalls({ 2: 'draw' }), turn: 1, next: null });
    expect(() => apply(drawn, { i: at(2, 8) }, 1)).toThrow('uttt.err.boardDone');
  });

  it('rejects a move in the wrong board', () => {
    const s = apply(init(0), { i: at(0, 4) }, 0); // ◯ must now play in board 4
    expect(() => apply(s, { i: at(0, 0) }, 1)).toThrow('uttt.err.wrongBoard');
    expect(() => apply(s, { i: at(8, 4) }, 1)).toThrow('uttt.err.wrongBoard');
    // even into a board that is finished: the message tells them where to play
    const done = mk({}, { small: smalls({ 5: 0 }), turn: 1, next: 4 });
    expect(() => apply(done, { i: at(5, 0) }, 1)).toThrow('uttt.err.wrongBoard');
  });

  it('rejects a cell that is already taken', () => {
    const s = apply(init(0), { i: 0 }, 0); // ✕ took board 0 cell 0, which sends ◯ to board 0
    expect(() => apply(s, { i: 0 }, 1)).toThrow('uttt.err.taken');
  });

  it('rejects bad cell indexes and malformed moves', () => {
    const s = init(0);
    for (const i of [-1, 81, 100, 1.5, NaN, Infinity]) {
      expect(() => apply(s, { i }, 0)).toThrow('uttt.err.badCell');
    }
    expect(() => apply(s, {} as { i: number }, 0)).toThrow('uttt.err.badCell');
    expect(() => apply(s, null as unknown as { i: number }, 0)).toThrow(GameError);
    expect(() => apply(s, { i: '3' as unknown as number }, 0)).toThrow('uttt.err.badCell');
  });

  it('rejects a move out of turn', () => {
    expect(() => apply(init(0), { i: 0 }, 1)).toThrow('err.notYourTurn');
    expect(() => apply(init(1), { i: 0 }, 0)).toThrow('err.notYourTurn');
    const s = apply(init(0), { i: at(0, 4) }, 0);
    expect(() => apply(s, { i: at(4, 0) }, 0)).toThrow('err.notYourTurn');
  });

  it('wins a small board with three in a row, and the opponent goes where the last cell points', () => {
    const s = mk({ [at(0, 0)]: 0, [at(0, 1)]: 0, [at(0, 3)]: 1, [at(0, 4)]: 1 }, { turn: 0, next: 0 });
    const after = apply(s, { i: at(0, 2) }, 0);
    expect(after.small[0]).toBe(0);
    expect(after.small.slice(1).every((x) => x === null)).toBe(true);
    expect(after.winner).toBeNull();
    expect(after.line).toBeNull();
    expect(after.next).toBe(2);
    // the won board takes no more moves
    const free = { ...after, next: null, turn: 1 as Player };
    expect(() => apply(free, { i: at(0, 8) }, 1)).toThrow('uttt.err.boardDone');
  });

  it('wins a small board on a column and a diagonal too', () => {
    const col = apply(mk({ [at(4, 1)]: 1, [at(4, 4)]: 1 }, { turn: 1, next: 4 }), { i: at(4, 7) }, 1);
    expect(col.small[4]).toBe(1);
    const diag = apply(mk({ [at(6, 2)]: 0, [at(6, 4)]: 0 }, { turn: 0, next: 6 }), { i: at(6, 6) }, 0);
    expect(diag.small[6]).toBe(0);
  });

  it('marks a full small board without a line as drawn (nobody owns it)', () => {
    const s = mk(almostDrawn(0), { turn: 0, next: 0 });
    const after = apply(s, { i: at(0, 8) }, 0);
    expect(after.small[0]).toBe('draw');
    expect(after.winner).toBeNull();
    expect(after.next).toBe(8); // cell 8 points at board 8, which is still open
    // a drawn board takes no more moves either (nothing is left in it anyway)
    expect(() => apply({ ...after, next: null, turn: 1 }, { i: at(0, 0) }, 1)).toThrow('uttt.err.boardDone');
  });

  it('wins the game with three small boards in a row', () => {
    const s = mk({ [at(2, 0)]: 0, [at(2, 1)]: 0 }, { small: smalls({ 0: 0, 1: 0 }), turn: 0, next: 2 });
    const after = apply(s, { i: at(2, 2) }, 0);
    expect(after.small[2]).toBe(0);
    expect(after.winner).toBe(0);
    expect(after.line).toEqual([0, 1, 2]);
    expect(after.next).toBeNull();
    expect(() => apply(after, { i: at(5, 5) }, 1)).toThrow('err.over');
    expect(() => apply(after, { i: at(5, 5) }, 0)).toThrow('err.over');
  });

  it('wins the game on a diagonal of boards for ◯', () => {
    const s = mk({ [at(8, 3)]: 1, [at(8, 4)]: 1 }, { small: smalls({ 0: 1, 4: 1 }), turn: 1, next: 8 });
    const after = apply(s, { i: at(8, 5) }, 1);
    expect(after.winner).toBe(1);
    expect(after.line).toEqual([0, 4, 8]);
  });

  it('does not count drawn boards toward a line', () => {
    const s = mk({ [at(2, 0)]: 0, [at(2, 1)]: 0 }, { small: smalls({ 0: 0, 1: 'draw' }), turn: 0, next: 2 });
    const after = apply(s, { i: at(2, 2) }, 0);
    expect(after.small[2]).toBe(0);
    expect(after.winner).toBeNull();
    expect(after.line).toBeNull();
  });

  it('is a draw when every small board is finished and nobody has a line', () => {
    // boards 0..7 are settled so that no line exists, board 8 is about to be a drawn board
    const small = smalls({ 0: 0, 1: 1, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 0 });
    const s = mk(almostDrawn(8), { small, turn: 0, next: 8 });
    const after = apply(s, { i: at(8, 8) }, 0);
    expect(after.small[8]).toBe('draw');
    expect(after.winner).toBe('draw');
    expect(after.line).toBeNull();
    expect(after.next).toBeNull();
    expect(() => apply(after, { i: at(0, 0) }, 1)).toThrow('err.over');
  });

  it('a winning line beats a full board of finished boards', () => {
    const small = smalls({ 0: 0, 1: 0, 3: 1, 4: 1, 5: 'draw', 6: 1, 7: 'draw', 8: 'draw' });
    const s = mk({ [at(2, 3)]: 0, [at(2, 4)]: 0 }, { small, turn: 0, next: 2 });
    const after = apply(s, { i: at(2, 5) }, 0);
    expect(after.small.every((x) => x !== null)).toBe(true);
    expect(after.winner).toBe(0);
    expect(after.line).toEqual([0, 1, 2]);
  });

  it('plays a few real turns in a row', () => {
    // ✕ b0c4 → ◯ b4c0 → ✕ b0c1 → ◯ b1c0 → ✕ b0c0 → ◯ b0c2
    const s = play(init(0), [at(0, 4), at(4, 0), at(0, 1), at(1, 0), at(0, 0)]);
    expect(s.turn).toBe(1);
    expect(s.next).toBe(0);
    expect(s.cells.filter((c) => c === 0)).toHaveLength(3);
    expect(s.cells.filter((c) => c === 1)).toHaveLength(2);
    expect(apply(s, { i: at(0, 2) }, 1).next).toBe(2);
  });

  it('does not mutate the previous state', () => {
    const s = mk(almostDrawn(0), { turn: 0, next: 0 });
    const before = JSON.stringify(s);
    const after = apply(s, { i: at(0, 8) }, 0);
    expect(JSON.stringify(s)).toBe(before);
    expect(after.cells).not.toBe(s.cells);
    expect(after.small).not.toBe(s.small);
    // and a rejected move leaves it alone too
    expect(() => apply(s, { i: at(0, 0) }, 0)).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('keeps state JSON-serialisable', () => {
    const s = apply(init(0), { i: at(2, 6) }, 0);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
