import { useEffect, useRef, useState } from 'preact/hooks';
import { other, type BoardProps, type GameDef } from '../../core/types';
import { t, tKey } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import {
  apply,
  clean,
  fold,
  init,
  letters,
  MAX_GUESSES,
  MAX_LEN,
  MIN_LEN,
  scriptDir,
  solvedAt,
  view,
  type Dir,
  type Guess,
  type Mark,
  type WordleMove,
  type WordleState,
  type WordleView,
} from './logic';
import { tg } from './strings';
import './style.css';

/** Input cap, with room for diacritics (typed, then dropped by clean). */
const MAX_INPUT = 24;

/** What's typed so far: the cleaned word and its letter count, or the error key. */
function check(text: string): { word: string; n: number; error: string | null } {
  try {
    const word = clean(text);
    return { word, n: letters(word).length, error: null };
  } catch (e) {
    return { word: '', n: 0, error: e instanceof Error ? e.message : 'err.generic' };
  }
}

interface RowData {
  chars?: string[];
  marks?: Mark[];
}

/** One row of letter cells. Direction follows the word's script; `reveal` flips the cells in. */
function Row({ n, dir, chars, marks, reveal }: RowData & { n: number; dir: Dir; reveal?: boolean }) {
  return (
    <div class={`wordle-row ${reveal ? 'reveal' : ''}`} dir={dir} style={`--n:${n}`}>
      {Array.from({ length: n }, (_, i) => {
        const ch = chars?.[i] ?? '';
        const m = marks?.[i];
        return (
          <span
            key={i}
            class={`wordle-cell ${m ?? (ch ? 'typed' : '')}`}
            style={reveal ? `animation-delay:${i * 90}ms` : undefined}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

/** MAX_GUESSES rows: the guesses, then (optionally) what's being typed, then empty rows. */
function Grid({ n, dir, rows, typing, mini }: { n: number; dir: Dir; rows: RowData[]; typing?: string[] | null; mini?: boolean }) {
  return (
    <div class={`wordle-grid ${mini ? 'mini' : ''}`}>
      {Array.from({ length: MAX_GUESSES }, (_, r) => {
        const row = rows[r] ?? (r === rows.length && typing ? { chars: typing } : {});
        return <Row key={r} n={n} dir={dir} {...row} reveal={r === rows.length - 1} />;
      })}
    </div>
  );
}

type MarkedRow = RowData & { marks: Mark[] };

const asRows = (guesses: Guess[]): MarkedRow[] => guesses.map((g) => ({ chars: letters(g.word), marks: g.marks }));

const RANK: Record<Mark, number> = { x: 0, y: 1, g: 2 };

/** Every letter I've tried, coloured by its best result so far (in order of first use). */
function triedLetters(guesses: Guess[]) {
  const best = new Map<string, { ch: string; m: Mark }>();
  for (const g of guesses) {
    letters(g.word).forEach((ch, i) => {
      const m = g.marks[i];
      const cur = best.get(fold(ch));
      if (!cur) best.set(fold(ch), { ch, m });
      else if (RANK[m] > RANK[cur.m]) cur.m = m;
    });
  }
  return [...best.values()];
}

function PickPanel({ v, opp, send }: { v: WordleView; opp: string; send: (m: WordleMove) => void }) {
  const [text, setText] = useState('');
  // Sent but not confirmed yet: block a second tap. Unlocks after 3s in case the send was lost.
  // The ref guards instantly (two taps in one frame); the state greys the button out.
  const sending = useRef(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => {
      sending.current = false;
      setSent(false);
    }, 3000);
    return () => clearTimeout(id);
  }, [sent]);

  if (v.mySecret !== null) {
    const chars = letters(v.mySecret);
    return (
      <section class="wordle-card">
        <div class="wordle-label">{tg('yourWord')}</div>
        <Row n={chars.length} dir={scriptDir(v.mySecret)} chars={chars} />
        <p class="muted small wordle-note">{tg('lockedHint', opp)}</p>
      </section>
    );
  }

  const c = check(text);
  const ok = c.error === null && c.n >= MIN_LEN && c.n <= MAX_LEN;
  const problem = c.error ?? (c.n > MAX_LEN ? 'wordle.err.length' : null);

  return (
    <section class="wordle-card">
      <p>{tg('pickHint', opp)}</p>
      <form
        class="wordle-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok || sending.current) return;
          sending.current = true;
          setSent(true);
          send({ type: 'secret', word: c.word });
        }}
      >
        <input
          value={text}
          dir="auto"
          maxLength={MAX_INPUT}
          autocomplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellcheck={false}
          enterKeyHint="done"
          placeholder={tg('secretLabel')}
          aria-label={tg('secretLabel')}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button class="btn primary" disabled={!ok || sent}>
          {tg('lockIn')}
        </button>
      </form>
      <p class={`small wordle-hint ${problem ? 'error' : 'muted'}`} aria-live="polite">
        {problem ? tKey(problem) : c.n > 0 ? tg('count', c.n) : ' '}
      </p>
      {v.oppReady && <p class="wordle-note">{tg('oppPicked', opp)}</p>}
    </section>
  );
}

function MyBoard({ v, send }: { v: WordleView; send: (m: WordleMove) => void }) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const n = v.targetLength ?? 0;
  const dir = v.targetDir ?? 'ltr';
  const over = v.phase === 'over';
  const canGuess = v.phase === 'play' && !v.myDone;

  const c = check(text);
  const ok = canGuess && c.error === null && c.n === n;
  const problem = c.error ?? (c.n > n ? 'wordle.err.guessLength' : null);
  const typing = canGuess ? (c.error ? letters(text.trim()) : letters(c.word)).slice(0, n) : null;
  const solved = solvedAt(v.myGuesses);
  const tried = triedLetters(v.myGuesses);

  return (
    <section class="wordle-mine">
      {over && (
        <div class="wordle-head">
          <span class="wordle-label">{tg('myGuesses')}</span>
          <span class="muted small">{solved !== null ? tg('solvedOn', solved) : tg('outOf')}</span>
        </div>
      )}

      <Grid n={n} dir={dir} rows={asRows(v.myGuesses)} typing={typing} />

      {canGuess && (
        <>
          <form
            class="wordle-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ok) return;
              send({ type: 'guess', word: c.word });
              setText('');
              input.current?.focus(); // keep the keyboard open for the next guess
            }}
          >
            <input
              ref={input}
              value={text}
              dir="auto"
              maxLength={MAX_INPUT}
              autocomplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellcheck={false}
              enterKeyHint="go"
              placeholder={dir === 'rtl' ? tg('phAr', n) : tg('phEn', n)}
              aria-label={tg('guessLabel')}
              onInput={(e) => setText(e.currentTarget.value)}
            />
            <button class="btn primary" disabled={!ok}>
              {tg('guess')}
            </button>
          </form>
          <p class="small wordle-hint error" aria-live="polite">
            {problem ? tKey(problem) : ' '}
          </p>
        </>
      )}

      {v.phase === 'play' && v.myDone && (
        <p class="wordle-note center">{solved !== null ? tg('youSolved', solved) : tg('youOut')}</p>
      )}

      {v.phase === 'play' && tried.length > 0 && (
        <div class="wordle-tried">
          <span class="wordle-label">{tg('tried')}</span>
          <div class="wordle-keys" dir={dir}>
            {tried.map(({ ch, m }) => (
              <span key={ch} class={`wordle-key ${m}`}>
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {v.phase === 'play' && (
        <div class="wordle-legend small">
          <span>
            <i class="g" />
            {tg('legendG')}
          </span>
          <span>
            <i class="y" />
            {tg('legendY')}
          </span>
          <span>
            <i class="x" />
            {tg('legendX')}
          </span>
        </div>
      )}
    </section>
  );
}

/** The partner's guesses at my word: colours only while playing, letters once it's over. */
function OppBoard({ v, opp, oppSeat }: { v: WordleView; opp: string; oppSeat: number }) {
  if (v.mySecret === null) return null;
  const over = v.phase === 'over';
  const n = letters(v.mySecret).length;
  const rows: MarkedRow[] = over && v.oppGuesses ? asRows(v.oppGuesses) : v.oppMarks.map((marks) => ({ marks }));
  const solved = solvedAt(rows);
  const state = solved !== null ? tg('solvedOn', solved) : v.oppDone ? tg('outOf') : tg('guessing');

  return (
    <section class="wordle-card wordle-opp">
      <div class="wordle-head">
        <span class={`wordle-seat p${oppSeat}`} />
        <span class="wordle-label">{over ? tg('oppGuesses', opp) : tg('oppProgress', opp)}</span>
        <span class="muted small wordle-count">
          {rows.length}/{MAX_GUESSES}
        </span>
      </div>
      <Grid n={n} dir={scriptDir(v.mySecret)} rows={rows} mini />
      <p class="small wordle-opp-state">{state}</p>
      {!over && (
        <p class="muted small wordle-opp-word">
          {tg('yourWord')}: <bdi>{v.mySecret}</bdi>
        </p>
      )}
    </section>
  );
}

function Board({ view: v, me, names, send, rematch, toLobby }: BoardProps<WordleView, WordleMove>) {
  const oppSeat = other(me);
  const opp = names[oppSeat];
  const over = v.phase === 'over';

  let status: string;
  if (v.phase === 'pick') status = v.mySecret === null ? tg('pickPrompt') : tg('waitWord', opp);
  else if (v.phase === 'play') status = v.myDone ? tg('waitFinish', opp) : tg('guessIt', v.targetLength ?? 0);
  else status = v.winner === 'draw' ? t('draw') : v.winner === me ? t('youWin') : t('oppWins', opp);
  const active = (v.phase === 'pick' && v.mySecret === null) || (v.phase === 'play' && !v.myDone);

  return (
    <div class="wordle">
      <TurnBanner text={status} active={active} over={over} />
      <ScoreBar names={names} me={me} />

      {v.phase === 'pick' ? (
        <PickPanel v={v} opp={opp} send={send} />
      ) : (
        <>
          {over && (
            <section class="wordle-card wordle-reveal">
              <div class="wordle-words">
                <div>
                  <div class="wordle-label">{tg('yourWord')}</div>
                  <bdi class="wordle-word">{v.mySecret}</bdi>
                </div>
                <div>
                  <div class="wordle-label">{tg('oppWord', opp)}</div>
                  <bdi class="wordle-word">{v.oppSecret}</bdi>
                </div>
              </div>
              <EndActions rematch={rematch} toLobby={toLobby} />
            </section>
          )}
          <MyBoard v={v} send={send} />
          <OppBoard v={v} opp={opp} oppSeat={oppSeat} />
        </>
      )}
    </div>
  );
}

export const wordle: GameDef<WordleState, WordleMove, WordleView, null> = {
  id: 'wordle',
  get name() {
    return tg('name');
  },
  icon: '🔤',
  tags: ['words', 'quick'],
  minutes: 5,
  Art,
  get blurb() {
    return tg('blurb');
  },
  init: () => init(),
  apply,
  view,
  Board,
};
