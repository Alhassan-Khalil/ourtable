import type { GameDef } from '../core/types';
import type { Key } from '../i18n';
import { connect4 } from './connect4';
import { guessWho } from './guesswho';

/** Add a new game here. Order = order in the lobby. */
export const GAME_LIST: GameDef[] = [guessWho, connect4];

export const GAMES: Record<string, GameDef> = Object.fromEntries(GAME_LIST.map((g) => [g.id, g]));

/** Shown greyed-out in the lobby so the roadmap is visible. */
export const COMING_SOON: { icon: string; name: Key }[] = [
  { icon: '♟️', name: 'chess' },
  { icon: '🚢', name: 'battleship' },
];
