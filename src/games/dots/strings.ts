import { defineStrings } from '../../i18n';

/**
 * This game's texts. `en` defines keys and argument types; `ar` must match.
 * Arabic: never assume the partner's gender (noun phrases like "دور سامي", "من نصيب …").
 * GameError messages use the registered form "dots.<key>", e.g. new GameError('dots.err.taken').
 */
export const tg = defineStrings(
  'dots',
  {
    name: 'Dots and Boxes',
    blurb: 'Take turns drawing lines. Close a box to score a point and play again.',
    yourTurn: 'Your turn: draw a line',
    again: 'Box closed! Your turn again',
    oppAgain: (n: string) => `A box for ${n}, who plays again…`,
    line: 'Line',
    'err.taken': 'That line is already drawn.',
    'err.badLine': 'Pick a line between two dots.',
  },
  {
    name: 'النقاط والمربعات',
    blurb: 'ارسما الخطوط بالتناوب. إغلاق مربع يعني نقطة ودوراً إضافياً.',
    yourTurn: 'دورك: ارسم خطاً',
    again: 'مربع مكتمل! دورك مرة أخرى',
    oppAgain: (n) => `مربع جديد من نصيب ${n}، والدور مستمر…`,
    line: 'خط',
    'err.taken': 'هذا الخط مرسوم بالفعل.',
    'err.badLine': 'اختر خطاً بين نقطتين.',
  },
);
