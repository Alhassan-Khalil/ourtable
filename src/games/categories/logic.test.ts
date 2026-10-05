import { describe, expect, it } from 'vitest';
import { GameError } from '../../core/types';
import {
  ALPHABETS,
  apply,
  autoVerdict,
  drawLetter,
  init,
  isRejected,
  leaders,
  normalize,
  roundPoints,
  scoreRound,
  startsWithLetter,
  view,
  type CatMove,
  type CatOptions,
  type CatState,
  type Rng,
} from './logic';

/** Always the first unused letter: the Arabic rounds go ا, ب, ت, ج, ح. */
const first: Rng = () => 0;
const OPTS: CatOptions = { alphabet: 'ar', rounds: 3 };

/** Two sets of five valid words per letter (name, animal, plant, object, place), no overlap between the sets. */
const WORDS: Record<string, [string[], string[]]> = {
  'ا': [
    ['أحمد', 'أسد', 'أرز', 'إبريق', 'الأردن'],
    ['أمل', 'أرنب', 'أقحوان', 'إناء', 'أمريكا'],
  ],
  'ب': [
    ['باسل', 'بقرة', 'بصل', 'بساط', 'بغداد'],
    ['بدر', 'بطة', 'بنفسج', 'برميل', 'بيروت'],
  ],
  'ت': [
    ['تامر', 'تمساح', 'تفاح', 'تلفاز', 'تونس'],
    ['تيسير', 'تيس', 'توت', 'تاج', 'تركيا'],
  ],
};
const EMPTY = ['', '', '', '', ''];

const draft = (s: CatState, by: number, answers: string[]) => apply(s, { type: 'draft', answers }, by, first);
const stop = (s: CatState, by: number, answers: string[]) => apply(s, { type: 'stop', answers }, by, first);
const reject = (s: CatState, by: number, player: number, category: number, on = true) =>
  apply(s, { type: 'reject', player, category, on }, by, first);
const ready = (s: CatState, by: number) => apply(s, { type: 'ready' }, by, first);
const allReady = (s: CatState) => Array.from({ length: s.players }, (_, p) => p).reduce(ready, s);

/** Everyone's drafts are in, then the first player with a full row presses Stop. */
function toReview(s: CatState, rows: string[][]): CatState {
  const typed = rows.reduce((st, row, p) => draft(st, p, row), s);
  const stopper = rows.findIndex((r) => r.every((a) => a.trim() !== ''));
  return stop(typed, stopper, rows[stopper]);
}

/** A whole game. `plan(letter, round)` gives each player's five answers for that round. */
function playGame(players: number, plan: (letter: string, round: number) => string[][]): CatState {
  let s = init(OPTS, players, first);
  while (s.phase !== 'over') {
    const letter = s.letters[s.round - 1];
    s = allReady(toReview(s, plan(letter, s.round)));
  }
  return s;
}

const errorOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    return (e as GameError).message;
  }
  return null;
};

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

describe('letters', () => {
  it('uses the right alphabets', () => {
    expect(ALPHABETS.ar).toHaveLength(23);
    expect(ALPHABETS.ar[0]).toBe('ا');
    expect(ALPHABETS.en).toHaveLength(23);
    for (const bad of ['Q', 'X', 'Z']) expect(ALPHABETS.en).not.toContain(bad);
  });

  it('never repeats a letter in one game (both alphabets, random draws)', () => {
    for (const alphabet of ['ar', 'en'] as const) {
      for (let game = 0; game < 40; game++) {
        let s = init({ alphabet, rounds: 5 }, 2);
        while (s.phase !== 'over') {
          s = apply(draft(s, 0, ['a', 'b', 'c', 'd', 'e']), { type: 'stop', answers: ['a', 'b', 'c', 'd', 'e'] }, 0);
          s = apply(apply(s, { type: 'ready' }, 0), { type: 'ready' }, 1);
        }
        expect(s.letters).toHaveLength(5);
        expect(new Set(s.letters).size).toBe(5);
        for (const l of s.letters) expect(ALPHABETS[alphabet]).toContain(l);
      }
    }
  });

  it('draws only unused letters', () => {
    const all = ALPHABETS.ar;
    expect(drawLetter('ar', all.slice(0, -1), () => 0.5)).toBe('ي');
    expect(drawLetter('ar', [], () => 0)).toBe('ا');
    expect(drawLetter('ar', [], () => 0.999999)).toBe('ي');
    expect(drawLetter('ar', [], () => 1)).toBe('ي'); // a broken rng can't walk off the end
    expect(ALPHABETS.ar).toContain(drawLetter('ar', all, () => 0.3)); // nothing left: starts over, never crashes
  });
});

describe('init', () => {
  it('starts in the write phase of round 1 with a letter and empty boxes', () => {
    const s = init(OPTS, 3, first);
    expect(s).toMatchObject({ round: 1, rounds: 3, players: 3, phase: 'write', winner: null, stoppedBy: null });
    expect(s.letters).toEqual(['ا']);
    expect(s.answers).toEqual([EMPTY, EMPTY, EMPTY]);
    expect(s.scores).toEqual([0, 0, 0]);
  });

  it('takes the options, with safe defaults', () => {
    expect(init({ alphabet: 'en', rounds: 5 }, 2).alphabet).toBe('en');
    expect(init({ alphabet: 'en', rounds: 5 }, 2, first).letters).toEqual(['A']);
    expect(init({ alphabet: 'zz', rounds: 4 } as unknown as CatOptions, 2)).toMatchObject({ alphabet: 'ar', rounds: 5 });
    expect(init(OPTS, 9).players).toBe(3);
    expect(init(OPTS, 1).players).toBe(2);
  });
});

describe('normalising and the letter check', () => {
  it('drops diacritics, tatweel, the leading «ال», and folds alef forms', () => {
    expect(normalize('  الأَسَدُ ')).toBe(normalize('اسد'));
    expect(normalize('أسد')).toBe('اسد');
    expect(normalize('إبراهيم')).toBe('ابراهيم');
    expect(normalize('آمنة')).toBe('امنه');
    expect(normalize('بـــاب')).toBe('باب');
    expect(normalize('Apple')).toBe('apple');
    expect(normalize('Émile')).toBe('emile');
  });

  it('accepts أحمد, الأسد and إبراهيم for the letter ا', () => {
    for (const a of ['أحمد', 'الأسد', 'إبراهيم', 'آدم', 'ابتسام', 'ألمانيا']) expect(autoVerdict(a, 'ا')).toBe('ok');
  });

  it('rejects an answer with the wrong letter', () => {
    expect(autoVerdict('أسد', 'ب')).toBe('wrongLetter');
    expect(autoVerdict('الجمل', 'ا')).toBe('wrongLetter'); // «ال» is ignored, so this one starts with ج
    expect(autoVerdict('الجمل', 'ج')).toBe('ok');
    expect(autoVerdict('الليمون', 'ل')).toBe('ok');
    expect(autoVerdict('لبنان', 'ل')).toBe('ok');
    expect(startsWithLetter('Apple', 'ا')).toBe(false);
  });

  it('is case-insensitive in English', () => {
    expect(autoVerdict('apple', 'A')).toBe('ok');
    expect(autoVerdict('APPLE', 'A')).toBe('ok');
    expect(autoVerdict('Émile', 'E')).toBe('ok');
    expect(autoVerdict('banana', 'A')).toBe('wrongLetter');
  });

  it('counts blank answers as empty', () => {
    expect(autoVerdict('', 'ا')).toBe('empty');
    expect(autoVerdict('   ', 'ا')).toBe('empty');
    expect(autoVerdict('ـ', 'ا')).toBe('empty');
  });
});

describe('drafts', () => {
  it('update only that player and keep the phase', () => {
    const s0 = init(OPTS, 3, first);
    const s1 = draft(s0, 1, ['أسد', '', '  أرز  ', '', '']);
    expect(s1.answers[1]).toEqual(['أسد', '', 'أرز', '', '']);
    expect(s1.answers[0]).toEqual(EMPTY);
    expect(s1.answers[2]).toEqual(EMPTY);
    expect(s1.phase).toBe('write');
    const s2 = draft(s1, 1, ['أسد', 'أرنب', 'أرز', '', '']);
    expect(s2.answers[1]).toEqual(['أسد', 'أرنب', 'أرز', '', '']);
    expect(view(s2, 0).filled).toEqual([0, 3, 0]);
  });

  it('collapse inner spaces and refuse bad input', () => {
    const s = init(OPTS, 2, first);
    expect(draft(s, 0, ['أبو   بكر', '', '', '', '']).answers[0][0]).toBe('أبو بكر');
    expect(errorOf(() => draft(s, 0, ['a', 'b']))).toBe('categories.err.badAnswers');
    expect(errorOf(() => draft(s, 0, ['', '', '', '', '', '']))).toBe('categories.err.badAnswers');
    expect(errorOf(() => draft(s, 0, [1, '', '', '', ''] as unknown as string[]))).toBe('categories.err.badAnswers');
    expect(errorOf(() => draft(s, 0, 'abc' as unknown as string[]))).toBe('categories.err.badAnswers');
    expect(errorOf(() => draft(s, 0, ['x'.repeat(31), '', '', '', '']))).toBe('categories.err.badAnswers');
    expect(draft(s, 0, ['x'.repeat(30), '', '', '', '']).answers[0][0]).toHaveLength(30);
  });

  it('that arrive after the writing ended are ignored, not errors', () => {
    const review = toReview(init(OPTS, 2, first), [WORDS['ا'][0], WORDS['ا'][1]]);
    expect(draft(review, 1, ['x', 'x', 'x', 'x', 'x'])).toBe(review);
  });
});

describe('stop', () => {
  it('needs all five boxes filled', () => {
    const s = init(OPTS, 2, first);
    expect(errorOf(() => stop(s, 0, ['أحمد', 'أسد', 'أرز', 'إبريق', '']))).toBe('categories.err.fillAll');
    expect(errorOf(() => stop(s, 0, ['أحمد', 'أسد', 'أرز', 'إبريق', '   ']))).toBe('categories.err.fillAll');
    expect(errorOf(() => stop(s, 0, EMPTY))).toBe('categories.err.fillAll');
    expect(errorOf(() => stop(s, 0, ['a']))).toBe('categories.err.badAnswers');
  });

  it('ends the round for everyone, with each player’s latest drafts', () => {
    let s = init(OPTS, 3, first);
    s = draft(s, 1, ['أمل', 'أرنب', '', '', '']);
    s = draft(s, 2, ['أحمد', '', '', '', '']);
    const stopped = stop(s, 0, WORDS['ا'][0]);
    expect(stopped.phase).toBe('review');
    expect(stopped.stoppedBy).toBe(0);
    expect(stopped.answers[0]).toEqual(WORDS['ا'][0]);
    expect(stopped.answers[1]).toEqual(['أمل', 'أرنب', '', '', '']);
    expect(stopped.answers[2]).toEqual(['أحمد', '', '', '', '']);
    expect(stopped.ready).toEqual([false, false, false]);
  });

  it('uses the answers sent with it, even when the last draft was older', () => {
    let s = draft(init(OPTS, 2, first), 1, ['أمل', 'أرنب', 'أقحوان', 'إناء', 'أمر']);
    s = stop(s, 1, ['أمل', 'أرنب', 'أقحوان', 'إناء', 'أمريكا']);
    expect(s.answers[1][4]).toBe('أمريكا');
  });
});

describe('scoring', () => {
  const none = (players: number) => Array.from({ length: players }, () => [0, 0, 0, 0, 0]);

  it('gives 10 for a unique valid answer, 5 for a shared one, 0 for invalid or empty', () => {
    const answers = [
      ['أحمد', 'أسد', 'أرز', 'بيت', ''],
      ['أحمد', 'الأسد', 'أقحوان', 'أرض', 'أمريكا'],
    ];
    const cells = scoreRound(answers, 'ا', none(2));
    expect(cells[0].map((c) => c.points)).toEqual([5, 5, 10, 0, 0]);
    expect(cells[1].map((c) => c.points)).toEqual([5, 5, 10, 10, 10]);
    expect(cells[0].map((c) => c.verdict)).toEqual(['ok', 'ok', 'ok', 'wrongLetter', 'empty']);
    expect(cells[0][0].shared).toBe(true);
    expect(cells[0][2].shared).toBe(false);
    expect(roundPoints(cells)).toEqual([20, 40]);
  });

  it('compares answers after normalising (case, «ال», hamza forms, diacritics)', () => {
    const cells = scoreRound([['إبراهيم'], ['ابراهيم'], ['ابْرَاهِيم']].map((r) => [...r, '', '', '', '']), 'ا', none(3));
    expect(cells.map((r) => r[0].points)).toEqual([5, 5, 5]);
    const en = scoreRound([['Apple', '', '', '', ''], ['APPLE', '', '', '', ''], ['Avocado', '', '', '', '']], 'A', none(3));
    expect(en.map((r) => r[0].points)).toEqual([5, 5, 10]);
  });

  it('three players: two the same and one different', () => {
    const rows = [
      ['أحمد', '', '', '', ''],
      ['أحمد', '', '', '', ''],
      ['أمل', '', '', '', ''],
    ];
    expect(scoreRound(rows, 'ا', none(3)).map((r) => r[0].points)).toEqual([5, 5, 10]);
  });

  it('adds the points to the totals when everyone is ready, and keeps the round in the history', () => {
    const s = allReady(toReview(init(OPTS, 2, first), [WORDS['ا'][0], WORDS['ا'][0].map((w, i) => (i < 2 ? w : WORDS['ا'][1][i]))]));
    // two shared (5 + 5) and three unique (3 × 10) for both
    expect(s.scores).toEqual([40, 40]);
    expect(s.history).toEqual([[40, 40]]);
  });
});

describe('rejecting answers', () => {
  const twoSame = (players: number) => {
    // category 0: players 0 and 1 gave the same name; the rest of the row is unique per player
    const rows = [
      ['أحمد', 'أسد', 'أرز', 'إبريق', 'الأردن'],
      ['أحمد', 'أرنب', 'أقحوان', 'إناء', 'أمريكا'],
      ['أمل', 'أبقار', 'أرجوان', 'أداة', 'أسوان'],
    ].slice(0, players);
    return toReview(init(OPTS, players, first), rows);
  };
  const pts = (s: CatState) => roundPoints(scoreRound(s.answers, s.letters[s.round - 1], s.rejects));

  it('isRejected needs every other player', () => {
    expect(isRejected(0b010, 0, 2)).toBe(true);
    expect(isRejected(0b001, 0, 2)).toBe(false); // the author's own bit never counts
    expect(isRejected(0b010, 0, 3)).toBe(false);
    expect(isRejected(0b110, 0, 3)).toBe(true);
    expect(isRejected(0b110, 1, 3)).toBe(false);
  });

  it('two players: the other player’s ✗ throws the answer out, and can be taken back', () => {
    const s0 = twoSame(2);
    expect(pts(s0)).toEqual([5 + 10 * 4, 5 + 10 * 4]);

    const s1 = reject(s0, 1, 0, 0);
    expect(pts(s1)).toEqual([0 + 10 * 4, 10 + 10 * 4]); // 0 for the rejected answer; the other one is no longer shared
    expect(scoreRound(s1.answers, 'ا', s1.rejects)[0][0].verdict).toBe('rejected');

    const s2 = reject(s1, 1, 0, 0, false);
    expect(pts(s2)).toEqual(pts(s0));
    expect(reject(s2, 1, 0, 0, false)).toBe(s2); // taking back what isn't there changes nothing
  });

  it('three players: one ✗ is not enough, both of the others are needed', () => {
    const s0 = twoSame(3);
    const s1 = reject(s0, 1, 0, 0);
    expect(scoreRound(s1.answers, 'ا', s1.rejects)[0][0]).toMatchObject({ verdict: 'ok', points: 5 });
    expect(reject(s1, 1, 0, 0)).toBe(s1); // the same player again changes nothing

    const s2 = reject(s1, 2, 0, 0);
    expect(scoreRound(s2.answers, 'ا', s2.rejects)[0][0]).toMatchObject({ verdict: 'rejected', points: 0 });
    // player 1's identical answer was shared with the rejected one: it is unique now
    expect(scoreRound(s2.answers, 'ا', s2.rejects)[1][0]).toMatchObject({ verdict: 'ok', points: 10, shared: false });

    const s3 = reject(s2, 2, 0, 0, false);
    expect(scoreRound(s3.answers, 'ا', s3.rejects)[0][0].points).toBe(5);
  });

  it('counts in the final totals', () => {
    const s = allReady(reject(twoSame(2), 1, 0, 0));
    expect(s.scores).toEqual([40, 50]);
  });

  it('only on another player’s answer that still counts', () => {
    const s = twoSame(2);
    expect(errorOf(() => reject(s, 0, 0, 0))).toBe('categories.err.badReject'); // my own
    expect(errorOf(() => reject(s, 0, 5, 0))).toBe('categories.err.badReject'); // nobody there
    expect(errorOf(() => reject(s, 0, -1, 0))).toBe('categories.err.badReject');
    expect(errorOf(() => reject(s, 0, 1, 5))).toBe('categories.err.badReject'); // no such category
    expect(errorOf(() => reject(s, 0, 1, 0.5))).toBe('categories.err.badReject');
    expect(errorOf(() => apply(s, { type: 'reject', player: 1, category: 0, on: 'yes' } as unknown as CatMove, 0))).toBe(
      'categories.err.badReject',
    );

    // an empty answer and a wrong-letter answer have nothing to vote on
    const odd = toReview(init(OPTS, 2, first), [['أحمد', 'أسد', 'أرز', 'إبريق', 'الأردن'], ['أحمد', 'بيت', 'أرز', 'إبريق', '']]);
    expect(errorOf(() => reject(odd, 0, 1, 1))).toBe('categories.err.nothingToReject');
    expect(errorOf(() => reject(odd, 0, 1, 4))).toBe('categories.err.nothingToReject');
    expect(reject(odd, 0, 1, 0).rejects[1][0]).toBe(0b001);
  });
});

describe('ready and the next round', () => {
  it('waits for everyone, and pressing twice is harmless', () => {
    const s0 = toReview(init(OPTS, 3, first), [WORDS['ا'][0], WORDS['ا'][1], EMPTY]);
    const s1 = ready(s0, 0);
    expect(s1.ready).toEqual([true, false, false]);
    expect(s1.phase).toBe('review');
    expect(ready(s1, 0)).toBe(s1);
    const s2 = ready(s1, 1);
    expect(s2.phase).toBe('review');
    expect(ready(s2, 2).phase).toBe('write');
  });

  it('adds the points and starts the next round with a new letter and empty boxes', () => {
    const s0 = toReview(init(OPTS, 2, first), [WORDS['ا'][0], WORDS['ا'][1]]);
    const s1 = allReady(s0);
    expect(s1).toMatchObject({ round: 2, phase: 'write', stoppedBy: null, scores: [50, 50], winner: null });
    expect(s1.letters).toEqual(['ا', 'ب']);
    expect(s1.answers).toEqual([EMPTY, EMPTY]);
    expect(s1.ready).toEqual([false, false]);
    expect(s1.rejects.flat()).toEqual(Array(10).fill(0));
    expect(view(s1, 0).letter).toBe('ب');
  });

  it('a late ready or ✗ from the previous round does nothing', () => {
    const s1 = allReady(toReview(init(OPTS, 2, first), [WORDS['ا'][0], WORDS['ا'][1]]));
    expect(apply(s1, { type: 'ready', round: 1 }, 1)).toBe(s1);
    expect(apply(s1, { type: 'reject', player: 0, category: 0, on: true, round: 1 }, 1)).toBe(s1);
    // without the round it is simply out of phase
    expect(errorOf(() => ready(s1, 1))).toBe('categories.err.notReview');
  });

  it('ends after the last round with the highest total as winner', () => {
    const s = playGame(2, (l) => [WORDS[l][0], EMPTY]);
    expect(s.phase).toBe('over');
    expect(s.round).toBe(3);
    expect(s.scores).toEqual([150, 0]);
    expect(s.winner).toBe(0);
    expect(s.history).toEqual([[50, 0], [50, 0], [50, 0]]);
    expect(s.letters).toEqual(['ا', 'ب', 'ت']);

    expect(playGame(2, (l) => [EMPTY, WORDS[l][1]]).winner).toBe(1);
  });

  it('is a draw when the totals are equal', () => {
    const s = playGame(2, (l) => [WORDS[l][0], WORDS[l][0]]);
    expect(s.scores).toEqual([75, 75]); // every answer shared: 25 a round
    expect(s.winner).toBe('draw');
  });

  it('three players: a clear winner, and a tie at the top is a draw', () => {
    const win = playGame(3, (l) => [WORDS[l][0], WORDS[l][0], WORDS[l][1]]);
    expect(win.scores).toEqual([75, 75, 150]);
    expect(win.winner).toBe(2);

    const tie = playGame(3, (l) => [WORDS[l][0], WORDS[l][1], EMPTY]);
    expect(tie.scores).toEqual([150, 150, 0]);
    expect(tie.winner).toBe('draw');
    expect(leaders(tie.scores)).toEqual([0, 1]);
  });

  it('ready after the game ended is harmless', () => {
    const s = playGame(2, (l) => [WORDS[l][0], EMPTY]);
    expect(ready(s, 1)).toBe(s);
  });
});

describe('hidden information', () => {
  const mine = ['أحمد', 'أسد', 'أرز', 'إبريق', 'الأردن'];
  const theirs = ['أمل', 'أرنب', 'أقحوان', 'إناء', 'أمريكا'];

  it('while writing, a view has only the counts of the other players', () => {
    let s = init(OPTS, 3, first);
    s = draft(s, 0, mine);
    s = draft(s, 1, [...theirs.slice(0, 3), '', '']);
    s = draft(s, 2, ['أبو بكر', '', '', '', '']);

    const v1 = JSON.stringify(view(s, 1));
    for (const w of [...mine, 'أبو بكر']) expect(v1).not.toContain(w);
    for (const w of theirs.slice(0, 3)) expect(v1).toContain(w); // my own, I may see
    expect(view(s, 1).filled).toEqual([5, 3, 1]);
    expect(view(s, 1).answers).toBeNull();
    expect(view(s, 1).rejects).toBeNull();
    expect(view(s, 1).mine).toEqual([...theirs.slice(0, 3), '', '']);

    const v0 = JSON.stringify(view(s, 0));
    for (const w of [...theirs.slice(0, 3), 'أبو بكر']) expect(v0).not.toContain(w);
    for (const w of mine) expect(v0).toContain(w);

    const v2 = JSON.stringify(view(s, 2));
    for (const w of [...mine, ...theirs.slice(0, 3)]) expect(v2).not.toContain(w);
    expect(v2).toContain('أبو بكر');
  });

  it('in review and at the end, everything is visible', () => {
    const review = toReview(init(OPTS, 2, first), [mine, theirs]);
    for (const me of [0, 1]) {
      const v = JSON.stringify(view(review, me));
      for (const w of [...mine, ...theirs]) expect(v).toContain(w);
    }
    expect(view(review, 1).answers).toEqual([mine, theirs]);

    const over = playGame(2, (l) => [WORDS[l][0], WORDS[l][1]]);
    expect(view(over, 0).answers).not.toBeNull();
    expect(view(over, 0).phase).toBe('over');
  });

  it('is plain JSON with every key present', () => {
    for (const s of [init(OPTS, 2, first), toReview(init(OPTS, 2, first), [mine, theirs]), playGame(2, (l) => [WORDS[l][0], EMPTY])]) {
      const v = view(s, 1);
      expect(JSON.parse(JSON.stringify(v))).toEqual(v);
      expect(Object.values(v).some((x) => x === undefined)).toBe(false);
    }
  });

  it('keeps unchanged parts under the same reference (the sync layer only re-sends changed keys)', () => {
    const s0 = init(OPTS, 3, first);
    const s1 = draft(s0, 1, ['أمل', '', '', '', '']);
    expect(view(s1, 0).mine).toBe(view(s0, 0).mine); // somebody else typing doesn't change my own answers
    expect(view(s1, 0).scores).toBe(view(s0, 0).scores);
    expect(view(s1, 0).letters).toBe(view(s0, 0).letters);
  });
});

describe('illegal moves', () => {
  const writing = init(OPTS, 2, first);
  const reviewing = toReview(writing, [WORDS['ا'][0], WORDS['ا'][1]]);
  const over = playGame(2, (l) => [WORDS[l][0], EMPTY]);

  it('out of phase', () => {
    expect(errorOf(() => ready(writing, 0))).toBe('categories.err.notReview');
    expect(errorOf(() => reject(writing, 0, 1, 0))).toBe('categories.err.notReview');
    expect(errorOf(() => stop(reviewing, 1, WORDS['ا'][1]))).toBe('categories.err.notWriting');
  });

  it('after the game is over', () => {
    expect(errorOf(() => stop(over, 0, WORDS['ا'][0]))).toBe('err.over');
    expect(errorOf(() => reject(over, 0, 1, 0))).toBe('err.over');
  });

  it('unknown moves and unknown players', () => {
    expect(errorOf(() => apply(writing, { type: 'boom' } as unknown as CatMove, 0))).toBe('err.unknownMove');
    expect(errorOf(() => apply(writing, null as unknown as CatMove, 0))).toBe('err.unknownMove');
    expect(errorOf(() => draft(writing, 2, EMPTY))).toBe('err.notInGame');
    expect(errorOf(() => draft(writing, -1, EMPTY))).toBe('err.notInGame');
    expect(errorOf(() => ready(reviewing, 5))).toBe('err.notInGame');
  });
});

describe('purity', () => {
  it('never mutates the previous state', () => {
    const s0 = deepFreeze(init(OPTS, 3, first));
    const typed = deepFreeze(draft(s0, 1, ['أمل', 'أرنب', '', '', '']));
    const review = deepFreeze(stop(typed, 0, WORDS['ا'][0]));
    const voted = deepFreeze(reject(review, 1, 0, 0));
    const voted2 = deepFreeze(reject(voted, 2, 0, 0));
    const r0 = deepFreeze(ready(voted2, 0));
    const r1 = deepFreeze(ready(r0, 1));
    const next = deepFreeze(ready(r1, 2)); // finishes the round: new letter, scores, history
    expect(next.round).toBe(2);
    deepFreeze(view(next, 1));
    expect(typed.answers[1]).toEqual(['أمل', 'أرنب', '', '', '']);
    expect(review.answers[1]).toEqual(['أمل', 'أرنب', '', '', '']);
    expect(voted2.rejects[0][0]).toBe(0b110);
    expect(s0.answers).toEqual([EMPTY, EMPTY, EMPTY]);
  });

  it('never mutates the previous state at the end of the game', () => {
    let s = init(OPTS, 2, first);
    for (let r = 0; r < 3; r++) {
      const letter = s.letters[s.round - 1];
      s = deepFreeze(toReview(s, [WORDS[letter][0], WORDS[letter][1]]));
      s = deepFreeze(allReady(s));
    }
    expect(s.phase).toBe('over');
  });
});
