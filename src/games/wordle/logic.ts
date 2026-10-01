import { GameError, other, type Player } from '../../core/types';

/**
 * Word Duel: each player picks a secret word, then both race (at the same time, no turns) to guess
 * the other's word in up to 6 tries, with Wordle-style colours. Arabic or English, no dictionary.
 *
 * Hidden information: a player's view never holds the opponent's secret or the opponent's guess
 * letters before the end, only the opponent's colours (marks).
 */
export const MIN_LEN = 3;
export const MAX_LEN = 7;
export const MAX_GUESSES = 6;

/** g = right letter, right place; y = in the word elsewhere; x = not in the word. */
export type Mark = 'g' | 'y' | 'x';

export interface Guess {
  /** Cleaned text, as typed (hamza forms etc. kept for display). */
  word: string;
  marks: Mark[];
}

export type Phase = 'pick' | 'play' | 'over';

export interface WordleState {
  phase: Phase;
  secrets: [string | null, string | null];
  /** guesses[p] = p's guesses at the OTHER player's word. */
  guesses: [Guess[], Guess[]];
  winner: Player | 'draw' | null;
}

export type WordleMove = { type: 'secret'; word: string } | { type: 'guess'; word: string };

export type Dir = 'rtl' | 'ltr';

/** What one player is allowed to see. */
export interface WordleView {
  phase: Phase;
  mySecret: string | null;
  oppReady: boolean;
  /** Length and script direction of the word I'm guessing (null until play). */
  targetLength: number | null;
  targetDir: Dir | null;
  myGuesses: Guess[];
  /** The opponent's colours only, never their letters. */
  oppMarks: Mark[][];
  myDone: boolean;
  oppDone: boolean;
  winner: Player | 'draw' | null;
  /** Both null until the game is over. */
  oppSecret: string | null;
  oppGuesses: Guess[] | null;
}

// ---------- letters ----------

/** Arabic diacritics (harakat, shadda, sukun…), superscript alef, tatweel, and invisible direction marks. */
const STRIP = /[ً-ٰٟـ​-‏؜﻿]/g;
const LETTER = /^[ء-غف-يٱA-Z]$/;
const ARABIC = /[ء-غف-يٱ]/;

/** Split into letters (code points). */
export const letters = (word: string): string[] => Array.from(word);

/**
 * Normalise what a player typed: trim, drop Arabic diacritics and tatweel, uppercase Latin.
 * Throws for anything that isn't one word of Arabic / Latin letters (spaces, digits, punctuation).
 * An empty string is returned as '' (the length checks reject it).
 */
export function clean(raw: unknown): string {
  if (typeof raw !== 'string') throw new GameError('wordle.err.letters');
  // NFKC also turns presentation forms (e.g. the lam-alef ligature) and full-width Latin into plain letters.
  const s = raw
    .normalize('NFKC')
    .replace(STRIP, '')
    .trim()
    .replace(/[a-z]/g, (c) => c.toUpperCase());
  if (!letters(s).every((c) => LETTER.test(c))) throw new GameError('wordle.err.letters');
  return s;
}

const FOLD: Record<string, string> = {
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ى': 'ي',
  'ة': 'ه',
  'ؤ': 'و',
  'ئ': 'ي',
};

/** For comparing only: letters people commonly swap in Arabic count as the same letter. */
export const fold = (letter: string): string => FOLD[letter] ?? letter;

/** Arabic words read right-to-left, Latin left-to-right. */
export const scriptDir = (word: string): Dir => (ARABIC.test(word) ? 'rtl' : 'ltr');

/**
 * Wordle colours for `guess` against `target` (both cleaned, same length).
 * Greens first; then yellows only up to the count of that letter not already matched green.
 */
export function score(target: string, guess: string): Mark[] {
  const t = letters(target).map(fold);
  const g = letters(guess).map(fold);
  if (t.length !== g.length) throw new GameError('wordle.err.guessLength');
  const marks: Mark[] = g.map(() => 'x');
  const left = new Map<string, number>();
  g.forEach((c, i) => {
    if (c === t[i]) marks[i] = 'g';
    else left.set(t[i], (left.get(t[i]) ?? 0) + 1);
  });
  g.forEach((c, i) => {
    if (marks[i] === 'g') return;
    const n = left.get(c) ?? 0;
    if (n > 0) {
      marks[i] = 'y';
      left.set(c, n - 1);
    }
  });
  return marks;
}

// ---------- game ----------

/** The guess number (1-based) that solved it, or null. Takes guesses or bare `{ marks }` rows. */
export function solvedAt(rows: readonly { marks: readonly Mark[] }[]): number | null {
  const i = rows.findIndex((g) => g.marks.every((m) => m === 'g'));
  return i < 0 ? null : i + 1;
}

/** Solved, or out of guesses. */
export const isDone = (guesses: Guess[]) => solvedAt(guesses) !== null || guesses.length >= MAX_GUESSES;

function decide(guesses: WordleState['guesses']): Player | 'draw' {
  const a = solvedAt(guesses[0]);
  const b = solvedAt(guesses[1]);
  if (a === null && b === null) return 'draw';
  if (a === null) return 1;
  if (b === null) return 0;
  return a < b ? 0 : b < a ? 1 : 'draw';
}

export function init(): WordleState {
  return { phase: 'pick', secrets: [null, null], guesses: [[], []], winner: null };
}

export function apply(s: WordleState, move: WordleMove, by: Player): WordleState {
  if (s.phase === 'over') throw new GameError('err.over');

  switch (move?.type) {
    case 'secret': {
      if (s.phase !== 'pick' || s.secrets[by] !== null) throw new GameError('wordle.err.locked');
      const word = clean(move.word);
      const n = letters(word).length;
      if (n < MIN_LEN || n > MAX_LEN) throw new GameError('wordle.err.length');
      const secrets: WordleState['secrets'] = [...s.secrets];
      secrets[by] = word;
      const ready = secrets[0] !== null && secrets[1] !== null;
      return { ...s, secrets, phase: ready ? 'play' : 'pick' };
    }

    case 'guess': {
      if (s.phase !== 'play') throw new GameError('err.notStarted');
      if (isDone(s.guesses[by])) throw new GameError('wordle.err.done');
      const target = s.secrets[other(by)] as string;
      const word = clean(move.word);
      if (letters(word).length !== letters(target).length) throw new GameError('wordle.err.guessLength');
      const guesses: WordleState['guesses'] = [...s.guesses];
      guesses[by] = [...s.guesses[by], { word, marks: score(target, word) }];
      const over = isDone(guesses[0]) && isDone(guesses[1]);
      return { ...s, guesses, phase: over ? 'over' : 'play', winner: over ? decide(guesses) : null };
    }

    default:
      throw new GameError('err.unknownMove');
  }
}

/**
 * The opponent's colours, cached per guesses array so the view keeps the same reference until the
 * opponent guesses again (the sync layer only re-sends top-level keys whose reference changed).
 */
const marksCache = new WeakMap<Guess[], Mark[][]>();
function marksOf(guesses: Guess[]): Mark[][] {
  let m = marksCache.get(guesses);
  if (!m) {
    m = guesses.map((g) => g.marks);
    marksCache.set(guesses, m);
  }
  return m;
}

export function view(s: WordleState, me: Player): WordleView {
  const opp = other(me);
  const over = s.phase === 'over';
  const target = s.phase === 'pick' ? null : s.secrets[opp];
  return {
    phase: s.phase,
    mySecret: s.secrets[me],
    oppReady: s.secrets[opp] !== null,
    targetLength: target === null ? null : letters(target).length,
    targetDir: target === null ? null : scriptDir(target),
    myGuesses: s.guesses[me],
    oppMarks: marksOf(s.guesses[opp]),
    myDone: s.phase !== 'pick' && isDone(s.guesses[me]),
    oppDone: s.phase !== 'pick' && isDone(s.guesses[opp]),
    winner: s.winner,
    oppSecret: over ? s.secrets[opp] : null,
    oppGuesses: over ? s.guesses[opp] : null,
  };
}
