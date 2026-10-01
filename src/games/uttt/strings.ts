import { defineStrings } from '../../i18n';

/**
 * This game's texts. `en` defines keys and argument types; `ar` must match.
 * Arabic: never assume the partner's gender (noun phrases like "دور سامي", "من نصيب …").
 * GameError messages use the registered form "uttt.<key>", e.g. new GameError('uttt.err.taken').
 */
export const tg = defineStrings(
  'uttt',
  {
    name: 'Ultimate Tic-Tac-Toe',
    blurb: 'Tic-tac-toe on nine boards. Every move decides where your partner plays next.',
    yourTurnBoard: 'Your turn: play in the highlighted board',
    yourTurnAny: 'Your turn: play anywhere',
    yourSymbol: 'Your symbol',
    hint: 'The square you pick decides which board your partner plays in next. Win three boards in a row.',
    cell: (b: number, c: number) => `Board ${b}, square ${c}`,
    'err.wrongBoard': 'Play in the highlighted board.',
    'err.boardDone': 'That board is already decided.',
    'err.taken': 'That square is taken.',
    'err.badCell': 'That square isn’t on the board.',
  },
  {
    name: 'إكس أو الكبيرة',
    blurb: 'إكس أو على تسعة مربعات: كل خانة تُلعب تحدد المربع التالي.',
    yourTurnBoard: 'دورك: اللعب في المربع المضاء',
    yourTurnAny: 'دورك: اللعب في أي مربع',
    yourSymbol: 'رمزك',
    hint: 'الخانة التي تُختار تحدد المربع الذي يُلعب فيه بعدها. الفوز بثلاثة مربعات في صف.',
    cell: (b, c) => `المربع ${b}، الخانة ${c}`,
    'err.wrongBoard': 'اللعب في المربع المضاء فقط.',
    'err.boardDone': 'هذا المربع محسوم بالفعل.',
    'err.taken': 'هذه الخانة مشغولة.',
    'err.badCell': 'هذه الخانة ليست على اللوحة.',
  },
);
