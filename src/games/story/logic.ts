import { GameError, other, type Player } from '../../core/types';

/**
 * Our Story. The two players write a story together, one sentence at a time, taking turns.
 * The twist: on your turn you only ever see the LAST sentence (your partner's). The whole story
 * is revealed once TOTAL sentences are in.
 */
export const TOTAL = 10;
export const MAX_LEN = 200;

export interface StoryLine {
  by: Player;
  text: string;
}

export interface StoryState {
  lines: StoryLine[];
  /** Whose turn it is to write the next sentence. */
  turn: Player;
  total: number;
  done: boolean;
}

export interface StoryMove {
  type: 'write';
  text: string;
}

/**
 * What a player is allowed to see. While the story is unfinished that is at most ONE line: the
 * previous one, and only on their own turn. Progress is just numbers. `lines` is only filled in
 * once the story is done.
 */
export interface StoryView {
  written: number;
  total: number;
  turn: Player;
  done: boolean;
  /** The previous sentence (my partner's), only while it is my turn to write; else null. */
  prev: string | null;
  /** The whole story, only when done; else null. */
  lines: StoryLine[] | null;
}

/** One line of text: newlines and runs of spaces become single spaces, ends trimmed. */
export const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Length in characters as people count them (an emoji is one, not two). */
export const chars = (text: string) => Array.from(text).length;

export function init(starter: Player = Math.random() < 0.5 ? 0 : 1, total = TOTAL): StoryState {
  return { lines: [], turn: starter, total, done: false };
}

export function apply(s: StoryState, move: StoryMove, by: Player): StoryState {
  if (s.done) throw new GameError('err.over');
  if (by !== s.turn) throw new GameError('err.notYourTurn');
  if (!move || move.type !== 'write') throw new GameError('err.unknownMove');

  const text = typeof move.text === 'string' ? clean(move.text) : '';
  if (text === '') throw new GameError('story.err.empty');
  if (chars(text) > MAX_LEN) throw new GameError('story.err.tooLong');

  const lines = [...s.lines, { by, text }];
  return { ...s, lines, turn: other(by), done: lines.length >= s.total };
}

export function view(s: StoryState, me: Player): StoryView {
  const written = s.lines.length;
  const myTurn = !s.done && s.turn === me;
  return {
    written,
    total: s.total,
    turn: s.turn,
    done: s.done,
    prev: myTurn && written > 0 ? s.lines[written - 1].text : null,
    // Same array as the state while done, so the sync layer sends it once.
    lines: s.done ? s.lines : null,
  };
}
