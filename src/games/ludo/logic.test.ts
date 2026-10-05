import { describe, expect, it } from 'vitest';
import { GameError, type Seat } from '../../core/types';
import { cellOf, HOME_COLUMN, placeOf, TRACK, triangle, YARD_ORIGIN, yardSpot } from './board';
import {
  apply,
  canMove,
  FINISH,
  init,
  isSafe,
  movable,
  progressOn,
  rollDie,
  squareOf,
  STARS,
  YARD,
  type LudoMove,
  type LudoState,
} from './logic';

const ROLL: LudoMove = { type: 'roll' };
const MOVE = (token: number): LudoMove => ({ type: 'move', token });

/** A random source that makes the die show exactly `d`. */
const dieShows = (d: number) => () => (d - 0.5) / 6;

/** A state with the tokens placed where the test needs them (one array per player). */
const at = (tokens: number[][], turn: Seat = 0): LudoState => ({
  ...init({ tokens: tokens[0].length === 4 ? 4 : 2 }, tokens.length, turn),
  tokens,
});

/** Roll `d` for whoever's turn it is. */
const roll = (s: LudoState, d: number) => apply(s, ROLL, s.turn, dieShows(d));

describe('ludo: setup', () => {
  it('starts with every token in the yard, 2 tokens by default', () => {
    const s = init({ tokens: 2 }, 2, 1);
    expect(s.players).toBe(2);
    expect(s.tokens).toEqual([
      [YARD, YARD],
      [YARD, YARD],
    ]);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('roll');
    expect(s).toMatchObject({ die: null, sixes: 0, winner: null, last: null, rolls: 0 });
    expect(init(null, 2, 0).tokens[0]).toHaveLength(2);
  });

  it('has 4 tokens each in the classic game', () => {
    const s = init({ tokens: 4 }, 3, 0);
    expect(s.tokens).toHaveLength(3);
    for (const t of s.tokens) expect(t).toEqual([YARD, YARD, YARD, YARD]);
  });

  it('puts 2 players in opposite corners and 3 players in corners 0, 1, 2', () => {
    expect(init(null, 2, 0).corners).toEqual([0, 2]);
    expect(init(null, 3, 0).corners).toEqual([0, 1, 2]);
  });

  it('picks a random starter among the players', () => {
    for (let i = 0; i < 20; i++) {
      expect([0, 1]).toContain(init(null, 2).turn);
      expect([0, 1, 2]).toContain(init(null, 3).turn);
    }
  });

  it('maps the random source to 1..6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999999)).toBe(6);
    expect(rollDie(() => 1)).toBe(6);
    expect([1, 2, 3, 4, 5, 6].map((d) => rollDie(dieShows(d)))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps the state JSON-serialisable', () => {
    let s = init({ tokens: 4 }, 3, 0);
    s = roll(s, 6);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('ludo: the board', () => {
  it('has 52 distinct track squares, each next to the one before (and round the loop)', () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map(([c, r]) => `${c},${r}`)).size).toBe(52);
    let diagonal = 0;
    TRACK.forEach(([c, r], i) => {
      const [pc, pr] = TRACK[(i + 51) % 52];
      expect(Math.max(Math.abs(pc - c), Math.abs(pr - r))).toBe(1);
      if (pc !== c && pr !== r) diagonal++;
    });
    expect(diagonal).toBe(4); // the classic path cuts each inner corner of the cross diagonally
    // never through a yard or the centre
    for (const [c, r] of TRACK) expect((c >= 6 && c <= 8) || (r >= 6 && r <= 8)).toBe(true);
    for (const [c, r] of TRACK) expect(c >= 6 && c <= 8 && r >= 6 && r <= 8).toBe(false);
  });

  it('puts the start squares and stars where the classic board has them', () => {
    expect(TRACK[0]).toEqual([1, 6]);
    expect(TRACK[13]).toEqual([8, 1]);
    expect(TRACK[26]).toEqual([13, 8]);
    expect(TRACK[39]).toEqual([6, 13]);
    expect(STARS.map((q) => TRACK[q])).toEqual([
      [6, 2],
      [12, 6],
      [8, 12],
      [2, 8],
    ]);
  });

  it('runs each home column from the square before the start straight to the centre', () => {
    for (const corner of [0, 1, 2, 3]) {
      const entry = cellOf(corner, 50)!;
      const col = HOME_COLUMN[corner];
      expect(Math.abs(col[0][0] - entry[0]) + Math.abs(col[0][1] - entry[1])).toBe(1);
      for (let i = 1; i < 5; i++) expect(Math.abs(col[i][0] - col[i - 1][0]) + Math.abs(col[i][1] - col[i - 1][1])).toBe(1);
      // the last cell touches the centre square (cells 6..8)
      expect(col[4].every((v) => v >= 5 && v <= 9)).toBe(true);
      expect(cellOf(corner, 55)).toEqual(col[4]);
    }
  });

  it('places yard spots inside the yard and finish spots inside the centre', () => {
    for (const corner of [0, 1, 2, 3]) {
      const [c, r] = YARD_ORIGIN[corner];
      for (let k = 0; k < 4; k++) {
        const p = yardSpot(corner, k, 4);
        expect(p.x).toBeGreaterThan(c);
        expect(p.x).toBeLessThan(c + 6);
        expect(p.y).toBeGreaterThan(r);
        expect(p.y).toBeLessThan(r + 6);
        const f = placeOf(corner, FINISH, k, 4);
        expect(f.x).toBeGreaterThan(6);
        expect(f.x).toBeLessThan(9);
        expect(f.y).toBeGreaterThan(6);
        expect(f.y).toBeLessThan(9);
      }
      expect(triangle(corner)).toHaveLength(3);
    }
  });

  it('stacks tokens on the same square under one key', () => {
    // player in corner 0 at progress 30 and player in corner 2 at progress 4: both on square 30
    expect(squareOf(0, 30)).toBe(squareOf(2, 4));
    expect(placeOf(0, 30, 0, 2).key).toBe(placeOf(2, 4, 1, 2).key);
    expect(placeOf(0, YARD, 0, 2).key).not.toBe(placeOf(0, YARD, 1, 2).key);
  });
});

describe('ludo: rules helpers', () => {
  it('needs a 6 to leave the yard and an exact roll to finish', () => {
    expect([1, 2, 3, 4, 5].some((d) => canMove(YARD, d))).toBe(false);
    expect(canMove(YARD, 6)).toBe(true);
    expect(canMove(53, 3)).toBe(true);
    expect(canMove(53, 4)).toBe(false);
    expect(canMove(FINISH, 1)).toBe(false);
    expect(movable([YARD, 10, 54, FINISH], 2)).toEqual([1, 2]);
  });

  it('knows the safe squares: every start square and the four stars', () => {
    expect([0, 13, 26, 39, 8, 21, 34, 47].every(isSafe)).toBe(true);
    expect([1, 5, 9, 12, 14, 30, 51].some(isSafe)).toBe(false);
    expect(progressOn(2, squareOf(2, 17))).toBe(17);
  });
});

describe('ludo: rolling and moving', () => {
  it('only leaves the yard on a 6', () => {
    let s = init(null, 2, 0);
    for (const d of [1, 2, 3, 4, 5]) {
      const next = apply(s, ROLL, 0, dieShows(d));
      expect(next.tokens).toEqual(s.tokens);
      expect(next.turn).toBe(1);
      expect(next.last).toMatchObject({ by: 0, die: d, token: null, passed: true, again: false });
    }
    s = roll(s, 6);
    expect(s.tokens[0]).toEqual([0, YARD]);
    expect(s.last).toMatchObject({ by: 0, die: 6, token: 0, from: YARD, to: 0, auto: true, again: true });
  });

  it('a 6 gives another roll after the move', () => {
    const s = roll(init(null, 2, 0), 6);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('roll');
    expect(s.sixes).toBe(1);
    const t = roll(s, 3); // only the token on the track can move
    expect(t.tokens[0]).toEqual([3, YARD]);
    expect(t.turn).toBe(1);
    expect(t.sixes).toBe(0);
  });

  it('moves a token forward by the die and passes the turn', () => {
    const s = roll(at([[3, YARD], [YARD, YARD]]), 4);
    expect(s.tokens[0]).toEqual([7, YARD]);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('roll');
    expect(s.die).toBeNull();
    expect(s.rolls).toBe(1);
  });

  it('plays the only legal move automatically', () => {
    const s = roll(at([[10, FINISH], [YARD, YARD]]), 5);
    expect(s.tokens[0]).toEqual([15, FINISH]);
    expect(s.last).toMatchObject({ token: 0, from: 10, to: 15, auto: true, passed: false });
  });

  it('treats tokens on the same spot as one move (no pointless choice)', () => {
    let s = roll(at([[YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]), 6);
    expect(s.tokens[0]).toEqual([0, YARD, YARD, YARD]);
    expect(s.last?.auto).toBe(true);
    s = roll(at([[5, 5, YARD, FINISH], [YARD, YARD, YARD, YARD]]), 3);
    expect(s.tokens[0]).toEqual([8, 5, YARD, FINISH]);
  });

  it('asks the player to choose when several tokens can move', () => {
    let s = roll(at([[3, 10], [YARD, YARD]]), 2);
    expect(s.phase).toBe('move');
    expect(s.die).toBe(2);
    expect(s.turn).toBe(0);
    expect(s.tokens[0]).toEqual([3, 10]);
    expect(s.last).toMatchObject({ by: 0, die: 2, token: null, passed: false, auto: false });
    s = apply(s, MOVE(1), 0);
    expect(s.tokens[0]).toEqual([3, 12]);
    expect(s.phase).toBe('roll');
    expect(s.die).toBeNull();
    expect(s.turn).toBe(1);
    expect(s.last).toMatchObject({ token: 1, from: 10, to: 12, auto: false });
    expect(s.rolls).toBe(1); // choosing is not a roll
  });

  it('on a 6 a yard token is one of the choices', () => {
    let s = roll(at([[YARD, 10], [YARD, YARD]]), 6);
    expect(s.phase).toBe('move');
    s = apply(s, MOVE(0), 0);
    expect(s.tokens[0]).toEqual([0, 10]);
    expect(s.turn).toBe(0); // rolled a 6: again
    expect(s.last?.again).toBe(true);
  });

  it('gives another roll for a 6 even when nothing can move', () => {
    const s = roll(at([[FINISH, 52], [YARD, YARD]]), 6);
    expect(s.tokens[0]).toEqual([FINISH, 52]);
    expect(s.turn).toBe(0);
    expect(s.sixes).toBe(1);
    expect(s.last).toMatchObject({ passed: true, again: true, thirdSix: false });
  });

  it('ends the turn on the third 6 in a row, with no move', () => {
    let s = roll(at([[3, 10], [YARD, YARD]]), 6);
    s = apply(s, MOVE(0), 0); // 3 → 9
    expect(s.sixes).toBe(1);
    s = roll(s, 6);
    s = apply(s, MOVE(1), 0); // 10 → 16
    expect(s.sixes).toBe(2);
    expect(s.turn).toBe(0);
    const before = s.tokens;
    s = roll(s, 6);
    expect(s.tokens).toEqual(before);
    expect(s.turn).toBe(1);
    expect(s.sixes).toBe(0);
    expect(s.phase).toBe('roll');
    expect(s.last).toMatchObject({ die: 6, token: null, passed: true, again: false, thirdSix: true });
  });

  it('counts sixes only in a row', () => {
    let s = roll(at([[20, FINISH], [YARD, YARD]]), 6); // 26, again
    expect(s.sixes).toBe(1);
    s = roll(s, 2); // 28, turn passes
    expect(s.sixes).toBe(0);
    expect(s.turn).toBe(1);
    s = roll(s, 6); // player 1 brings a token out
    expect(s.sixes).toBe(1);
    expect(s.turn).toBe(1);
  });

  it('never overshoots the finish: a too-big roll is no move', () => {
    const s = roll(at([[53, FINISH], [YARD, YARD]]), 4);
    expect(s.tokens[0]).toEqual([53, FINISH]);
    expect(s.last?.passed).toBe(true);
    expect(s.turn).toBe(1);
  });

  it('only offers the tokens that fit when choosing', () => {
    let s = roll(at([[54, 20], [YARD, YARD]]), 3); // 54 + 3 = 57: only token 1 can move
    expect(s.tokens[0]).toEqual([54, 23]);
    expect(s.last?.auto).toBe(true);
    s = roll(at([[54, 20], [YARD, YARD]]), 2); // both fit
    expect(s.phase).toBe('move');
  });

  it('finishes with the exact number', () => {
    const s = roll(at([[53, 10], [YARD, YARD]]), 3);
    expect(s.phase).toBe('move');
    const t = apply(s, MOVE(0), 0);
    expect(t.tokens[0]).toEqual([FINISH, 10]);
    expect(t.last?.to).toBe(FINISH);
    expect(t.winner).toBeNull();
  });

  it('enters the home column after a full lap instead of going round again', () => {
    const s = roll(at([[48, FINISH], [YARD, YARD]]), 5); // 48 → 53
    expect(s.tokens[0][0]).toBe(53);
    expect(cellOf(0, 53)).toEqual(HOME_COLUMN[0][2]);
    const t = roll(at([[50, FINISH], [YARD, YARD]]), 1); // last track square → first home cell
    expect(t.tokens[0][0]).toBe(51);
  });

  it('cannot be captured in the home column', () => {
    // player 0 lands on progress 53 (home column). Player 1 sits on main-track square 1,
    // which is where progress 53 would be if the track went on.
    const theirs = progressOn(2, squareOf(0, 53));
    const s = roll(at([[48, FINISH], [theirs, YARD]]), 5);
    expect(s.tokens[1]).toEqual([theirs, YARD]);
    expect(s.last?.captured).toEqual([]);
  });
});

describe('ludo: captures and safe squares', () => {
  it('sends an opponent token on the landing square back to its yard', () => {
    const theirs = progressOn(2, squareOf(0, 9)); // square 9 is not safe
    const s = roll(at([[5, FINISH], [theirs, 3]]), 4);
    expect(s.tokens[0]).toEqual([9, FINISH]);
    expect(s.tokens[1]).toEqual([YARD, 3]);
    expect(s.last?.captured).toEqual([{ player: 1, token: 0 }]);
    expect(s.turn).toBe(1); // no extra turn for a capture
  });

  it('captures every opponent token on that square (no blocks)', () => {
    const p1 = progressOn(2, squareOf(0, 30));
    const s = roll(at([[27, FINISH], [p1, p1]]), 3);
    expect(s.tokens[1]).toEqual([YARD, YARD]);
    expect(s.last?.captured).toEqual([
      { player: 1, token: 0 },
      { player: 1, token: 1 },
    ]);
  });

  it('captures tokens of both opponents in a 3-player game', () => {
    const sq = squareOf(0, 20);
    const s = roll(at([[16, FINISH], [progressOn(1, sq), YARD], [YARD, progressOn(2, sq)]]), 4);
    expect(s.tokens[1]).toEqual([YARD, YARD]);
    expect(s.tokens[2]).toEqual([YARD, YARD]);
    expect(s.last?.captured).toHaveLength(2);
  });

  it('never captures your own tokens: they share the square', () => {
    const s = roll(at([[5, 9], [YARD, YARD]]), 4);
    expect(s.phase).toBe('move');
    const t = apply(s, MOVE(0), 0);
    expect(t.tokens[0]).toEqual([9, 9]);
    expect(t.last?.captured).toEqual([]);
  });

  it('does not capture on a star', () => {
    const theirs = progressOn(2, 8);
    const s = roll(at([[4, FINISH], [theirs, YARD]]), 4);
    expect(s.tokens[0]).toEqual([8, FINISH]);
    expect(s.tokens[1]).toEqual([theirs, YARD]);
    expect(s.last?.captured).toEqual([]);
  });

  it('does not capture on a start square, used or not', () => {
    // player 1's start square (26)
    let s = roll(at([[22, FINISH], [0, YARD]]), 4);
    expect(s.tokens[1]).toEqual([0, YARD]);
    // the empty corner's start square (13) in a 2-player game
    const theirs = progressOn(2, 13);
    s = roll(at([[9, FINISH], [theirs, YARD]]), 4);
    expect(s.tokens[1]).toEqual([theirs, YARD]);
  });

  it('coming out onto your start square never captures', () => {
    const theirs = progressOn(2, 0); // player 1's token sits on player 0's start square
    const s = roll(at([[YARD, FINISH], [theirs, YARD]]), 6);
    expect(s.tokens[0]).toEqual([0, FINISH]);
    expect(s.tokens[1]).toEqual([theirs, YARD]);
  });
});

describe('ludo: turn order and winning', () => {
  it('alternates in a 2-player game, and the second player starts from the opposite corner', () => {
    let s = init(null, 2, 0);
    s = roll(s, 1);
    expect(s.turn).toBe(1);
    s = roll(s, 6); // player 1 comes out on its own start square: 26
    expect(s.tokens[1]).toEqual([0, YARD]);
    expect(squareOf(s.corners[1], s.tokens[1][0])).toBe(26);
    s = roll(s, 2);
    expect(s.turn).toBe(0);
  });

  it('goes 0 → 1 → 2 → 0 with 3 players', () => {
    let s = init(null, 3, 0);
    const order: number[] = [];
    for (let i = 0; i < 6; i++) {
      order.push(s.turn);
      s = roll(s, 2);
    }
    expect(order).toEqual([0, 1, 2, 0, 1, 2]);
    s = init(null, 3, 2);
    s = roll(s, 3);
    expect(s.turn).toBe(0);
  });

  it('starts each of 3 players from their own corner', () => {
    let s = init(null, 3, 0);
    for (let i = 0; i < 3; i++) {
      s = roll(s, 6);
      s = roll(s, 1);
    }
    expect(s.tokens.map((t, p) => squareOf(s.corners[p], t[0]))).toEqual([1, 14, 27]);
  });

  it('wins by bringing every token home, and the game is over', () => {
    const s = roll(at([[FINISH, 53], [10, YARD]]), 3);
    expect(s.tokens[0]).toEqual([FINISH, FINISH]);
    expect(s.winner).toBe(0);
    expect(s.phase).toBe('over');
    expect(s.last?.again).toBe(false);
    expect(() => apply(s, ROLL, 1, dieShows(1))).toThrow('err.over');
    expect(() => apply(s, ROLL, 0, dieShows(1))).toThrow('err.over');
  });

  it('winning with a 6 does not give another roll', () => {
    const s = roll(at([[50, FINISH], [YARD, YARD]], 0), 6);
    expect(s.winner).toBe(0);
    expect(s.phase).toBe('over');
  });

  it('player 2 can win a 3-player game', () => {
    const s = roll(at([[YARD, YARD], [YARD, YARD], [FINISH, 55]], 2), 1);
    expect(s.winner).toBe(2);
  });

  it('always finishes a game played with random dice (2 and 3 players, 4 tokens)', () => {
    for (const players of [2, 3]) {
      let seed = 4242 + players;
      const rng = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      let s = init({ tokens: 4 }, players, 0);
      let guard = 0;
      while (s.phase !== 'over' && guard++ < 20000) {
        if (s.phase === 'roll') s = apply(s, ROLL, s.turn, rng);
        else s = apply(s, MOVE(movable(s.tokens[s.turn], s.die!).pop()!), s.turn);
      }
      expect(s.winner).not.toBeNull();
      expect(s.tokens[s.winner!].every((p) => p === FINISH)).toBe(true);
    }
  });
});

describe('ludo: illegal moves', () => {
  it('rejects moves out of turn', () => {
    const s = init(null, 3, 1);
    expect(() => apply(s, ROLL, 0)).toThrow('err.notYourTurn');
    expect(() => apply(s, ROLL, 2)).toThrow('err.notYourTurn');
  });

  it('rejects moving before rolling, and rolling before moving', () => {
    const s = at([[3, 10], [YARD, YARD]]);
    expect(() => apply(s, MOVE(0), 0)).toThrow('ludo.err.rollFirst');
    const t = roll(s, 2);
    expect(t.phase).toBe('move');
    expect(() => apply(t, ROLL, 0)).toThrow('ludo.err.moveFirst');
    expect(() => apply(t, MOVE(0), 1)).toThrow('err.notYourTurn');
  });

  it('rejects a token that cannot move with this roll', () => {
    const s = roll(at([[YARD, 10, 54, 20], [YARD, YARD, YARD, YARD]]), 3);
    expect(s.phase).toBe('move');
    expect(() => apply(s, MOVE(0), 0)).toThrow('ludo.err.cantMove'); // in the yard, not a 6
    expect(() => apply(s, MOVE(2), 0)).toThrow('ludo.err.cantMove'); // 54 + 3 overshoots
    const done = roll(at([[FINISH, 10, 20, YARD], [YARD, YARD, YARD, YARD]]), 2);
    expect(() => apply(done, MOVE(0), 0)).toThrow('ludo.err.cantMove'); // already home
  });

  it('rejects bad token indices', () => {
    const s = roll(at([[3, 10], [YARD, YARD]]), 2);
    for (const token of [-1, 2, 1.5, NaN, '0' as unknown as number, null as unknown as number]) {
      expect(() => apply(s, { type: 'move', token }, 0)).toThrow('ludo.err.badToken');
    }
  });

  it('rejects unknown moves', () => {
    const s = init(null, 2, 0);
    expect(() => apply(s, { type: 'jump' } as unknown as LudoMove, 0)).toThrow('err.unknownMove');
    expect(() => apply(s, null as unknown as LudoMove, 0)).toThrow(GameError);
    expect(() => apply(s, undefined as unknown as LudoMove, 0)).toThrow(GameError);
  });
});

describe('ludo: purity', () => {
  it('does not mutate the previous state (roll, choice, capture)', () => {
    const theirs = progressOn(2, squareOf(0, 9));
    const s = at([[5, 3], [theirs, YARD]]);
    const before = JSON.stringify(s);
    const rolled = apply(s, ROLL, 0, dieShows(4));
    expect(JSON.stringify(s)).toBe(before);
    const rolledBefore = JSON.stringify(rolled);
    const moved = apply(rolled, MOVE(0), 0);
    expect(JSON.stringify(rolled)).toBe(rolledBefore);
    expect(JSON.stringify(s)).toBe(before);
    expect(moved.tokens[1][0]).toBe(YARD);
    expect(s.tokens[1][0]).toBe(theirs);
    expect(moved.tokens).not.toBe(rolled.tokens);
  });
});
