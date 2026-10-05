import type { ComponentType } from 'preact';

/** A player in a 2-player game. */
export type Player = 0 | 1;
export const other = (p: Player): Player => (p === 0 ? 1 : 0);

/** A player in a game for up to three (game-internal index, 0..players-1). */
export type Seat = 0 | 1 | 2;

/** A room holds at most this many people (the host is seat 0). */
export const MAX_SEATS = 3;

/**
 * Thrown by GameDef.apply for an illegal move. The message is an i18n key (e.g. 'err.notYourTurn'),
 * sent as-is to the player who made the move and translated in *their* language.
 */
export class GameError extends Error {}

export interface BoardProps<V, M, P extends number = Player> {
  view: V;
  /** My index among the players of THIS game (0..players-1). */
  me: P;
  /** The players' names, in game order. */
  names: string[];
  send: (move: M) => void;
  rematch: () => void;
  toLobby: () => void;
}

/** Lobby categories. A game can have several. */
export type GameTag = 'us' | 'words' | 'board' | 'quick';

export interface SetupProps<O> {
  onStart: (opts: O) => void;
  onCancel: () => void;
}

/**
 * A game is pure logic plus a Board component.
 *
 * The host keeps the one true state. Guests send moves, the host applies them and pushes each
 * player their own `view` (that is where hidden information is stripped).
 *
 * Contract for `view`: return an object whose keys are always present (use null, never undefined),
 * and keep big static data (e.g. a photo deck) under the SAME object reference between calls.
 * The sync layer only re-sends top-level keys whose reference changed.
 * State and views must be JSON-serialisable.
 */
export interface GameDef<S = any, M = any, V = any, O = any, P extends number = Player> {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  /** Lobby categories ('us' = personal games for the two of you). */
  tags: GameTag[];
  /** Typical length of one round, in minutes (shown on the lobby card). */
  minutes: number;
  /** The illustration on the lobby card (a small SVG, about 120 × 64, using theme colours). */
  Art: ComponentType;
  /** How many people can play: [min, max], within 2..MAX_SEATS. Most games are [2, 2]. */
  players: [number, number];
  /** Optional host-only screen shown before the game starts (e.g. choose a photo deck). */
  Setup?: ComponentType<SetupProps<O>>;
  /** `players` = how many people are playing (within the `players` range). */
  init(opts: O, players: number): S;
  /**
   * Optional: rebuild the init options from a state, for "Play again". Games whose options are big
   * (a photo deck already inside the state) use this so the host doesn't store them twice.
   */
  rematchOpts?(state: S): O;
  apply(state: S, move: M, by: P): S;
  view(state: S, me: P): V;
  Board: ComponentType<BoardProps<V, M, P>>;
}
