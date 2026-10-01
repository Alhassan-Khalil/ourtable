import { useEffect, useState } from 'preact/hooks';
import { other, type BoardProps, type GameDef, type Player } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import {
  apply,
  init,
  MAX_LEN,
  view,
  type Idx,
  type Items,
  type TruthsMove,
  type TruthsState,
  type TruthsView,
} from './logic';
import { tg } from './strings';
import './style.css';

type Send = (move: TruthsMove) => void;

/** Blocks a double tap while a move is on its way; frees the button again if nothing came back. */
function useBusy() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setBusy(false), 3000);
    return () => clearTimeout(id);
  }, [busy]);
  return [busy, () => setBusy(true)] as const;
}

interface StatementProps {
  /** 1-based position shown in the badge. */
  n: number;
  text: string;
  /** Reveal / waiting state: whether this one is the lie or a truth. */
  mark?: 'lie' | 'truth';
  tags?: string[];
  selected?: boolean;
  /** Present = a tappable choice (guess phase); absent = just a card. */
  onPick?: () => void;
}

function Statement({ n, text, mark, tags = [], selected, onPick }: StatementProps) {
  const cls = ['truths-card', selected && 'sel', mark].filter(Boolean).join(' ');
  const inner = (
    <>
      <span class="truths-num" aria-hidden="true">
        {n}
      </span>
      <span class="truths-body">
        <span class="truths-text" dir="auto">
          {text}
        </span>
        {(mark || tags.length > 0) && (
          <span class="truths-badges">
            {mark && (
              <span class={`truths-mark ${mark}`}>{mark === 'lie' ? `🤥 ${tg('lie')}` : `✓ ${tg('truth')}`}</span>
            )}
            {tags.map((tag) => (
              <span key={tag} class="truths-tag">
                {tag}
              </span>
            ))}
          </span>
        )}
      </span>
    </>
  );
  return onPick ? (
    <button type="button" class={cls} role="radio" aria-checked={!!selected} onClick={onPick}>
      {inner}
    </button>
  ) : (
    <div class={cls}>{inner}</div>
  );
}

/** "+1 · Name" in that player's seat colour. */
function Point({ who, name }: { who: Player; name: string }) {
  return (
    <span class={`truths-point p${who}`}>
      <i />
      <span>+1 · {name}</span>
    </span>
  );
}

/** Step 1: three fields, mark the lie, lock in. */
function Write({ opp, oppWrote, send }: { opp: string; oppWrote: boolean; send: Send }) {
  const [items, setItems] = useState<Items>(['', '', '']);
  const [lie, setLie] = useState<Idx | null>(null);
  const [busy, markBusy] = useBusy();
  const placeholders = [tg('ph1'), tg('ph2'), tg('ph3')];
  const ready = lie !== null && items.every((x) => x.trim().length > 0) && !busy;

  function submit(e: Event) {
    e.preventDefault();
    if (!ready || lie === null) return;
    markBusy();
    send({ type: 'write', items, lie });
  }

  return (
    <form class="truths-write" onSubmit={submit}>
      <p class="truths-hint">{tg('writeHint')}</p>
      {oppWrote && <p class="truths-ready">{tg('partnerReady', opp)}</p>}
      {items.map((text, i) => (
        <div key={i} class={`truths-field ${lie === i ? 'is-lie' : ''}`}>
          <textarea
            class="truths-input"
            rows={2}
            value={text}
            maxLength={MAX_LEN}
            dir="auto"
            placeholder={placeholders[i]}
            aria-label={tg('statement', i + 1)}
            enterkeyhint={i < 2 ? 'next' : 'done'}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setItems((prev) => prev.map((x, k) => (k === i ? value : x)) as Items);
            }}
            onKeyDown={(e) => {
              // One statement is one line: Enter jumps to the next statement (and closes the keyboard after the last).
              if (e.key !== 'Enter' || e.shiftKey) return;
              e.preventDefault();
              const next = e.currentTarget.form?.querySelectorAll('textarea')[i + 1];
              if (next) next.focus();
              else e.currentTarget.blur();
            }}
          />
          <div class="truths-field-foot">
            <span class="truths-num" aria-hidden="true">
              {i + 1}
            </span>
            <button type="button" class="truths-lie-btn" aria-pressed={lie === i} onClick={() => setLie(i as Idx)}>
              {tg('thisIsLie')}
            </button>
          </div>
        </div>
      ))}
      <button class="btn primary wide" disabled={!ready}>
        {tg('lockIn')}
      </button>
    </form>
  );
}

/** Step 1b: my statements are locked in, waiting for the partner. */
function Waiting({ mine }: { mine: NonNullable<TruthsView['mine']> }) {
  return (
    <section class="truths-section">
      <h3 class="truths-title">{tg('yourStatements')}</h3>
      <div class="truths-list">
        {mine.items.map((text, i) => (
          <Statement key={i} n={i + 1} text={text} mark={i === mine.lie ? 'lie' : 'truth'} />
        ))}
      </div>
      <p class="truths-note">{tg('shuffled')}</p>
    </section>
  );
}

/** Step 2: pick the partner's lie, then lock it in. */
function Guess({ v, opp, send }: { v: TruthsView; opp: string; send: Send }) {
  const [pick, setPick] = useState<Idx | null>(null);
  const [busy, markBusy] = useBusy();
  const theirs = v.theirs ?? [];
  const locked = v.myGuess !== null;

  return (
    <section class="truths-section">
      <h3 class="truths-title">{tg('theirStatements', opp)}</h3>
      {!locked && <p class="truths-hint">{tg('pickHint')}</p>}
      <div class="truths-list" role={locked ? undefined : 'radiogroup'} aria-label={tg('theirStatements', opp)}>
        {theirs.map((text, i) =>
          locked ? (
            <Statement
              key={i}
              n={i + 1}
              text={text}
              selected={v.myGuess === i}
              tags={v.myGuess === i ? [tg('yourGuess')] : []}
            />
          ) : (
            <Statement key={i} n={i + 1} text={text} selected={pick === i} onPick={() => setPick(i as Idx)} />
          ),
        )}
      </div>
      {!locked && (
        <div class="truths-actions">
          <button
            class="btn primary wide"
            disabled={pick === null || busy}
            onClick={() => {
              if (pick === null) return;
              markBusy();
              send({ type: 'guess', index: pick });
            }}
          >
            {tg('thatsTheLie')}
          </button>
        </div>
      )}
    </section>
  );
}

/** Step 3: both sides of the round, who scored, and "next round" (or the end). */
function Reveal({
  v,
  me,
  opp,
  send,
  rematch,
  toLobby,
}: {
  v: TruthsView;
  me: Player;
  opp: string;
  send: Send;
  rematch: () => void;
  toLobby: () => void;
}) {
  const mine = v.mine;
  const theirs = v.theirs ?? [];
  const nameOf = (p: Player) => (p === me ? t('you') : opp);
  const iFound = v.myGuess !== null && v.myGuess === v.theirLie;
  const oppFound = mine !== null && v.oppGuess !== null && v.oppGuess === mine.lie;
  // The point for each half of the round: whoever found the lie, or else the one who wrote it.
  const myPoint = iFound ? me : other(me);
  const oppPoint = oppFound ? other(me) : me;

  return (
    <>
      <section class="truths-section">
        <h3 class="truths-title">{tg('theirStatements', opp)}</h3>
        <div class="truths-list">
          {theirs.map((text, i) => (
            <Statement
              key={i}
              n={i + 1}
              text={text}
              mark={i === v.theirLie ? 'lie' : 'truth'}
              selected={v.myGuess === i}
              tags={v.myGuess === i ? [tg('yourGuess')] : []}
            />
          ))}
        </div>
        <div class={`truths-result ${iFound ? 'ok' : 'no'}`}>
          <span>{iFound ? tg('foundLie') : tg('missedLie')}</span>
          <Point who={myPoint} name={nameOf(myPoint)} />
        </div>
      </section>

      {mine && (
        <section class="truths-section">
          <h3 class="truths-title">{tg('yourStatements')}</h3>
          <div class="truths-list">
            {mine.items.map((text, i) => (
              <Statement
                key={i}
                n={i + 1}
                text={text}
                mark={i === mine.lie ? 'lie' : 'truth'}
                selected={v.oppGuess === i}
                tags={v.oppGuess === i ? [tg('theirGuess', opp)] : []}
              />
            ))}
          </div>
          <div class={`truths-result ${oppFound ? 'no' : 'ok'}`}>
            <span>{oppFound ? tg('oppFoundLie', opp) : tg('oppMissedLie', opp)}</span>
            <Point who={oppPoint} name={nameOf(oppPoint)} />
          </div>
        </section>
      )}

      {v.phase === 'over' ? (
        <EndActions rematch={rematch} toLobby={toLobby} />
      ) : (
        <div class="truths-actions">
          <button class="btn primary wide" onClick={() => send({ type: 'next', round: v.round })}>
            {tg('nextRound')}
          </button>
        </div>
      )}
    </>
  );
}

function Board({ view: v, me, names, send, rematch, toLobby }: BoardProps<TruthsView, TruthsMove>) {
  const opp = names[other(me)];

  let status: string;
  let active = false;
  if (v.phase === 'over') {
    status = v.winner === 'draw' ? t('draw') : v.winner === me ? t('youWin') : t('oppWins', opp);
  } else if (v.phase === 'reveal') {
    status = tg('roundResult');
    active = true;
  } else if (v.phase === 'write') {
    active = v.mine === null;
    status = v.mine === null ? tg('writeNow') : tg('waitWrite', opp);
  } else {
    active = v.myGuess === null;
    status = v.myGuess === null ? tg('guessNow', opp) : tg('waitGuess', opp);
  }

  return (
    <div class="truths">
      <TurnBanner text={status} active={active} over={v.phase === 'over'} />
      <ScoreBar names={names} me={me} scores={v.scores} />
      <p class="truths-round">{tg('round', v.round, v.rounds)}</p>

      {v.phase === 'write' &&
        (v.mine === null ? (
          <Write key={v.round} opp={opp} oppWrote={v.oppWrote} send={send} />
        ) : (
          <Waiting mine={v.mine} />
        ))}
      {v.phase === 'guess' && <Guess key={v.round} v={v} opp={opp} send={send} />}
      {(v.phase === 'reveal' || v.phase === 'over') && (
        <Reveal v={v} me={me} opp={opp} send={send} rematch={rematch} toLobby={toLobby} />
      )}
    </div>
  );
}

export const truths: GameDef<TruthsState, TruthsMove, TruthsView, null> = {
  id: 'truths',
  get name() {
    return tg('name');
  },
  icon: '🤥',
  get blurb() {
    return tg('blurb');
  },
  init: () => init(),
  apply: (s, move, by) => apply(s, move, by),
  view,
  Board,
};
