import { describe, expect, it } from 'vitest';
import { GameError, type Player } from '../../core/types';
import { apply, clean, fold, init, MAX_GUESSES, score, view, type WordleState } from './logic';

const secret = (s: WordleState, by: Player, word: string) => apply(s, { type: 'secret', word }, by);
const guess = (s: WordleState, by: Player, word: string) => apply(s, { type: 'guess', word }, by);

/** Player 0 picks `a` (player 1 guesses it), player 1 picks `b` (player 0 guesses it). */
const started = (a: string, b: string) => secret(secret(init(), 0, a), 1, b);

/** Error key thrown by fn. */
function errorOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    return (e as Error).message;
  }
  throw new Error('expected a GameError');
}

describe('clean', () => {
  it('trims and uppercases Latin', () => {
    expect(clean('  apple ')).toBe('APPLE');
    expect(clean('HeLLo')).toBe('HELLO');
  });

  it('strips Arabic diacritics, superscript alef and tatweel', () => {
    expect(clean('مَدْرَسَةٌ')).toBe('مدرسة');
    expect(clean('كـتـاب')).toBe('كتاب');
    expect(clean('هٰذا')).toBe('هذا');
    expect(clean('مُحَمَّد')).toBe('محمد');
  });

  it('keeps hamza forms and alef wasla for display', () => {
    expect(clean('أحمد')).toBe('أحمد');
    expect(clean('ٱلله')).toBe('ٱلله');
    expect(clean('مستشفى')).toBe('مستشفى');
  });

  it('rejects spaces, digits, punctuation and other alphabets', () => {
    for (const bad of ['two words', 'abc1', 'كلمة!', 'ab-cd', 'كتاب٣', 'سؤال؟', 'café', 'пример', 'a.b', 'مرحبا،']) {
      expect(errorOf(() => clean(bad)), bad).toBe('wordle.err.letters');
    }
    expect(errorOf(() => clean(42 as unknown as string))).toBe('wordle.err.letters');
  });

  it('returns an empty string for blank input (length checks reject it later)', () => {
    expect(clean('   ')).toBe('');
  });
});

describe('fold', () => {
  it('folds hamza forms, alef maqsura, ta marbuta', () => {
    for (const a of ['أ', 'إ', 'آ', 'ٱ']) expect(fold(a)).toBe('ا');
    expect(fold('ى')).toBe('ي');
    expect(fold('ة')).toBe('ه');
    expect(fold('ؤ')).toBe('و');
    expect(fold('ئ')).toBe('ي');
  });

  it('leaves other letters alone', () => {
    for (const c of ['ا', 'ب', 'ي', 'ه', 'و', 'A', 'Z']) expect(fold(c)).toBe(c);
  });
});

describe('score', () => {
  it('all green for the right word', () => {
    expect(score('APPLE', 'APPLE')).toEqual(['g', 'g', 'g', 'g', 'g']);
  });

  it('handles duplicate letters like Wordle', () => {
    // one green P, one yellow P, the third P has nothing left to match
    expect(score('APPLE', 'PAPPY')).toEqual(['y', 'y', 'g', 'x', 'x']);
    expect(score('ABBEY', 'KEBAB')).toEqual(['x', 'y', 'g', 'y', 'y']);
    expect(score('LEVER', 'EERIE')).toEqual(['y', 'g', 'y', 'x', 'x']);
    // a green later in the word takes the only copy before an earlier yellow can
    expect(score('CRANE', 'EERIE')).toEqual(['x', 'x', 'y', 'x', 'g']);
  });

  it('handles duplicate letters in Arabic', () => {
    // كتاب has one ت: the green one uses it, so the first ت is grey
    expect(score('كتاب', 'تتبع')).toEqual(['x', 'g', 'y', 'x']);
    // two ر in the guess, one in the target
    expect(score('مدرسة', 'ررررر')).toEqual(['x', 'x', 'g', 'x', 'x']);
  });

  it('compares folded letters', () => {
    expect(score('مدرسة', 'مدرسه')).toEqual(['g', 'g', 'g', 'g', 'g']);
    expect(score('أحمد', 'احمد')).toEqual(['g', 'g', 'g', 'g']);
    expect(score('مستشفى', 'مستشفي')).toEqual(Array(6).fill('g'));
    expect(score('سأل', 'الس')).toEqual(['y', 'y', 'y']);
  });
});

describe('word duel', () => {
  it('starts in the pick phase and moves to play once both words are in', () => {
    let s = init();
    expect(s.phase).toBe('pick');
    s = secret(s, 1, 'Planet');
    expect(s.phase).toBe('pick');
    expect(s.secrets).toEqual([null, 'PLANET']);
    s = secret(s, 0, 'مَدرسة');
    expect(s.phase).toBe('play');
    expect(s.secrets).toEqual(['مدرسة', 'PLANET']);
  });

  it('enforces secret length 3 to 7 letters (diacritics do not count)', () => {
    const s = init();
    expect(errorOf(() => secret(s, 0, 'AB'))).toBe('wordle.err.length');
    expect(errorOf(() => secret(s, 0, 'ABCDEFGH'))).toBe('wordle.err.length');
    expect(errorOf(() => secret(s, 0, ''))).toBe('wordle.err.length');
    expect(errorOf(() => secret(s, 0, 'two words'))).toBe('wordle.err.letters');
    expect(secret(s, 0, 'CAT').secrets[0]).toBe('CAT');
    expect(secret(s, 0, 'ABCDEFG').secrets[0]).toBe('ABCDEFG');
    expect(secret(s, 0, 'مَدْرَسَتُنَا').secrets[0]).toBe('مدرستنا'); // 7 letters once diacritics go
    expect(errorOf(() => secret(s, 0, 'مُسْتَشْفَيَاتٌ'))).toBe('wordle.err.length'); // 8 letters
  });

  it('locks a secret once submitted', () => {
    const s = secret(init(), 0, 'APPLE');
    expect(errorOf(() => secret(s, 0, 'GRAPE'))).toBe('wordle.err.locked');
    const p = secret(s, 1, 'LEMON');
    expect(errorOf(() => secret(p, 1, 'MELON'))).toBe('wordle.err.locked');
  });

  it('cannot guess before play', () => {
    const s = secret(init(), 0, 'APPLE');
    expect(errorOf(() => guess(s, 1, 'GRAPE'))).toBe('err.notStarted');
  });

  it('scores guesses against the other player’s word and stores the cleaned text', () => {
    let s = started('APPLE', 'كتاب');
    s = guess(s, 1, 'pappy');
    expect(s.guesses[1]).toEqual([{ word: 'PAPPY', marks: ['y', 'y', 'g', 'x', 'x'] }]);
    s = guess(s, 0, 'تَتبع');
    expect(s.guesses[0]).toEqual([{ word: 'تتبع', marks: ['x', 'g', 'y', 'x'] }]);
    expect(s.phase).toBe('play');
  });

  it('rejects a guess with the wrong number of letters or bad characters', () => {
    const s = started('APPLE', 'كتاب');
    expect(errorOf(() => guess(s, 1, 'APPLES'))).toBe('wordle.err.guessLength');
    expect(errorOf(() => guess(s, 1, 'APP'))).toBe('wordle.err.guessLength');
    expect(errorOf(() => guess(s, 0, 'كتابة'))).toBe('wordle.err.guessLength');
    expect(errorOf(() => guess(s, 1, 'AP LE'))).toBe('wordle.err.letters');
    expect(errorOf(() => apply(s, { type: 'nope' } as never, 0))).toBe('err.unknownMove');
  });

  it('a player who solved it cannot guess again', () => {
    let s = started('APPLE', 'LEMON');
    s = guess(s, 0, 'LEMON');
    expect(errorOf(() => guess(s, 0, 'MELON'))).toBe('wordle.err.done');
    expect(s.phase).toBe('play');
  });

  it('allows at most 6 guesses', () => {
    let s = started('APPLE', 'LEMON');
    for (let i = 0; i < MAX_GUESSES; i++) s = guess(s, 0, 'MELON');
    expect(s.guesses[0]).toHaveLength(MAX_GUESSES);
    expect(errorOf(() => guess(s, 0, 'LEMON'))).toBe('wordle.err.done');
    expect(s.phase).toBe('play'); // player 1 is still guessing
  });

  it('fewer guesses wins', () => {
    let s = started('APPLE', 'LEMON');
    s = guess(s, 0, 'MELON');
    s = guess(s, 0, 'LEMON'); // player 0 in 2
    s = guess(s, 1, 'GRAPE');
    s = guess(s, 1, 'PAPPY');
    expect(s.phase).toBe('play');
    s = guess(s, 1, 'APPLE'); // player 1 in 3
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(errorOf(() => guess(s, 1, 'APPLE'))).toBe('err.over');
    expect(errorOf(() => secret(s, 1, 'APPLE'))).toBe('err.over');
  });

  it('only one solved: that player wins, even with more guesses', () => {
    let s = started('APPLE', 'LEMON');
    for (let i = 0; i < MAX_GUESSES; i++) s = guess(s, 0, 'MELON'); // player 0 fails
    for (let i = 0; i < 5; i++) s = guess(s, 1, 'GRAPE');
    expect(s.phase).toBe('play');
    s = guess(s, 1, 'APPLE'); // player 1 on the last try
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(1);
  });

  it('both fail → draw', () => {
    let s = started('APPLE', 'LEMON');
    for (let i = 0; i < MAX_GUESSES; i++) s = guess(guess(s, 0, 'MELON'), 1, 'GRAPE');
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('draw');
  });

  it('same number of guesses → draw', () => {
    let s = started('مدرسة', 'أحمد');
    s = guess(s, 0, 'محمد');
    s = guess(s, 1, 'مدينة');
    s = guess(s, 0, 'احمد'); // folded: correct
    s = guess(s, 1, 'مدرسه'); // folded: correct
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('draw');
  });

  it('does not mutate the previous state', () => {
    const s0 = init();
    const s1 = secret(s0, 0, 'APPLE');
    const s2 = secret(s1, 1, 'LEMON');
    const before = [JSON.stringify(s0), JSON.stringify(s1), JSON.stringify(s2)];
    const s3 = guess(s2, 0, 'MELON');
    guess(s3, 1, 'GRAPE');
    expect([JSON.stringify(s0), JSON.stringify(s1), JSON.stringify(s2)]).toEqual(before);
  });
});

describe('view (hidden information)', () => {
  // Player 0's word is مدرسة, player 1's is PLANET. Nobody solves it in this setup.
  const setup = () => {
    let s = started('مدرسة', 'PLANET');
    s = guess(s, 0, 'STREAM');
    s = guess(s, 0, 'BANANA');
    s = guess(s, 1, 'سيارة');
    s = guess(s, 1, 'كتابة');
    return s;
  };

  it('never shows the partner’s word or guess letters before the end', () => {
    const s = setup();
    const v0 = JSON.stringify(view(s, 0));
    const v1 = JSON.stringify(view(s, 1));
    for (const hidden of ['PLANET', 'سيارة', 'كتابة']) expect(v0).not.toContain(hidden);
    for (const hidden of ['مدرسة', 'STREAM', 'BANANA']) expect(v1).not.toContain(hidden);

    const v = view(s, 0);
    expect(v.mySecret).toBe('مدرسة');
    expect(v.oppSecret).toBeNull();
    expect(v.oppGuesses).toBeNull();
    expect(v.myGuesses.map((g) => g.word)).toEqual(['STREAM', 'BANANA']);
    expect(v.oppMarks).toEqual(s.guesses[1].map((g) => g.marks));
    expect(v.targetLength).toBe(6);
    expect(v.targetDir).toBe('ltr');
    expect(view(s, 1).targetLength).toBe(5);
    expect(view(s, 1).targetDir).toBe('rtl');
  });

  it('keeps hiding while one player is done and the other is still guessing', () => {
    let s = setup();
    for (let i = 0; i < 4; i++) s = guess(s, 0, 'STREAM'); // player 0 out of guesses
    const v = view(s, 0);
    expect(v.myDone).toBe(true);
    expect(v.oppDone).toBe(false);
    const json = JSON.stringify(v);
    for (const hidden of ['PLANET', 'سيارة', 'كتابة']) expect(json).not.toContain(hidden);
    expect(view(s, 1).oppDone).toBe(true);
  });

  it('hides the target length and the partner’s word during the pick phase', () => {
    const s = secret(init(), 1, 'PLANET');
    const v = view(s, 0);
    expect(v.oppReady).toBe(true);
    expect(v.targetLength).toBeNull();
    expect(v.targetDir).toBeNull();
    expect(JSON.stringify(v)).not.toContain('PLANET');
    expect(view(s, 1).oppReady).toBe(false);
  });

  it('reveals both words (and guesses) once the game is over', () => {
    let s = setup();
    s = guess(s, 0, 'PLANET');
    s = guess(s, 1, 'مدرسه');
    expect(s.phase).toBe('over');
    const v = view(s, 0);
    expect(v.oppSecret).toBe('PLANET');
    expect(v.oppGuesses?.map((g) => g.word)).toEqual(['سيارة', 'كتابة', 'مدرسه']);
    expect(JSON.stringify(view(s, 1))).toContain('مدرسة');
  });

  it('keeps top-level view values reference-stable when they did not change', () => {
    const s = setup();
    const before = view(s, 0);
    const s2 = guess(s, 0, 'BANANA'); // only player 0's guesses change
    const after = view(s2, 0);
    expect(after.oppMarks).toBe(before.oppMarks);
    expect(after.myGuesses).not.toBe(before.myGuesses);
    expect(view(s2, 1).myGuesses).toBe(view(s, 1).myGuesses);
    // views always have every key, never undefined
    expect(Object.values(view(init(), 0)).every((x) => x !== undefined)).toBe(true);
  });
});
