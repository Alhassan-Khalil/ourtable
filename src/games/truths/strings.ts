import { defineStrings } from '../../i18n';

/**
 * This game's texts. `en` defines keys and argument types; `ar` must match.
 * Arabic: never assume the partner's gender (noun phrases like "جمل سامي", "تخمين …", "بانتظار كتابة …").
 * GameError messages use the registered form "truths.<key>", e.g. new GameError('truths.err.badLie').
 */
export const tg = defineStrings(
  'truths',
  {
    name: 'Two Truths and a Lie',
    blurb: 'Write two truths and a lie about yourself, then spot your partner’s lie. Three rounds.',
    round: (r: number, n: number) => `Round ${r} of ${n}`,

    // turn banner
    writeNow: 'Write two truths and a lie about yourself',
    waitWrite: (n: string) => `Waiting for ${n} to write…`,
    guessNow: (n: string) => `Find ${n}’s lie`,
    waitGuess: (n: string) => `Waiting for ${n}’s guess…`,
    roundResult: 'Round result',

    // writing
    writeHint: 'Three short statements about you: two true, one a lie. Mark the lie.',
    statement: (i: number) => `Statement ${i}`,
    ph1: 'I’ve been to Istanbul',
    ph2: 'I can ride a horse',
    ph3: 'I once met a famous singer',
    thisIsLie: '🤥 This is the lie',
    lockIn: 'Lock in my statements',
    partnerReady: (n: string) => `${n}’s statements are ready`,
    yourStatements: 'Your statements',
    shuffled: 'Your partner sees them in this shuffled order.',

    // guessing
    theirStatements: (n: string) => `${n}’s statements`,
    pickHint: 'Tap the statement you think is the lie',
    thatsTheLie: 'That’s the lie!',

    // reveal
    lie: 'Lie',
    truth: 'Truth',
    yourGuess: 'Your guess',
    theirGuess: (n: string) => `${n}’s guess`,
    foundLie: 'You spotted the lie!',
    missedLie: 'You missed the lie',
    oppFoundLie: (n: string) => `${n} spotted your lie`,
    oppMissedLie: (n: string) => `You fooled ${n}!`,
    nextRound: 'Next round',

    'err.badStatements': 'Write three statements, each between 1 and 140 characters.',
    'err.badLie': 'Mark which statement is the lie.',
    'err.alreadyWrote': 'Your statements are already locked in.',
    'err.notWriting': 'It’s not time to write statements.',
    'err.notGuessing': 'It’s not time to guess.',
    'err.badGuess': 'Pick one of the three statements.',
    'err.alreadyGuessed': 'Your guess is already locked in.',
    'err.notReveal': 'The round isn’t finished yet.',
  },
  {
    name: 'حقيقتان وكذبة',
    blurb: 'اكتب حقيقتين وكذبة عن نفسك، ثم اكشف كذبة شريكك. ثلاث جولات.',
    round: (r, n) => `الجولة ${r} من ${n}`,

    writeNow: 'اكتب حقيقتين وكذبة عن نفسك',
    waitWrite: (n) => `بانتظار كتابة ${n}…`,
    guessNow: (n) => `اكشف كذبة ${n}`,
    waitGuess: (n) => `بانتظار تخمين ${n}…`,
    roundResult: 'نتيجة الجولة',

    writeHint: 'ثلاث جمل قصيرة عنك: اثنتان صحيحتان وواحدة كذبة. حدّد الكذبة.',
    statement: (i) => `الجملة ${i}`,
    ph1: 'زرت إسطنبول',
    ph2: 'أستطيع ركوب الخيل',
    ph3: 'قابلت مطرباً مشهوراً ذات مرة',
    thisIsLie: '🤥 هذه هي الكذبة',
    lockIn: 'تثبيت جملي',
    partnerReady: (n) => `جمل ${n} جاهزة`,
    yourStatements: 'جملك',
    shuffled: 'يراها شريكك بهذا الترتيب العشوائي.',

    theirStatements: (n) => `جمل ${n}`,
    pickHint: 'اضغط على الجملة التي تظنها كذبة',
    thatsTheLie: 'هذه هي الكذبة!',

    lie: 'كذبة',
    truth: 'حقيقة',
    yourGuess: 'تخمينك',
    theirGuess: (n) => `تخمين ${n}`,
    foundLie: 'كشفت الكذبة!',
    missedLie: 'لم تكشف الكذبة',
    oppFoundLie: (n) => `انكشفت كذبتك أمام ${n}`,
    oppMissedLie: (n) => `نجحت خدعتك مع ${n}!`,
    nextRound: 'الجولة التالية',

    'err.badStatements': 'اكتب ثلاث جمل، طول كل واحدة بين 1 و140 حرفاً.',
    'err.badLie': 'حدّد أي الجمل هي الكذبة.',
    'err.alreadyWrote': 'جملك مثبّتة بالفعل.',
    'err.notWriting': 'ليس وقت كتابة الجمل.',
    'err.notGuessing': 'ليس وقت التخمين.',
    'err.badGuess': 'اختر إحدى الجمل الثلاث.',
    'err.alreadyGuessed': 'تخمينك مثبّت بالفعل.',
    'err.notReveal': 'لم تنتهِ الجولة بعد.',
  },
);
