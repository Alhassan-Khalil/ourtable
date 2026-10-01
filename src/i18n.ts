import { effect, signal } from '@preact/signals';
import { KEYS, load, save } from './core/storage';

/**
 * Arabic is the default; English is one tap away on the home screen.
 *
 * Arabic wording avoids assuming anyone's gender: the partner is referred to with noun phrases
 * ("دور سامي", "الفوز من نصيب …") instead of gendered verbs, and questions use "شخصك" (your person).
 * Names are never glued to a prefix like "لـ", which breaks on names starting with "ال".
 */
export type Lang = 'ar' | 'en';

const en = {
  appName: 'OurTable',
  tagline: 'Board games for two, wherever you both are.',
  otherLang: 'العربية',
  yourName: 'Your name',
  namePlaceholder: 'Your first name',
  needName: 'Type your name first, so your partner sees who joined.',
  badCode: 'That code doesn’t look right. It has 10 letters/numbers, like ABCDE-FGH23.',
  invited: 'You’re invited 💌',
  room: 'Room',
  joinTheTable: 'Join the table',
  continue: 'Continue',
  yourRoom: 'Your room',
  withName: (n: string) => `with ${n}`,
  joinedRoom: 'Joined room',
  reopen: 'Reopen',
  rejoin: 'Rejoin',
  forget: 'Forget',
  startTable: 'Start a table',
  startTableHint: 'You get a link to send your partner.',
  createRoom: 'Create room',
  joinTable: 'Join a table',
  join: 'Join',
  roomCode: 'Room code',
  footnote: '🔒 Moves and photos go directly between your two browsers, encrypted. No accounts, and nothing is stored on a server.',

  'status.starting': 'Opening…',
  'status.waiting': 'Waiting for partner',
  'status.connecting': 'Connecting…',
  'status.connected': 'Connected',
  'status.failed': 'Can’t connect',
  withPartner: (n: string) => `With ${n}`,
  games: 'Games',
  leave: 'Leave',
  confirmStopGame: 'Stop this game and go back to the game list?',
  confirmCloseRoom: 'Close this room? Your partner will be disconnected and the saved game is forgotten on this device.',
  confirmLeave: 'Leave this room?',
  backHome: 'Back home',
  pickGame: 'Pick a game',
  hostChooses: (n: string) => `${n} chooses the game. It will start for you automatically.`,
  comingSoon: 'Coming soon',
  settingUp: (host: string, game: string) => `${host} is setting up ${game}…`,
  loadingGame: 'Loading the game…',
  inviteTitle: 'Invite your partner',
  inviteHint: 'Send this link (e.g. on WhatsApp). When it’s opened, you’re connected.',
  inviteLink: 'Invite link',
  copy: 'Copy',
  copied: 'Copied ✓',
  share: 'Share',
  shareText: 'Come play with me 💛',
  copyPrompt: 'Copy this link:',
  returning: (n: string) => `${n} can rejoin with the same link. It may just need to be reopened.`,
  newDevice: 'Let a new device join',
  newDeviceHint: (n: string) => `Only if ${n} switched to another phone or browser.`,
  seatFreed: 'Done. The next device that opens the link takes the seat.',
  playAgain: 'Play again',
  otherGames: 'Other games',
  chess: 'Chess',
  battleship: 'Battleship',

  // connection details (keys come from net/link.ts)
  'link.opening': 'Opening the room…',
  'link.roomOpen': 'Room is open. Waiting for your partner…',
  'link.idTaken': 'The room is still registered from before. Retrying…',
  'link.retrying': 'Connection problem. Retrying…',
  'link.noWebrtc': 'This browser can’t make direct connections (WebRTC).',
  'link.partnerLeft': 'Your partner disconnected. Waiting for them to come back…',
  'link.partnerLost': 'Lost your partner. Waiting for them to come back…',
  'link.reaching': 'Reaching the room…',
  'link.hostOffline': 'Waiting for the room to open. Is your partner online?',
  'link.cantReach': 'Can’t reach the room yet. Retrying…',
  'link.connLost': 'Connection lost. Reconnecting…',
  'link.roomFull': 'This room already has two players. If you switched device, ask the host to tap “Let a new device join”.',

  'toast.saveFailed': 'Couldn’t save the game on this device (storage full). It still works while open.',
  'toast.notConnected': 'Not connected right now. Try again in a moment.',

  // game errors (GameError messages are these keys)
  'err.generic': 'That move didn’t work.',
  'err.over': 'The game is over.',
  'err.notYourTurn': 'It’s not your turn.',
  'err.pickColumn': 'Pick a column.',
  'err.columnFull': 'That column is full.',
  'err.deckTooSmall': 'Guess Who needs at least 6 people.',
  'err.alreadyChosen': 'Secret people are already chosen.',
  'err.unknownCard': 'Unknown card.',
  'err.notStarted': 'The game hasn’t started yet.',
  'err.emptyQuestion': 'Type a question first.',
  'err.noQuestion': 'There’s no question to answer.',
  'err.partnerAnswers': 'Your partner has to answer your question.',
  'err.guessOnTurn': 'You can only guess on your turn, instead of asking.',
  'err.unknownMove': 'Unknown move.',

  // Connect Four
  'c4.name': 'Connect Four',
  'c4.blurb': 'Drop pieces, line up four in a row. Quick, 5 minutes.',
  'c4.draw': 'It’s a draw!',
  'c4.yourTurn': 'Your turn: drop a piece',
  'c4.dropIn': (col: number) => `Drop in column ${col}`,
  youWin: 'You win! 🎉',
  oppWins: (n: string) => `${n} wins`,
  oppTurn: (n: string) => `${n}’s turn…`,
  you: 'You',
  draw: 'It’s a draw!',

  // Guess Who
  'gw.name': 'Guess Who',
  'gw.blurb': 'Ask yes/no questions to find the secret person. Classic faces or your own photos.',
  'gw.setupTitle': 'Guess Who: choose the people',
  'gw.classic': 'Classic faces',
  'gw.classicHint': '24 characters with glasses, hats, beards… Ready to play.',
  'gw.photos': 'Our photos',
  'gw.photosHint': (min: number, max: number) => `Family, friends, places you both know. ${min} to ${max} photos.`,
  'gw.addPhotos': '+ Add photos',
  'gw.processing': 'Processing…',
  'gw.addAtLeast': (n: number) => `(add at least ${n})`,
  'gw.clearAll': 'Clear all',
  'gw.tooMany': (max: number) => `Only ${max} people fit on a board; extra photos were skipped.`,
  'gw.cantRead': (names: string) => `Couldn’t read: ${names} (try JPG or PNG).`,
  'gw.photosPrivacy':
    'Photos are shrunk on this device and sent only to your partner’s browser. Nothing is uploaded to a server. Give each one a name you both recognise.',
  'gw.nameLabel': 'Name',
  'gw.remove': (n: string) => `Remove ${n}`,
  'gw.person': (i: number) => `Person ${i}`,
  back: 'Back',
  startGame: 'Start game',
  'gw.pickPrompt': 'Tap a card to choose your secret person',
  'gw.waitPick': (n: string) => `Waiting for ${n} to choose… (you can still change)`,
  'gw.starting': 'Starting…',
  'gw.yourTurn': 'Your turn: ask a yes/no question, or make a guess',
  'gw.tapGuess': 'Tap the person you think it is',
  'gw.waitAnswer': (n: string) => `Waiting for ${n} to answer…`,
  'gw.oppAsked': (n: string) => `${n} asked you a question`,
  'gw.oppThinking': (n: string) => `${n}’s turn to ask…`,
  'gw.youRight': (g: string) => `You guessed ${g}. Correct!`,
  'gw.youWrong': (g: string, s: string) => `You guessed ${g}, but it was ${s}.`,
  'gw.oppRight': (n: string, g: string) => `${n} guessed ${g}. That was your person.`,
  'gw.oppWrong': (n: string, g: string, s: string) => `${n} guessed ${g}, but your person was ${s}.`,
  'gw.yourPerson': 'Your person',
  'gw.left': (l: number, n: number) => `${l} of ${n} still up`,
  'gw.asks': (n: string) => `${n} asks:`,
  yes: 'Yes',
  no: 'No',
  'gw.answerAbout': (n: string) => `Answer about ${n}.`,
  'gw.askPlaceholder': 'Does your person…?',
  'gw.ask': 'Ask',
  'gw.yourQuestion': 'Your question',
  'gw.makeGuess': '🎯 Make a guess',
  'gw.guessHelp': (n: string) => `Tap the person you think ${n} has. If you’re wrong, you lose.`,
  'gw.cancelGuess': 'Cancel guess',
  'gw.said': (n: string) => `${n} said`,
  'gw.flipHint': 'Tap everyone who doesn’t match to flip them down.',
  'gw.questions': 'Questions',
  'gw.guessConfirm': (g: string) => `Guess ${g}?`,
  'gw.ifWrong': (n: string) => `If you’re wrong, ${n} wins.`,
  cancel: 'Cancel',
  'gw.yesGuess': 'Yes, guess',
};

type Dict = typeof en;

const ar: Dict = {
  appName: 'طاولتنا',
  tagline: 'ألعاب لوحية لشخصين، أينما كنتما.',
  otherLang: 'English',
  yourName: 'اسمك',
  namePlaceholder: 'اسمك الأول',
  needName: 'اكتب اسمك أولاً ليعرف شريكك من انضم.',
  badCode: 'الرمز غير صحيح. يتكون من 10 أحرف وأرقام، مثل ABCDE-FGH23.',
  invited: 'لديك دعوة 💌',
  room: 'الغرفة',
  joinTheTable: 'انضم إلى الطاولة',
  continue: 'متابعة',
  yourRoom: 'غرفتك',
  withName: (n) => `مع ${n}`,
  joinedRoom: 'غرفة انضممت إليها',
  reopen: 'افتح',
  rejoin: 'عودة',
  forget: 'احذف',
  startTable: 'ابدأ طاولة',
  startTableHint: 'ستحصل على رابط ترسله لشريكك.',
  createRoom: 'إنشاء غرفة',
  joinTable: 'انضم إلى طاولة',
  join: 'انضمام',
  roomCode: 'رمز الغرفة',
  footnote: '🔒 الحركات والصور تنتقل مباشرة بين متصفحيكما وبشكل مشفّر. لا حسابات، ولا شيء يُحفظ على أي خادم.',

  'status.starting': 'جارٍ الفتح…',
  'status.waiting': 'بانتظار الشريك',
  'status.connecting': 'جارٍ الاتصال…',
  'status.connected': 'متصل',
  'status.failed': 'تعذّر الاتصال',
  withPartner: (n) => `مع ${n}`,
  games: 'الألعاب',
  leave: 'خروج',
  confirmStopGame: 'إيقاف هذه اللعبة والعودة إلى قائمة الألعاب؟',
  confirmCloseRoom: 'إغلاق هذه الغرفة؟ سيُفصل شريكك وتُحذف اللعبة المحفوظة من هذا الجهاز.',
  confirmLeave: 'مغادرة هذه الغرفة؟',
  backHome: 'العودة للرئيسية',
  pickGame: 'اختر لعبة',
  hostChooses: (n) => `اختيار اللعبة عند ${n}، وستبدأ عندك تلقائياً.`,
  comingSoon: 'قريباً',
  settingUp: (host, game) => `جارٍ تجهيز «${game}» عند ${host}…`,
  loadingGame: 'جارٍ تحميل اللعبة…',
  inviteTitle: 'ادعُ شريكك',
  inviteHint: 'أرسل هذا الرابط (مثلاً عبر واتساب). عند فتحه تصبحان متصلَين.',
  inviteLink: 'رابط الدعوة',
  copy: 'نسخ',
  copied: 'تم النسخ ✓',
  share: 'مشاركة',
  shareText: 'هيا نلعب معاً 💛',
  copyPrompt: 'انسخ هذا الرابط:',
  returning: (n) => `بإمكان ${n} العودة بنفس الرابط، وربما يكفي فتحه من جديد.`,
  newDevice: 'السماح بجهاز جديد',
  newDeviceHint: (n) => `فقط إذا انتقل ${n} إلى هاتف أو متصفح آخر.`,
  seatFreed: 'تم. أول جهاز يفتح الرابط سيأخذ المقعد.',
  playAgain: 'العب مجدداً',
  otherGames: 'ألعاب أخرى',
  chess: 'الشطرنج',
  battleship: 'معركة السفن',

  'link.opening': 'جارٍ فتح الغرفة…',
  'link.roomOpen': 'الغرفة مفتوحة. بانتظار شريكك…',
  'link.idTaken': 'الغرفة ما زالت مسجلة من قبل. إعادة المحاولة…',
  'link.retrying': 'مشكلة في الاتصال. إعادة المحاولة…',
  'link.noWebrtc': 'هذا المتصفح لا يدعم الاتصال المباشر (WebRTC).',
  'link.partnerLeft': 'انقطع اتصال شريكك. بانتظار العودة…',
  'link.partnerLost': 'فُقد الاتصال بشريكك. بانتظار العودة…',
  'link.reaching': 'جارٍ الوصول إلى الغرفة…',
  'link.hostOffline': 'بانتظار فتح الغرفة. هل شريكك متصل؟',
  'link.cantReach': 'تعذّر الوصول إلى الغرفة حالياً. إعادة المحاولة…',
  'link.connLost': 'انقطع الاتصال. جارٍ إعادة الاتصال…',
  'link.roomFull': 'هذه الغرفة فيها لاعبان بالفعل. إذا غيّرت جهازك، اطلب من صاحب الغرفة الضغط على «السماح بجهاز جديد».',

  'toast.saveFailed': 'تعذّر حفظ اللعبة على هذا الجهاز (المساحة ممتلئة). ستعمل ما دامت الصفحة مفتوحة.',
  'toast.notConnected': 'غير متصل الآن. حاول بعد لحظات.',

  'err.generic': 'لم تنجح هذه الحركة.',
  'err.over': 'انتهت اللعبة.',
  'err.notYourTurn': 'ليس دورك.',
  'err.pickColumn': 'اختر عموداً.',
  'err.columnFull': 'هذا العمود ممتلئ.',
  'err.deckTooSmall': 'تحتاج اللعبة إلى 6 أشخاص على الأقل.',
  'err.alreadyChosen': 'تم اختيار الأشخاص السريين بالفعل.',
  'err.unknownCard': 'بطاقة غير معروفة.',
  'err.notStarted': 'لم تبدأ اللعبة بعد.',
  'err.emptyQuestion': 'اكتب سؤالاً أولاً.',
  'err.noQuestion': 'لا يوجد سؤال للإجابة عنه.',
  'err.partnerAnswers': 'الإجابة عن سؤالك عند شريكك.',
  'err.guessOnTurn': 'التخمين متاح في دورك فقط، بدلاً من السؤال.',
  'err.unknownMove': 'حركة غير معروفة.',

  'c4.name': 'أربعة في صف',
  'c4.blurb': 'أسقط القطع وصُفّ أربعاً متتالية. لعبة سريعة، 5 دقائق.',
  'c4.draw': 'تعادل!',
  'c4.yourTurn': 'دورك: أسقط قطعة',
  'c4.dropIn': (col) => `إسقاط في العمود ${col}`,
  youWin: 'فزت! 🎉',
  oppWins: (n) => `الفوز من نصيب ${n}`,
  oppTurn: (n) => `دور ${n}…`,
  you: 'أنت',
  draw: 'تعادل!',

  'gw.name': 'خمّن مَن',
  'gw.blurb': 'اسأل أسئلة جوابها نعم أو لا لتكتشف الشخص السري. بالوجوه الكلاسيكية أو بصوركما.',
  'gw.setupTitle': 'خمّن مَن: اختيار الشخصيات',
  'gw.classic': 'الوجوه الكلاسيكية',
  'gw.classicHint': '24 شخصية بنظارات وقبعات ولحى… جاهزة للعب.',
  'gw.photos': 'صورنا',
  'gw.photosHint': (min, max) => `العائلة والأصدقاء وأماكن تعرفانها. من ${min} إلى ${max} صورة.`,
  'gw.addPhotos': '+ إضافة صور',
  'gw.processing': 'جارٍ التجهيز…',
  'gw.addAtLeast': (n) => `(أضف ${n} على الأقل)`,
  'gw.clearAll': 'مسح الكل',
  'gw.tooMany': (max) => `يتسع اللوح لـ${max} شخصاً فقط، وتم تجاهل الصور الزائدة.`,
  'gw.cantRead': (names) => `تعذّرت قراءة: ${names} (جرّب JPG أو PNG).`,
  'gw.photosPrivacy':
    'تُصغَّر الصور على هذا الجهاز وتُرسل إلى متصفح شريكك فقط، ولا يُرفع شيء إلى أي خادم. أعطِ كل صورة اسماً يعرفه كلاكما.',
  'gw.nameLabel': 'الاسم',
  'gw.remove': (n) => `إزالة ${n}`,
  'gw.person': (i) => `شخص ${i}`,
  back: 'رجوع',
  startGame: 'ابدأ اللعب',
  'gw.pickPrompt': 'اضغط على بطاقة لاختيار شخصك السري',
  'gw.waitPick': (n) => `بانتظار اختيار ${n}… (يمكنك التغيير)`,
  'gw.starting': 'جارٍ البدء…',
  'gw.yourTurn': 'دورك: اسأل سؤالاً جوابه نعم أو لا، أو خمّن',
  'gw.tapGuess': 'اضغط على الشخص الذي تظنه',
  'gw.waitAnswer': (n) => `بانتظار إجابة ${n}…`,
  'gw.oppAsked': (n) => `سؤال من ${n}`,
  'gw.oppThinking': (n) => `دور ${n} في السؤال…`,
  'gw.youRight': (g) => `خمّنت ${g}. إجابة صحيحة!`,
  'gw.youWrong': (g, s) => `خمّنت ${g}، لكن الشخص كان ${s}.`,
  'gw.oppRight': (n, g) => `تخمين ${n}: ${g}، وهو شخصك فعلاً.`,
  'gw.oppWrong': (n, g, s) => `تخمين ${n}: ${g}، لكن شخصك كان ${s}.`,
  'gw.yourPerson': 'شخصك',
  'gw.left': (l, n) => `المتبقي ${l} من ${n}`,
  'gw.asks': (n) => `سؤال ${n}:`,
  yes: 'نعم',
  no: 'لا',
  'gw.answerAbout': (n) => `الإجابة عن ${n}.`,
  'gw.askPlaceholder': 'هل شخصك…؟',
  'gw.ask': 'اسأل',
  'gw.yourQuestion': 'سؤالك',
  'gw.makeGuess': '🎯 خمّن الشخص',
  'gw.guessHelp': (n) => `اضغط على الشخص الذي تظن أنه مع ${n}. إن أخطأت تخسر.`,
  'gw.cancelGuess': 'إلغاء التخمين',
  'gw.said': (n) => `إجابة ${n}:`,
  'gw.flipHint': 'اضغط على كل من لا يطابق لقلبه.',
  'gw.questions': 'الأسئلة',
  'gw.guessConfirm': (g) => `تخمين ${g}؟`,
  'gw.ifWrong': (n) => `إن كان التخمين خطأً فالفوز من نصيب ${n}.`,
  cancel: 'إلغاء',
  'gw.yesGuess': 'نعم، خمّن',
};

const DICTS: Record<Lang, Dict> = { ar, en };

export type Key = keyof Dict;

export const lang = signal<Lang>(load<Lang>(KEYS.lang) === 'en' ? 'en' : 'ar');

export function setLang(l: Lang) {
  lang.value = l;
  save(KEYS.lang, l);
}

type Args<K extends Key> = Dict[K] extends (...a: infer A) => string ? A : [];

/** Translate. Reading `lang.value` here subscribes the calling component, so switching re-renders. */
export function t<K extends Key>(key: K, ...args: Args<K>): string {
  const v = DICTS[lang.value][key] as string | ((...a: unknown[]) => string);
  return typeof v === 'function' ? v(...args) : v;
}

/** For keys that arrive at runtime (GameError / link details). Unknown keys are shown as-is. */
export function tKey(key: string): string {
  const v = (DICTS[lang.value] as Record<string, unknown>)[key] ?? GAME_STRINGS[lang.value][key];
  return typeof v === 'string' ? v : key;
}

type Entry = string | ((...a: any[]) => string);

/** Strings registered by games via defineStrings, under "<gameId>.<key>". Used by tKey for GameErrors. */
const GAME_STRINGS: Record<Lang, Record<string, Entry>> = { ar: {}, en: {} };

/**
 * A game's own texts, kept in its folder (src/games/<id>/strings.ts) so games never edit this file.
 * `en` defines the keys and argument types; `ar` must have exactly the same keys.
 * Returns a typed translator for this game. Keys are also registered as "<id>.<key>", which is
 * what a GameError message must be: `throw new GameError('dots.err.taken')`.
 */
export function defineStrings<D extends Record<string, Entry>>(id: string, en: D, ar: NoInfer<{ [K in keyof D]: D[K] }>) {
  for (const [k, v] of Object.entries(en)) GAME_STRINGS.en[`${id}.${k}`] = v;
  for (const [k, v] of Object.entries(ar)) GAME_STRINGS.ar[`${id}.${k}`] = v as Entry;
  const dicts = { en, ar } as Record<Lang, Record<string, Entry>>;
  return <K extends keyof D & string>(key: K, ...args: D[K] extends (...a: infer A) => string ? A : []): string => {
    const v = dicts[lang.value][key];
    return typeof v === 'function' ? v(...args) : v;
  };
}

if (typeof document !== 'undefined') {
  effect(() => {
    const root = document.documentElement;
    root.lang = lang.value;
    root.dir = lang.value === 'ar' ? 'rtl' : 'ltr';
    document.title = DICTS[lang.value].appName;
  });
}
