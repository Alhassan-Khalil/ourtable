import type { GameDef } from '../core/types';
import type { Key } from '../i18n';
import { battleship } from './battleship';
import { categories } from './categories';
import { connect4 } from './connect4';
import { dots } from './dots';
import { guessWho } from './guesswho';
import { snakes } from './snakes';
import { story } from './story';
import { truths } from './truths';
import { uttt } from './uttt';
import { wordle } from './wordle';

/** Add a new game here. Order = order in the lobby. (Games for 2 use Player, games for 3 use Seat.) */
export const GAME_LIST: GameDef<any, any, any, any, any>[] = [guessWho, truths, story, wordle, categories, battleship, connect4, dots, uttt, snakes];

export const GAMES: Record<string, GameDef<any, any, any, any, any>> = Object.fromEntries(GAME_LIST.map((g) => [g.id, g]));

/** Shown greyed-out in the lobby so the roadmap is visible. */
export const COMING_SOON: { icon: string; name: Key }[] = [
  { icon: '♟️', name: 'chess' },
];
