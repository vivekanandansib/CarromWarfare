import { useState } from 'react';
import type { GameState } from '../game/types';

export function StartScreen({
  canResume,
  onStart,
  onResume,
}: {
  canResume: boolean;
  onStart: (p1: string, p2: string, target: number, clock: number) => void;
  onResume: () => void;
}) {
  const [p1, setP1] = useState('Asha');
  const [p2, setP2] = useState('Ravi');
  const [target, setTarget] = useState(50);
  const [clock, setClock] = useState(30);
  const valid = p1.trim() !== '' && p2.trim() !== '' && target > 0;

  return (
    <div className="screen">
      <div className="hero">
        <h1>🎯 Carrom Quiz Battle</h1>
        <p className="tagline">Pocket coins with your brain. Two players, one board, quiz-powered shots.</p>
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
          <button className="btn primary" disabled={!valid} onClick={() => onStart(p1.trim(), p2.trim(), target, clock)}>
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
        <h2>How to play</h2>
        <ol className="rules">
          <li>Either player may select <strong>any available coin</strong> on their turn.</li>
          <li>Each turn has a <strong>shot clock</strong> — strike (pick + answer) in time or the turn passes.</li>
          <li>Answer the question: <strong>correct</strong> pockets the coin and you play again; <strong>wrong</strong> sends the coin off-target and passes the turn.</li>
          <li>Shots matter: <strong>Straight +10</strong> (any), <strong>Cut +12</strong> (medium+), <strong>Bank +15</strong> (hardest), <strong>Defensive +10</strong> (easy).</li>
          <li>The red <strong>Queen</strong> needs a hard question + a <strong>cover</strong>: pocket another coin next turn or she returns! Cover bonus <strong>+20</strong>.</li>
          <li>First to the <strong>target score</strong> wins. Board cleared? Higher score wins; tied → Queen holder wins, else draw.</li>
        </ol>
      </div>
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
