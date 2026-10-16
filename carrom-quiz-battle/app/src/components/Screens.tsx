import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameState } from '../game/types';

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

export function StartScreen({
  canResume,
  onStart,
  onResume,
}: {
  canResume: boolean;
  onStart: (p1: string, p2: string, target: number, clock: number, mode: 'quiz' | 'classic') => void;
  onResume: () => void;
}) {
  const [p1, setP1] = useState('Asha');
  const [p2, setP2] = useState('Ravi');
  const [target, setTarget] = useState(50);
  const [clock, setClock] = useState(30);
  const [mode, setMode] = useState<'quiz' | 'classic'>('quiz');
  const valid = p1.trim() !== '' && p2.trim() !== '' && target > 0;

  return (
    <div className="screen wide">
      <div className="hero-premium">
        <CoinRain />
        <div className="hero-kicker">TWO PLAYERS · ONE BOARD</div>
        <h1 className="hero-title">Carrom Quiz Battle</h1>
        <p className="hero-sub">Pocket coins with your brain — or your flick. Quiz brains meet carrom hands.</p>
        <div className="stat-chips" aria-label="Game highlights">
          <span className="stat-chip">🎯 Quiz + 🎲 Flick modes</span>
          <span className="stat-chip">⏱ Shot clock</span>
          <span className="stat-chip">👑 Queen + cover</span>
        </div>
      </div>
      <div className="mode-cards" role="radiogroup" aria-label="Game mode">
        <button
          role="radio"
          aria-checked={mode === 'quiz'}
          className={`mode-card${mode === 'quiz' ? ' active' : ''}`}
          onClick={() => setMode('quiz')}
        >
          <span className="mode-emoji">🎯</span>
          <span className="mode-name">Quiz Battle</span>
          <span className="mode-desc">Answer to pocket · shots pay up to +15</span>
        </button>
        <button
          role="radio"
          aria-checked={mode === 'classic'}
          className={`mode-card${mode === 'classic' ? ' active' : ''}`}
          onClick={() => setMode('classic')}
        >
          <span className="mode-emoji">🎲</span>
          <span className="mode-name">Classic Flick</span>
          <span className="mode-desc">Real flick physics · ICF-style rules</span>
        </button>
      </div>
      <div className="card">
        <h2>New game</h2>
        <div className="form-row">
          <label>
            Player 1<input value={p1} onChange={(e) => setP1(e.target.value)} maxLength={20} aria-label="Player 1 name" />
          </label>
          <label>
            Player 2<input value={p2} onChange={(e) => setP2(e.target.value)} maxLength={20} aria-label="Player 2 name" />
          </label>
          <label>
            Target score
            <input
              type="number"
              min={10}
              max={190}
              step={10}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              aria-label="Target score"
            />
          </label>
          <label>
            Shot clock
            <select value={clock} onChange={(e) => setClock(Number(e.target.value))} aria-label="Shot clock seconds">
              <option value={15}>15s (quick)</option>
              <option value={30}>30s (standard)</option>
              <option value={45}>45s (relaxed)</option>
              <option value={60}>60s (casual)</option>
            </select>
          </label>
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={!valid} onClick={() => onStart(p1.trim(), p2.trim(), target, clock, mode)}>
            Start battle
          </button>
          {canResume && (
            <button className="btn" onClick={onResume}>
              Resume saved game
            </button>
          )}
        </div>
      </div>
      <div className="card">
        <h2>{mode === 'quiz' ? 'How quiz battle works' : 'How classic flick works'}</h2>
        {mode === 'quiz' ? (
          <ol className="rules">
            <li>Either player may select <strong>any available coin</strong> on their turn.</li>
            <li>Each turn has a <strong>shot clock</strong> — strike (pick + answer) in time or the turn passes.</li>
            <li>Answer the question: <strong>correct</strong> pockets the coin and you play again; <strong>wrong</strong> sends the coin off-target and passes the turn.</li>
            <li>Shots matter: <strong>Straight +10</strong> (any), <strong>Cut +12</strong> (medium+), <strong>Bank +15</strong> (hardest), <strong>Defensive +10</strong> (easy).</li>
            <li>The red <strong>Queen</strong> needs a hard question + a <strong>cover</strong>: pocket another coin next turn or she returns! Cover bonus <strong>+20</strong>.</li>
            <li>First to the <strong>target score</strong> wins. Board cleared? Higher score wins; tied → Queen holder wins, else draw.</li>
          </ol>
        ) : (
          <ol className="rules">
            <li><strong>White breaks</strong> (Player 1) — the break must touch a coin within the clock.</li>
            <li>Drag the striker <strong>backwards</strong> and release; tap the baseline to reposition.</li>
            <li>Pocket your color to play again (White vs Black). Opponent coins stay down, no points.</li>
            <li><strong>Striker in a pocket is a foul</strong> — turn passes and you owe a due coin.</li>
            <li>The red <strong>Queen</strong> needs a prior own coin + a <strong>cover</strong> next shot (+20) or she returns to center.</li>
            <li>Clear your color with the Queen secured — or hit the <strong>target score</strong> — to win.</li>
          </ol>
        )}
      </div>
      <p className="version-line">Same laptop · keyboard + tablet friendly</p>
    </div>
  );
}

export function ResultsScreen({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const [s1, s2] = game.scores;
  const title =
    game.winner === 0
      ? 'A hard-fought draw!'
      : `🏆 ${game.winner === 1 ? game.playerNames[0] : game.playerNames[1]} wins!`;
  return (
    <div className="screen">
      <div className="card results">
        <h1>{title}</h1>
        <p className="final-score">
          {game.playerNames[0]} <strong>{s1}</strong> — <strong>{s2}</strong> {game.playerNames[1]}
        </p>
        <p className="muted">
          Queen: {game.queenState === 'secured' ? `secured by Player ${game.queenPocketedBy}` : game.queenState}
          {' · '}Target was {game.targetScore}
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={onRestart} autoFocus>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
