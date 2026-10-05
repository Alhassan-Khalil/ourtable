import { GameError, MAX_SEATS } from '../../core/types';

/**
 * Categories (إنسان حيوان جماد نبات) for 2 or 3 players.
 *
 *   write  → a letter is shown; everyone types five answers (name, animal, plant, object, place) AT THE SAME TIME.
 *            The Board sends drafts as people type, so the host always holds the latest text.
 *            Whoever has all five filled can press Stop, which ends the writing for everyone at once.
 *   review → all answers are revealed side by side. Wrong-letter and empty answers score nothing on their own;
 *            players can reject OTHER players' answers (an answer is out when every other player rejected it).
 *            When everyone is ready the points are added and the next round starts (or the game ends).
 *   over   → totals; the highest total wins, a tie at the top is a draw.
 *
 * Scoring per category: a valid answer nobody else also gave is 10, the same valid answer as another player is 5,
 * an empty / wrong-letter / rejected answer is 0.
 *
 * Hidden information: during `write` a view only says HOW MANY fields each other player has filled, never what is in them.
 */

export const CATEGORIES = 5;
export const MAX_ANSWER_LEN = 30;
export const POINTS_UNIQUE = 10;
export const POINTS_SHARED = 5;

export type Alphabet = 'ar' | 'en';
export type Phase = 'write' | 'review' | 'over';

export interface CatOptions {
  alphabet: Alphabet;
  rounds: 3 | 5;
}

/** The letters a round can use. Arabic skips the rare ones (ث ذ ض ظ غ), English skips Q, X and Z. */
export const ALPHABETS: Record<Alphabet, readonly string[]> = {
  ar: 'ا ب ت ج ح خ د ر ز س ش ص ط ع ف ق ك ل م ن ه و ي'.split(' '),
  en: 'ABCDEFGHIJKLMNOPRSTUVWY'.split(''),
};

export interface CatState {
  alphabet: Alphabet;
  rounds: number;
  /** How many people play (2 or 3). */
  players: number;
  /** 1-based. */
  round: number;
  phase: Phase;
  /** The letter of every round so far; the last one is the current round's. */
  letters: string[];
  /** answers[p] = player p's five answers (the latest draft while writing, final once reviewing). */
  answers: string[][];
  /** Who pressed Stop this round (null while writing). */
  stoppedBy: number | null;
  /**
   * rejects[p][c] = bit mask of the players who rejected player p's answer in category c
   * (bit q set = player q rejected it). Only meaningful in review.
   */
  rejects: number[][];
  ready: boolean[];
  /** Points added after each finished round. */
  scores: number[];
  /** history[r][p] = points player p earned in round r+1. */
  history: number[][];
  winner: number | 'draw' | null;
}

export type CatMove =
  /** The five answers as typed so far. Fire-and-forget: a late one (after the writing ended) is ignored. */
  | { type: 'draft'; answers: string[] }
  /** All five must be filled. Ends the writing for everyone. */
  | { type: 'stop'; answers: string[] }
  | { type: 'reject'; player: number; category: number; on: boolean; round?: number }
  /** `round` = the round the button was pressed in, so a late press can't leak into the next round. */
  | { type: 'ready'; round?: number };

/** What one player is allowed to see. All keys always present (null, never undefined). */
export interface CatView {
  alphabet: Alphabet;
  rounds: number;
  players: number;
  round: number;
  phase: Phase;
  letter: string;
  letters: string[];
  scores: number[];
  history: number[][];
  winner: number | 'draw' | null;
  /** My own five answers (always mine to see). */
  mine: string[];
  /** How many of their five boxes each player has filled (the texts stay hidden while writing). */
  filled: number[];
  stoppedBy: number | null;
  /** Review / over only: everyone's answers. null while writing. */
  answers: string[][] | null;
  /** Review / over only. */
  rejects: number[][] | null;
  ready: boolean[];
}

/** Random source: Math.random in the game, a fixed one in tests. */
export type Rng = () => number;

// ---------- text ----------

/** Arabic harakat, superscript alef, tatweel, and invisible direction marks. */
const MARKS = /[ً-ٰٟـ​-‏؜﻿]/g;
/** The letters people commonly swap, folded together so they compare equal. */
const FOLD: Record<string, string> = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه' };

/** Trim and collapse whitespace. What gets stored and shown. */
export const tidy = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

/**
 * The comparison form of an answer: no diacritics / tatweel, a leading «ال» dropped, أ إ آ ٱ folded to ا
 * (and a few other usual swaps), lower-case Latin without accents.
 *
 * «ال» is only dropped when it is written with a plain alef, so «ألمانيا» (Germany) keeps its alef,
 * while «الأسد» and «الجمل» start with «أ» and «ج» for the game's purposes.
 */
export function normalize(raw: string): string {
  let s = tidy(raw.normalize('NFKC').replace(MARKS, ''));
  s = s.replace(/^[اٱ]ل(?=\S)/, '');
  s = Array.from(s, (c) => FOLD[c] ?? c).join('');
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Does the answer start with the round's letter (after normalising both)? Empty answers don't. */
export function startsWithLetter(answer: string, letter: string): boolean {
  const first = Array.from(normalize(answer))[0];
  return first !== undefined && first === normalize(letter);
}

export type AutoVerdict = 'ok' | 'empty' | 'wrongLetter';

/** What can be decided without asking the other players. */
export function autoVerdict(answer: string, letter: string): AutoVerdict {
  if (normalize(answer) === '') return 'empty';
  return startsWithLetter(answer, letter) ? 'ok' : 'wrongLetter';
}

// ---------- scoring ----------

export type Verdict = AutoVerdict | 'rejected';

export interface Cell {
  verdict: Verdict;
  /** The same valid answer was also given by someone else. */
  shared: boolean;
  points: number;
}

/** Rejected means every OTHER player rejected it. */
export function isRejected(mask: number, player: number, players: number): boolean {
  const others = ((1 << players) - 1) & ~(1 << player);
  return others !== 0 && (mask & others) === others;
}

/** How many players have rejected an answer (for "1 of 2"). */
export const countBits = (mask: number): number => {
  let n = 0;
  for (let m = mask; m > 0; m >>= 1) n += m & 1;
  return n;
};

/** cells[p][c] for one round. */
export function scoreRound(answers: string[][], letter: string, rejects: number[][]): Cell[][] {
  const players = answers.length;
  const verdicts: Verdict[][] = answers.map((row, p) =>
    row.map((a, c) => {
      const v = autoVerdict(a, letter);
      return v === 'ok' && isRejected(rejects[p]?.[c] ?? 0, p, players) ? 'rejected' : v;
    }),
  );

  const cells: Cell[][] = verdicts.map((row) => row.map((verdict) => ({ verdict, shared: false, points: 0 })));
  for (let c = 0; c < CATEGORIES; c++) {
    const seen = new Map<string, number[]>();
    for (let p = 0; p < players; p++) {
      if (verdicts[p][c] !== 'ok') continue;
      const key = normalize(answers[p][c]);
      seen.set(key, [...(seen.get(key) ?? []), p]);
    }
    for (const group of seen.values()) {
      for (const p of group) {
        const shared = group.length > 1;
        cells[p][c] = { verdict: 'ok', shared, points: shared ? POINTS_SHARED : POINTS_UNIQUE };
      }
    }
  }
  return cells;
}

/** Points per player for one round. */
export const roundPoints = (cells: Cell[][]): number[] => cells.map((row) => row.reduce((sum, c) => sum + c.points, 0));

/** The players holding the highest total. */
export function leaders(scores: readonly number[]): number[] {
  const top = Math.max(...scores);
  return scores.flatMap((s, p) => (s === top ? [p] : []));
}

// ---------- game ----------

/** Draw a letter not used yet in this game. */
export function drawLetter(alphabet: Alphabet, used: readonly string[], rng: Rng): string {
  const all = ALPHABETS[alphabet];
  const free = all.filter((l) => !used.includes(l));
  const pool = free.length > 0 ? free : all;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

const zeros = (n: number) => Array<number>(n).fill(0);
const blankAnswers = (players: number) => Array.from({ length: players }, () => Array<string>(CATEGORIES).fill(''));
const blankRejects = (players: number) => Array.from({ length: players }, () => zeros(CATEGORIES));

export function init(opts: CatOptions, players = 2, rng: Rng = Math.random): CatState {
  const alphabet: Alphabet = opts?.alphabet === 'en' ? 'en' : 'ar';
  const rounds = opts?.rounds === 3 ? 3 : 5;
  const n = Math.min(MAX_SEATS, Math.max(2, Math.trunc(Number(players)) || 2));
  return {
    alphabet,
    rounds,
    players: n,
    round: 1,
    phase: 'write',
    letters: [drawLetter(alphabet, [], rng)],
    answers: blankAnswers(n),
    stoppedBy: null,
    rejects: blankRejects(n),
    ready: Array<boolean>(n).fill(false),
    scores: zeros(n),
    history: [],
    winner: null,
  };
}

/** Exactly five strings, each at most MAX_ANSWER_LEN characters once tidied. */
function cleanAnswers(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length !== CATEGORIES) throw new GameError('categories.err.badAnswers');
  return raw.map((x) => {
    if (typeof x !== 'string') throw new GameError('categories.err.badAnswers');
    const text = tidy(x);
    if (text.length > MAX_ANSWER_LEN) throw new GameError('categories.err.badAnswers');
    return text;
  });
}

const withRow = <T>(rows: T[], i: number, row: T): T[] => rows.map((r, k) => (k === i ? row : r));

/** Everyone is ready: add the points, then start the next round or end the game. */
function finishRound(s: CatState, rng: Rng): CatState {
  const pts = roundPoints(scoreRound(s.answers, s.letters[s.round - 1], s.rejects));
  const scores = s.scores.map((x, p) => x + pts[p]);
  const history = [...s.history, pts];

  if (s.round >= s.rounds) {
    const top = leaders(scores);
    return { ...s, phase: 'over', scores, history, winner: top.length === 1 ? top[0] : 'draw' };
  }
  return {
    ...s,
    round: s.round + 1,
    phase: 'write',
    letters: [...s.letters, drawLetter(s.alphabet, s.letters, rng)],
    answers: blankAnswers(s.players),
    stoppedBy: null,
    rejects: blankRejects(s.players),
    ready: Array<boolean>(s.players).fill(false),
    scores,
    history,
  };
}

export function apply(s: CatState, move: CatMove, by: number, rng: Rng = Math.random): CatState {
  if (!Number.isInteger(by) || by < 0 || by >= s.players) throw new GameError('err.notInGame');

  switch (move?.type) {
    case 'draft': {
      // Drafts are fire-and-forget (also sent when a field loses focus), so one that arrives after the
      // writing ended is a harmless race, not a mistake.
      if (s.phase !== 'write') return s;
      return { ...s, answers: withRow(s.answers, by, cleanAnswers(move.answers)) };
    }

    case 'stop': {
      if (s.phase === 'over') throw new GameError('err.over');
      if (s.phase !== 'write') throw new GameError('categories.err.notWriting');
      const answers = cleanAnswers(move.answers);
      if (answers.some((a) => a === '')) throw new GameError('categories.err.fillAll');
      return {
        ...s,
        phase: 'review',
        answers: withRow(s.answers, by, answers),
        stoppedBy: by,
        rejects: blankRejects(s.players),
        ready: Array<boolean>(s.players).fill(false),
      };
    }

    case 'reject': {
      // A press from an earlier round that arrived late.
      if (typeof move.round === 'number' && move.round < s.round) return s;
      if (s.phase === 'over') throw new GameError('err.over');
      if (s.phase !== 'review') throw new GameError('categories.err.notReview');
      const { player, category, on } = move;
      if (
        !Number.isInteger(player) ||
        player < 0 ||
        player >= s.players ||
        player === by ||
        !Number.isInteger(category) ||
        category < 0 ||
        category >= CATEGORIES ||
        typeof on !== 'boolean'
      ) {
        throw new GameError('categories.err.badReject');
      }
      // Empty and wrong-letter answers are already worth nothing, there is nothing to vote on.
      if (autoVerdict(s.answers[player][category], s.letters[s.round - 1]) !== 'ok') {
        throw new GameError('categories.err.nothingToReject');
      }
      const mask = s.rejects[player][category];
      const next = on ? mask | (1 << by) : mask & ~(1 << by);
      if (next === mask) return s;
      return { ...s, rejects: withRow(s.rejects, player, s.rejects[player].map((m, c) => (c === category ? next : m))) };
    }

    case 'ready': {
      if (typeof move.round === 'number' && move.round < s.round) return s;
      // Pressing it again, or the last player pressing it a moment after the game ended, is harmless.
      if (s.phase === 'over') return s;
      if (s.phase !== 'review') throw new GameError('categories.err.notReview');
      if (s.ready[by]) return s;
      const ready = s.ready.map((r, p) => r || p === by);
      const next = { ...s, ready };
      return ready.every(Boolean) ? finishRound(next, rng) : next;
    }

    default:
      throw new GameError('err.unknownMove');
  }
}

const filledCount = (row: string[]) => row.filter((a) => a.trim() !== '').length;

export function view(s: CatState, me: number): CatView {
  const revealed = s.phase !== 'write';
  return {
    alphabet: s.alphabet,
    rounds: s.rounds,
    players: s.players,
    round: s.round,
    phase: s.phase,
    letter: s.letters[s.round - 1],
    letters: s.letters,
    scores: s.scores,
    history: s.history,
    winner: s.winner,
    mine: s.answers[me],
    filled: s.answers.map(filledCount),
    stoppedBy: s.stoppedBy,
    // While writing, other players' texts never leave the host.
    answers: revealed ? s.answers : null,
    rejects: revealed ? s.rejects : null,
    ready: s.ready,
  };
}
