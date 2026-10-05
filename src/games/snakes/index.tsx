import { useEffect, useRef, useState } from 'preact/hooks';
import { other, type BoardProps, type GameDef, type Player } from '../../core/types';
import { t } from '../../i18n';
import { EndActions, ScoreBar, TurnBanner } from '../../ui/common';
import { Art } from './art';
import { apply, init, LADDERS, LAST, SNAKES, squareToCell, type SnakesMove, type SnakesState } from './logic';
import { tg } from './strings';
import './style.css';

// ---------- board geometry (SVG units: one square is U wide) ----------

const U = 10;
const SIZE = 10 * U;
const STRIP = 9; // the "start" area under the board, where tokens wait before their first roll
const HEIGHT = SIZE + STRIP;

type Pt = { x: number; y: number };

const centre = (n: number): Pt => {
  const { row, col } = squareToCell(n);
  return { x: col * U + U / 2, y: row * U + U / 2 };
};
const r2 = (v: number) => Math.round(v * 100) / 100;

const CELLS = Array.from({ length: LAST }, (_, i) => {
  const n = i + 1;
  const { row, col } = squareToCell(n);
  return { n, x: col * U, y: row * U, shade: (row + col) % 2 === 0 ? 'a' : 'b' };
});

/** A ladder: two rails and rungs between the centres of its foot and top squares. */
const LADDER_ART = Object.entries(LADDERS).map(([foot, top]) => {
  const a = centre(+foot);
  const b = centre(top);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  // half the gap between the rails, as a vector across the ladder
  const px = (-dy / len) * 1.7;
  const py = (dx / len) * 1.7;
  const rungs = Math.max(2, Math.floor(len / 4.4));
  let rails = '';
  for (const s of [-1, 1]) rails += `M${r2(a.x + px * s)} ${r2(a.y + py * s)}L${r2(b.x + px * s)} ${r2(b.y + py * s)}`;
  let steps = '';
  for (let i = 0; i < rungs; i++) {
    const f = (i + 0.5) / rungs;
    const cx = a.x + dx * f;
    const cy = a.y + dy * f;
    steps += `M${r2(cx - px)} ${r2(cy - py)}L${r2(cx + px)} ${r2(cy + py)}`;
  }
  return { key: foot, rails, steps };
});

/**
 * A snake: a smooth chain of S-curves from head square to tail square. Neighbouring curves bulge to
 * opposite sides with matching tangents, so the body slithers without kinks.
 */
const SNAKE_ART = Object.entries(SNAKES).map(([head, tail], idx) => {
  const a = centre(+head);
  const b = centre(tail);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const waves = Math.max(2, Math.round(len / 16));
  const seg = len / waves;
  const bulge = Math.min(5.5, seg * 0.45) * (idx % 2 === 0 ? 1 : -1);
  const nx = -uy * bulge;
  const ny = ux * bulge;

  let d = `M${r2(a.x)} ${r2(a.y)}`;
  let neck: Pt = a;
  for (let i = 0; i < waves; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const sx = a.x + dx * (i / waves);
    const sy = a.y + dy * (i / waves);
    const c1 = { x: sx + ux * seg * 0.3 + nx * side, y: sy + uy * seg * 0.3 + ny * side };
    const c2 = { x: sx + ux * seg * 0.7 + nx * side, y: sy + uy * seg * 0.7 + ny * side };
    const ex = a.x + dx * ((i + 1) / waves);
    const ey = a.y + dy * ((i + 1) / waves);
    d += `C${r2(c1.x)} ${r2(c1.y)} ${r2(c2.x)} ${r2(c2.y)} ${r2(ex)} ${r2(ey)}`;
    if (i === 0) neck = c1;
  }
  // The head looks away from the body, along the curve's tangent at the head.
  const angle = r2((Math.atan2(a.y - neck.y, a.x - neck.x) * 180) / Math.PI);
  return { key: head, d, head: a, angle, tone: idx % 4 };
});

/** Where a token sits: in its square (nudged down so the number stays visible), or in the start area. */
function anchor(pos: number, p: Player, shared: boolean): Pt {
  if (pos === 0) return { x: 6 + p * 8, y: SIZE + STRIP / 2 };
  const c = centre(pos);
  return { x: c.x + (shared ? (p === 0 ? -2.1 : 2.1) : 0), y: c.y + 1.3 };
}

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

function Die({ value, by, animate }: { value: number | null; by: Player | null; animate: boolean }) {
  const on = value === null ? [] : (PIPS[value] ?? []);
  return (
    <div
      class={`snakes-die ${by === null ? '' : `p${by}`} ${value === null ? 'blank' : ''} ${animate ? 'roll' : ''}`}
      role="img"
      aria-label={value === null ? tg('dieBlank') : tg('dieShows', value)}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} class={on.includes(i) ? 'on' : ''} />
      ))}
    </div>
  );
}

// ---------- the board ----------

/** A token that took a ladder or snake first glides to the square the die gave it, then pauses, then jumps. */
const JUMP_PAUSE_MS = 900;

function useShownPositions(s: SnakesState): [number, number] {
  const [settled, setSettled] = useState(s.rolls);
  useEffect(() => {
    if (settled === s.rolls) return;
    const id = setTimeout(() => setSettled(s.rolls), JUMP_PAUSE_MS);
    return () => clearTimeout(id);
  }, [s.rolls, settled]);

  const l = s.last;
  if (l !== null && l.via !== null && settled !== s.rolls) {
    const pos: [number, number] = [s.pos[0], s.pos[1]];
    pos[l.by] = l.landed;
    return pos;
  }
  return s.pos;
}

function Board({ view: s, me, names, send, rematch, toLobby }: BoardProps<SnakesState, SnakesMove>) {
  const opp = names[other(me)];
  const shown = useShownPositions(s);
  // A winning ladder (80 → 100): announce the win only once the token has made the jump.
  const winner = shown === s.pos ? s.winner : null;
  const myTurn = winner === null && s.turn === me;
  const firstRolls = useRef(s.rolls);
  const [cooling, setCooling] = useState(false);

  const status =
    winner === me
      ? t('youWin')
      : winner !== null
        ? t('oppWins', opp)
        : myTurn
          ? tg('yourTurn')
          : t('oppTurn', opp);

  const l = s.last;
  let message = tg('intro');
  if (l !== null) {
    const who = l.by === me ? t('you') : names[l.by];
    message = l.stayed
      ? tg('exact', who, l.die, LAST - l.from)
      : l.via === 'ladder'
        ? tg('ladder', who, l.landed, l.to)
        : l.via === 'snake'
          ? tg('snake', who, l.landed, l.to)
          : tg('moved', who, l.die, l.to);
  }

  // One tap, one roll: ignore a quick second tap while the first is still on its way to the host.
  const roll = () => {
    if (!myTurn || cooling) return;
    setCooling(true);
    setTimeout(() => setCooling(false), 900);
    send({ type: 'roll' });
  };

  const sharing = shown[0] === shown[1] && shown[0] > 0;

  return (
    <div class="snakes">
      <TurnBanner text={status} active={myTurn} over={winner !== null} />
      <ScoreBar names={names} me={me} scores={s.pos} turn={winner === null ? s.turn : null} />

      {/* Geometry, so always left-to-right. */}
      <svg class="snakes-board" viewBox={`0 0 ${SIZE} ${HEIGHT}`} dir="ltr" role="img" aria-label={tg('boardLabel')}>
        {CELLS.map((c) => (
          <rect
            key={c.n}
            class={`snakes-cell ${c.n === LAST ? 'end' : c.shade}`}
            x={c.x}
            y={c.y}
            width={U}
            height={U}
          />
        ))}
        <rect class="snakes-start" x={0} y={SIZE} width={SIZE} height={STRIP} />
        <text class="snakes-start-label" x={22} y={SIZE + STRIP / 2 + 1.1}>
          {tg('start')}
        </text>

        {LADDER_ART.map((a) => (
          <g key={a.key} class="snakes-ladder">
            <path class="snakes-ladder-shadow" d={a.rails + a.steps} />
            <path class="snakes-rails" d={a.rails} />
            <path class="snakes-rungs" d={a.steps} />
          </g>
        ))}

        {SNAKE_ART.map((a) => (
          <g key={a.key} class={`snakes-snake tone${a.tone}`}>
            <path class="snakes-snake-edge" d={a.d} />
            <path class="snakes-snake-body" d={a.d} />
            <path class="snakes-snake-scales" d={a.d} />
            <g transform={`translate(${r2(a.head.x)} ${r2(a.head.y)}) rotate(${a.angle})`}>
              <path class="snakes-tongue" d="M2.4 0L4.3 0M4.3 0L5.2 -0.8M4.3 0L5.2 0.8" />
              <ellipse class="snakes-snake-head" rx={2.7} ry={2.2} />
              <circle class="snakes-eye" cx={0.9} cy={-1.05} r={0.65} />
              <circle class="snakes-eye" cx={0.9} cy={1.05} r={0.65} />
              <circle class="snakes-pupil" cx={1.1} cy={-1.05} r={0.32} />
              <circle class="snakes-pupil" cx={1.1} cy={1.05} r={0.32} />
            </g>
          </g>
        ))}

        {/* Numbers sit above the drawings (with a halo) so a ladder or snake never hides them. */}
        {CELLS.map((c) => (
          <text key={c.n} class={`snakes-num ${c.n === LAST ? 'end' : ''}`} x={c.x + 1.1} y={c.y + 3.5}>
            {c.n}
          </text>
        ))}

        {([0, 1] as const).map((p) => {
          const { x, y } = anchor(shown[p], p, sharing);
          return (
            <g
              key={p}
              class={`snakes-token p${p} ${winner === p ? 'win' : ''}`}
              style={{ transform: `translate(${r2(x)}px, ${r2(y)}px)` }}
            >
              <g class="snakes-bob">
                <ellipse class="snakes-shadow" cx={0} cy={1.9} rx={2.6} ry={1} />
                <circle class="snakes-piece" r={2.7} />
                <circle class="snakes-shine" cx={-0.9} cy={-0.9} r={0.9} />
              </g>
            </g>
          );
        })}
      </svg>

      <div class="snakes-controls">
        <p class={`snakes-msg ${l !== null ? `p${l.by}` : ''}`} aria-live="polite">
          {message}
        </p>
        {winner === null && (
          <div class="snakes-roll-row">
            <Die
              key={s.rolls}
              value={l?.die ?? null}
              by={l?.by ?? null}
              animate={l !== null && s.rolls !== firstRolls.current}
            />
            <button class="btn primary snakes-roll" disabled={!myTurn || cooling} onClick={roll}>
              <span aria-hidden="true">🎲</span> {tg('roll')}
            </button>
          </div>
        )}
      </div>

      {winner !== null && <EndActions rematch={rematch} toLobby={toLobby} />}
    </div>
  );
}

export const snakes: GameDef<SnakesState, SnakesMove, SnakesState, null> = {
  id: 'snakes',
  get name() {
    return tg('name');
  },
  icon: '🐍',
  tags: ['board', 'quick'],
  minutes: 5,
  players: [2, 2],
  Art,
  get blurb() {
    return tg('blurb');
  },
  init: () => init(),
  apply: (s, m, by) => apply(s, m, by), // the die is rolled inside apply, which only the host runs
  view: (s) => s, // no hidden information
  Board,
};
