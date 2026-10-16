import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { PlayerNumber, QueenState } from '../game/types';

const RAIN_COLORS = ['#ffd54a', '#d7263d', '#f7f1e3', '#ff8ba0'];

export function CoinRain({ pieces = 9 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }).map((_, i) => ({
        id: i,
        x: (i * 37 + 11) % 100,
        s: 8 + ((i * 13) % 10),
        d: 5 + ((i * 29) % 40) / 10,
        dl: ((i * 53) % 30) / 10,
        c: RAIN_COLORS[i % RAIN_COLORS.length],
      })),
    [pieces],
  );
  return (
    <div className="coin-rain" aria-hidden="true">
      {items.map((p) => (
        <i
          key={p.id}
          style={
            {
              left: `${p.x}%`,
              '--s': `${p.s}px`,
              '--d': `${p.d}s`,
              '--dl': `${p.dl}s`,
              '--c': p.c,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

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

export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const items = useMemo(
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
