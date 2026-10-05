import { GameError, type Seat } from '../../core/types';

/**
 * Basra (باصرة) for 2 or 3 players, the Egyptian fishing game (rules as on pagat.com).
 *
 * 52 cards. Each player gets 4, and 4 go face up on the floor (a jack or the 7♦ there is buried
 * back in the pack and replaced). Everyone plays one card per turn; when all hands are empty,
 * 4 more each (none to the floor), until the pack runs out: that is one round.
 *
 * What a card takes from the floor (always everything it can, the game works it out):
 *   A, 2..10   every card of the same value, plus groups of numerals adding up to it (A = 1)
 *   Q, K       every card of the same rank (they have no number)
 *   J          the whole floor (never a basra)
 *   7♦         the whole floor; a basra only if the floor was all numerals adding up to 10 or less,
 *              or if an ordinary 7 would have cleared it anyway
 * A card that takes nothing stays on the floor. Clearing the floor is a basra: 10 points.
 * At the end of the round, whatever is left on the floor goes to the last player who took.
 *
 * Points per round: most cards 30 (a tie carries the 30 over to the next round), each ace 1,
 * each jack 1, 2♣ 2, 10♦ 3, each basra 10. The game is one round, or rounds until someone has 101.
 */

/** A card: rank then suit letter, e.g. 'AS' is the ace of spades, '10D' the ten of diamonds. */
export type Card = string;
export type Suit = 'S' | 'H' | 'D' | 'C';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: readonly string[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SEVEN_DIAMONDS: Card = '7D';
export const HAND_SIZE = 4;
export const MOST_CARDS = 30;
export const BASRA = 10;
export const TARGET = 101;

export const rankOf = (c: Card) => c.slice(0, -1);
export const suitOf = (c: Card) => c.slice(-1) as Suit;
export const isRed = (c: Card) => suitOf(c) === 'H' || suitOf(c) === 'D';

/** The number on a card (A = 1); 0 for J, Q and K, which have none. */
export function valueOf(c: Card): number {
  const r = rankOf(c);
  if (r === 'A') return 1;
  const n = Number(r);
  return Number.isInteger(n) ? n : 0;
}

/** What a card is worth when the round is scored. */
export function pointsOf(c: Card): number {
  const r = rankOf(c);
  if (r === 'A' || r === 'J') return 1;
  if (c === '2C') return 2;
  if (c === '10D') return 3;
  return 0;
}

export const fullDeck = (): Card[] => SUITS.flatMap((s) => RANKS.map((r) => r + s));

function shuffle<T>(a: T[], rng: () => number): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const popcount = (m: number) => {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
};

/** Search at most this many floor cards for sums (2^n subsets). A real floor never gets close. */
const MAX_SEARCH = 18;

/**
 * The most floor cards that split into groups each adding up to `v` (every card used once).
 * Ties go to the groups worth more points.
 */
function bestGroups(cards: Card[], v: number): Card[] {
  const list = cards.slice(0, MAX_SEARCH);
  const n = list.length;
  if (n < 2) return [];
  const vals = list.map(valueOf);
  const pts = list.map(pointsOf);
  const size = 1 << n;
  const sum = new Int32Array(size);
  const score = new Int32Array(size);
  // reach[mask]: the cards of mask can be laid out as full groups of v, plus one group still filling up
  const reach = new Uint8Array(size);
  reach[0] = 1;
  let best = 0;
  let bestCount = 0;
  let bestPts = -1;
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    const lowI = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low] + vals[lowI];
    score[mask] = score[mask ^ low] + pts[lowI];
    for (let rest = mask; rest; rest &= rest - 1) {
      const bit = rest & -rest;
      const prev = mask ^ bit;
      if (reach[prev] && (sum[prev] % v) + vals[31 - Math.clz32(bit)] <= v) {
        reach[mask] = 1;
        break;
      }
    }
    if (reach[mask] && sum[mask] % v === 0) {
      const count = popcount(mask);
      if (count > bestCount || (count === bestCount && score[mask] > bestPts)) {
        best = mask;
        bestCount = count;
        bestPts = score[mask];
      }
    }
  }
  return list.filter((_, i) => best & (1 << i));
}

/** What an ordinary numeral of value `v` takes: the same value, plus groups adding up to it. */
function numeralTake(floor: Card[], v: number): Card[] {
  const same = floor.filter((c) => valueOf(c) === v);
  const groups = bestGroups(
    floor.filter((c) => valueOf(c) > 0 && valueOf(c) < v),
    v,
  );
  return floor.filter((c) => same.includes(c) || groups.includes(c));
}

export interface Capture {
  /** The floor cards this card takes (in floor order); empty: the card stays on the floor. */
  take: Card[];
  /** It clears the floor and scores 10. */
  basra: boolean;
}

/** What playing `card` onto `floor` does. Shared by the rules and the on-screen preview. */
export function captureFor(floor: readonly Card[], card: Card): Capture {
  const f = floor.slice();
  if (f.length === 0) return { take: [], basra: false };
  const r = rankOf(card);
  if (r === 'J') return { take: f, basra: false };
  if (card === SEVEN_DIAMONDS) {
    const numerals = f.every((c) => valueOf(c) > 0);
    const total = f.reduce((a, c) => a + valueOf(c), 0);
    const basra = numerals && (total <= 10 || numeralTake(f, 7).length === f.length);
    return { take: f, basra };
  }
  const take = r === 'Q' || r === 'K' ? f.filter((c) => rankOf(c) === r) : numeralTake(f, valueOf(card));
  return { take, basra: take.length > 0 && take.length === f.length };
}

export interface BasraOptions {
  /** 'one': a single round, highest score wins. 'full': rounds until someone reaches 101. */
  length: 'one' | 'full';
}

/** What the last card did, for the message line and the animations. */
export interface BasraLast {
  by: Seat;
  card: Card;
  take: Card[];
  basra: boolean;
  /** Everyone's hand was empty and 4 new cards each were dealt. */
  dealt: boolean;
}

/** One player's line in the round's score. */
export interface RoundLine {
  cards: number;
  /** 30 for most cards (plus any 30 carried over), else 0. */
  most: number;
  aces: number;
  jacks: number;
  twoClubs: number;
  tenDiamonds: number;
  basras: number;
  total: number;
}

export interface RoundResult {
  round: number;
  lines: RoundLine[];
  /** Cards left on the floor at the end, and who got them (null: nobody took all round). */
  leftover: number;
  leftoverTo: Seat | null;
  /** A tie for most cards: this many points wait for the next round. */
  carried: number;
}

export interface BasraState {
  players: number;
  length: BasraOptions['length'];
  /** Undealt cards; the next card dealt is deck[0]. */
  deck: Card[];
  hands: Card[][];
  floor: Card[];
  /** The cards each player has taken this round. */
  taken: Card[][];
  basras: number[];
  /** Game totals (after the rounds played so far). */
  scores: number[];
  /** Most-cards points waiting after a tie. */
  carry: number;
  lastTaker: Seat | null;
  dealer: Seat;
  turn: Seat;
  /** 1, 2, 3… */
  round: number;
  phase: 'play' | 'scored' | 'over';
  /** null at the end of the game: a draw. */
  winner: Seat | null;
  last: BasraLast | null;
  result: RoundResult | null;
  /** Counts every card played, so the screen can replay an animation for each. */
  seq: number;
}

export type BasraMove = { type: 'play'; card: Card } | { type: 'next' };

const next = (p: number, players: number) => ((p + 1) % players) as Seat;

/** Shuffle and deal a new round: 4 each, then 4 to the floor (no jack or 7♦ there). */
function deal(s: BasraState, dealer: Seat, rng: () => number): BasraState {
  const deck = shuffle(fullDeck(), rng);
  const hands = Array.from({ length: s.players }, () => deck.splice(0, HAND_SIZE));
  const floor: Card[] = [];
  while (floor.length < HAND_SIZE) {
    const c = deck.shift()!;
    if (rankOf(c) === 'J' || c === SEVEN_DIAMONDS) {
      // bury it in the pack, anywhere but the top
      deck.splice(1 + Math.floor(rng() * deck.length), 0, c);
    } else floor.push(c);
  }
  return {
    ...s,
    deck,
    hands,
    floor,
    taken: Array.from({ length: s.players }, () => []),
    basras: Array<number>(s.players).fill(0),
    lastTaker: null,
    dealer,
    turn: next(dealer, s.players),
    phase: 'play',
    result: null,
  };
}

export function init(opts: BasraOptions | null | undefined, players: number, rng: () => number = Math.random): BasraState {
  const n = players === 3 ? 3 : 2;
  const empty: BasraState = {
    players: n,
    length: opts?.length === 'full' ? 'full' : 'one',
    deck: [],
    hands: [],
    floor: [],
    taken: [],
    basras: [],
    scores: Array<number>(n).fill(0),
    carry: 0,
    lastTaker: null,
    dealer: 0,
    turn: 0,
    round: 1,
    phase: 'play',
    winner: null,
    last: null,
    result: null,
    seq: 0,
  };
  return deal(empty, Math.floor(rng() * n) as Seat, rng);
}

/** Score the round that just ended (the floor already went to the last taker). */
export function scoreRound(taken: readonly (readonly Card[])[], basras: readonly number[], carry: number): { lines: RoundLine[]; carried: number } {
  const counts = taken.map((t) => t.length);
  const top = Math.max(...counts);
  const leaders = counts.filter((c) => c === top).length;
  const lines = taken.map((t, p) => {
    const most = leaders === 1 && counts[p] === top ? MOST_CARDS + carry : 0;
    const aces = t.filter((c) => rankOf(c) === 'A').length;
    const jacks = t.filter((c) => rankOf(c) === 'J').length;
    const twoClubs = t.includes('2C') ? 2 : 0;
    const tenDiamonds = t.includes('10D') ? 3 : 0;
    const b = basras[p] * BASRA;
    return { cards: counts[p], most, aces, jacks, twoClubs, tenDiamonds, basras: basras[p], total: most + aces + jacks + twoClubs + tenDiamonds + b };
  });
  return { lines, carried: leaders === 1 ? 0 : carry + MOST_CARDS };
}

/** The winner when the game ends now, 'draw', or null to play another round. */
function decide(scores: number[], length: BasraState['length']): Seat | 'draw' | null {
  const top = Math.max(...scores);
  const leaders = scores.flatMap((x, p) => (x === top ? [p as Seat] : []));
  if (length === 'one') return leaders.length === 1 ? leaders[0] : 'draw';
  if (top < TARGET) return null;
  return leaders.length === 1 ? leaders[0] : null; // level at the top: one more round
}

export function apply(s: BasraState, move: BasraMove, by: Seat, rng: () => number = Math.random): BasraState {
  if (s.phase === 'over') throw new GameError('err.over');
  const type = (move as { type?: unknown } | null | undefined)?.type;

  if (type === 'next') {
    if (s.phase !== 'scored') throw new GameError('basra.err.notYet');
    return { ...deal(s, next(s.dealer, s.players), rng), round: s.round + 1, last: null };
  }

  if (type !== 'play') throw new GameError('err.unknownMove');
  if (s.phase !== 'play') throw new GameError('basra.err.roundOver');
  if (by !== s.turn) throw new GameError('err.notYourTurn');
  const card = (move as { card?: unknown }).card;
  if (typeof card !== 'string' || !s.hands[by].includes(card)) throw new GameError('basra.err.notInHand');

  const { take, basra } = captureFor(s.floor, card);
  const hands = s.hands.map((h, p) => (p === by ? h.filter((c) => c !== card) : h));
  let floor = take.length ? s.floor.filter((c) => !take.includes(c)) : [...s.floor, card];
  let taken = take.length ? s.taken.map((t, p) => (p === by ? [...t, ...take, card] : t)) : s.taken;
  const basras = basra ? s.basras.map((b, p) => (p === by ? b + 1 : b)) : s.basras;
  const lastTaker = take.length ? by : s.lastTaker;
  const last: BasraLast = { by, card, take, basra, dealt: false };
  const played: BasraState = { ...s, hands, floor, taken, basras, lastTaker, turn: next(by, s.players), last, seq: s.seq + 1 };

  if (hands.some((h) => h.length > 0)) return played;

  // Everyone has played their four: deal four more each, or the round is over.
  if (s.deck.length > 0) {
    const deck = s.deck.slice();
    const fresh = hands.map(() => deck.splice(0, HAND_SIZE));
    return { ...played, deck, hands: fresh, last: { ...last, dealt: true } };
  }

  const leftover = floor.length;
  if (lastTaker !== null && leftover > 0) {
    taken = taken.map((t, p) => (p === lastTaker ? [...t, ...floor] : t));
    floor = [];
  }
  const { lines, carried } = scoreRound(taken, basras, s.carry);
  const scores = s.scores.map((x, p) => x + lines[p].total);
  const outcome = decide(scores, s.length);
  return {
    ...played,
    floor,
    taken,
    scores,
    carry: carried,
    phase: outcome === null ? 'scored' : 'over',
    winner: outcome === null || outcome === 'draw' ? null : outcome,
    result: { round: s.round, lines, leftover, leftoverTo: leftover > 0 ? lastTaker : null, carried },
  };
}

/** What one player sees: their own hand; only counts for the others' hands, the pack and the piles. */
export interface BasraView {
  players: number;
  length: BasraState['length'];
  hand: Card[];
  handCounts: number[];
  deckCount: number;
  floor: Card[];
  takenCounts: number[];
  basras: number[];
  scores: number[];
  carry: number;
  dealer: Seat;
  turn: Seat;
  round: number;
  phase: BasraState['phase'];
  winner: Seat | null;
  last: BasraLast | null;
  result: RoundResult | null;
  seq: number;
}

export function view(s: BasraState, me: Seat): BasraView {
  return {
    players: s.players,
    length: s.length,
    hand: s.hands[me] ?? [],
    handCounts: s.hands.map((h) => h.length),
    deckCount: s.deck.length,
    floor: s.floor,
    takenCounts: s.taken.map((t) => t.length),
    basras: s.basras,
    scores: s.scores,
    carry: s.carry,
    dealer: s.dealer,
    turn: s.turn,
    round: s.round,
    phase: s.phase,
    winner: s.winner,
    last: s.last,
    result: s.result,
    seq: s.seq,
  };
}
