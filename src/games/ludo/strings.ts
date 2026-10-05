import { defineStrings } from '../../i18n';

/**
 * This game's texts. `en` defines keys and argument types; `ar` must match.
 * Arabic: never assume a player's gender (noun phrases like "دور سامي", "قطعة رنا").
 * In the messages `n` is "You"/"أنت" or a player's name, always shown as a label before a colon
 * (Arabic) or as the subject (English).
 * Words: yard = البيت (where tokens wait), home = المركز (the finish in the middle).
 */
export const tg = defineStrings(
  'ludo',
  {
    name: 'Ludo',
    blurb: 'Roll a 6 to bring a token out, race round the board and get all your tokens home first. Land on a rival to send it back.',
    yourRoll: 'Your turn: roll the die',
    yourMove: 'Your turn: pick a token',
    roll: 'Roll',
    intro: 'A 6 brings a token out of the yard. Bring all your tokens home to win.',
    boardLabel: 'Ludo board',
    dieShows: (d: number) => `The die shows ${d}`,
    dieBlank: 'No roll yet',
    moveToken: (k: number) => `Move token ${k}`,
    bringOut: 'Bring a token out',
    rolled: (n: string, d: number) => `${n} rolled ${d}.`,
    choose: 'The glowing tokens can move.',
    choosing: 'Choosing a token…',
    out: 'A token comes out.',
    onlyMove: 'Only one move, played automatically.',
    captured: (n: string, count: number) =>
      count === 1 ? `💥 Captured! ${n}’s token goes back to the yard.` : `💥 Captured! ${count} of ${n}’s tokens go back to the yard.`,
    capturedYou: (count: number) =>
      count === 1 ? '💥 Captured! Your token goes back to the yard.' : `💥 Captured! ${count} of your tokens go back to the yard.`,
    home: '🏠 A token is home!',
    again: 'A 6: roll again!',
    noMove: 'No move possible: the turn passes.',
    noMoveAgain: 'No move possible, but a 6: roll again!',
    thirdSix: 'A third 6 in a row: the turn passes.',
    tokensLabel: 'Tokens per player',
    quick: 'Quick',
    quickHint: '2 tokens each: a short race',
    classic: 'Classic',
    classicHint: '4 tokens each: the full game',
    'err.rollFirst': 'Roll the die first.',
    'err.moveFirst': 'Move a token first.',
    'err.badToken': 'That isn’t one of your tokens.',
    'err.cantMove': 'That token can’t move with this roll.',
  },
  {
    name: 'لودو',
    blurb: 'الرقم 6 يُخرج القطعة من البيت، ثم السباق حول اللوح نحو المركز. الوقوع على قطعة منافسة يعيدها إلى بيتها، والفوز بإيصال كل القطع أولاً.',
    yourRoll: 'دورك: رمي النرد',
    yourMove: 'دورك: اختيار قطعة',
    roll: 'رمي النرد',
    intro: 'الرقم 6 يُخرج القطعة من البيت. الفوز بإيصال كل القطع إلى المركز.',
    boardLabel: 'لوح لودو',
    dieShows: (d) => `النرد: ${d}`,
    dieBlank: 'لا رمية بعد',
    moveToken: (k) => `تحريك القطعة ${k}`,
    bringOut: 'إخراج قطعة من البيت',
    rolled: (n, d) => `${n}: ${d} على النرد.`,
    choose: 'القطع المضيئة جاهزة للحركة.',
    choosing: 'بانتظار اختيار قطعة…',
    out: 'قطعة جديدة تخرج إلى المسار.',
    onlyMove: 'حركة وحيدة ممكنة، تمّت تلقائياً.',
    captured: (n, count) =>
      count === 1
        ? `💥 قطعة ${n} تعود إلى البيت!`
        : count === 2
          ? `💥 قطعتان من قطع ${n} تعودان إلى البيت!`
          : `💥 ${count} من قطع ${n} تعود إلى البيت!`,
    capturedYou: (count) =>
      count === 1 ? '💥 قطعتك تعود إلى البيت!' : count === 2 ? '💥 قطعتان من قطعك تعودان إلى البيت!' : `💥 ${count} من قطعك تعود إلى البيت!`,
    home: '🏠 قطعة وصلت إلى المركز!',
    again: 'الرقم 6: رمية إضافية!',
    noMove: 'لا حركة ممكنة، والدور ينتقل.',
    noMoveAgain: 'لا حركة ممكنة، لكن الرقم 6 يمنح رمية إضافية!',
    thirdSix: 'الرقم 6 للمرة الثالثة على التوالي: الدور ينتقل.',
    tokensLabel: 'عدد القطع لكل لاعب',
    quick: 'سريعة',
    quickHint: 'قطعتان لكل لاعب: سباق قصير',
    classic: 'كلاسيكية',
    classicHint: '4 قطع لكل لاعب: اللعبة الكاملة',
    'err.rollFirst': 'يجب رمي النرد أولاً.',
    'err.moveFirst': 'يجب تحريك قطعة أولاً.',
    'err.badToken': 'هذه ليست إحدى قطعك.',
    'err.cantMove': 'هذه القطعة لا تتحرك بهذه الرمية.',
  },
);
