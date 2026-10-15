import type { CoinPos } from '../game/types';

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
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onKeyShot,
}: FlickBoardProps) {
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
            <stop offset="0%" className="wood-hi" />
            <stop offset="62%" className="wood-mid" />
            <stop offset="100%" className="wood-lo" />
          </radialGradient>
          <radialGradient id="fsurface" cx="50%" cy="46%" r="68%">
            <stop offset="0%" className="felt-hi" />
            <stop offset="100%" className="felt-lo" />
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
        <rect x="0" y="0" width="400" height="400" rx="26" fill="#7c4f22" filter="url(#fgrain)" opacity="0.5" />
        <rect x="14" y="14" width="372" height="372" rx="18" fill="none" stroke="#3f2810" strokeWidth="5" />
        <rect x="34" y="34" width="332" height="332" rx="12" fill="url(#fsurface)" stroke="#5b3a16" strokeWidth="2" />
        <rect x="34" y="34" width="332" height="332" rx="12" fill="#dfb26e" filter="url(#fgrain)" opacity="0.35" />

        <circle cx="200" cy="200" r="62" fill="none" className="design-ring" strokeWidth="2" />
        <circle cx="200" cy="200" r="52" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <circle cx="200" cy="200" r="14" fill="#b03030" />

        <line x1="110" y1="312" x2="290" y2="312" stroke="#26211c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="312" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <circle cx="272" cy="312" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <line x1="110" y1="88" x2="290" y2="88" stroke="#26211c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="88" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />
        <circle cx="272" cy="88" r="9" fill="none" stroke="#b03030" strokeWidth="2.5" />

        {POCKETS.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="19" fill="none" stroke="#e8c47c" strokeWidth="2.5" opacity="0.85" />
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

        {/* coins */}
        {coins.map((c) => (
          <g key={c.id} filter="url(#fsoft)">
            <ellipse cx={c.x} cy={c.y + 3} rx="10.5" ry="3.6" fill="#3a2410" opacity="0.35" />
            <circle
              cx={c.x}
              cy={c.y}
              r={c.color === 'queen' ? 12.5 : 11}
              fill={
                c.color === 'queen'
                  ? 'url(#fcoinQueen)'
                  : c.color === 'white'
                    ? 'url(#fcoinWhite)'
                    : 'url(#fcoinBlack)'
              }
              stroke={c.color === 'queen' ? '#ffd9de' : '#4a3018'}
              strokeWidth={1.5}
            />
            {c.color === 'queen' ? (
              <text x={c.x} y={c.y + 5} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold">
                Q
              </text>
            ) : (
              <circle cx={c.x} cy={c.y} r="1.8" fill={c.color === 'black' ? '#6b5d4d' : '#fff'} opacity="0.9" />
            )}
          </g>
        ))}

        {/* striker */}
        {striker && (
          <g className="striker">
            <ellipse cx={striker.x} cy={striker.y + 12} rx="13" ry="3.5" fill="#000" opacity="0.3" />
            <circle cx={striker.x} cy={striker.y} r="14" fill="url(#fstriker)" stroke="#b03030" strokeWidth="3" />
            <circle cx={striker.x - 4.5} cy={striker.y - 5} r="3.2" fill="#fff" opacity="0.8" />
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
