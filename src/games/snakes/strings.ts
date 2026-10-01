import { defineStrings } from '../../i18n';

/**
 * This game's texts. `en` defines keys and argument types; `ar` must match.
 * Arabic: never assume the partner's gender (noun phrases like "دور سامي", "من نصيب …").
 * In the messages `n` is "You"/"أنت" or the partner's name, always shown as a label before a colon.
 */
export const tg = defineStrings(
  'snakes',
  {
    name: 'Snakes and Ladders',
    blurb: 'Roll the die and race to square 100. Ladders lift you up, snakes slide you down.',
    yourTurn: 'Your turn: roll the die',
    roll: 'Roll',
    intro: 'Both of you start off the board. Land exactly on 100 to win.',
    start: 'Start',
    boardLabel: 'Snakes and Ladders board',
    dieShows: (d: number) => `The die shows ${d}`,
    dieBlank: 'No roll yet',
    moved: (n: string, die: number, to: number) => `${n} rolled ${die} and moved to ${to}`,
    ladder: (n: string, from: number, to: number) => `🪜 ${n}: Ladder! ${from} → ${to}`,
    snake: (n: string, from: number, to: number) => `🐍 ${n}: Snake! ${from} → ${to}`,
    exact: (n: string, die: number, need: number) => `${n} rolled ${die}, but exactly ${need} is needed to finish`,
  },
  {
    name: 'السلم والثعبان',
    blurb: 'ارميا النرد وتسابقا إلى المربع 100. السلالم تختصر الطريق، والثعابين تُرجع إلى الوراء.',
    yourTurn: 'دورك: رمي النرد',
    roll: 'رمي النرد',
    intro: 'يبدأ كلاكما خارج اللوح. الفوز بالوصول إلى المربع 100 بالضبط.',
    start: 'البداية',
    boardLabel: 'لوح السلم والثعبان',
    dieShows: (d) => `النرد: ${d}`,
    dieBlank: 'لا رمية بعد',
    moved: (n, die, to) => `${n}: ${die} على النرد، والانتقال إلى المربع ${to}`,
    ladder: (n, from, to) => `🪜 ${n}: سلّم! من ${from} إلى ${to}`,
    snake: (n, from, to) => `🐍 ${n}: ثعبان! من ${from} إلى ${to}`,
    exact: (n, die, need) => `${n}: ${die} على النرد، والمطلوب ${need} بالضبط للوصول إلى المربع 100`,
  },
);
