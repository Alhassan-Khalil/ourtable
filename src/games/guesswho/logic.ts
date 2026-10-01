import { GameError, other, type Player } from '../../core/types';

export interface Card {
  id: string;
  /** For your own photos: whatever you typed. For classic faces: the Latin spelling. */
  name: string;
  /** Classic faces only: Arabic spelling, shown when the UI is in Arabic. */
  nameAr?: string;
  /** data: URL (SVG for the classic faces, small JPEG for your own photos). */
  img: string;
  /** Visible features, used for the quick-question chips. Photos have none. */
  tags?: string[];
}

export interface GWOptions {
  deck: Card[];
  deckName: string;
}

export interface Asked {
  by: Player;
  q: string;
  /** null while waiting for the answer. */
  a: boolean | null;
}

export interface GWState {
  deck: Card[];
  deckName: string;
  phase: 'pick' | 'play' | 'over';
  secrets: [string | null, string | null];
  turn: Player;
  /** Within a turn: the turn player asks, then the other player answers. */
  step: 'ask' | 'answer';
  log: Asked[];
  /** Cards each player has flipped down on their own board. */
  flips: [string[], string[]];
  winner: Player | null;
  guess: { by: Player; cardId: string; correct: boolean } | null;
}

export type GWMove =
  | { type: 'pick'; cardId: string }
  | { type: 'ask'; text: string }
  | { type: 'answer'; yes: boolean }
  | { type: 'flip'; cardId: string }
  | { type: 'guess'; cardId: string };

/** What one player is allowed to see. The opponent's secret only appears once the game is over. */
export interface GWView {
  deck: Card[];
  deckName: string;
  phase: GWState['phase'];
  turn: Player;
  step: GWState['step'];
  log: Asked[];
  mySecret: string | null;
  oppReady: boolean;
  myFlips: string[];
  winner: Player | null;
  guess: GWState['guess'];
  oppSecret: string | null;
}

export const MIN_CARDS = 6;
export const MAX_CARDS = 30;
export const MAX_QUESTION = 200;
const MAX_LOG = 200;

export function init(opts: GWOptions, starter: Player = Math.random() < 0.5 ? 0 : 1): GWState {
  const deck = opts?.deck;
  if (!Array.isArray(deck) || deck.length < MIN_CARDS) throw new GameError('err.deckTooSmall');
  return {
    deck,
    deckName: opts.deckName,
    phase: 'pick',
    secrets: [null, null],
    turn: starter,
    step: 'ask',
    log: [],
    flips: [[], []],
    winner: null,
    guess: null,
  };
}

const hasCard = (s: GWState, id: unknown) => typeof id === 'string' && s.deck.some((c) => c.id === id);

export function apply(s: GWState, move: GWMove, by: Player): GWState {
  if (s.phase === 'over') throw new GameError('err.over');

  switch (move?.type) {
    case 'pick': {
      if (s.phase !== 'pick') throw new GameError('err.alreadyChosen');
      if (!hasCard(s, move.cardId)) throw new GameError('err.unknownCard');
      const secrets: GWState['secrets'] = [...s.secrets];
      secrets[by] = move.cardId;
      const ready = secrets[0] !== null && secrets[1] !== null;
      return { ...s, secrets, phase: ready ? 'play' : 'pick' };
    }

    case 'flip': {
      if (s.phase !== 'play') throw new GameError('err.notStarted');
      if (!hasCard(s, move.cardId)) throw new GameError('err.unknownCard');
      const mine = s.flips[by];
      const next = mine.includes(move.cardId) ? mine.filter((id) => id !== move.cardId) : [...mine, move.cardId];
      const flips: GWState['flips'] = [...s.flips];
      flips[by] = next;
      return { ...s, flips };
    }

    case 'ask': {
      if (s.phase !== 'play') throw new GameError('err.notStarted');
      if (s.turn !== by || s.step !== 'ask') throw new GameError('err.notYourTurn');
      const q = typeof move.text === 'string' ? move.text.trim().slice(0, MAX_QUESTION) : '';
      if (!q) throw new GameError('err.emptyQuestion');
      const log = [...s.log, { by, q, a: null }].slice(-MAX_LOG);
      return { ...s, step: 'answer', log };
    }

    case 'answer': {
      if (s.phase !== 'play' || s.step !== 'answer') throw new GameError('err.noQuestion');
      if (by === s.turn) throw new GameError('err.partnerAnswers');
      const log = s.log.slice();
      const last = log[log.length - 1];
      log[log.length - 1] = { ...last, a: !!move.yes };
      return { ...s, log, step: 'ask', turn: other(s.turn) };
    }

    case 'guess': {
      if (s.phase !== 'play') throw new GameError('err.notStarted');
      if (s.turn !== by || s.step !== 'ask') throw new GameError('err.guessOnTurn');
      if (!hasCard(s, move.cardId)) throw new GameError('err.unknownCard');
      const correct = s.secrets[other(by)] === move.cardId;
      return {
        ...s,
        phase: 'over',
        winner: correct ? by : other(by),
        guess: { by, cardId: move.cardId, correct },
      };
    }

    default:
      throw new GameError('err.unknownMove');
  }
}

export function view(s: GWState, me: Player): GWView {
  return {
    deck: s.deck, // same reference every time: the sync layer sends the photos only once
    deckName: s.deckName,
    phase: s.phase,
    turn: s.turn,
    step: s.step,
    log: s.log,
    mySecret: s.secrets[me],
    oppReady: s.secrets[other(me)] !== null,
    myFlips: s.flips[me],
    winner: s.winner,
    guess: s.guess,
    oppSecret: s.phase === 'over' ? s.secrets[other(me)] : null,
  };
}
