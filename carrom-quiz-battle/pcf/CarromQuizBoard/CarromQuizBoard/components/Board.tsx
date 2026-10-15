import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Coin, CoinPos, QueenState, ShotType } from '../game/types';

export interface PocketAnim {
  coin: Coin;
  from: CoinPos;
  mid: CoinPos;
  to: CoinPos;
  durationMs: number;
}

interface BoardProps {
  coins: Coin[];
  queenState: QueenState;
  activeCoinId?: string;
  disabled: boolean;
  pocketAnim: PocketAnim | null;
  strikerX: number;
  onSelect: (coinId: string) => void;
  onAnimDone: () => void;
}

export const POCKETS: CoinPos[] = [
  { x: 30, y: 30 },
  { x: 370, y: 30 },
  { x: 30, y: 370 },
  { x: 370, y: 370 },
];

export function nearestPocket(p: CoinPos): CoinPos {
  let best = POCKETS[0];
  let bd = Infinity;
  for (const q of POCKETS) {
    const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/** Waypoint per shot type (visual only — no physics claims). */
export function waypointFor(from: CoinPos, to: CoinPos, shot: ShotType): CoinPos {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  switch (shot) {
    case 'cut':
      return { x: mx + (-dy / len) * 46, y: my + (dx / len) * 46 };
    case 'bank': {
      // bounce off the nearest cushion: push midpoint out to the edge
      const distTop = my;
      const distBottom = 400 - my;
      const distLeft = mx;
      const distRight = 400 - mx;
      const m = Math.min(distTop, distBottom, distLeft, distRight);
      if (m === distTop) return { x: mx, y: 14 };
      if (m === distBottom) return { x: mx, y: 386 };
      if (m === distLeft) return { x: 14, y: my };
      return { x: 386, y: my };
    }
    case 'defensive':
      return { x: mx + (-dy / len) * 14, y: my + (dx / len) * 14 };
    case 'straight':
    default:
      return { x: mx, y: my };
  }
}

function coinFill(c: Coin): string {
  if (c.color === 'queen') return '#d7263d';
  if (c.color === 'white') return '#f7f1e3';
  return '#26211c';
}

export default function Board({
  coins,
  activeCoinId,
  disabled,
  pocketAnim,
  strikerX,
  onSelect,
  onAnimDone,
}: BoardProps) {
  const [animPos, setAnimPos] = useState<CoinPos | null>(null);
  const rafRef = useRef<number>(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!pocketAnim) {
      setAnimPos(null);
      doneRef.current = false;
      return;
    }
    doneRef.current = false;
    const { from, mid, to, durationMs } = pocketAnim;
    const t0 = performance.now();
    const quad = (t: number): CoinPos => {
      const u = 1 - t;
      return {
        x: u * u * from.x + 2 * u * t * mid.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * mid.y + t * t * to.y,
      };
    };
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      setAnimPos(quad(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onAnimDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pocketAnim]);

  const animatingId = pocketAnim?.coin.id;

  const handleKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div className="board-wrap">
      <svg
        className="board"
        viewBox="0 0 400 400"
        role="group"
        aria-label="Carrom board. Use Tab to reach a coin, Enter to select it."
      >
        <defs>
          <radialGradient id="wood" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#c98d4e" />
            <stop offset="70%" stopColor="#a96f35" />
            <stop offset="100%" stopColor="#7c4f22" />
          </radialGradient>
          <radialGradient id="surface" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#f3d9a4" />
            <stop offset="100%" stopColor="#dfb26e" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="400" height="400" rx="26" fill="url(#wood)" />
        <rect x="14" y="14" width="372" height="372" rx="18" fill="none" stroke="#5b3a16" strokeWidth="4" />
        <rect x="34" y="34" width="332" height="332" rx="12" fill="url(#surface)" stroke="#7c4f22" strokeWidth="2" />

        {/* center markings */}
        <circle cx="200" cy="200" r="52" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <circle cx="200" cy="200" r="14" fill="#b03030" />
        {/* baselines */}
        <line x1="110" y1="312" x2="290" y2="312" stroke="#26211c" strokeWidth="3" />
        <circle cx="128" cy="312" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <circle cx="272" cy="312" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <line x1="110" y1="88" x2="290" y2="88" stroke="#26211c" strokeWidth="3" />
        <circle cx="128" cy="88" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <circle cx="272" cy="88" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />

        {/* pockets */}
        {POCKETS.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="17" fill="#1a120b" />
            <circle cx={p.x} cy={p.y} r="17" fill="none" stroke="#e8c47c" strokeWidth="2" opacity="0.6" />
          </g>
        ))}

        {/* striker on baseline, slides toward selected coin */}
        <g className="striker" style={{ transform: `translate(${strikerX}px, 312px)` }}>
          <circle cx="0" cy="0" r="14" fill="#f3e9d2" stroke="#b03030" strokeWidth="3" />
          <circle cx="-4" cy="-4" r="3" fill="#fff" opacity="0.7" />
        </g>

        {/* coins */}
        {coins.map((c) => {
          if (c.state === 'pocketed' || c.id === animatingId) return null;
          const selected = c.id === activeCoinId;
          return (
            <g
              key={c.id}
              tabIndex={disabled ? -1 : 0}
              role="button"
              aria-label={`${c.color} coin ${c.id}${selected ? ', selected' : ''}`}
              aria-disabled={disabled}
              className={`coin${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
              onClick={() => !disabled && onSelect(c.id)}
              onKeyDown={(e) => !disabled && handleKey(e, c.id)}
            >
              {selected && <circle cx={c.pos.x} cy={c.pos.y} r="17" className="coin-halo" />}
              <circle
                cx={c.pos.x}
                cy={c.pos.y}
                r={c.color === 'queen' ? 12.5 : 11}
                fill={coinFill(c)}
                stroke={selected ? '#ffd54a' : '#5b3a16'}
                strokeWidth={selected ? 3.5 : 1.5}
              />
              <circle cx={c.pos.x - 3} cy={c.pos.y - 3} r="2.6" fill="#fff" opacity="0.55" />
              {c.color === 'queen' && (
                <text x={c.pos.x} y={c.pos.y + 4.5} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="bold">
                  Q
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* pocket-flight overlay (HTML for smooth bezier motion) */}
      {pocketAnim && animPos && (
        <div
          className={`pocket-flyer ${pocketAnim.coin.color}`}
          style={{ left: `${(animPos.x / 400) * 100}%`, top: `${(animPos.y / 400) * 100}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
