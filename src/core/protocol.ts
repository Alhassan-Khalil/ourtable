/** Messages on the wire between the two browsers. Host = player 0, guest = player 1. */

export interface RoomMeta {
  screen: 'lobby' | 'setup' | 'game';
  gameId: string | null;
  /** Increments every time a new game starts (used to reset local UI state). */
  gameKey: number;
  names: [string, string];
}

export type ToHost =
  | { t: 'hello'; clientId: string; name: string }
  | { t: 'move'; move: unknown }
  | { t: 'rematch' }
  | { t: 'lobby' }
  | { t: 'ping' };

export type ToGuest =
  | { t: 'welcome' }
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
