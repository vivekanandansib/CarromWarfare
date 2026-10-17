import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { PlayerNumber, QueenState } from '../game/types';

export function PlayerPanel({
  name,
  score,
  player,
  isTurn,
  mustCover,
  target,
  tag,
}: {
  name: string;
  score: number;
  player: PlayerNumber;
  isTurn: boolean;
  mustCover: boolean;
  target: number;
  tag?: string;
}) {
  return (
    <section className={`player${isTurn ? ' turn' : ''}`} aria-label={`Player ${player}: ${name}`}>
      <div className="player-head">
        <span className={`p-disc p${player}`} aria-hidden="true" />
        <div>
          <div className="player-name">
            {name} {isTurn && <span className="turn-badge">● to play</span>}
          </div>
          <div className="player-sub">
            Player {player}
            {tag ? ` · ${tag}` : ''}
          </div>
        </div>
        <div className="player-score" aria-label={`${name} score ${score}`}>
          {score}
          <span className="score-target">/ {target}</span>
        </div>
      </div>
      {mustCover && <p className="cover-note">Must cover the Queen — pocket any other coin!</p>}
    </section>
  );
}

export function QueenBadge({ queenState }: { queenState: QueenState }) {
  return (
    <div className={`queen-badge ${queenState}`} aria-live="polite" aria-label={`Queen status: ${queenState}`}>
      <span className="queen-dot" aria-hidden="true" />
      Queen:{' '}
      <strong>
        {queenState === 'available' && 'on board'}
        {queenState === 'pendingCover' && 'needs cover!'}
        {queenState === 'secured' && 'secured ✓'}
      </strong>
    </div>
  );
}

export function Toast({ msg, tone }: { msg: string | null; tone: 'good' | 'bad' | 'info' }) {
  if (!msg) return null;
  return (
    <div className={`toast ${tone}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}

export interface Burst {
  id: number;
  x: number;
  y: number;
}

export interface Floater {
  id: number;
  text: string;
  x: number;
  y: number;
  bonus?: boolean;
}

const SPARK_COLORS = ['#ffd54a', '#ffffff', '#ff8ba0', '#ffb14a'];

/** Pocket-burst sparks + floating score popups, positioned in board % coordinates. */
export function FxLayer({ bursts, floaters }: { bursts: Burst[]; floaters: Floater[] }) {
  return (
    <div className="fx-layer" aria-hidden="true">
      {bursts.map((b) => (
        <div
          key={b.id}
          className="burst"
          style={{ left: `${(b.x / 400) * 100}%`, top: `${(b.y / 400) * 100}%` }}
        >
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2 + (b.id % 7);
            const d = 34 + ((i * 13 + b.id) % 30);
            const style = {
              '--dx': `${Math.cos(a) * d}px`,
              '--dy': `${Math.sin(a) * d}px`,
              '--c': SPARK_COLORS[(i + b.id) % SPARK_COLORS.length],
            } as CSSProperties;
            return <i key={i} style={style} />;
          })}
        </div>
      ))}
      {floaters.map((f) => (
        <div
          key={f.id}
          className={`floater${f.bonus ? ' bonus' : ''}`}
          style={{ left: `${(f.x / 400) * 100}%`, top: `${(f.y / 400) * 100}%` }}
        >
          {f.text}
        </div>
      ))}
    </div>
  );
}

const CONFETTI_COLORS = ['#ffd54a', '#d7263d', '#7ef0ff', '#7ddf9a', '#ffffff', '#ff8ba0'];

export function Confetti({ pieces = 70 }: { pieces?: number }) {  const items = useMemo(
    () =>
      Array.from({ length: pieces }).map((_, i) => ({
        id: i,
        x: (i * 97 + 13) % 100,
        d: 2.4 + ((i * 37) % 20) / 10,
        dl: ((i * 53) % 15) / 10,
        c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [pieces],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {items.map((p) => (
        <i
          key={p.id}
          style={{ '--x': `${p.x}%`, '--d': `${p.d}s`, '--dl': `${p.dl}s`, '--c': p.c } as CSSProperties}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Infographics: live race bar, results donut + stat tiles. Pure presentation.
// ---------------------------------------------------------------------------

/** Live score race: share-of-points bar with a target tick. */
export function ScoreRace({
  s1,
  s2,
  n1,
  n2,
  target,
}: {
  s1: number;
  s2: number;
  n1: string;
  n2: string;
  target: number;
}) {
  const total = Math.max(1, s1 + s2);
  const p1 = (s1 / total) * 100;
  const tickAt = Math.min(100, (target / Math.max(target, total)) * 100);
  return (
    <div
      className="race"
      role="img"
      aria-label={`Score race: ${n1} ${s1} points, ${n2} ${s2} points, target ${target}`}
    >
      <div className="race-bar">
        <div className="race-p1" style={{ width: `${p1}%` }} />
        <div className="race-p2" style={{ width: `${100 - p1}%` }} />
        <div className="race-tick" style={{ left: `${tickAt}%` }} title={`Target ${target}`} />
      </div>
      <div className="race-labels">
        <span>
          {n1} · <strong>{s1}</strong>
        </span>
        <span className="race-target-label">🏁 {target}</span>
        <span>
          <strong>{s2}</strong> · {n2}
        </span>
      </div>
    </div>
  );
}

export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

/** Donut chart with center total. */
export function Donut({
  segments,
  size = 132,
  centerTop,
  centerBottom,
}: {
  segments: DonutSeg[];
  size?: number;
  centerTop: string;
  centerBottom: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((a, s) => a + s.value, 0),
  );
  const R = 46;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg
        className="donut"
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        <circle cx="60" cy="60" r={R} fill="none" stroke="#241a0e" strokeWidth="16" />
        {segments.map((s) => {
          const len = (s.value / total) * C;
          const off = acc;
          acc += len;
          return (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`}
              strokeDashoffset={-off}
              transform="rotate(-90 60 60)"
              strokeLinecap="butt"
            />
          );
        })}
        <text x="60" y="58" textAnchor="middle" className="donut-center-top">
          {centerTop}
        </text>
        <text x="60" y="74" textAnchor="middle" className="donut-center-sub">
          {centerBottom}
        </text>
      </svg>
      <ul className="donut-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="donut-swatch" style={{ background: s.color }} />
            {s.label} · <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Key-value stat tiles. */
export function StatGrid({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <dl className="stat-grid">
      {stats.map((s) => (
        <div key={s.label} className="stat-tile">
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- turn-log analytics (shared by quiz + classic results) ---

export interface TurnEntry {
  player: 1 | 2;
  points: number;
  /** Quiz: answer verdict. Classic: scoring shot (true) vs dry/foul (false). */
  correct: boolean;
  coinIds: string[];
  /** Queen lens: 'secured' | 'pending' | 'failed' | 'returned' | '' */
  queen: string;
}

export function coinColorOfId(id: string): 'white' | 'black' | 'queen' {
  if (id === 'Q') return 'queen';
  return id.startsWith('W') ? 'white' : 'black';
}

export function accuracyOf(log: TurnEntry[], player: 1 | 2): string {
  const t = log.filter((e) => e.player === player);
  if (t.length === 0) return '—';
  const c = t.filter((e) => e.correct).length;
  return `${Math.round((c / t.length) * 100)}% (${c}/${t.length})`;
}

export function bestStreakOf(log: TurnEntry[], player: 1 | 2): number {
  let best = 0;
  let run = 0;
  for (const e of log) {
    if (e.player !== player) {
      run = 0;
      continue;
    }
    if (e.correct) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function coinsByColor(log: TurnEntry[]): { white: number; black: number; queen: number } {
  const out = { white: 0, black: 0, queen: 0 };
  for (const e of log) for (const id of e.coinIds) out[coinColorOfId(id)]++;
  return out;
}

export function queenHolderOf(log: TurnEntry[], names: [string, string]): string {
  const secured = [...log].reverse().find((e) => e.queen === 'secured');
  if (!secured) return '—';
  return names[secured.player - 1];
}
