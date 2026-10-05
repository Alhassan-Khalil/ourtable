import { GameError, type Seat } from '../../core/types';

/**
 * Ludo for 2 or 3 players on the classic cross board.
 *
 * The board has 4 corners (yards), numbered clockwise. With 2 players they sit in opposite corners
 * (0 and 2), with 3 players in corners 0, 1 and 2.
 *
 * The main track is 52 squares, numbered 0..51 clockwise. Corner c's start square is 13 × c.
 * A token's progress `p` counts from its own start square:
 *   -1        in the yard
 *   0..50     on the main track, on square (start + p) % 52
 *   51..55    in its own home column (nobody else can go there)
 *   56        finished (in the centre)
 */
export const TRACK_LEN = 52;
export const YARD = -1;
export const LAST_ON_TRACK = 50;
export const FINISH = 56;
/** The star squares (safe), on the main track. */
export const STARS: readonly number[] = [8, 21, 34, 47];

export const startOf = (corner: number) => corner * 13;
/** The main-track square a token of this corner stands on (only for progress 0..50). */
export const squareOf = (corner: number, p: number) => (startOf(corner) + p) % TRACK_LEN;
/** Every corner's start square (used or not) and the four stars are safe: nobody is captured there. */
export const isSafe = (square: number) => square % 13 === 0 || STARS.includes(square);
/** Which corner each player sits in. */
export const cornersFor = (players: number): number[] => (players === 3 ? [0, 1, 2] : [0, 2]);

export interface LudoOptions {
  /** Tokens per player: 2 (quick) or 4 (classic). */
  tokens: 2 | 4;
}

export interface Captured {
  player: Seat;
  token: number;
}

/** What the last action did, for the message line and the animations. */
export interface LudoLast {
  by: Seat;
  die: number;
  /** The token that moved (null: nothing moved, e.g. waiting for a choice or no move possible). */
  token: number | null;
  from: number | null;
  to: number | null;
  /** Opponent tokens sent back to their yard by this move. */
  captured: Captured[];
  /** The only possible move, played without asking. */
  auto: boolean;
  /** No token could move with this roll. */
  passed: boolean;
  /** Rolled a 6 (and didn't win): the same player rolls again. */
  again: boolean;
  /** The third 6 in a row: the turn ended with no move. */
  thirdSix: boolean;
}

export interface LudoState {
  players: number;
  /** The corner of each player. */
  corners: number[];
  /** Per player, the progress of each token. */
  tokens: number[][];
  turn: Seat;
  phase: 'roll' | 'move' | 'over';
  /** The roll waiting to be used (only during the 'move' phase). */
  die: number | null;
  /** 6s rolled in a row by the player whose turn it is. */
  sixes: number;
  winner: Seat | null;
  last: LudoLast | null;
  /** Counts every roll, so the screen can replay the die animation even when the same number comes up. */
  rolls: number;
}

export type LudoMove = { type: 'roll' } | { type: 'move'; token: number };

export function init(opts: LudoOptions | null | undefined, players: number, starter?: Seat): LudoState {
  const n = players === 3 ? 3 : 2;
  const k = opts?.tokens === 4 ? 4 : 2;
  return {
    players: n,
    corners: cornersFor(n),
    tokens: Array.from({ length: n }, () => Array<number>(k).fill(YARD)),
    turn: starter ?? (Math.floor(Math.random() * n) as Seat),
    phase: 'roll',
    die: null,
    sixes: 0,
    winner: null,
    last: null,
    rolls: 0,
  };
}

/** 1..6 from a random source returning [0, 1). */
export function rollDie(rng: () => number): number {
  return Math.min(5, Math.floor(rng() * 6)) + 1;
}

/** Can a token at progress `p` move with this roll? (A 6 brings it out; it must land exactly on 56.) */
export function canMove(p: number, die: number): boolean {
  if (p === YARD) return die === 6;
  return p < FINISH && p + die <= FINISH;
}

export const targetOf = (p: number, die: number) => (p === YARD ? 0 : p + die);

/** Indices of the tokens that can move with this roll. */
export function movable(tokens: readonly number[], die: number): number[] {
  const out: number[] = [];
  tokens.forEach((p, k) => {
    if (canMove(p, die)) out.push(k);
  });
  return out;
}

const nextPlayer = (by: Seat, players: number) => ((by + 1) % players) as Seat;

/** The die is rolled here, so only the host (which runs `apply`) ever decides the number. */
export function apply(s: LudoState, move: LudoMove, by: Seat, rng: () => number = Math.random): LudoState {
  if (s.phase === 'over' || s.winner !== null) throw new GameError('err.over');
  if (by !== s.turn) throw new GameError('err.notYourTurn');
  const type = (move as { type?: unknown } | null | undefined)?.type;

  if (type === 'roll') {
    if (s.phase !== 'roll') throw new GameError('ludo.err.moveFirst');
    const die = rollDie(rng);
    const rolls = s.rolls + 1;
    const sixes = die === 6 ? s.sixes + 1 : 0;
    const base: LudoLast = {
      by,
      die,
      token: null,
      from: null,
      to: null,
      captured: [],
      auto: false,
      passed: false,
      again: false,
      thirdSix: false,
    };

    // Three 6s in a row: the turn ends at once, nothing moves.
    if (sixes === 3) {
      return { ...s, turn: nextPlayer(by, s.players), phase: 'roll', die: null, sixes: 0, rolls, last: { ...base, passed: true, thirdSix: true } };
    }

    const options = movable(s.tokens[by], die);
    if (options.length === 0) {
      // Nothing can move. A 6 still earns another roll.
      const again = die === 6;
      return {
        ...s,
        turn: again ? by : nextPlayer(by, s.players),
        phase: 'roll',
        die: null,
        sixes: again ? sixes : 0,
        rolls,
        last: { ...base, passed: true, again },
      };
    }

    // Tokens on the same spot (e.g. all in the yard) make the same move: count distinct moves.
    const distinct = new Set(options.map((k) => s.tokens[by][k]));
    if (distinct.size === 1) return moveToken({ ...s, sixes, rolls }, by, options[0], die, true);

    return { ...s, phase: 'move', die, sixes, rolls, last: base };
  }

  if (type === 'move') {
    if (s.phase !== 'move' || s.die === null) throw new GameError('ludo.err.rollFirst');
    const k = (move as { token?: unknown }).token;
    const mine = s.tokens[by];
    if (typeof k !== 'number' || !Number.isInteger(k) || k < 0 || k >= mine.length) throw new GameError('ludo.err.badToken');
    if (!canMove(mine[k], s.die)) throw new GameError('ludo.err.cantMove');
    return moveToken(s, by, k, s.die, false);
  }

  throw new GameError('err.unknownMove');
}

/** Move one token (already checked to be legal), capture, and work out who plays next. */
function moveToken(s: LudoState, by: Seat, k: number, die: number, auto: boolean): LudoState {
  const from = s.tokens[by][k];
  const to = targetOf(from, die);
  const tokens = s.tokens.map((t) => t.slice());
  tokens[by][k] = to;

  const captured: Captured[] = [];
  if (to <= LAST_ON_TRACK) {
    const square = squareOf(s.corners[by], to);
    if (!isSafe(square)) {
      tokens.forEach((theirs, q) => {
        if (q === by) return;
        theirs.forEach((p, j) => {
          if (p >= 0 && p <= LAST_ON_TRACK && squareOf(s.corners[q], p) === square) {
            theirs[j] = YARD;
            captured.push({ player: q as Seat, token: j });
          }
        });
      });
    }
  }

  const won = tokens[by].every((p) => p === FINISH);
  const again = !won && die === 6;
  return {
    ...s,
    tokens,
    turn: won || again ? by : nextPlayer(by, s.players),
    phase: won ? 'over' : 'roll',
    die: null,
    sixes: again ? s.sixes : 0,
    winner: won ? by : null,
    last: { by, die, token: k, from, to, captured, auto, passed: false, again, thirdSix: false },
  };
}

/** Progress of a token of `corner` standing on main-track `square` (inverse of squareOf). */
export const progressOn = (corner: number, square: number) => (square - startOf(corner) + TRACK_LEN) % TRACK_LEN;

/** How many tokens each player has brought home. */
export const homeCounts = (tokens: readonly (readonly number[])[]) => tokens.map((t) => t.filter((p) => p === FINISH).length);
