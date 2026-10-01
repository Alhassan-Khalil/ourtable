import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { other, type BoardProps, type GameDef, type Player } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import {
  apply,
  chars,
  clean,
  init,
  MAX_LEN,
  view,
  type StoryLine,
  type StoryMove,
  type StoryState,
  type StoryView,
} from './logic';
import { tg } from './strings';
import './style.css';

type Send = BoardProps<StoryView, StoryMove>['send'];

const OPENERS = ['opener1', 'opener2', 'opener3', 'opener4', 'opener5', 'opener6'] as const;

/** Sentences per paragraph when the finished story is laid out. */
const PARAGRAPH = 5;

/** "Sentence 3 of 10" plus one dot per sentence. */
function Progress({ written, total }: { written: number; total: number }) {
  return (
    <div class="story-progress">
      <span class="story-progress-text">{tg('progress', Math.min(written + 1, total), total)}</span>
      <span class="story-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} class={`story-dot ${i < written ? 'done' : i === written ? 'now' : ''}`} />
        ))}
      </span>
    </div>
  );
}

/** My turn: see the partner's last sentence (or a nudge to start), write mine. */
function Compose({ s, opp, me, send }: { s: StoryView; opp: string; me: Player; send: Send }) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [idea] = useState(() => Math.floor(Math.random() * OPENERS.length));

  const mine = clean(text);
  const count = chars(mine);
  const tooLong = count > MAX_LEN;
  const ok = count > 0 && !tooLong && !sent;

  // After sending, wait for the new view (this component then goes away). If nothing happened
  // (e.g. the connection dropped), unlock the button again and keep the draft.
  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => setSent(false), 3000);
    return () => clearTimeout(id);
  }, [sent]);

  function submit(e: Event) {
    e.preventDefault();
    if (!ok) return;
    send({ type: 'write', text: mine });
    setSent(true);
  }

  return (
    <>
      <Progress written={s.written} total={s.total} />

      {s.prev !== null ? (
        <section class={`story-card p${other(me)}`}>
          <div class="story-label">{tg('partnerLast', opp)}</div>
          <p class="story-quote" dir="auto">
            {s.prev}
          </p>
        </section>
      ) : (
        s.written === 0 && (
          <section class="story-card start">
            <div class="story-label">{tg('startTitle')}</div>
            <p class="story-hint">{tg('startHint')}</p>
            <p class="story-example">
              <span class="story-example-label">{tg('example')}</span>{' '}
              <span dir="auto">{tg(OPENERS[idea])}</span>
            </p>
          </section>
        )
      )}

      <form class="story-form" onSubmit={submit}>
        <textarea
          class="story-input"
          dir="auto"
          rows={4}
          value={text}
          placeholder={s.written === 0 ? tg('phStart') : tg('phNext')}
          aria-label={tg('yourSentence')}
          autocomplete="off"
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(e);
          }}
        />
        <div class={`story-count ${tooLong ? 'over' : ''}`}>
          {count}/{MAX_LEN}
        </div>
        <button type="submit" class="btn primary wide" disabled={!ok}>
          {tg('add')}
        </button>
      </form>
    </>
  );
}

/** Partner's turn: nothing to see but a teaser. */
function Waiting({ s }: { s: StoryView }) {
  return (
    <>
      <Progress written={s.written} total={s.total} />
      <section class="story-card wait">
        <div class="story-pencil" aria-hidden="true">
          ✍️
        </div>
        <p class="story-hint">{tg('secret', s.total)}</p>
      </section>
    </>
  );
}

interface FinishedProps extends Pick<BoardProps<StoryView, StoryMove>, 'names' | 'me' | 'rematch' | 'toLobby'> {
  lines: StoryLine[];
}

/** The reveal: the whole story, each sentence tinted by who wrote it. */
function Finished({ lines, names, me, rematch, toLobby }: FinishedProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const plain = lines.map((l) => l.text).join(' ');

  async function copy() {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
    } catch {
      prompt(tg('copyPrompt'), plain);
    }
  }

  const paragraphs: StoryLine[][] = [];
  for (let i = 0; i < lines.length; i += PARAGRAPH) paragraphs.push(lines.slice(i, i + PARAGRAPH));

  return (
    <>
      <TurnBanner text={tg('ready')} active={false} over />
      {/* No scores: it doubles as the colour legend. */}
      <ScoreBar names={names} me={me} />

      <article class="story-book">
        {paragraphs.map((para, k) => (
          // dir="auto" lets a whole paragraph flow the way its first sentence reads.
          <p key={k} dir="auto">
            {para.map((l, j) => (
              <Fragment key={j}>
                <span class={`story-s p${l.by}`} title={names[l.by]}>
                  {l.text}
                </span>{' '}
              </Fragment>
            ))}
          </p>
        ))}
      </article>

      <button type="button" class="btn ghost wide story-copy" onClick={copy}>
        {copied ? t('copied') : tg('copyStory')}
      </button>

      <EndActions rematch={rematch} toLobby={toLobby} />
    </>
  );
}

function Board({ view: s, me, names, send, rematch, toLobby }: BoardProps<StoryView, StoryMove>) {
  const opp = names[other(me)];
  const myTurn = !s.done && s.turn === me;

  return (
    <div class="story">
      {s.done ? (
        <Finished lines={s.lines ?? []} names={names} me={me} rematch={rematch} toLobby={toLobby} />
      ) : (
        <>
          <TurnBanner
            text={myTurn ? (s.written === 0 ? tg('yourStart') : tg('yourTurn')) : tg('oppWriting', opp)}
            active={myTurn}
          />
          {/* keyed by sentence number, so every turn starts with an empty box */}
          {myTurn ? <Compose key={s.written} s={s} opp={opp} me={me} send={send} /> : <Waiting s={s} />}
        </>
      )}
    </div>
  );
}

export const story: GameDef<StoryState, StoryMove, StoryView, null> = {
  id: 'story',
  get name() {
    return tg('name');
  },
  icon: '📖',
  get blurb() {
    return tg('blurb');
  },
  init: () => init(),
  apply,
  view,
  Board,
};
