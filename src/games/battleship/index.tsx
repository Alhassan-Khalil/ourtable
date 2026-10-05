import { useEffect, useRef, useState } from 'preact/hooks';
import { other, type BoardProps, type GameDef } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import {
  apply,
  fits,
  FLEET,
  init,
  randomFleet,
  shipCells,
  SIZE,
  view,
  type BattleMove,
  type BattleState,
  type BattleView,
  type Ship,
} from './logic';
import { tg } from './strings';
import './style.css';

type Part = { part: 'bow' | 'mid' | 'stern'; dir: Ship['dir']; idx: number };

/** Square → which ship and which part of it, so ships can be drawn with rounded ends. */
function shipMap(ships: Ship[]): Map<number, Part> {
  const m = new Map<number, Part>();
  ships.forEach((s, idx) =>
    shipCells(s).forEach((k, i) => m.set(k, { part: i === 0 ? 'bow' : i === s.len - 1 ? 'stern' : 'mid', dir: s.dir, idx })),
  );
  return m;
}

interface Mark {
  ship?: Part;
  ghost?: boolean; // a partner ship revealed at the end, not sunk
  hit?: boolean;
  miss?: boolean;
  last?: boolean;
  selected?: boolean;
}

/** One sea. Geometry, so always left-to-right. */
function Sea({
  marks,
  onTap,
  small,
  label,
  playable,
}: {
  marks: (k: number) => Mark;
  onTap?: (k: number) => void;
  small?: boolean;
  label: string;
  playable?: (k: number) => boolean;
}) {
  return (
    <div class={`bs-sea ${small ? 'small' : ''}`} dir="ltr" role="group" aria-label={label}>
      {Array.from({ length: SIZE * SIZE }, (_, k) => {
        const m = marks(k);
        const cls = [
          'bs-cell',
          m.ship && `ship ${m.ship.part} ${m.ship.dir}`,
          m.ghost && 'ghost',
          m.selected && 'selected',
          m.hit && 'hit',
          m.miss && 'miss',
          m.last && 'last',
        ]
          .filter(Boolean)
          .join(' ');
        const can = !!onTap && (playable ? playable(k) : true);
        return (
          <button
            key={k}
            type="button"
            class={cls}
            disabled={!can}
            tabIndex={can ? 0 : -1}
            aria-label={tg('square', Math.floor(k / SIZE) + 1, (k % SIZE) + 1)}
            onClick={() => onTap?.(k)}
          />
        );
      })}
    </div>
  );
}

/** Before the battle: arrange my fleet (local until locked in). */
function Placement({ v, opp, send }: { v: BattleView; opp: string; send: (m: BattleMove) => void }) {
  const [ships, setShips] = useState<Ship[]>(() => randomFleet());
  const [sel, setSel] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
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
  useEffect(() => {
    if (!bump) return;
    const id = setTimeout(() => setBump(false), 350);
    return () => clearTimeout(id);
  }, [bump]);

  if (v.myShips !== null) {
    const map = shipMap(v.myShips);
    return (
      <section class="bs-card">
        <div class="bs-label">{tg('yourFleet')}</div>
        <Sea marks={(k) => ({ ship: map.get(k) })} label={tg('yourFleet')} />
      </section>
    );
  }

  const map = shipMap(ships);
  const others = (i: number) => ships.filter((_, j) => j !== i);

  function tap(k: number) {
    const hitShip = map.get(k);
    if (hitShip && hitShip.idx !== sel) return setSel(hitShip.idx);
    if (hitShip && hitShip.idx === sel) return setSel(null);
    if (sel === null) return;
    const moved: Ship = { ...ships[sel], r: Math.floor(k / SIZE), c: k % SIZE };
    if (fits(moved, others(sel))) setShips(ships.map((s, i) => (i === sel ? moved : s)));
    else setBump(true);
  }

  /** Rotate around the bow, nudging back inside the sea if needed. */
  function rotated(i: number): Ship | null {
    const s = ships[i];
    const dir = s.dir === 'h' ? 'v' : 'h';
    const r = dir === 'v' ? Math.min(s.r, SIZE - s.len) : s.r;
    const c = dir === 'h' ? Math.min(s.c, SIZE - s.len) : s.c;
    const turned: Ship = { ...s, dir, r, c };
    return fits(turned, others(i)) ? turned : null;
  }
  const turned = sel === null ? null : rotated(sel);

  return (
    <section class="bs-card">
      <p class="bs-hint">{tg('placeHint')}</p>
      <div class={bump ? 'bs-bump' : ''}>
        <Sea
          marks={(k) => ({ ship: map.get(k), selected: sel !== null && map.get(k)?.idx === sel })}
          onTap={tap}
          label={tg('yourFleet')}
        />
      </div>
      <div class="bs-tools">
        <button
          type="button"
          class="btn"
          onClick={() => {
            setShips(randomFleet());
            setSel(null);
          }}
        >
          {tg('shuffle')}
        </button>
        <button
          type="button"
          class="btn"
          disabled={turned === null}
          onClick={() => turned && sel !== null && setShips(ships.map((s, i) => (i === sel ? turned : s)))}
        >
          {tg('rotate')}
        </button>
      </div>
      <button
        type="button"
        class="btn primary wide"
        disabled={sent}
        onClick={() => {
          if (sending.current) return;
          sending.current = true;
          setSent(true);
          send({ type: 'place', ships });
        }}
      >
        {tg('ready')}
      </button>
      {v.oppReady && <p class="bs-note">{tg('oppReady', opp)}</p>}
    </section>
  );
}

/** The partner's fleet as little bars, crossed out when sunk. */
function FleetStatus({ sunk, title }: { sunk: number[]; title: string }) {
  const left = [...sunk];
  return (
    <div class="bs-fleet">
      <div class="bs-label">{title}</div>
      {FLEET.map((len, i) => {
        const at = left.indexOf(len);
        const down = at >= 0;
        if (down) left.splice(at, 1);
        return (
          <div key={i} class={`bs-bar ${down ? 'down' : ''}`} aria-label={`${len}`}>
            {Array.from({ length: len }, (_, j) => (
              <i key={j} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Board({ view: v, me, names, send, rematch, toLobby }: BoardProps<BattleView, BattleMove>) {
  const opp = names[other(me)];

  if (v.phase === 'place') {
    const status = v.myShips === null ? tg('placeTitle') : tg('waitPlace', opp);
    return (
      <div class="bs">
        <TurnBanner text={status} active={v.myShips === null} />
        <Placement v={v} opp={opp} send={send} />
      </div>
    );
  }

  const over = v.phase === 'over';
  const myTurn = !over && v.turn === me;
  const mine = v.myShips ?? [];

  // Which of my ships the partner sank, from their shots.
  const oppShotSet = new Set(v.oppShots);
  const mySunk = mine.filter((s) => shipCells(s).every((k) => oppShotSet.has(k)));
  const scores: [number, number] = [0, 0];
  scores[me] = v.oppSunk.length;
  scores[other(me)] = mySunk.length;

  const l = v.last;
  let message = '';
  if (l) {
    if (l.by === me) message = l.sunk ? tg('youSunk', l.sunk) : l.hit ? tg('youHit') : tg('youMiss');
    else message = l.sunk ? tg('oppSunk', opp, l.sunk) : l.hit ? tg('oppHit', opp) : tg('oppMiss', opp);
  }

  const status = over ? (v.winner === me ? t('youWin') : t('oppWins', opp)) : myTurn ? tg('yourTurn') : t('oppTurn', opp);

  // Partner's sea: my shots, sunk ships revealed, the rest of their fleet shown at the end.
  const shot = new Set(v.myShots);
  const hits = new Set(v.myHits);
  const sunkMap = shipMap(v.oppSunk);
  const ghostMap = over && v.oppShips ? shipMap(v.oppShips) : new Map<number, Part>();
  const theirMarks = (k: number): Mark => ({
    ship: sunkMap.get(k) ?? ghostMap.get(k),
    ghost: !sunkMap.has(k) && ghostMap.has(k),
    hit: hits.has(k),
    miss: shot.has(k) && !hits.has(k),
    last: l?.by === me && l.cell === k,
  });

  // My sea: my ships and the partner's shots.
  const myMap = shipMap(mine);
  const myMarks = (k: number): Mark => ({
    ship: myMap.get(k),
    hit: oppShotSet.has(k) && myMap.has(k),
    miss: oppShotSet.has(k) && !myMap.has(k),
    last: l !== null && l.by !== me && l.cell === k,
  });

  return (
    <div class="bs">
      <TurnBanner text={status} active={myTurn} over={over} />
      <ScoreBar names={names} me={me} scores={scores} turn={over ? null : v.turn} />
      <p class={`bs-message ${l?.hit ? 'hit' : ''}`} aria-live="polite">
        {message || ' '}
      </p>

      <section class="bs-card">
        <div class="bs-label">{tg('theirSea', opp)}</div>
        <Sea
          marks={theirMarks}
          onTap={myTurn ? (k) => send({ type: 'fire', cell: k }) : undefined}
          playable={(k) => !shot.has(k)}
          label={tg('theirSea', opp)}
        />
      </section>

      <section class="bs-bottom">
        <div class="bs-card">
          <div class="bs-label">{tg('yourFleet')}</div>
          <Sea marks={myMarks} small label={tg('yourFleet')} />
        </div>
        <FleetStatus sunk={v.oppSunk.map((s) => s.len)} title={tg('theirFleet', opp)} />
      </section>

      {over && <EndActions rematch={rematch} toLobby={toLobby} />}
    </div>
  );
}

export const battleship: GameDef<BattleState, BattleMove, BattleView, null> = {
  id: 'battleship',
  get name() {
    return tg('name');
  },
  icon: '🚢',
  tags: ['board'],
  minutes: 15,
  Art,
  get blurb() {
    return tg('blurb');
  },
  init: () => init(),
  apply,
  view,
  Board,
};

