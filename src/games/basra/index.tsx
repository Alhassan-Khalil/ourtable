import { useEffect, useRef, useState } from 'preact/hooks';
import type { BoardProps, GameDef, Seat } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import {
  apply,
  captureFor,
  init,
  isRed,
  rankOf,
  SEVEN_DIAMONDS,
  suitOf,
  view,
  type BasraMove,
  type BasraOptions,
  type BasraState,
  type BasraView,
  type Card,
  type RoundResult,
} from './logic';
import { Setup } from './Setup';
import { tg } from './strings';
import './style.css';

// ---------- cards ----------

/** Suit symbols, forced to text style (iOS otherwise draws ♥ and ♦ as emoji). */
const SYMBOL: Record<string, string> = { S: '♠︎', H: '♥︎', D: '♦︎', C: '♣︎' };

function cardName(c: Card): string {
  const r = rankOf(c);
  const rank = r === 'A' || r === 'J' || r === 'Q' || r === 'K' ? tg(`rank.${r}`) : r;
  return tg('cardName', rank, tg(`suit.${suitOf(c)}`));
}

/** A card face. Always left-to-right inside, like a printed card. */
function Face({ card, cls = '' }: { card: Card; cls?: string }) {
  const r = rankOf(card);
  const s = SYMBOL[suitOf(card)];
  const court = r === 'J' || r === 'Q' || r === 'K';
  return (
    <span class={`basra-card ${isRed(card) ? 'red' : ''} ${cls}`} dir="ltr" role="img" aria-label={cardName(card)}>
      <span class="basra-corner" aria-hidden="true">
        {r}
        <i>{s}</i>
      </span>
      <span class={`basra-pip ${court ? 'court' : ''}`} aria-hidden="true">
        {court ? r : s}
      </span>
      <span class="basra-corner end" aria-hidden="true">
        {r}
        <i>{s}</i>
      </span>
    </span>
  );
}

/** A face-down card (the pack, a partner's hand). */
const Back = ({ cls = '' }: { cls?: string }) => <span class={`basra-back ${cls}`} aria-hidden="true" />;

// ---------- the round's score ----------

function ScoreTable({ result, scores, names, me }: { result: RoundResult; scores: number[]; names: string[]; me: number }) {
  const rows: [string, (p: number) => number, string?][] = [
    [tg('rowCards'), (p) => result.lines[p].cards, 'count'],
    [tg('rowMost'), (p) => result.lines[p].most],
    [tg('rowAces'), (p) => result.lines[p].aces],
    [tg('rowJacks'), (p) => result.lines[p].jacks],
    [tg('rowTwo'), (p) => result.lines[p].twoClubs],
    [tg('rowTen'), (p) => result.lines[p].tenDiamonds],
    [tg('rowBasras'), (p) => result.lines[p].basras * 10],
    [tg('rowRound'), (p) => result.lines[p].total, 'sum'],
    [tg('rowTotal'), (p) => scores[p], 'total'],
  ];
  return (
    <table class="basra-score">
      <thead>
        <tr>
          <th />
          {names.map((n, p) => (
            <th key={p} class={`basra-p${p}`}>
              <i />
              {p === me ? t('you') : n}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value, kind]) => (
          <tr key={label} class={kind ?? ''}>
            <th scope="row">{label}</th>
            {names.map((_, p) => {
              const v = value(p);
              return (
                <td key={p} class={v === 0 && !kind ? 'zero' : ''}>
                  {v}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- the board ----------

function message(v: BasraView, me: number, names: string[]): string {
  const l = v.last;
  if (l === null) return tg('intro');
  const who = l.by === me ? t('you') : names[l.by];
  const parts: string[] = [];
  if (l.take.length === 0) parts.push(tg('dropped', who));
  else if (rankOf(l.card) === 'J') parts.push(tg('sweptJack', who, l.take.length));
  else if (l.card === SEVEN_DIAMONDS) parts.push(tg('sweptSeven', who, l.take.length));
  else parts.push(tg('took', who, l.take.length));
  if (l.basra) parts.push(tg('basra'));
  if (l.dealt) parts.push(v.deckCount === 0 ? tg('dealtLast') : tg('dealt'));
  return parts.join(' ');
}

function Board({ view: v, me, names, send, rematch, toLobby }: BoardProps<BasraView, BasraMove, Seat>) {
  const playing = v.phase === 'play';
  const myTurn = playing && v.turn === me;
  const firstSeq = useRef(v.seq); // don't replay the play that was already there when the board opened
  const fresh = v.seq !== firstSeq.current;

  // One tap, one card: ignore taps until the host answers (or 2.5 s pass, e.g. after an error).
  const stateKey = `${v.seq}|${v.phase}|${v.round}`;
  const [sentAt, setSentAt] = useState<string | null>(null);
  const busy = sentAt === stateKey;
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setSentAt(null), 2500);
    return () => clearTimeout(id);
  }, [busy]);
  const act = (m: BasraMove) => {
    if (busy) return;
    setSentAt(stateKey);
    send(m);
  };

  // The picked card (any time, to look ahead); playing it needs my turn.
  const [pick, setPick] = useState<Card | null>(null);
  const picked = playing && pick !== null && v.hand.includes(pick) ? pick : null;
  const preview = picked === null ? null : captureFor(v.floor, picked);
  const canPlay = myTurn && picked !== null && !busy;
  const play = () => picked !== null && canPlay && act({ type: 'play', card: picked });
  function tapCard(c: Card) {
    if (c === picked && canPlay) play();
    else setPick(c === picked ? null : c);
  }

  const status =
    v.phase === 'over'
      ? v.winner === null
        ? t('draw')
        : v.winner === me
          ? t('youWin')
          : t('oppWins', names[v.winner])
      : v.phase === 'scored'
        ? tg('roundOver', v.round)
        : myTurn
          ? tg('yourTurn')
          : t('oppTurn', names[v.turn]);

  const playLabel = preview === null ? tg('pick') : preview.basra ? tg('playBasra') : preview.take.length ? tg('playTakes', preview.take.length) : tg('playDrop');
  const l = v.last;
  // The others, in playing order after me (as if seated round the table).
  const others = Array.from({ length: v.players - 1 }, (_, i) => (me + 1 + i) % v.players);
  const result = v.result;

  return (
    <div class="basra">
      <TurnBanner text={status} active={myTurn} over={v.phase === 'over'} />
      <ScoreBar names={names} me={me} scores={v.scores} turn={playing ? v.turn : null} />

      <div class="basra-others">
        {others.map((p) => (
          <div key={p} class={`basra-seat basra-p${p} ${playing && v.turn === p ? 'turn' : ''}`}>
            <span class="basra-seat-name">
              <i />
              {names[p]}
            </span>
            <span class="basra-fan" role="img" aria-label={tg('handOf', v.handCounts[p])}>
              {Array.from({ length: v.handCounts[p] }, (_, k) => (
                <Back key={k} cls="tiny" />
              ))}
            </span>
            <Pile count={v.takenCounts[p]} basras={v.basras[p]} />
          </div>
        ))}
      </div>

      <section class="basra-felt" aria-label={tg('floorLabel')}>
        <div class="basra-felt-head">
          <span class="basra-deck" role="img" aria-label={tg('deckLeft', v.deckCount)}>
            {v.deckCount > 0 && <Back cls="tiny" />}
            <b>{tg('deckLeft', v.deckCount)}</b>
          </span>
          <span class="basra-round">
            {tg('round', v.round)}
            {v.length === 'full' && ` · ${tg('toTarget')}`}
          </span>
        </div>
        <div class={`basra-floor ${preview?.take.length ? 'preview' : ''}`}>
          {v.floor.length === 0 && <span class="basra-empty">{tg('floorEmpty')}</span>}
          {v.floor.map((c) => (
            <Face key={c} card={c} cls={`${preview?.take.includes(c) ? 'take' : ''} ${fresh && l?.card === c ? 'new' : ''}`} />
          ))}
          {preview && preview.take.length === 0 && <Face key="ghost" card={picked!} cls="ghost" />}
        </div>
        {v.carry > 0 && <p class="basra-carry">{tg('carry', v.carry)}</p>}
        {fresh && l?.basra && (
          <div key={v.seq} class="basra-burst" aria-hidden="true">
            <span>{tg('basra')}</span>
          </div>
        )}
      </section>

      <div key={v.seq} class={`basra-msg ${l ? `basra-p${l.by}` : ''} ${fresh ? 'fresh' : ''}`} aria-live="polite">
        <p>{message(v, me, names)}</p>
        {l && (
          <div class="basra-last" aria-hidden="true">
            <Face card={l.card} cls="mini" />
            {l.take.length > 0 && <span class="basra-arrow" />}
            {l.take.map((c) => (
              <Face key={c} card={c} cls="mini" />
            ))}
          </div>
        )}
      </div>

      {playing && (
        <section class={`basra-mine basra-p${me}`} aria-label={tg('handLabel')}>
          <div class="basra-hand">
            {v.hand.map((c) => (
              <button
                key={c}
                type="button"
                class={`basra-hand-card ${c === picked ? 'picked' : ''}`}
                aria-pressed={c === picked}
                onClick={() => tapCard(c)}
              >
                <Face card={c} cls="big" />
              </button>
            ))}
          </div>
          <div class="basra-mine-row">
            <Pile count={v.takenCounts[me]} basras={v.basras[me]} />
            <button type="button" class={`btn primary basra-play ${preview?.basra ? 'basra-hot' : ''}`} disabled={!canPlay} onClick={play}>
              {playLabel}
            </button>
          </div>
        </section>
      )}

      {result && v.phase !== 'play' && (
        <section class="panel basra-result">
          <ScoreTable result={result} scores={v.scores} names={names} me={me} />
          {result.leftoverTo !== null && (
            <p class="basra-note">
              {result.leftoverTo === me ? tg('leftoverYou', result.leftover) : tg('leftover', names[result.leftoverTo], result.leftover)}
            </p>
          )}
          {result.carried > 0 && <p class="basra-note">{tg('tie')}</p>}
          {v.phase === 'scored' && (
            <button type="button" class="btn primary wide" disabled={busy} onClick={() => act({ type: 'next' })}>
              {tg('nextRound')}
            </button>
          )}
        </section>
      )}

      {v.phase === 'over' && <EndActions rematch={rematch} toLobby={toLobby} />}
    </div>
  );
}

/** A player's taken pile: a count, and a star per basra. */
function Pile({ count, basras }: { count: number; basras: number }) {
  return (
    <span class="basra-pile" role="img" aria-label={`${tg('pileOf', count)}${basras ? `, ★ ${basras}` : ''}`}>
      <span class="basra-pile-stack" aria-hidden="true">
        <b>{count}</b>
      </span>
      {basras > 0 && (
        <span class="basra-stars" aria-hidden="true">
          {'★'.repeat(Math.min(basras, 5))}
          {basras > 5 && `+${basras - 5}`}
        </span>
      )}
    </span>
  );
}

export const basra: GameDef<BasraState, BasraMove, BasraView, BasraOptions, Seat> = {
  id: 'basra',
  get name() {
    return tg('name');
  },
  icon: '🃏',
  tags: ['board'],
  minutes: 10,
  players: [2, 3],
  Art,
  get blurb() {
    return tg('blurb');
  },
  Setup,
  init: (opts, players) => init(opts, players),
  apply: (s, m, by) => apply(s, m, by), // the shuffles happen inside apply/init, which only the host runs
  view,
  Board,
};
