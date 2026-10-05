/** Messages on the wire between the browsers. The host is seat 0; guests are seats 1 and 2. */

/** Someone sitting at the table. */
export interface SeatInfo {
  name: string;
  online: boolean;
}

export interface RoomMeta {
  screen: 'lobby' | 'setup' | 'game';
  gameId: string | null;
  /** Increments every time a new game starts (used to reset local UI state). */
  gameKey: number;
  /** Names by seat ('' = empty seat). Also kept for clients from before rooms of three. */
  names: string[];
  /** By seat; seat 0 is the host. null = empty seat. */
  seats: (SeatInfo | null)[];
  /** The seats playing the current game, in game-player order (null outside a game). */
  players: number[] | null;
}

export type ToHost =
  | { t: 'hello'; clientId: string; name: string }
  | { t: 'move'; move: unknown }
  | { t: 'rematch' }
  | { t: 'lobby' }
  | { t: 'ping' };

export type ToGuest =
  | { t: 'welcome'; seat?: number }
  | { t: 'full' }
  | {
      t: 'sync';
      room: RoomMeta;
      /** With full=true this is the whole view, otherwise only the top-level keys that changed. */
      view: Record<string, unknown> | null;
      full: boolean;
    }
  | { t: 'error'; message: string }
  | { t: 'ping' };

export type Wire = ToHost | ToGuest;
