import type { ComponentType } from 'preact';

export type Player = 0 | 1;
export const other = (p: Player): Player => (p === 0 ? 1 : 0);

/**
 * Thrown by GameDef.apply for an illegal move. The message is an i18n key (e.g. 'err.notYourTurn'),
 * sent as-is to the player who made the move and translated in *their* language.
 */
export class GameError extends Error {}

export interface BoardProps<V, M> {
  view: V;
  me: Player;
  names: [string, string];
  send: (move: M) => void;
  rematch: () => void;
  toLobby: () => void;
}

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
export interface GameDef<S = any, M = any, V = any, O = any> {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  /** Optional host-only screen shown before the game starts (e.g. choose a photo deck). */
  Setup?: ComponentType<SetupProps<O>>;
  init(opts: O): S;
  /**
   * Optional: rebuild the init options from a state, for "Play again". Games whose options are big
   * (a photo deck already inside the state) use this so the host doesn't store them twice.
   */
  rematchOpts?(state: S): O;
  apply(state: S, move: M, by: Player): S;
  view(state: S, me: Player): V;
  Board: ComponentType<BoardProps<V, M>>;
}
