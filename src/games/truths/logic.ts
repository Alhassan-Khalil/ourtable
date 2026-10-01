import { GameError, other, type Player } from '../../core/types';

/**
 * Two Truths and a Lie. Three rounds. In each round both players write three statements about
 * themselves (one of them a lie) at the same time, then each tries to find the other's lie.
 *
 *   write  → both players write; each submission is shuffled by the host and locked in
 *   guess  → both players see the partner's shuffled statements and pick the lie
 *   reveal → both sides are shown, points are in (skipped after the last round: it goes to over)
 *   over   → final result, winner by points
 *
 * Scoring per round: finding your partner's lie is 1 point for you; missing it is 1 point for
 * your partner (they fooled you).
 */
export const ROUNDS = 3;
export const MAX_LEN = 140;

export type Idx = 0 | 1 | 2;
export type Items = [string, string, string];
export type Phase = 'write' | 'guess' | 'reveal' | 'over';

/** What one player wrote. `items` are already shuffled (this is the order the partner sees) and `lie` points into them. */
export interface Entry {
  items: Items;
  lie: Idx;
}

export interface TruthsState {
  rounds: number;
  /** 1-based. */
  round: number;
  phase: Phase;
  /** entries[p] = what player p wrote this round (null until locked in). */
  entries: [Entry | null, Entry | null];
  /** guesses[p] = the statement player p picked as the lie in the PARTNER's entry (null until locked in). */
  guesses: [Idx | null, Idx | null];
  scores: [number, number];
  winner: Player | 'draw' | null;
}

export type TruthsMove =
  | { type: 'write'; items: Items; lie: Idx }
  | { type: 'guess'; index: Idx }
  /** `round` = the round the button was pressed in, so a second, simultaneous press is harmless. */
  | { type: 'next'; round?: number };

/** What one player is allowed to see. All keys always present (null, never undefined). */
export interface TruthsView {
  rounds: number;
  round: number;
  phase: Phase;
  scores: [number, number];
  winner: Player | 'draw' | null;
  /** My own statements and which one is my lie (null until I lock them in). */
  mine: Entry | null;
  /** Has the partner locked in their statements? (The statements themselves stay hidden.) */
  oppWrote: boolean;
  /** The partner's statements, shuffled. null until both have written. Never says which one is the lie. */
  theirs: Items | null;
  /** My pick among `theirs` (my own guess, so it is always mine to know). */
  myGuess: Idx | null;
  /** Only whether the partner has guessed yet, never what they picked (until reveal). */
  oppGuessed: boolean;
  /** Reveal / over only: which of `theirs` is the lie. */
  theirLie: Idx | null;
  /** Reveal / over only: what the partner picked among MY statements (same indexes as `mine.items`). */
  oppGuess: Idx | null;
}

/** Random source: Math.random in the game, a fixed one in tests. */
export type Rng = () => number;

export function init(rounds = ROUNDS): TruthsState {
  return {
    rounds,
    round: 1,
    phase: 'write',
    entries: [null, null],
    guesses: [null, null],
    scores: [0, 0],
    winner: null,
  };
}

const isIdx = (x: unknown): x is Idx => x === 0 || x === 1 || x === 2;

/** Three strings, each 1 to MAX_LEN characters after collapsing whitespace and trimming. */
function cleanItems(raw: unknown): Items {
  if (!Array.isArray(raw) || raw.length !== 3) throw new GameError('truths.err.badStatements');
  const out = raw.map((x) => {
    const text = typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '';
    if (text.length < 1 || text.length > MAX_LEN) throw new GameError('truths.err.badStatements');
    return text;
  });
  return out as Items;
}

/** Fisher-Yates over [0, 1, 2]: order[k] = which written statement goes in shown position k. */
function shuffleOrder(rng: Rng): number[] {
  const order = [0, 1, 2];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function apply(s: TruthsState, move: TruthsMove, by: Player, rng: Rng = Math.random): TruthsState {
  if (s.phase === 'over') throw new GameError('err.over');

  switch (move?.type) {
    case 'write': {
      if (s.phase !== 'write') throw new GameError('truths.err.notWriting');
      if (s.entries[by] !== null) throw new GameError('truths.err.alreadyWrote');
      const items = cleanItems(move.items);
      if (!isIdx(move.lie)) throw new GameError('truths.err.badLie');

      // Shuffle now, so where the lie sits tells the partner nothing; the lie moves with its text.
      const order = shuffleOrder(rng);
      const shown = order.map((k) => items[k]) as Items;
      const lie = order.indexOf(move.lie) as Idx;

      const entries: TruthsState['entries'] = [...s.entries];
      entries[by] = { items: shown, lie };
      const both = entries[0] !== null && entries[1] !== null;
      return { ...s, entries, phase: both ? 'guess' : 'write' };
    }

    case 'guess': {
      if (s.phase !== 'guess') throw new GameError('truths.err.notGuessing');
      if (s.guesses[by] !== null) throw new GameError('truths.err.alreadyGuessed');
      if (!isIdx(move.index)) throw new GameError('truths.err.badGuess');

      const guesses: TruthsState['guesses'] = [...s.guesses];
      guesses[by] = move.index;
      if (guesses[0] === null || guesses[1] === null) return { ...s, guesses };

      // Both are in: finding the partner's lie scores for you, missing it scores for them.
      const scores: [number, number] = [...s.scores];
      for (const p of [0, 1] as const) {
        const author = other(p);
        if (guesses[p] === s.entries[author]?.lie) scores[p]++;
        else scores[author]++;
      }
      if (s.round >= s.rounds) {
        const winner = scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1;
        return { ...s, guesses, scores, phase: 'over', winner };
      }
      return { ...s, guesses, scores, phase: 'reveal' };
    }

    case 'next': {
      // Both players pressed "Next round" at about the same time: the round already moved on.
      if (typeof move.round === 'number' && move.round < s.round) return s;
      if (s.phase !== 'reveal') throw new GameError('truths.err.notReveal');
      return { ...s, round: s.round + 1, phase: 'write', entries: [null, null], guesses: [null, null] };
    }

    default:
      throw new GameError('err.unknownMove');
  }
}

export function view(s: TruthsState, me: Player): TruthsView {
  const opp = other(me);
  const theirEntry = s.entries[opp];
  // Once the phase has left 'write' both entries exist; before that the partner's text stays hidden.
  const bothWrote = s.phase !== 'write';
  const revealed = s.phase === 'reveal' || s.phase === 'over';
  return {
    rounds: s.rounds,
    round: s.round,
    phase: s.phase,
    scores: s.scores,
    winner: s.winner,
    mine: s.entries[me],
    oppWrote: theirEntry !== null,
    theirs: bothWrote && theirEntry ? theirEntry.items : null,
    myGuess: s.guesses[me],
    oppGuessed: s.guesses[opp] !== null,
    theirLie: revealed && theirEntry ? theirEntry.lie : null,
    oppGuess: revealed ? s.guesses[opp] : null,
  };
}
