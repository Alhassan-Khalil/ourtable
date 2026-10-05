import { defineStrings } from '../../i18n';

/**
 * This game's texts. `en` defines keys and argument types; `ar` must match.
 * Arabic: never assume a player's gender (noun phrases like "ستوب من سامي", "إجابات …", "التعادل بين …").
 * GameError messages use the registered form "categories.<key>", e.g. new GameError('categories.err.fillAll').
 */
export const tg = defineStrings(
  'categories',
  {
    name: 'Categories',
    blurb: 'A race to fill five boxes with one letter: a name, an animal, a plant, an object and a place. Then compare answers.',
    round: (r: number, n: number) => `Round ${r} of ${n}`,
    letter: 'The letter',

    // the five categories, always in this order
    'cat.0': 'Name',
    'cat.1': 'Animal',
    'cat.2': 'Plant',
    'cat.3': 'Object',
    'cat.4': 'Country / city',

    // setup (host)
    'setup.title': 'Categories: set up the game',
    'setup.alphabet': 'Letters',
    'setup.ar': 'Arabic',
    'setup.en': 'English',
    'setup.rounds': 'Rounds',
    'setup.roundsN': (n: number) => `${n} rounds`,

    // writing
    writeBanner: 'Fill all five boxes, fast!',
    writeHint: (l: string) => `Every answer starts with ${l}. Once all five are filled, Stop ends the round for everyone.`,
    stop: 'Stop! ✋',
    stopLocked: 'Stop unlocks when all five boxes are filled',
    progressAria: (n: string, k: number) => `${n}: ${k} of 5 filled`,
    wrongLetter: (l: string) => `Doesn’t start with ${l}`,

    // review
    reviewBanner: 'Check the answers',
    waiting: 'Waiting for the others…',
    stoppedBy: (n: string) => `Stop! called by ${n} ✋`,
    stoppedByYou: 'You called Stop! ✋',
    reviewHint: 'Tap ✗ on an answer you think is wrong. It is thrown out only if all the other players reject it.',
    noAnswer: 'No answer',
    sameAnswer: 'Matches another answer',
    rejected: 'Rejected',
    rejectAria: (n: string) => `Reject ${n}’s answer`,
    thisRound: 'This round',
    ready: 'Ready ✓',

    // end
    final: 'Final scores',
    total: 'Total',
    tiedFor: (names: string) => `Tied at the top: ${names}`,

    'err.badAnswers': 'Send five answers, each up to 30 characters.',
    'err.notWriting': 'The writing time is over.',
    'err.notReview': 'It’s not time to check answers.',
    'err.fillAll': 'Fill all five boxes before pressing Stop.',
    'err.badReject': 'Pick another player’s answer.',
    'err.nothingToReject': 'That answer is already worth nothing.',
  },
  {
    name: 'إنسان حيوان جماد نبات',
    blurb: 'سباق لملء خمس خانات بحرف واحد: إنسان وحيوان ونبات وجماد وبلاد. ثم تُقارَن الإجابات.',
    round: (r, n) => `الجولة ${r} من ${n}`,
    letter: 'الحرف',

    'cat.0': 'إنسان',
    'cat.1': 'حيوان',
    'cat.2': 'نبات',
    'cat.3': 'جماد',
    'cat.4': 'بلاد',

    'setup.title': 'إنسان حيوان جماد نبات: إعدادات اللعبة',
    'setup.alphabet': 'الحروف',
    'setup.ar': 'العربية',
    'setup.en': 'الإنجليزية',
    'setup.rounds': 'عدد الجولات',
    'setup.roundsN': (n) => `${n} جولات`,

    writeBanner: 'الخانات الخمس بأسرع ما يمكن!',
    writeHint: (l) => `كل إجابة تبدأ بحرف ${l}. بعد امتلاء الخانات الخمس يصبح ستوب متاحاً، وبه تنتهي الجولة للجميع.`,
    stop: 'ستوب ✋',
    stopLocked: 'ستوب يُفتح بعد امتلاء الخانات الخمس',
    progressAria: (n, k) => `${n}: ${k} من 5`,
    wrongLetter: (l) => `لا تبدأ بحرف ${l}`,

    reviewBanner: 'مراجعة الإجابات',
    waiting: 'بانتظار البقية…',
    stoppedBy: (n) => `ستوب من ${n} ✋`,
    stoppedByYou: 'ستوب منك ✋',
    reviewHint: 'اضغط ✗ على أي إجابة تراها خاطئة. لا تُلغى الإجابة إلا إذا رفضها جميع اللاعبين الآخرين.',
    noAnswer: 'بلا إجابة',
    sameAnswer: 'تطابق إجابة أخرى',
    rejected: 'مرفوضة',
    rejectAria: (n) => `رفض إجابة ${n}`,
    thisRound: 'هذه الجولة',
    ready: 'جاهز ✓',

    final: 'النتيجة النهائية',
    total: 'المجموع',
    tiedFor: (names) => `التعادل بين ${names}`,

    'err.badAnswers': 'يلزم خمس إجابات، لا تزيد كل واحدة عن 30 حرفاً.',
    'err.notWriting': 'انتهى وقت الكتابة.',
    'err.notReview': 'ليس وقت مراجعة الإجابات.',
    'err.fillAll': 'يلزم ملء الخانات الخمس قبل ستوب.',
    'err.badReject': 'اختر إجابة لاعب آخر.',
    'err.nothingToReject': 'هذه الإجابة بلا نقاط أصلاً.',
  },
);
