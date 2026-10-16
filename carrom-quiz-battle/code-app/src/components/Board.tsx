import { useEffect, useRef, useState } from 'react';
import type { Coin, CoinPos, QueenState, ShotType } from '../game/types';
import type { BoardPalette } from '../game/boardTheme';
import { PALETTES } from '../game/boardTheme';

export interface PocketAnim {
  kind: 'pocket' | 'miss';
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
  /** Aim guide target (selected coin) — dashed striker line. */
  aimTo?: CoinPos | null;
  /** Pocket that just swallowed a coin — flash ring. */
  pocketFlash?: CoinPos | null;
  /** Explicit paint (theme switching without CSS-dependent SVG). Defaults to classic. */
  palette?: BoardPalette;
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

/** Miss waypoint: ~72% toward the pocket, veering sideways — the coin goes out and comes back. */
export function missMidpoint(from: CoinPos, to: CoinPos): CoinPos {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: from.x + dx * 0.72 + (-dy / len) * 64,
    y: from.y + dy * 0.72 + (dx / len) * 64,
  };
}

function coinGradient(c: Coin): string {
  if (c.color === 'queen') return 'url(#manQueen)';
  if (c.color === 'white') return 'url(#manWhite)';
  return 'url(#manBlack)';
}

function coinRim(c: Coin): string {
  if (c.color === 'queen') return '#7d1020';
  if (c.color === 'white') return '#8a6f45';
  return '#0a0705';
}

function coinPrint(c: Coin): string {
  if (c.color === 'queen') return '#ffe3e8';
  if (c.color === 'white') return '#b03030';
  return '#d8c49a';
}

export default function Board({
  coins,
  activeCoinId,
  disabled,
  pocketAnim,
  strikerX,
  aimTo,
  pocketFlash,
  palette,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pocketAnim]);

  const P = palette ?? PALETTES.classic;
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
          <radialGradient id="wood" cx="50%" cy="38%" r="78%">
            <stop offset="0%" stopColor={P.woodHi} />
            <stop offset="62%" stopColor={P.woodMid} />
            <stop offset="100%" stopColor={P.woodLo} />
          </radialGradient>
          <radialGradient id="surface" cx="50%" cy="46%" r="68%">
            <stop offset="0%" stopColor={P.feltHi} />
            <stop offset="100%" stopColor={P.feltLo} />
          </radialGradient>
          <radialGradient id="coinWhite" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#fffdf6" />
            <stop offset="55%" stopColor="#f3ead3" />
            <stop offset="100%" stopColor="#c9b183" />
          </radialGradient>
          {/* flat printed carrom men */}
          <linearGradient id="manWhite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbf5e6" />
            <stop offset="100%" stopColor="#e3d3ae" />
          </linearGradient>
          <linearGradient id="manBlack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#54432f" />
            <stop offset="100%" stopColor="#1d140d" />
          </linearGradient>
          <linearGradient id="manQueen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8546a" />
            <stop offset="100%" stopColor="#a31328" />
          </linearGradient>
          <marker id="pocketArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={P.arrow} />
          </marker>
          <radialGradient id="coinBlack" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#6b5d4d" />
            <stop offset="55%" stopColor="#33291f" />
            <stop offset="100%" stopColor="#0f0b08" />
          </radialGradient>
          <radialGradient id="coinQueen" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#ff8ba0" />
            <stop offset="55%" stopColor="#d7263d" />
            <stop offset="100%" stopColor="#7d1020" />
          </radialGradient>
          <radialGradient id="pocketGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="72%" stopColor="#120b06" />
            <stop offset="100%" stopColor="#3a2a18" />
          </radialGradient>
          <radialGradient id="strikerGrad" cx="38%" cy="30%" r="85%">
            <stop offset="0%" stopColor="#fffdf6" />
            <stop offset="60%" stopColor="#f0e2c4" />
            <stop offset="100%" stopColor="#b89b62" />
          </radialGradient>
          <filter id="grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.12" numOctaves="2" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0.6 0.6 0 0" result="a" />
            <feComposite operator="in" in="a" in2="SourceGraphic" result="c" />
            <feBlend in="SourceGraphic" in2="c" mode="multiply" />
          </filter>
          <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="1.6" floodColor="#000" floodOpacity="0.45" />
          </filter>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ffd54a" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* frame */}
        <rect x="0" y="0" width="400" height="400" rx="26" fill="url(#wood)" />
        <rect x="0" y="0" width="400" height="400" rx="26" fill={P.grainFrame} filter="url(#grain)" opacity="0.5" />
        <rect x="14" y="14" width="372" height="372" rx="18" fill="none" stroke="#3f2810" strokeWidth="5" />
        <rect x="18" y="18" width="364" height="364" rx="15" fill="none" stroke={P.frameLine} strokeWidth="1.5" opacity="0.8" />

        {/* playing surface */}
        <rect x="34" y="34" width="332" height="332" rx="12" fill="url(#surface)" stroke="#5b3a16" strokeWidth="2" />
        <rect x="34" y="34" width="332" height="332" rx="12" fill={P.grainFelt} filter="url(#grain)" opacity="0.35" />

        {/* full diagonal foul lines, pocket to pocket, under everything */}
        <line x1="34" y1="34" x2="366" y2="366" stroke={P.diagonal} strokeWidth="2" opacity="0.45" />
        <line x1="366" y1="34" x2="34" y2="366" stroke={P.diagonal} strokeWidth="2" opacity="0.45" />

        {/* frame corner ornaments + brand */}
        {[
          [26, 26],
          [374, 26],
          [26, 374],
          [374, 374],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="6.5" fill="none" stroke={P.flourish} strokeWidth="1.5" opacity="0.85" />
            <circle cx={x} cy={y} r="2.2" fill={P.centerRed} />
          </g>
        ))}
        <text
          x="200"
          y="26"
          textAnchor="middle"
          fontSize="10"
          letterSpacing="3"
          fill="#e8c47c"
          opacity="0.8"
          fontWeight="bold"
          className="brand brand-quiz"
        >
          CARROM QUIZ BATTLE
        </text>
        <text
          x="200"
          y="26"
          textAnchor="middle"
          fontSize="11"
          letterSpacing="3"
          fill="#d4af37"
          opacity="0.95"
          fontWeight="bold"
          className="brand brand-kingdom"
        >
          ♛ MODERN KINGDOM
        </text>
        <text
          x="200"
          y="381"
          textAnchor="middle"
          fontSize="10"
          letterSpacing="6"
          fill="#e8c47c"
          opacity="0.8"
          className="brand brand-quiz"
        >
          ★ ★ ★
        </text>
        <text
          x="200"
          y="381"
          textAnchor="middle"
          fontSize="9"
          letterSpacing="2"
          fill="#d4af37"
          opacity="0.9"
          className="brand brand-kingdom"
        >
          PLAY • STRATEGIZE • RULE
        </text>

        {/* corner flourishes */}
        {[
          [52, 52],
          [348, 52],
          [52, 348],
          [348, 348],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" className="flourish" />
        ))}

        {/* center design */}
        <circle cx="200" cy="200" r="62" fill="none" stroke={P.designRing} strokeWidth="2" />
        <circle cx="200" cy="200" r="52" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <circle
              key={i}
              cx={200 + 57 * Math.cos(a)}
              cy={200 + 57 * Math.sin(a)}
              r="2.4"
              fill={P.centerRed}
            />
          );
        })}
        <circle cx="200" cy="200" r="22" fill="none" stroke={P.centerDark} strokeWidth="2" />
        <circle cx="200" cy="200" r="18" fill="none" stroke={P.centerRed} strokeWidth="1.5" />
        <circle cx="200" cy="200" r="14" fill={P.centerRed} />
        <circle cx="200" cy="200" r="14" fill="none" stroke="#7d1f1f" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="5" fill="#f3d9a4" opacity="0.9" />

        {/* Modern Kingdom compass rose + crown + diamonds (theme-only overlay) */}
        <g className="kingdom-only" aria-hidden="true">
          <circle cx="200" cy="200" r="44" fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.9" />
          <polygon
            points={Array.from({ length: 16 })
              .map((_, i) => {
                const r = i % 2 === 0 ? 40 : 17;
                const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
                return `${200 + r * Math.cos(a)},${200 + r * Math.sin(a)}`;
              })
              .join(' ')}
            fill="#c8102e"
            opacity="0.85"
          />
          <polygon
            points={Array.from({ length: 16 })
              .map((_, i) => {
                const r = i % 2 === 0 ? 29 : 17;
                const a = (i / 16) * Math.PI * 2 - Math.PI / 2 + Math.PI / 16;
                return `${200 + r * Math.cos(a)},${200 + r * Math.sin(a)}`;
              })
              .join(' ')}
            fill="#d4af37"
            opacity="0.9"
          />
          <g transform="translate(200,200)">
            <path d="M -9 7 L -9 -3 L -4.5 1.5 L 0 -8 L 4.5 1.5 L 9 -3 L 9 7 Z" fill="#d4af37" stroke="#7a5c14" strokeWidth="1" />
            <rect x="-9" y="7" width="18" height="3" rx="1" fill="#c8102e" />
          </g>
          {[
            [200, 96],
            [200, 304],
            [96, 200],
            [304, 200],
          ].map(([x, y], i) => (
            <path key={i} d={`M ${x} ${y - 7} L ${x + 5} ${y} L ${x} ${y + 7} L ${x - 5} ${y} Z`} fill="#c8102e" stroke="#d4af37" strokeWidth="1" />
          ))}
        </g>

        {/* baselines */}
        <line x1="110" y1="312" x2="290" y2="312" stroke="#26211c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="312" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="272" cy="312" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="200" cy="312" r="3.5" fill={P.centerRed} />
        <line x1="110" y1="88" x2="290" y2="88" stroke="#26211c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="88" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="272" cy="88" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="200" cy="88" r="3.5" fill={P.centerRed} />

        {/* diagonal pocket arrows — the classic carrom marks */}
        {[
          { x1: 239, y1: 161, x2: 343, y2: 57 },
          { x1: 161, y1: 161, x2: 57, y2: 57 },
          { x1: 161, y1: 239, x2: 57, y2: 343 },
          { x1: 239, y1: 239, x2: 343, y2: 343 },
        ].map((a, i) => (
          <g key={i}>
            <line
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke={P.arrow}
              strokeWidth="2.5"
              markerEnd="url(#pocketArrow)"
            />
            <circle cx={a.x1} cy={a.y1} r="3.5" fill={P.arrow} />
          </g>
        ))}

        {/* pockets with depth + regulation red rings */}
        {POCKETS.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="21" fill="none" stroke="#b03030" strokeWidth="2.5" opacity="0.9" />
            <circle cx={p.x} cy={p.y} r="19" fill="none" stroke="#e8c47c" strokeWidth="1.5" opacity="0.7" />
            <circle cx={p.x} cy={p.y} r="16.5" fill="url(#pocketGrad)" />
            <circle cx={p.x} cy={p.y} r="16.5" fill="none" stroke="#000" strokeWidth="1.5" opacity="0.7" />
          </g>
        ))}
        {pocketFlash && (
          <circle
            key={`${pocketFlash.x}-${pocketFlash.y}-${Date.now()}`}
            cx={pocketFlash.x}
            cy={pocketFlash.y}
            r="16"
            className="pocket-flash"
          />
        )}

        {/* aim guide */}
        {aimTo && (
          <g className="aim" aria-hidden="true">
            <line x1={strikerX} y1="312" x2={aimTo.x} y2={aimTo.y} className="aim-line" />
            <circle cx={aimTo.x} cy={aimTo.y} r="15" className="aim-ring" />
          </g>
        )}

        {/* striker with classic rings */}
        <g className="striker" style={{ transform: `translate(${strikerX}px, 312px)` }}>
          <ellipse cx="0" cy="12" rx="13" ry="3.5" fill="#000" opacity="0.3" />
          <circle cx="0" cy="1.5" r="14" fill="#4a3018" opacity="0.8" />
          <circle cx="0" cy="0" r="14" fill={P.strikerBase} stroke="#5b3a16" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="10.5" fill="none" stroke="#b03030" strokeWidth="2" />
          <circle cx="0" cy="0" r="6" fill="none" stroke="#2e7d4f" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="1.8" fill="#b03030" />
          <circle cx="-4.5" cy="-5" r="2.6" fill="#fff" opacity="0.5" />
        </g>

        {/* coins */}
        {coins.map((c) => {
          if (c.state === 'pocketed' || c.id === animatingId) return null;
          const selected = c.id === activeCoinId;
          const isQueen = c.color === 'queen';
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
              filter={selected ? 'url(#glow)' : undefined}
            >
              <ellipse cx={c.pos.x} cy={c.pos.y + 3} rx="10.5" ry="3.6" fill="#3a2410" opacity="0.35" />
              {selected && <circle cx={c.pos.x} cy={c.pos.y} r="17" className="coin-halo" />}
              {/* flat printed carrom man: side wall + matte face + printed rings */}
              <circle cx={c.pos.x} cy={c.pos.y + 1.8} r={isQueen ? 12.5 : 11} fill={coinRim(c)} opacity="0.85" />
              <g filter="url(#soft)">
                <circle
                  cx={c.pos.x}
                  cy={c.pos.y}
                  r={isQueen ? 12.5 : 11}
                  fill={coinGradient(c)}
                  stroke={selected ? '#ffd54a' : coinRim(c)}
                  strokeWidth={selected ? 3 : 1.5}
                />
              </g>
              <circle
                cx={c.pos.x}
                cy={c.pos.y}
                r={isQueen ? 9 : 7.8}
                fill="none"
                stroke={coinPrint(c)}
                strokeWidth="1.6"
                opacity="0.95"
              />
              <circle
                cx={c.pos.x}
                cy={c.pos.y}
                r={isQueen ? 5 : 4}
                fill="none"
                stroke={coinPrint(c)}
                strokeWidth="1"
                opacity="0.7"
              />
              {isQueen ? (
                <text x={c.pos.x} y={c.pos.y + 4} textAnchor="middle" fontSize="9.5" fill="#fff" fontWeight="bold">
                  Q
                </text>
              ) : (
                <circle cx={c.pos.x} cy={c.pos.y} r="1.6" fill={coinPrint(c)} opacity="0.9" />
              )}
              {/* soft top sheen */}
              <path
                d={`M ${c.pos.x - 6} ${c.pos.y - 5} A 8 8 0 0 1 ${c.pos.x + 2} ${c.pos.y - 7.5}`}
                fill="none"
                stroke="#fff"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.35"
              />
            </g>
          );
        })}
      </svg>

      {/* pocket-flight overlay (HTML for smooth bezier motion) */}
      {pocketAnim && animPos && (
        <div
          className={`pocket-flyer ${pocketAnim.coin.color} ${pocketAnim.kind}`}
          style={{ left: `${(animPos.x / 400) * 100}%`, top: `${(animPos.y / 400) * 100}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
