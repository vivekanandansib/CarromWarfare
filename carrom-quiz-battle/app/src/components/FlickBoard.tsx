import type { CoinPos } from '../game/types';
import type { BoardPalette } from '../game/boardTheme';
import { PALETTES } from '../game/boardTheme';

export interface FlickCoin {
  id: string;
  color: 'white' | 'black' | 'queen';
  x: number;
  y: number;
}

export interface AimState {
  angleDeg: number; // 0 = right, -90 = up the board
  power: number; // 0..1
}

interface FlickBoardProps {
  coins: FlickCoin[];
  striker: { x: number; y: number } | null;
  aim: AimState | null;
  interactive: boolean;
  /** Explicit paint (theme switching without CSS-dependent SVG). Defaults to classic. */
  palette?: BoardPalette;
  onPointerDown: (pos: CoinPos) => void;
  onPointerMove: (pos: CoinPos) => void;
  onPointerEnd: () => void;
  onKeyShot: (kind: 'left' | 'right' | 'up' | 'down' | 'powerUp' | 'powerDown' | 'fire') => void;
}

export const POCKETS: CoinPos[] = [
  { x: 30, y: 30 },
  { x: 370, y: 30 },
  { x: 30, y: 370 },
  { x: 370, y: 370 },
];

function toLocal(e: React.PointerEvent<SVGSVGElement>): CoinPos {
  const r = e.currentTarget.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * 400,
    y: ((e.clientY - r.top) / r.height) * 400,
  };
}

export default function FlickBoard({
  coins,
  striker,
  aim,
  interactive,
  palette,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onKeyShot,
}: FlickBoardProps) {
  const P = palette ?? PALETTES.classic;
  const aimRad = aim ? (aim.angleDeg * Math.PI) / 180 : 0;
  const aimLen = aim ? 30 + aim.power * 120 : 0;
  const aimEnd = striker &&
    aim && {
      x: striker.x + Math.cos(aimRad) * aimLen,
      y: striker.y + Math.sin(aimRad) * aimLen,
    };

  return (
    <div className="board-wrap">
      <svg
        className="board"
        viewBox="0 0 400 400"
        role="group"
        aria-label="Carrom flick board. Drag the striker to aim and release to shoot. Keyboard: arrows slide and rotate, plus and minus set power, Enter fires."
        tabIndex={interactive ? 0 : -1}
        onPointerDown={(e) => {
          if (!interactive) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          onPointerDown(toLocal(e));
        }}
        onPointerMove={(e) => {
          if (!interactive) return;
          onPointerMove(toLocal(e));
        }}
        onPointerUp={() => interactive && onPointerEnd()}
        onPointerCancel={() => interactive && onPointerEnd()}
        onKeyDown={(e) => {
          if (!interactive) return;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onKeyShot('left');
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onKeyShot('right');
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onKeyShot('up');
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onKeyShot('down');
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onKeyShot('fire');
          } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            onKeyShot('powerUp');
          } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            onKeyShot('powerDown');
          }
        }}
      >
        <defs>
          <radialGradient id="fwood" cx="50%" cy="38%" r="78%">
            <stop offset="0%" stopColor={P.woodHi} />
            <stop offset="62%" stopColor={P.woodMid} />
            <stop offset="100%" stopColor={P.woodLo} />
          </radialGradient>
          <radialGradient id="fsurface" cx="50%" cy="46%" r="68%">
            <stop offset="0%" stopColor={P.feltHi} />
            <stop offset="100%" stopColor={P.feltLo} />
          </radialGradient>
          <radialGradient id="fcoinWhite" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#fffdf6" />
            <stop offset="55%" stopColor="#f3ead3" />
            <stop offset="100%" stopColor="#c9b183" />
          </radialGradient>
          <radialGradient id="fcoinBlack" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#6b5d4d" />
            <stop offset="55%" stopColor="#33291f" />
            <stop offset="100%" stopColor="#0f0b08" />
          </radialGradient>
          <radialGradient id="fcoinQueen" cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#ff8ba0" />
            <stop offset="55%" stopColor="#d7263d" />
            <stop offset="100%" stopColor="#7d1020" />
          </radialGradient>
          <linearGradient id="fmanWhite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbf5e6" />
            <stop offset="100%" stopColor="#e3d3ae" />
          </linearGradient>
          <linearGradient id="fmanBlack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#54432f" />
            <stop offset="100%" stopColor="#1d140d" />
          </linearGradient>
          <linearGradient id="fmanQueen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8546a" />
            <stop offset="100%" stopColor="#a31328" />
          </linearGradient>
          <marker id="fpocketArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={P.arrow} />
          </marker>
          <radialGradient id="fpocket" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="72%" stopColor="#120b06" />
            <stop offset="100%" stopColor="#3a2a18" />
          </radialGradient>
          <radialGradient id="fstriker" cx="38%" cy="30%" r="85%">
            <stop offset="0%" stopColor="#fffdf6" />
            <stop offset="60%" stopColor="#f0e2c4" />
            <stop offset="100%" stopColor="#b89b62" />
          </radialGradient>
          <filter id="fgrain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.12" numOctaves="2" result="n" />
            <feColorMatrix
              in="n"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0.6 0.6 0 0"
              result="a"
            />
            <feComposite operator="in" in="a" in2="SourceGraphic" result="c" />
            <feBlend in="SourceGraphic" in2="c" mode="multiply" />
          </filter>
          <filter id="fsoft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="1.6" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>

        <rect x="0" y="0" width="400" height="400" rx="26" fill="url(#fwood)" />
        <rect x="0" y="0" width="400" height="400" rx="26" fill={P.grainFrame} filter="url(#fgrain)" opacity="0.5" />
        <rect x="14" y="14" width="372" height="372" rx="18" fill="none" stroke="#3f2810" strokeWidth="5" />
        <rect x="34" y="34" width="332" height="332" rx="12" fill="url(#fsurface)" stroke="#5b3a16" strokeWidth="2" />
        <rect x="34" y="34" width="332" height="332" rx="12" fill={P.grainFelt} filter="url(#fgrain)" opacity="0.35" />

        {/* full diagonal foul lines, pocket to pocket, under everything */}
        <line x1="34" y1="34" x2="366" y2="366" stroke={P.diagonal} strokeWidth="2" opacity="0.45" />
        <line x1="366" y1="34" x2="34" y2="366" stroke={P.diagonal} strokeWidth="2" opacity="0.45" />

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

        <circle cx="200" cy="200" r="62" fill="none" stroke={P.designRing} strokeWidth="2" />
        <circle cx="200" cy="200" r="52" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="200" cy="200" r="22" fill="none" stroke={P.centerDark} strokeWidth="2" />
        <circle cx="200" cy="200" r="18" fill="none" stroke={P.centerRed} strokeWidth="1.5" />
        <circle cx="200" cy="200" r="14" fill={P.centerRed} />
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

        <line x1="110" y1="312" x2="290" y2="312" stroke="#26211c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="312" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="272" cy="312" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="200" cy="312" r="3.5" fill={P.centerRed} />
        <line x1="110" y1="88" x2="290" y2="88" stroke="#26211c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="88" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />
        <circle cx="272" cy="88" r="9" fill="none" stroke={P.centerRed} strokeWidth="2.5" />

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
              markerEnd="url(#fpocketArrow)"
            />
            <circle cx={a.x1} cy={a.y1} r="3.5" fill={P.arrow} />
          </g>
        ))}

        {POCKETS.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="21" fill="none" stroke="#b03030" strokeWidth="2.5" opacity="0.9" />
            <circle cx={p.x} cy={p.y} r="19" fill="none" stroke="#e8c47c" strokeWidth="1.5" opacity="0.7" />
            <circle cx={p.x} cy={p.y} r="16.5" fill="url(#fpocket)" />
          </g>
        ))}

        {/* aim guide */}
        {striker && aim && aimEnd && (
          <g className="aim" aria-hidden="true">
            <line x1={striker.x} y1={striker.y} x2={aimEnd.x} y2={aimEnd.y} className="aim-line" />
            <circle cx={aimEnd.x} cy={aimEnd.y} r="9" className="aim-ring" />
          </g>
        )}

        {/* coins: flat printed carrom men */}
        {coins.map((c) => {
          const face = c.color === 'queen' ? 'url(#fmanQueen)' : c.color === 'white' ? 'url(#fmanWhite)' : 'url(#fmanBlack)';
          const rim = c.color === 'queen' ? '#7d1020' : c.color === 'white' ? '#8a6f45' : '#0a0705';
          const print = c.color === 'queen' ? '#ffe3e8' : c.color === 'white' ? '#b03030' : '#d8c49a';
          const r = c.color === 'queen' ? 12.5 : 11;
          return (
            <g key={c.id}>
              <ellipse cx={c.x} cy={c.y + 3} rx="10.5" ry="3.6" fill="#3a2410" opacity="0.35" />
              <circle cx={c.x} cy={c.y + 1.8} r={r} fill={rim} opacity="0.85" />
              <g filter="url(#fsoft)">
                <circle cx={c.x} cy={c.y} r={r} fill={face} stroke={rim} strokeWidth={1.5} />
              </g>
              <circle cx={c.x} cy={c.y} r={r - 3.2} fill="none" stroke={print} strokeWidth="1.6" opacity="0.95" />
              <circle cx={c.x} cy={c.y} r={r - 6.5} fill="none" stroke={print} strokeWidth="1" opacity="0.7" />
              {c.color === 'queen' ? (
                <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="9.5" fill="#fff" fontWeight="bold">
                  Q
                </text>
              ) : (
                <circle cx={c.x} cy={c.y} r="1.6" fill={print} opacity="0.9" />
              )}
              <path
                d={`M ${c.x - 6} ${c.y - 5} A 8 8 0 0 1 ${c.x + 2} ${c.y - 7.5}`}
                fill="none"
                stroke="#fff"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.35"
              />
            </g>
          );
        })}

        {/* striker with classic rings */}
        {striker && (
          <g className="striker">
            <ellipse cx={striker.x} cy={striker.y + 12} rx="13" ry="3.5" fill="#000" opacity="0.3" />
            <circle cx={striker.x} cy={striker.y + 1.5} r="14" fill="#4a3018" opacity="0.8" />
            <circle cx={striker.x} cy={striker.y} r="14" fill={P.strikerBase} stroke="#5b3a16" strokeWidth="1.5" />
            <circle cx={striker.x} cy={striker.y} r="10.5" fill="none" stroke="#b03030" strokeWidth="2" />
            <circle cx={striker.x} cy={striker.y} r="6" fill="none" stroke="#2e7d4f" strokeWidth="1.5" />
            <circle cx={striker.x} cy={striker.y} r="1.8" fill="#b03030" />
            <circle cx={striker.x - 4.5} cy={striker.y - 5} r="2.6" fill="#fff" opacity="0.5" />
          </g>
        )}

        {/* power meter */}
        {striker && aim && (
          <g aria-hidden="true">
            <rect x={striker.x - 22} y={striker.y + 20} width="44" height="6" rx="3" fill="#000" opacity="0.45" />
            <rect
              x={striker.x - 22}
              y={striker.y + 20}
              width={44 * aim.power}
              height="6"
              rx="3"
              fill={aim.power > 0.8 ? '#d7263d' : aim.power > 0.5 ? '#ffd54a' : '#7ddf9a'}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
