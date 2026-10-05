import { useEffect, useRef, useState } from 'preact/hooks';
import type { BoardProps, GameDef, Seat } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import { HOME_COLUMN, N, placeOf, TRACK, triangle, YARD_ORIGIN, yardSpot } from './board';
import {
  apply,
  FINISH,
  homeCounts,
  init,
  movable,
  progressOn,
  squareOf,
  STARS,
  targetOf,
  YARD,
  type Captured,
  type LudoMove,
  type LudoOptions,
  type LudoState,
} from './logic';
import { Setup } from './Setup';
import { tg } from './strings';
import './style.css';

// ---------- board geometry (SVG units: one cell is U wide) ----------

const U = 10;
const SIZE = N * U;
const MARGIN = 2;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A five-pointed star centred on (0, 0), for the safe squares. */
const STAR_PATH = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = (i % 2 === 0 ? 0.36 : 0.15) * U;
    d += `${i === 0 ? 'M' : 'L'}${r2(Math.cos(a) * r)} ${r2(Math.sin(a) * r)}`;
  }
  return `${d}Z`;
})();

/** Offsets (in cells) for tokens sharing a square, and the radius that fits. */
const STACKS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.18, -0.18],
    [0.18, 0.18],
  ],
  3: [
    [-0.2, -0.17],
    [0.2, -0.17],
    [0, 0.2],
  ],
  4: [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ],
};
function stackSpot(i: number, n: number): [number, number] {
  if (n <= 4) return STACKS[n][i];
  const a = (2 * Math.PI * i) / n;
  return [Math.cos(a) * 0.26, Math.sin(a) * 0.26];
}
const stackRadius = (n: number) => (n === 1 ? 0.36 : n === 2 ? 0.3 : n <= 4 ? 0.25 : 0.2);

const tone = (player: number) => (player >= 0 ? `ludo-p${player}` : 'ludo-none');

// ---------- the die ----------

/** Which of the 3 × 3 cells hold a pip, for each face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, by, animate }: { value: number | null; by: number | null; animate: boolean }) {
  const on = value === null ? [] : (PIPS[value] ?? []);
  return (
    <div
      class={`ludo-die ${by === null ? '' : `ludo-p${by}`} ${value === null ? 'blank' : ''} ${animate ? 'roll' : ''}`}
      role="img"
      aria-label={value === null ? tg('dieBlank') : tg('dieShows', value)}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} class={on.includes(i) ? 'on' : ''} />
      ))}
    </div>
  );
}

// ---------- token animation ----------

const STEP_MS = 150; // one square per step
const DIE_MS = 650; // after a roll, let the die land before the token sets off

/**
 * The tokens as drawn: a token that just moved walks there square by square, and anything it
 * captured stays put until it arrives. `settled` is false while a token is still walking.
 */
function useShownTokens(s: LudoState): { tokens: number[][]; settled: boolean } {
  const key = `${s.rolls}|${s.phase}`; // every action changes the roll count or the phase
  const mountedAt = useRef(key); // don't replay the move that was already there when the board opened
  const [step, setStep] = useState({ key, n: 0 });
  const n = step.key === key ? step.n : 0;

  const l = s.last;
  let walk: { by: number; token: number; from: number; to: number; auto: boolean; captured: Captured[] } | null = null;
  if (key !== mountedAt.current && l !== null && l.token !== null && l.from !== null && l.to !== null) {
    walk = { by: l.by, token: l.token, from: l.from, to: l.to, auto: l.auto, captured: l.captured };
  }
  const steps = walk === null ? 0 : walk.from === YARD ? 1 : walk.to - walk.from;
  const settled = n >= steps;

  useEffect(() => {
    if (settled) return;
    const id = setTimeout(() => setStep({ key, n: n + 1 }), n === 0 ? (walk?.auto ? DIE_MS : 40) : STEP_MS);
    return () => clearTimeout(id);
  }, [key, n, settled]);

  if (settled || walk === null) return { tokens: s.tokens, settled: true };
  const tokens = s.tokens.map((a) => a.slice());
  tokens[walk.by][walk.token] = walk.from === YARD ? (n >= 1 ? 0 : YARD) : walk.from + n;
  const square = squareOf(s.corners[walk.by], walk.to);
  for (const c of walk.captured) tokens[c.player][c.token] = progressOn(s.corners[c.player], square);
  return { tokens, settled: false };
}

// ---------- the board ----------

function message(s: LudoState, me: number, names: string[]): string {
  const l = s.last;
  if (l === null) return tg('intro');
  const who = l.by === me ? t('you') : names[l.by];
  const parts = [tg('rolled', who, l.die)];
  if (l.thirdSix) parts.push(tg('thirdSix'));
  else if (l.passed) parts.push(l.again ? tg('noMoveAgain') : tg('noMove'));
  else if (l.token === null) parts.push(l.by === me ? tg('choose') : tg('choosing'));
  else {
    if (l.auto) parts.push(tg('onlyMove'));
    if (l.from === YARD) parts.push(tg('out'));
    const victims = new Map<number, number>();
    for (const c of l.captured) victims.set(c.player, (victims.get(c.player) ?? 0) + 1);
    for (const [q, count] of victims) parts.push(q === me ? tg('capturedYou', count) : tg('captured', names[q], count));
    if (l.to === FINISH) parts.push(tg('home'));
    if (l.again) parts.push(tg('again'));
  }
  return parts.join(' ');
}

function Board({ view: s, me, names, send, rematch, toLobby }: BoardProps<LudoState, LudoMove, Seat>) {
  const { tokens: shown, settled } = useShownTokens(s);
  // A winning move: announce the win once the token has walked home.
  const winner = settled ? s.winner : null;
  const myTurn = s.phase !== 'over' && s.turn === me;
  const firstRolls = useRef(s.rolls);

  // One tap, one action: ignore taps until the host answers (or 2.5 s pass, e.g. after an error).
  const stateKey = `${s.rolls}|${s.phase}`;
  const [sentAt, setSentAt] = useState<string | null>(null);
  const busy = sentAt === stateKey;
  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setSentAt(null), 2500);
    return () => clearTimeout(id);
  }, [busy]);
  const act = (m: LudoMove) => {
    if (busy) return;
    setSentAt(stateKey);
    send(m);
  };

  const canRoll = myTurn && s.phase === 'roll' && settled && !busy;
  const choosing = myTurn && s.phase === 'move' && s.die !== null && !busy;
  const die = s.die ?? 0;
  const mine = s.tokens[me] ?? [];
  const options = choosing ? movable(mine, die) : [];
  // one target per spot: tokens on the same spot make the same move
  const targets: { token: number; p: number }[] = [];
  for (const k of options) if (!targets.some((x) => x.p === mine[k])) targets.push({ token: k, p: mine[k] });

  // Everyone sees their own corner at the bottom left (like sitting at a real board).
  const spin = (3 - (s.corners[me] ?? 0) + 4) % 4;
  const vis = (corner: number) => (corner + spin) % 4;
  const ownerAt = (v: number) => s.corners.indexOf((v - spin + 4) % 4);
  const count = s.tokens[0].length;

  // Tokens with their drawing spot; tokens sharing a square spread out a little.
  const pieces = shown.flatMap((list, player) =>
    list.map((p, token) => ({ player, token, p, ...placeOf(vis(s.corners[player]), p, token, count) })),
  );
  const groups = new Map<string, number[]>();
  pieces.forEach((pc, i) => groups.set(pc.key, [...(groups.get(pc.key) ?? []), i]));

  const status =
    winner !== null
      ? winner === me
        ? t('youWin')
        : t('oppWins', names[winner])
      : s.turn === me
        ? s.phase === 'roll'
          ? tg('yourRoll')
          : tg('yourMove')
        : t('oppTurn', names[s.turn]);

  const l = s.last;
  const myV = vis(s.corners[me] ?? 0);

  return (
    <div class="ludo">
      <TurnBanner text={status} active={myTurn} over={winner !== null} />
      <ScoreBar names={names} me={me} scores={homeCounts(shown)} turn={winner === null && s.phase !== 'over' ? s.turn : null} />

      {/* Geometry, so always left-to-right (CSS direction: the dir attribute does nothing on <svg>). */}
      <svg
        class={`ludo-board ${choosing ? 'choosing' : ''}`}
        viewBox={`${-MARGIN} ${-MARGIN} ${SIZE + 2 * MARGIN} ${SIZE + 2 * MARGIN}`}
        role="group"
        aria-label={tg('boardLabel')}
      >
        {/* yards */}
        {YARD_ORIGIN.map(([c, r], v) => {
          const owner = ownerAt(v);
          return (
            <g key={`y${v}`} class={`ludo-yard ${tone(owner)}`}>
              <rect class="ludo-yard-bg" x={c * U} y={r * U} width={6 * U} height={6 * U} rx={U * 0.5} />
              <rect class="ludo-yard-in" x={(c + 1) * U} y={(r + 1) * U} width={4 * U} height={4 * U} rx={U * 0.6} />
              {owner >= 0 &&
                Array.from({ length: count }, (_, k) => {
                  const p = yardSpot(v, k, count);
                  return <circle key={k} class="ludo-spot" cx={p.x * U} cy={p.y * U} r={0.55 * U} />;
                })}
            </g>
          );
        })}

        {/* the track: start squares in their corner's colour, stars on the safe squares */}
        {TRACK.map(([c, r], sq) => (
          <rect
            key={`t${sq}`}
            class={`ludo-cell ${sq % 13 === 0 ? `start ${tone(ownerAt(sq / 13))}` : ''}`}
            x={c * U}
            y={r * U}
            width={U}
            height={U}
          />
        ))}
        {STARS.map((sq) => (
          <path key={`s${sq}`} class="ludo-star" d={STAR_PATH} transform={`translate(${(TRACK[sq][0] + 0.5) * U} ${(TRACK[sq][1] + 0.5) * U})`} />
        ))}
        {HOME_COLUMN.map((cells, v) =>
          cells.map(([c, r]) => <rect key={`h${c}.${r}`} class={`ludo-homecell ${tone(ownerAt(v))}`} x={c * U} y={r * U} width={U} height={U} />),
        )}

        {/* the centre: one triangle per corner */}
        {[0, 1, 2, 3].map((v) => (
          <polygon
            key={`c${v}`}
            class={`ludo-tri ${tone(ownerAt(v))}`}
            points={triangle(v)
              .map((p) => `${p.x * U},${p.y * U}`)
              .join(' ')}
          />
        ))}

        {/* where each movable token would land */}
        {targets.map(({ token, p }) => {
          const d = placeOf(myV, targetOf(p, die), token, count);
          return <circle key={`d${p}`} class={`ludo-dest ludo-p${me}`} cx={r2(d.x * U)} cy={r2(d.y * U)} r={r2(0.34 * U)} />;
        })}

        {pieces.map((pc, idx) => {
          const group = groups.get(pc.key)!;
          const i = group.indexOf(idx);
          const onTrack = pc.p !== YARD && pc.p !== FINISH;
          const [dx, dy] = onTrack ? stackSpot(i, group.length) : [0, 0];
          const rad = (pc.p === YARD ? 0.4 : pc.p === FINISH ? 0.24 : stackRadius(group.length)) * U;
          const can = pc.player === me && targets.length > 0 && options.includes(pc.token);
          return (
            <g
              key={`${pc.player}.${pc.token}`}
              class={`ludo-token ludo-p${pc.player} ${pc.p === YARD ? 'yard' : ''} ${can ? 'can' : ''} ${winner === pc.player ? 'win' : ''}`}
              style={{ transform: `translate(${r2((pc.x + dx) * U)}px, ${r2((pc.y + dy) * U)}px)` }}
            >
              <g class="ludo-bob">
                {can && <circle class="ludo-ring" r={r2(rad + 1.7)} />}
                <circle class="ludo-halo" r={r2(rad + 0.7)} />
                <circle class="ludo-piece" r={r2(rad)} />
                <circle class="ludo-cap" r={r2(rad * 0.45)} />
              </g>
            </g>
          );
        })}

        {/* generous tap areas: the whole yard to bring a token out, a bit more than a cell elsewhere */}
        {targets.map(({ token, p }) => {
          const go = () => act({ type: 'move', token });
          const yard = p === YARD;
          const at = placeOf(myV, p, token, count);
          const size = yard ? 6 : 1.3;
          const x = yard ? YARD_ORIGIN[myV][0] : at.x - size / 2;
          const y = yard ? YARD_ORIGIN[myV][1] : at.y - size / 2;
          return (
            <rect
              key={`hit${p}`}
              class="ludo-hit"
              role="button"
              tabIndex={0}
              aria-label={yard ? tg('bringOut') : tg('moveToken', token + 1)}
              x={r2(x * U)}
              y={r2(y * U)}
              width={size * U}
              height={size * U}
              rx={U * 0.3}
              onClick={go}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  go();
                }
              }}
            />
          );
        })}
      </svg>

      <div class="ludo-controls">
        <p class={`ludo-msg ${l !== null ? `ludo-p${l.by}` : ''}`} aria-live="polite">
          {message(s, me, names)}
        </p>
        {winner === null && (
          <div class="ludo-roll-row">
            <Die key={s.rolls} value={l?.die ?? null} by={l?.by ?? null} animate={l !== null && s.rolls !== firstRolls.current} />
            <button class="btn primary ludo-roll" disabled={!canRoll} onClick={() => canRoll && act({ type: 'roll' })}>
              <span aria-hidden="true">🎲</span> {tg('roll')}
            </button>
          </div>
        )}
      </div>

      {winner !== null && <EndActions rematch={rematch} toLobby={toLobby} />}
    </div>
  );
}

export const ludo: GameDef<LudoState, LudoMove, LudoState, LudoOptions, Seat> = {
  id: 'ludo',
  get name() {
    return tg('name');
  },
  icon: '🎲',
  tags: ['board'],
  minutes: 15,
  players: [2, 3],
  Art,
  get blurb() {
    return tg('blurb');
  },
  Setup,
  init: (opts, players) => init(opts, players),
  apply: (s, m, by) => apply(s, m, by), // the die is rolled inside apply, which only the host runs
  view: (s) => s, // no hidden information
  Board,
};
