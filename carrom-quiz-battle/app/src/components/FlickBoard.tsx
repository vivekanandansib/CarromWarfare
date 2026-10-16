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
  /** Player-2 perspective: board drawn rotated 180°, pointer mapped back. */
  rotated?: boolean;
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

const SERIF = "Cinzel, Marcellus, Georgia, 'Times New Roman', serif";

function toLocal(e: React.PointerEvent<SVGSVGElement>, rotated: boolean): CoinPos {
  const r = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 400;
  const y = ((e.clientY - r.top) / r.height) * 400;
  return rotated ? { x: 400 - x, y: 400 - y } : { x, y };
}

/** Small gold crown, centered on (0,0), ~18 wide. */
function Crown({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path
        d="M -9 7 L -9 -3 L -4.5 1.5 L 0 -8 L 4.5 1.5 L 9 -3 L 9 7 Z"
        fill="#F8D477"
        stroke="#8E5A20"
        strokeWidth="1"
      />
      <rect x="-9" y="7" width="18" height="3" rx="1" fill="#A51D2A" />
      <circle cx="0" cy="-8" r="1.4" fill="#F8D477" />
      <circle cx="-9" cy="-3" r="1.2" fill="#F8D477" />
      <circle cx="9" cy="-3" r="1.2" fill="#F8D477" />
    </g>
  );
}

function Diamond({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      d={`M ${x} ${y - 6 * s} L ${x + 4.5 * s} ${y} L ${x} ${y + 6 * s} L ${x - 4.5 * s} ${y} Z`}
      fill="#A51D2A"
      stroke="#D9A441"
      strokeWidth="1"
    />
  );
}

function CoinFace({ c }: { c: FlickCoin }) {
  if (c.color === 'queen') {
    return (
      <g>
        <circle cx={c.x} cy={c.y + 1.8} r={12.5} fill="#5f0a12" opacity="0.9" />
        <circle cx={c.x} cy={c.y} r={12.5} fill="#B71926" stroke="#D9A441" strokeWidth="1.5" />
        <circle cx={c.x} cy={c.y} r={9.5} fill="none" stroke="#7d0f1a" strokeWidth="1.4" />
        <circle cx={c.x} cy={c.y} r={6.5} fill="none" stroke="#e8546a" strokeWidth="1" opacity="0.9" />
        <circle cx={c.x} cy={c.y} r="14" fill="none" stroke="#5f0a12" strokeWidth="1" />
        <path
          d={`M ${c.x - 6} ${c.y - 5} A 8 8 0 0 1 ${c.x + 2} ${c.y - 7.5}`}
          fill="none"
          stroke="#ffb3bd"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    );
  }
  const base = c.color === 'white' ? ['#F7DEB2', '#EAD3A8', '#B9854F'] : ['#4a3a28', '#241a10', '#0d0906'];
  const ring = c.color === 'white' ? '#D9A441' : '#D9A441';
  const dot = c.color === 'white' ? '#8E5A20' : '#F8D477';
  return (
    <g>
      <ellipse cx={c.x} cy={c.y + 3} rx="10.5" ry="3.6" fill="#3a2410" opacity="0.35" />
      <circle cx={c.x} cy={c.y + 1.8} r={11} fill={base[2]} opacity="0.9" />
      <circle cx={c.x} cy={c.y} r={11} fill={base[0]} stroke={base[2]} strokeWidth="1.5" />
      <circle cx={c.x} cy={c.y} r={11} fill="url(#coinSheen)" />
      <circle cx={c.x} cy={c.y} r={7.6} fill="none" stroke={ring} strokeWidth="1.3" opacity="0.95" />
      <circle cx={c.x} cy={c.y} r={4.6} fill="none" stroke={ring} strokeWidth="0.8" opacity="0.7" />
      <circle cx={c.x} cy={c.y} r="1.6" fill={dot} />
      <path
        d={`M ${c.x - 6} ${c.y - 5.5} A 8 8 0 0 1 ${c.x + 1} ${c.y - 7.6}`}
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </g>
  );
}

export default function FlickBoard({
  coins,
  striker,
  aim,
  interactive,
  rotated,
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
    <div className={`board-wrap${rotated ? ' rotated' : ''}`}>
      <svg
        className="board"
        viewBox="0 0 400 400"
        role="group"
        aria-label="Modern Kingdom carrom board. Drag the striker to aim and release to shoot. Keyboard: arrows slide and rotate, plus and minus set power, Enter fires."
        tabIndex={interactive ? 0 : -1}
        onPointerDown={(e) => {
          if (!interactive) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          onPointerDown(toLocal(e, !!rotated));
        }}
        onPointerMove={(e) => {
          if (!interactive) return;
          onPointerMove(toLocal(e, !!rotated));
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
          {/* ebony frame */}
          <linearGradient id="kframe" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2b2019" />
            <stop offset="45%" stopColor="#17110D" />
            <stop offset="100%" stopColor="#0b0806" />
          </linearGradient>
          {/* honey maple surface */}
          <radialGradient id="ksurface" cx="50%" cy="44%" r="72%">
            <stop offset="0%" stopColor="#F7DEB2" />
            <stop offset="60%" stopColor="#EBCB99" />
            <stop offset="100%" stopColor="#B9854F" />
          </radialGradient>
          <linearGradient id="kgold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8D477" />
            <stop offset="55%" stopColor="#D9A441" />
            <stop offset="100%" stopColor="#8E5A20" />
          </linearGradient>
          <radialGradient id="kpocket" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="70%" stopColor="#0d0906" />
            <stop offset="100%" stopColor="#4A2C16" />
          </radialGradient>
          <radialGradient id="coinSheen" cx="36%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <filter id="kgrain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8 0.1" numOctaves="2" result="n" />
            <feColorMatrix
              in="n"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.5 0.5 0.5 0 0"
              result="a"
            />
            <feComposite operator="in" in="a" in2="SourceGraphic" result="c" />
            <feBlend in="SourceGraphic" in2="c" mode="multiply" />
          </filter>
          <filter id="ksoft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="1.6" floodColor="#000" floodOpacity="0.45" />
          </filter>
          <marker
            id="karrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#241910" />
          </marker>
        </defs>

        {/* L1 background tabletop */}
        <rect x="0" y="0" width="400" height="400" rx="26" fill="#050304" />

        {/* L2 outer ebony frame */}
        <rect x="2" y="2" width="396" height="396" rx="24" fill="url(#kframe)" />
        <rect x="2" y="2" width="396" height="396" rx="24" fill="none" stroke="url(#kgold)" strokeWidth="2" />
        <rect x="7" y="7" width="386" height="386" rx="21" fill="none" stroke="#8E5A20" strokeWidth="1" opacity="0.8" />

        {/* burgundy corner beds under the pockets */}
        {[
          [4, 4],
          [348, 4],
          [4, 348],
          [348, 348],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="48" height="48" rx="6" fill="#780E19" stroke="url(#kgold)" strokeWidth="1.5" />
            <Diamond x={x + 10} y={y + 10} s={0.8} />
            <Diamond x={x + 38} y={y + 38} s={0.8} />
          </g>
        ))}

        {/* side burgundy panels with gold + diamond */}
        {[104, 296].map((y) => (
          <g key={`l${y}`}>
            <rect x="9" y={y - 34} width="16" height="68" rx="4" fill="#780E19" stroke="url(#kgold)" strokeWidth="1.2" />
            <line x1="12.5" y1={y - 30} x2="12.5" y2={y + 30} stroke="#D9A441" strokeWidth="0.8" />
            <line x1="21.5" y1={y - 30} x2="21.5" y2={y + 30} stroke="#D9A441" strokeWidth="0.8" />
            <Diamond x={17} y={y} s={1} />
            <circle cx={17} cy={y - 24} r="1.4" fill="#D9A441" />
            <circle cx={17} cy={y + 24} r="1.4" fill="#D9A441" />
          </g>
        ))}
        {[104, 296].map((y) => (
          <g key={`r${y}`}>
            <rect x="375" y={y - 34} width="16" height="68" rx="4" fill="#780E19" stroke="url(#kgold)" strokeWidth="1.2" />
            <line x1="378.5" y1={y - 30} x2="378.5" y2={y + 30} stroke="#D9A441" strokeWidth="0.8" />
            <line x1="387.5" y1={y - 30} x2="387.5" y2={y + 30} stroke="#D9A441" strokeWidth="0.8" />
            <Diamond x={383} y={y} s={1} />
            <circle cx={383} cy={y - 24} r="1.4" fill="#D9A441" />
            <circle cx={383} cy={y + 24} r="1.4" fill="#D9A441" />
          </g>
        ))}

        {/* top plaque */}
        <g>
          <rect x="100" y="7" width="200" height="21" rx="4" fill="#0d0906" stroke="url(#kgold)" strokeWidth="1.2" />
          <rect x="100" y="7" width="14" height="21" fill="#780E19" opacity="0.9" />
          <rect x="286" y="7" width="14" height="21" fill="#780E19" opacity="0.9" />
          <line x1="120" y1="11.5" x2="280" y2="11.5" stroke="#8E5A20" strokeWidth="0.8" />
          <line x1="120" y1="23.5" x2="280" y2="23.5" stroke="#8E5A20" strokeWidth="0.8" />
          <Diamond x={112} y={17.5} s={0.8} />
          <Diamond x={288} y={17.5} s={0.8} />
          <Crown x={200} y={9} s={0.62} />
          <text
            x="200"
            y="22.5"
            textAnchor="middle"
            fontSize="10"
            letterSpacing="2.5"
            fill="#F8D477"
            fontFamily={SERIF}
            fontWeight="bold"
          >
            MODERN KINGDOM
          </text>
        </g>

        {/* bottom plaque */}
        <g>
          <rect x="96" y="372" width="208" height="21" rx="4" fill="#0d0906" stroke="url(#kgold)" strokeWidth="1.2" />
          <line x1="112" y1="376" x2="180" y2="376" stroke="#8E5A20" strokeWidth="0.8" />
          <line x1="220" y1="376" x2="288" y2="376" stroke="#8E5A20" strokeWidth="0.8" />
          <Diamond x={104} y={382.5} s={0.8} />
          <Diamond x={296} y={382.5} s={0.8} />
          <Crown x={200} y={372.5} s={0.55} />
          <text
            x="200"
            y="388.5"
            textAnchor="middle"
            fontSize="8"
            letterSpacing="1.8"
            fill="#F8D477"
            fontFamily={SERIF}
            fontWeight="bold"
          >
            PLAY ✦ STRATEGIZE ✦ RULE
          </text>
        </g>

        {/* L3 honey maple surface with grain + edge shade */}
        <rect x="34" y="34" width="332" height="332" rx="8" fill="url(#ksurface)" />
        <rect x="34" y="34" width="332" height="332" rx="8" fill="#D9AD73" filter="url(#kgrain)" opacity="0.3" />
        <rect
          x="34"
          y="34"
          width="332"
          height="332"
          rx="8"
          fill="none"
          stroke="#B9854F"
          strokeWidth="5"
          opacity="0.55"
        />
        <rect x="34" y="34" width="332" height="332" rx="8" fill="none" stroke="#241910" strokeWidth="1.5" />

        {/* L4 field geometry: nested rectangles + burgundy markers */}
        <g>
          <rect x="72" y="80" width="256" height="232" fill="none" stroke="#241910" strokeWidth="2.5" />
          <rect x="86" y="88" width="228" height="216" fill="none" stroke="#241910" strokeWidth="2" />
          {[
            [72, 80],
            [328, 80],
            [72, 312],
            [328, 312],
            [72, 150],
            [72, 262],
            [328, 150],
            [328, 262],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="7.5" fill="none" stroke="#D9A441" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="5.8" fill="none" stroke="#241910" strokeWidth="1.2" />
              <circle cx={x} cy={y} r="4.4" fill="#780E19" />
            </g>
          ))}
        </g>

        {/* diagonal shooting lines with black arrowheads */}
        {[
          { x1: 72, y1: 80, x2: 40, y2: 48 },
          { x1: 328, y1: 80, x2: 360, y2: 48 },
          { x1: 72, y1: 312, x2: 40, y2: 344 },
          { x1: 328, y1: 312, x2: 360, y2: 344 },
        ].map((a, i) => (
          <line
            key={i}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke="#241910"
            strokeWidth="2.5"
            markerEnd="url(#karrow)"
          />
        ))}

        {/* curved rotational arrows per corner */}
        {[
          'M 62 118 A 46 46 0 0 1 108 66',
          'M 338 118 A 46 46 0 0 0 292 66',
          'M 62 282 A 46 46 0 0 0 108 334',
          'M 338 282 A 46 46 0 0 1 292 334',
        ].map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke="#241910" strokeWidth="2" markerEnd="url(#karrow)" />
          </g>
        ))}

        {/* cardinal ornaments N/S/E/W */}
        <g>
          <path d="M 200 46 L 206 62 L 200 78 L 194 62 Z" fill="#780E19" stroke="#D9A441" strokeWidth="1" />
          <Diamond x={200} y={86} s={0.9} />
          <path d="M 200 354 L 206 338 L 200 322 L 194 338 Z" fill="#780E19" stroke="#D9A441" strokeWidth="1" />
          <Diamond x={200} y={314} s={0.9} />
          <path d="M 46 200 L 62 194 L 78 200 L 62 206 Z" fill="#780E19" stroke="#D9A441" strokeWidth="1" />
          <Diamond x={86} y={200} s={0.9} />
          <path d="M 354 200 L 338 194 L 322 200 L 338 206 Z" fill="#780E19" stroke="#D9A441" strokeWidth="1" />
          <Diamond x={314} y={200} s={0.9} />
        </g>

        {/* baselines with end circles */}
        <line x1="110" y1="312" x2="290" y2="312" stroke="#241910" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="312" r="9" fill="none" stroke="#780E19" strokeWidth="2.5" />
        <circle cx="272" cy="312" r="9" fill="none" stroke="#780E19" strokeWidth="2.5" />
        <circle cx="200" cy="312" r="3.5" fill="#780E19" />
        <line x1="110" y1="88" x2="290" y2="88" stroke="#241910" strokeWidth="3" strokeLinecap="round" />
        <circle cx="128" cy="88" r="9" fill="none" stroke="#780E19" strokeWidth="2.5" />
        <circle cx="272" cy="88" r="9" fill="none" stroke="#780E19" strokeWidth="2.5" />
        <circle cx="200" cy="88" r="3.5" fill="#780E19" />

        {/* L5 compass rose */}
        <g>
          <circle cx="200" cy="200" r="56" fill="none" stroke="#D9A441" strokeWidth="2.5" />
          <circle cx="200" cy="200" r="52" fill="#780E19" />
          <circle cx="200" cy="200" r="52" fill="none" stroke="#F8D477" strokeWidth="0.8" opacity="0.7" />
          <circle cx="200" cy="200" r="45" fill="none" stroke="#17110D" strokeWidth="2" />
          <circle cx="200" cy="200" r="43" fill="none" stroke="#F2DCC0" strokeWidth="1.2" opacity="0.9" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const major = i % 2 === 0;
            const len = major ? 40 : 30;
            const w = major ? 9 : 7;
            const a = ((deg - 90) * Math.PI) / 180;
            const tip = { x: 200 + len * Math.cos(a), y: 200 + len * Math.sin(a) };
            const pa = a + Math.PI / 2;
            const b1 = { x: 200 + w * Math.cos(pa), y: 200 + w * Math.sin(pa) };
            const b2 = { x: 200 - w * Math.cos(pa), y: 200 - w * Math.sin(pa) };
            return (
              <polygon
                key={i}
                points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`}
                fill={major ? '#17110D' : '#A51D2A'}
                stroke="#D9A441"
                strokeWidth="1"
              />
            );
          })}
          {/* ivory accent ticks between points */}
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg, i) => {
            const a = ((deg - 90) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={200 + 20 * Math.cos(a)}
                y1={200 + 20 * Math.sin(a)}
                x2={200 + 26 * Math.cos(a)}
                y2={200 + 26 * Math.sin(a)}
                stroke="#F2DCC0"
                strokeWidth="1.2"
              />
            );
          })}
          {/* inner medallion */}
          <circle cx="200" cy="200" r="16" fill="#17110D" />
          <circle cx="200" cy="200" r="16" fill="none" stroke="#D9A441" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="11" fill="none" stroke="#F2DCC0" strokeWidth="1" opacity="0.8" />
        </g>

        {/* L4 pockets: brown wall, stacked gold rims, black depth */}
        {POCKETS.map((p, i) => (
          <g key={i} filter="url(#ksoft)">
            <circle cx={p.x} cy={p.y} r="22" fill="none" stroke="#8E5A20" strokeWidth="3" />
            <circle cx={p.x} cy={p.y} r="19.5" fill="none" stroke="#D9A441" strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="17.5" fill="none" stroke="#F8D477" strokeWidth="1" opacity="0.9" />
            <circle cx={p.x} cy={p.y} r="16" fill="#4A2C16" />
            <circle cx={p.x} cy={p.y} r="14.5" fill="url(#kpocket)" />
            <ellipse cx={p.x} cy={p.y + 12} rx="16" ry="4" fill="#000" opacity="0.45" />
          </g>
        ))}

        {/* aim guide */}
        {striker && aim && aimEnd && (
          <g className="aim" aria-hidden="true">
            <line x1={striker.x} y1={striker.y} x2={aimEnd.x} y2={aimEnd.y} className="aim-line" />
            <circle cx={aimEnd.x} cy={aimEnd.y} r="9" className="aim-ring" />
          </g>
        )}

        {/* L6 playing pieces */}
        {coins.map((c) => (
          <g key={c.id} filter="url(#ksoft)">
            <CoinFace c={c} />
          </g>
        ))}

        {/* L7 royal striker medallion */}
        {striker && (
          <g className="striker">
            <ellipse cx={striker.x} cy={striker.y + 12} rx="14" ry="4" fill="#000" opacity="0.4" />
            <circle cx={striker.x} cy={striker.y} r="15" fill="#17130F" stroke="#8E5A20" strokeWidth="2" />
            <circle cx={striker.x} cy={striker.y} r="12.5" fill="none" stroke="#D9A441" strokeWidth="1.2" />
            <circle cx={striker.x} cy={striker.y} r="10" fill="none" stroke="#A51D2A" strokeWidth="2" />
            <circle cx={striker.x} cy={striker.y} r="7" fill="none" stroke="#D9A441" strokeWidth="1" />
            <Crown x={striker.x} y={striker.y - 1} s={0.62} />
          </g>
        )}

        {/* power meter */}
        {striker && aim && (
          <g aria-hidden="true">
            <rect x={striker.x - 22} y={striker.y + 22} width="44" height="6" rx="3" fill="#000" opacity="0.45" />
            <rect
              x={striker.x - 22}
              y={striker.y + 22}
              width={44 * aim.power}
              height="6"
              rx="3"
              fill={aim.power > 0.8 ? '#A51D2A' : aim.power > 0.5 ? '#D9A441' : '#7ddf9a'}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
