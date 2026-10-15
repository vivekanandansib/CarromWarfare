import { useEffect, useRef, useState } from 'react';
import FlickBoard, { type AimState } from './FlickBoard';
import { nearestPocket } from './Board';
import { Confetti, FxLayer, PlayerPanel, QueenBadge, Toast } from './Panels';
import type { Burst, Floater } from './Panels';
import { createClassic, resolveShot, type ClassicState } from '../game/classic';
import { initialCoinLayout, makeId } from '../game/engine';
import {
  allSettled,
  BASELINE_MAX_X,
  BASELINE_MIN_X,
  BASELINE_Y,
  COIN_R,
  dragToVelocity,
  QUEEN_R,
  stepBodies,
  STRIKER_R,
  type Body,
  type Vec,
} from '../game/physics';
import { sound } from '../game/sound';
import type { CoinPos, PlayerNumber } from '../game/types';

export interface ClassicShotInfo {
  shooter: PlayerNumber;
  pocketedNow: string[];
  points: number;
  foul: boolean;
  queenEvent: string;
}

export interface ClassicSink {
  onSessionStart?: (state: ClassicState) => void;
  onShot?: (state: ClassicState, info: ClassicShotInfo) => void;
}

interface ClassicModeProps {
  playerNames: [string, string];
  targetScore: number;
  clockSecs: number;
  sink?: ClassicSink;
  onExit: () => void;
}

function coinBodies(): Body[] {
  return initialCoinLayout().map((c) => ({
    id: c.id,
    pos: { ...c.pos },
    vel: { x: 0, y: 0 },
    radius: c.color === 'queen' ? QUEEN_R : COIN_R,
  }));
}

function freshStriker(x: number): Body {
  return {
    id: 'S',
    pos: { x, y: BASELINE_Y },
    vel: { x: 0, y: 0 },
    radius: STRIKER_R,
  };
}

const clampStrikerX = (x: number) => Math.min(BASELINE_MAX_X, Math.max(BASELINE_MIN_X, x));

export default function ClassicMode({ playerNames, targetScore, clockSecs, sink, onExit }: ClassicModeProps) {
  const [rules, setRules] = useState<ClassicState>(() =>
    createClassic(makeId('sess'), playerNames, targetScore),
  );
  const [bodies, setBodies] = useState<Body[]>(() => [...coinBodies(), freshStriker(200)]);
  const [phase, setPhase] = useState<'aim' | 'rolling'>('aim');
  const [aim, setAim] = useState<AimState>({ angleDeg: -90, power: 0.45 });
  const [toast, setToast] = useState<{ msg: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [paused, setPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(clockSecs);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);

  const simRef = useRef<Body[]>([]);
  const capturedRef = useRef<{ id: string; at: Vec }[]>([]);
  const dragRef = useRef<{ ax: number; ay: number } | null>(null);
  const aimRef = useRef<AimState>({ angleDeg: -90, power: 0.45 });
  const rulesRef = useRef(rules);
  const strikerXRef = useRef(200);
  const toastTimer = useRef<number>(0);
  const expiredRef = useRef(false);
  const fxId = useRef(0);
  const sinkRef = useRef(sink);
  sinkRef.current = sink;

  // keep sim in sync while aiming (fresh reference each new game/turn reset does it)
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  useEffect(() => {
    aimRef.current = aim;
  }, [aim]);

  useEffect(() => {
    sinkRef.current?.onSessionStart?.(rulesRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string, tone: 'good' | 'bad' | 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  const spawnBurst = (x: number, y: number) => {
    const id = ++fxId.current;
    setBursts((b) => [...b, { id, x, y }]);
    window.setTimeout(() => setBursts((b) => b.filter((s) => s.id !== id)), 700);
  };

  const spawnFloater = (text: string, x: number, y: number, bonus = false) => {
    const id = ++fxId.current;
    setFloaters((f) => [...f, { id, text, x, y, bonus }]);
    window.setTimeout(() => setFloaters((f) => f.filter((s) => s.id !== id)), 1350);
  };

  // ---- clock ----
  useEffect(() => {
    setTimeLeft(clockSecs);
    expiredRef.current = false;
  }, [rules.currentPlayer, rules.finished, clockSecs]);

  useEffect(() => {
    if (paused || phase !== 'aim' || rules.finished) return;
    if (timeLeft <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        sound.wrong();
        const res = resolveShot(rulesRef.current, []);
        setRules(res.state);
        sinkRef.current?.onShot?.(res.state, {
          shooter: res.state.currentPlayer === 1 ? 2 : 1,
          pocketedNow: [],
          points: 0,
          foul: false,
          queenEvent: res.queenEvent,
        });
        const nextName = res.state.playerNames[res.state.currentPlayer - 1];
        flash(`Time! Turn passes to ${nextName}.`, 'bad');
      }
      return;
    }
    if (timeLeft <= 5) sound.tick();
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  });

  // ---- physics loop ----
  useEffect(() => {
    if (phase !== 'rolling') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const ev = stepBodies(simRef.current, 'S', dt);
      for (const id of ev.pocketed) {
        if (!capturedRef.current.some((c) => c.id === id)) {
          const b = simRef.current.find((x) => x.id === id);
          capturedRef.current.push({ id, at: { x: b?.pos.x ?? 200, y: b?.pos.y ?? 200 } });
        }
      }
      if (ev.clicks > 0) sound.click();
      if (ev.cushions > 0) sound.thud();
      const gone = new Set(ev.pocketed);
      simRef.current = simRef.current.filter((b) => !gone.has(b.id));
      setBodies(simRef.current.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
      if (allSettled(simRef.current)) {
        settleShot();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const settleShot = () => {
    const captured = capturedRef.current;
    const ids = captured.map((c) => c.id);
    const shooter = rulesRef.current.currentPlayer;
    const res = resolveShot(rulesRef.current, ids);
    setRules(res.state);
    // fx per pocketed coin
    for (const c of captured) {
      if (c.id === 'S') continue;
      const pk = nearestPocket(c.at);
      spawnBurst(pk.x, pk.y);
    }
    if (res.points > 0) {
      const at = captured.length > 0 ? nearestPocket(captured[0].at) : { x: 200, y: 200 };
      spawnFloater(`+${res.points}`, at.x, at.y - 24, res.points > 10);
      sound.rattle();
    }
    if (res.foul) {
      sound.wrong();
      flash(`Foul — striker pocketed! Turn passes to ${res.state.playerNames[res.state.currentPlayer - 1]}.`, 'bad');
    } else if (res.queenEvent === 'secured') {
      sound.queen();
      flash(`Queen secured! +${res.points} pts — you play again.`, 'good');
    } else if (res.queenEvent === 'pending') {
      flash('Queen pocketed! Cover her with your next shot.', 'info');
    } else if (res.queenEvent === 'returned') {
      flash('Queen returns! Turn passes.', 'bad');
    } else if (res.points > 0) {
      flash(`Pocketed! +${res.points} pts — you play again.`, 'good');
    } else {
      const nextName = res.state.playerNames[res.state.currentPlayer - 1];
      flash(`Nothing down — turn passes to ${nextName}.`, 'bad');
    }
    if (res.state.finished) sound.win();
    sinkRef.current?.onShot?.(res.state, {
      shooter,
      pocketedNow: res.pocketedNow,
      points: res.points,
      foul: res.foul,
      queenEvent: res.queenEvent,
    });
    // reconcile visuals: queen back if returned; fresh striker; start next aim
    const keep = simRef.current.filter((b) => b.id !== 'S' && b.id !== 'Q');
    if (res.state.queen === 'available' && !keep.some((b) => b.id === 'Q')) {
      keep.push({ id: 'Q', pos: { x: 200, y: 200 }, vel: { x: 0, y: 0 }, radius: QUEEN_R });
    }
    keep.push(freshStriker(strikerXRef.current));
    simRef.current = keep;
    setBodies(keep.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
    setAim({ angleDeg: -90, power: 0.45 });
    if (!res.state.finished) setPhase('aim');
  };

  // ---- aiming ----
  const fireDrag = (drag: Vec) => {
    const s = simRef.current.find((b) => b.id === 'S');
    if (!s || phase !== 'aim' || paused) return;
    const v = dragToVelocity(drag);
    if (Math.hypot(v.x, v.y) < 60) return; // too soft — ignore
    s.vel = v;
    capturedRef.current = [];
    sound.strike();
    setPhase('rolling');
  };

  const handlePointerDown = (pos: CoinPos) => {
    if (phase !== 'aim' || paused) return;
    const s = simRef.current.find((b) => b.id === 'S');
    if (!s) syncSim();
    const cur = (simRef.current.find((b) => b.id === 'S') ?? { pos: { x: strikerXRef.current, y: 312 } }).pos;
    if (Math.hypot(pos.x - cur.x, pos.y - cur.y) < 34) {
      dragRef.current = { ax: pos.x, ay: pos.y };
    } else if (pos.y > 240) {
      strikerXRef.current = clampStrikerX(pos.x);
      const st = simRef.current.find((b) => b.id === 'S');
      if (st) {
        st.pos.x = strikerXRef.current;
        st.pos.y = 312;
        setBodies(simRef.current.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
      }
    }
  };

  const handlePointerMove = (pos: CoinPos) => {
    const a = dragRef.current;
    if (!a) return;
    const dx = pos.x - a.ax;
    const dy = pos.y - a.ay;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const ang = (Math.atan2(-dy, -dx) * 180) / Math.PI;
    setAim({ angleDeg: ang, power: Math.min(1, len / 140) });
  };

  const handlePointerEnd = () => {
    const had = dragRef.current !== null;
    dragRef.current = null;
    if (!had) return;
    fireDrag(vecFromAim(aimRef.current));
  };

  const vecFromAim = (am: AimState): Vec => {
    const rad = (am.angleDeg * Math.PI) / 180;
    const len = am.power * 140;
    return { x: -Math.cos(rad) * len, y: -Math.sin(rad) * len };
  };

  const handleKeyShot = (kind: 'left' | 'right' | 'up' | 'down' | 'powerUp' | 'powerDown' | 'fire') => {
    if (phase !== 'aim' || paused) return;
    if (kind === 'fire') {
      fireDrag(vecFromAim(aimRef.current));
      return;
    }
    if (kind === 'left' || kind === 'right') {
      // ArrowLeft/Right slide the striker along the baseline
      const d = kind === 'left' ? -8 : 8;
      strikerXRef.current = clampStrikerX(strikerXRef.current + d);
      const st = simRef.current.find((b) => b.id === 'S');
      if (st) {
        st.pos.x = strikerXRef.current;
        setBodies(simRef.current.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
      }
      return;
    }
    // Up/Down rotate the aim; +/- change power
    setAim((a) => {
      if (kind === 'up') return { ...a, angleDeg: Math.max(-160, a.angleDeg - 4) };
      if (kind === 'down') return { ...a, angleDeg: Math.min(-20, a.angleDeg + 4) };
      if (kind === 'powerUp') return { ...a, power: Math.min(1, +(a.power + 0.1).toFixed(2)) };
      return { ...a, power: Math.max(0.1, +(a.power - 0.1).toFixed(2)) };
    });
  };

  const syncSim = () => {
    if (simRef.current.length === 0) {
      simRef.current = [...coinBodies(), freshStriker(strikerXRef.current)];
      setBodies(simRef.current.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
    }
  };

  // init sim on mount
  useEffect(() => {
    syncSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = () => {
    const g = createClassic(makeId('sess'), rulesRef.current.playerNames, rulesRef.current.targetScore);
    setRules(g);
    rulesRef.current = g;
    strikerXRef.current = 200;
    simRef.current = [...coinBodies(), freshStriker(200)];
    setBodies(simRef.current.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
    setPhase('aim');
    setAim({ angleDeg: -90, power: 0.45 });
    setTimeLeft(clockSecs);
    expiredRef.current = false;
    sinkRef.current?.onSessionStart?.(g);
  };

  if (rules.finished) {
    const [s1, s2] = rules.scores;
    return (
      <div className="app">
        <Confetti pieces={rules.winner === 0 ? 30 : 80} />
        <div className="screen">
          <div className="card results">
            <h1>
              {rules.winner === 0
                ? 'A hard-fought draw!'
                : `🏆 ${rules.winner === 1 ? rules.playerNames[0] : rules.playerNames[1]} wins!`}
            </h1>
            <p className="final-score">
              {rules.playerNames[0]} <strong>{s1}</strong> — <strong>{s2}</strong> {rules.playerNames[1]}
            </p>
            <div className="btn-row center">
              <button className="btn primary" onClick={restart} autoFocus>
                Play again
              </button>
              <button className="btn" onClick={onExit}>
                Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const me: PlayerNumber = rules.currentPlayer;
  const striker = simRef.current.find((b) => b.id === 'S');
  const paintCoins = bodies
    .filter((b) => b.id !== 'S')
    .map((b) => ({
      id: b.id,
      color: (b.id === 'Q' ? 'queen' : b.id.startsWith('W') ? 'white' : 'black') as
        | 'white'
        | 'black'
        | 'queen',
      x: b.pos.x,
      y: b.pos.y,
    }));

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo">🎲 Classic Flick</h1>
        <div className="top-actions">
          <QueenBadge queenState={rules.queen} />
          <button className="btn small" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn small" onClick={restart}>
            ↺ Restart
          </button>
          <button className="btn small" onClick={onExit}>
            Menu
          </button>
        </div>
      </header>

      <Toast msg={toast?.msg ?? null} tone={toast?.tone ?? 'info'} />

      <main className="layout">
        <div className="board-col">
          <div className="board-stack" style={{ position: 'relative' }}>
            <FlickBoard
              coins={paintCoins}
              striker={striker ? { x: striker.pos.x, y: striker.pos.y } : null}
              aim={phase === 'aim' && !paused ? aim : null}
              interactive={phase === 'aim' && !paused}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerEnd={handlePointerEnd}
              onKeyShot={handleKeyShot}
            />
            <FxLayer bursts={bursts} floaters={floaters} />
          </div>
          <p className="board-hint" aria-live="polite">
            {paused
              ? 'Paused — press Resume to continue.'
              : phase === 'rolling'
                ? 'Rolling…'
                : rules.queen === 'pendingCover'
                  ? `${rules.playerNames[me - 1]} must cover the Queen — pocket a coin!`
                  : `${rules.playerNames[me - 1]}, drag the striker back and release to shoot.`}
          </p>
          {phase === 'aim' && !paused && (
            <div
              className={`clock${timeLeft <= 5 ? ' low' : ''}`}
              role="timer"
              aria-label={`${timeLeft} seconds left to strike`}
            >
              <div className="clock-bar" style={{ width: `${(timeLeft / clockSecs) * 100}%` }} />
              <span>⏱ {timeLeft}s to strike</span>
            </div>
          )}
        </div>

        <aside className="side-col">
          <PlayerPanel
            name={rules.playerNames[0]}
            score={rules.scores[0]}
            player={1}
            isTurn={me === 1}
            mustCover={me === 1 && rules.queen === 'pendingCover'}
            target={rules.targetScore}
          />
          <PlayerPanel
            name={rules.playerNames[1]}
            score={rules.scores[1]}
            player={2}
            isTurn={me === 2}
            mustCover={me === 2 && rules.queen === 'pendingCover'}
            target={rules.targetScore}
          />
          <section className="card shots" aria-label="How to shoot">
            <h2>How to shoot</h2>
            <p className="muted">
              Drag the striker <strong>backwards</strong> and release — direction and pull set the shot.
              Tap the baseline to reposition. Keyboard: ←/→ slide, ↑/↓ rotate, +/− power, Enter fires.
            </p>
            <p className="muted">Pocket a coin to play again · striker in a pocket is a foul · Queen needs a cover.</p>
          </section>
        </aside>
      </main>

      {paused && (
        <div className="modal-backdrop">
          <div className="modal narrow" role="dialog" aria-modal="true" aria-label="Paused">
            <h2>Paused</h2>
            <div className="btn-row center">
              <button className="btn primary" onClick={() => setPaused(false)} autoFocus>
                ▶ Resume
              </button>
              <button className="btn" onClick={restart}>
                ↺ Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
