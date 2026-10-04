import type { GameDef } from '../core/types';
import type { Key } from '../i18n';
import { battleship } from './battleship';
import { connect4 } from './connect4';
import { dots } from './dots';
import { guessWho } from './guesswho';
import { snakes } from './snakes';
import { story } from './story';
import { truths } from './truths';
import { uttt } from './uttt';
import { wordle } from './wordle';

/** Add a new game here. Order = order in the lobby. */
export const GAME_LIST: GameDef[] = [guessWho, truths, story, wordle, battleship, connect4, dots, uttt, snakes];

export const GAMES: Record<string, GameDef> = Object.fromEntries(GAME_LIST.map((g) => [g.id, g]));

/** Shown greyed-out in the lobby so the roadmap is visible. */
export const COMING_SOON: { icon: string; name: Key }[] = [
  { icon: '♟️', name: 'chess' },
];
