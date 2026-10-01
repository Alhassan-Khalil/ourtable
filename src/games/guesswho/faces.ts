import type { Card } from './logic';

/**
 * The built-in "Classic faces" deck: 24 hand-tuned characters drawn as SVG, so there are no
 * image assets and the whole deck is a few KB. Features are spread so yes/no questions split well.
 */

type Style = 'short' | 'long' | 'curly' | 'bun' | 'spiky' | 'bald';
type HairColor = 'black' | 'brown' | 'blonde' | 'red' | 'gray';

interface Face {
  name: string;
  skin: number;
  style: Style;
  hair: HairColor;
  glasses?: boolean;
  hat?: boolean;
  beard?: boolean;
  earrings?: boolean;
}

const SKIN = ['#f6d5b8', '#eab98f', '#c98d5f', '#9a643f', '#6b442a', '#f2c9a0'];
const HAIR: Record<HairColor, string> = {
  black: '#211c1b',
  brown: '#6f4121',
  blonde: '#e3bd57',
  red: '#c0461d',
  gray: '#a3a8b1',
};
const BG = ['#fde2e4', '#dbeafe', '#dcfce7', '#fef3c7', '#ede9fe', '#cffafe', '#ffedd5', '#fce7f3'];
const SHIRT = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4b5563'];
const HAT = ['#1d4ed8', '#be123c', '#15803d', '#7e22ce', '#b45309'];

const FACES: (Face & { ar: string })[] = [
  { name: 'Hadi', ar: 'هادي', skin: 0, style: 'short', hair: 'brown', glasses: true },
  { name: 'Sami', ar: 'سامي', skin: 2, style: 'curly', hair: 'black' },
  { name: 'Maya', ar: 'مايا', skin: 1, style: 'long', hair: 'black', earrings: true },
  { name: 'Omar', ar: 'عمر', skin: 3, style: 'short', hair: 'black', beard: true },
  { name: 'Lina', ar: 'لينا', skin: 0, style: 'long', hair: 'red', glasses: true, earrings: true },
  { name: 'Nabil', ar: 'نبيل', skin: 1, style: 'short', hair: 'blonde', hat: true },
  { name: 'Zeina', ar: 'زينة', skin: 4, style: 'bun', hair: 'black', earrings: true },
  { name: 'Rami', ar: 'رامي', skin: 0, style: 'short', hair: 'red', beard: true },
  { name: 'Nour', ar: 'نور', skin: 2, style: 'long', hair: 'blonde', glasses: true },
  { name: 'Yusuf', ar: 'يوسف', skin: 3, style: 'bald', hair: 'gray', beard: true, glasses: true },
  { name: 'Salma', ar: 'سلمى', skin: 0, style: 'bun', hair: 'blonde' },
  { name: 'Karim', ar: 'كريم', skin: 2, style: 'curly', hair: 'brown', hat: true },
  { name: 'Sara', ar: 'سارة', skin: 1, style: 'long', hair: 'brown', earrings: true, hat: true },
  { name: 'Adam', ar: 'آدم', skin: 4, style: 'short', hair: 'black', glasses: true },
  { name: 'Hana', ar: 'هنا', skin: 5, style: 'curly', hair: 'red' },
  { name: 'Tarek', ar: 'طارق', skin: 0, style: 'bald', hair: 'brown' },
  { name: 'Rania', ar: 'رانيا', skin: 3, style: 'long', hair: 'black', hat: true },
  { name: 'Bilal', ar: 'بلال', skin: 1, style: 'spiky', hair: 'brown', beard: true },
  { name: 'Layla', ar: 'ليلى', skin: 2, style: 'curly', hair: 'black', earrings: true, glasses: true },
  { name: 'Majid', ar: 'ماجد', skin: 0, style: 'short', hair: 'gray', hat: true, beard: true },
  { name: 'Dina', ar: 'دينا', skin: 5, style: 'short', hair: 'blonde', earrings: true },
  { name: 'Hamza', ar: 'حمزة', skin: 5, style: 'spiky', hair: 'red', glasses: true },
  { name: 'Mariam', ar: 'مريم', skin: 4, style: 'long', hair: 'gray' },
  { name: 'Jamal', ar: 'جمال', skin: 2, style: 'bald', hair: 'black', beard: true },
];

/**
 * Tag → the question a player would ask. Only tags present in the deck are offered.
 * Arabic uses "شخصك" (your person, a grammatically neutral noun) so it fits men and women alike.
 */
export const QUICK_QUESTIONS: [tag: string, q: { en: string; ar: string }][] = [
  ['glasses', { en: 'Do they wear glasses?', ar: 'هل يرتدي شخصك نظارة؟' }],
  ['hat', { en: 'Do they wear a hat?', ar: 'هل يرتدي شخصك قبعة؟' }],
  ['beard', { en: 'Do they have a beard?', ar: 'هل لشخصك لحية؟' }],
  ['earrings', { en: 'Do they wear earrings?', ar: 'هل يضع شخصك أقراطاً؟' }],
  ['bald', { en: 'Are they bald?', ar: 'هل شخصك أصلع؟' }],
  ['long hair', { en: 'Do they have long hair?', ar: 'هل شعر شخصك طويل؟' }],
  ['curly hair', { en: 'Do they have curly hair?', ar: 'هل شعر شخصك مجعّد؟' }],
  ['hair bun', { en: 'Is their hair in a bun?', ar: 'هل شعر شخصك مربوط كعكة؟' }],
  ['black hair', { en: 'Is their hair black?', ar: 'هل شعر شخصك أسود؟' }],
  ['brown hair', { en: 'Is their hair brown?', ar: 'هل شعر شخصك بني؟' }],
  ['blonde hair', { en: 'Is their hair blonde?', ar: 'هل شعر شخصك أشقر؟' }],
  ['red hair', { en: 'Is their hair red?', ar: 'هل شعر شخصك أحمر؟' }],
  ['gray hair', { en: 'Is their hair gray?', ar: 'هل شعر شخصك رمادي؟' }],
];

function tagsOf(f: Face): string[] {
  const tags: string[] = [];
  if (f.glasses) tags.push('glasses');
  if (f.hat) tags.push('hat');
  if (f.beard) tags.push('beard');
  if (f.earrings) tags.push('earrings');
  if (f.style === 'bald') tags.push('bald');
  else tags.push(`${f.hair} hair`);
  if (f.style === 'long') tags.push('long hair');
  if (f.style === 'curly') tags.push('curly hair');
  if (f.style === 'bun') tags.push('hair bun');
  return tags;
}

const CAP = 'M26 50 C22 18 78 18 74 50 C70 36 60 31 50 31 C40 31 30 36 26 50 Z';
const CURLS: [number, number][] = [
  [27, 47], [28, 37], [33, 28], [41, 22], [50, 20], [59, 22], [67, 28], [72, 37], [73, 47],
];

function faceSvg(f: Face, i: number): string {
  const skin = SKIN[f.skin];
  const hair = HAIR[f.hair];
  const brow = f.style === 'bald' && !f.beard ? '#4b5563' : hair;
  const p: string[] = [];

  p.push(`<rect width="100" height="100" fill="${BG[i % BG.length]}"/>`);
  if (f.style === 'long') p.push(`<path d="M24 50 C21 18 79 18 76 50 L80 88 C68 94 32 94 20 88 Z" fill="${hair}"/>`);
  p.push(`<path d="M12 100 C12 84 30 78 50 78 C70 78 88 84 88 100 Z" fill="${SHIRT[(i * 3) % SHIRT.length]}"/>`);
  p.push(`<rect x="43" y="66" width="14" height="16" rx="5" fill="${skin}"/>`);
  p.push(`<circle cx="27" cy="53" r="5" fill="${skin}"/><circle cx="73" cy="53" r="5" fill="${skin}"/>`);
  p.push(`<ellipse cx="50" cy="50" rx="23" ry="26" fill="${skin}"/>`);
  if (f.beard) p.push(`<path d="M27 50 C27 84 73 84 73 50 C70 62 62 67 50 67 C38 67 30 62 27 50 Z" fill="${hair}"/>`);
  p.push(`<circle cx="41" cy="50" r="2.4" fill="#1f2937"/><circle cx="59" cy="50" r="2.4" fill="#1f2937"/>`);
  p.push(
    `<path d="M36 43 Q41 40 46 43 M54 43 Q59 40 64 43" stroke="${brow}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  );
  p.push(`<path d="M50 52 Q48 58 51 59" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
  p.push(
    `<path d="M43 64 Q50 ${i % 3 === 0 ? 67 : 70} 57 64" stroke="#8b2c2c" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  );
  if (f.glasses) {
    p.push(
      `<g fill="rgba(255,255,255,.3)" stroke="#111827" stroke-width="1.8"><circle cx="41" cy="50" r="6.5"/><circle cx="59" cy="50" r="6.5"/></g>`,
      `<path d="M47.5 50 H52.5 M34.5 49 L28 47 M65.5 49 L72 47" stroke="#111827" stroke-width="1.8"/>`,
    );
  }

  // Front hair. Under a hat, anything that would poke out above it is left off.
  if (f.style === 'short' || f.style === 'long') p.push(`<path d="${CAP}" fill="${hair}"/>`);
  if (f.style === 'bun') p.push(`<circle cx="50" cy="19" r="9" fill="${hair}"/><path d="${CAP}" fill="${hair}"/>`);
  if (f.style === 'spiky') {
    p.push(
      `<path d="M26 48 L27 30 L34 34 L36 19 L44 29 L50 16 L56 29 L64 19 L66 34 L73 30 L74 48 C69 37 60 32 50 32 C40 32 31 37 26 48 Z" fill="${hair}"/>`,
    );
  }
  if (f.style === 'curly') {
    p.push(`<path d="${CAP}" fill="${hair}"/>`);
    for (const [x, y] of CURLS) if (!f.hat || y >= 36) p.push(`<circle cx="${x}" cy="${y}" r="8.5" fill="${hair}"/>`);
  }

  if (f.hat) {
    const c = HAT[i % HAT.length];
    p.push(`<path d="M24 42 C24 11 76 11 76 42 Z" fill="${c}"/>`);
    p.push(`<rect x="21" y="37" width="58" height="8" rx="4" fill="${c}"/><rect x="21" y="37" width="58" height="8" rx="4" fill="rgba(0,0,0,.2)"/>`);
  }
  if (f.earrings) p.push(`<circle cx="27" cy="61" r="2.8" fill="#f59e0b"/><circle cx="73" cy="61" r="2.8" fill="#f59e0b"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${p.join('')}</svg>`;
}

let classic: Card[] | null = null;

export function classicDeck(): Card[] {
  classic ??= FACES.map((f, i) => ({
    id: `c${i}`,
    name: f.name,
    nameAr: f.ar,
    img: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(faceSvg(f, i))}`,
    tags: tagsOf(f),
  }));
  return classic;
}
