import { useCallback, useEffect, useRef, useState } from 'react';
import Board, { missMidpoint, nearestPocket, waypointFor, type PocketAnim } from './components/Board';
import { PlayerPanel, QueenBadge, Toast } from './components/Panels';
import QuestionDialog from './components/QuestionDialog';
import { ResultsScreen, StartScreen } from './components/Screens';
import { SAMPLE_QUESTIONS } from './data/questions';
import {
  answerQuestion,
  completeAnimation,
  completeMiss,
  createGame,
  EngineError,
  expireIdleTurn,
  getCoin,
  makeId,
  selectCoin,
} from './game/engine';
import { QuestionBank } from './game/questions';
import { sound } from './game/sound';
import { clearGame, loadLastGame, saveGame } from './game/storage';
import type { GameState, ShotType } from './game/types';
import './styles.css';

const SHOTS: { id: ShotType; label: string; desc: string }[] = [
  { id: 'straight', label: 'Straight +10', desc: 'Any difficulty, standard points' },
  { id: 'cut', label: 'Cut +12', desc: 'Difficulty 2+, +2 bonus' },
  { id: 'bank', label: 'Bank +15', desc: 'Hardest questions, +5 bonus' },
  { id: 'defensive', label: 'Defensive +10', desc: 'Easy questions, standard points' },
];

const SHOT_BONUS: Record<ShotType, number> = { straight: 0, cut: 2, bank: 5, defensive: 0 };

function hasSavedGame(): boolean {
  try {
    return loadLastGame() !== undefined;
  } catch {
    return false;
  }
}

export default function App() {
  const [bank, setBank] = useState(() => new QuestionBank(SAMPLE_QUESTIONS));
  const [game, setGame] = useState<GameState | null>(null);
  const [shot, setShot] = useState<ShotType>('straight');
  const [pocketAnim, setPocketAnim] = useState<PocketAnim | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [canResume, setCanResume] = useState(hasSavedGame);
  const [clockSecs, setClockSecs] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const toastTimer = useRef<number>(0);
  const expiredRef = useRef(false);

  const flash = useCallback((msg: string, tone: 'good' | 'bad' | 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const persist = (g: GameState) => {
    if (!saveGame(g)) flash('Could not save progress (storage unavailable) — game continues.', 'info');
    setCanResume(true);
  };

  const startGame = (p1: string, p2: string, target: number, clock: number) => {
    const fresh = new QuestionBank(SAMPLE_QUESTIONS);
    if (fresh.size === 0) {
      setError('No active questions available. Add questions to the bank and retry.');
      return;
    }
    setBank(fresh);
    try {
      const g = createGame({ sessionId: makeId('sess'), playerNames: [p1, p2], targetScore: target });
      setGame(g);
      setPocketAnim(null);
      setPaused(false);
      setError(null);
      setClockSecs(clock);
      setTimeLeft(clock);
      expiredRef.current = false;
      persist(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start game');
    }
  };

  const resumeGame = () => {
    const g = loadLastGame();
    if (!g) {
      setError('No saved game found.');
      return;
    }
    if (g.phase === 'asking' || g.phase === 'animating') {
      // Never resume mid-question/animation — roll back to a clean ready state.
      g.phase = 'ready';
      g.animKind = undefined;
      g.activeCoinId = undefined;
      g.activeQuestion = undefined;
      g.activeShot = undefined;
    }
    setBank(new QuestionBank(SAMPLE_QUESTIONS));
    setGame(g.phase === 'finished' ? g : g);
    setPocketAnim(null);
    setPaused(false);
    setError(null);
  };

  const handleSelect = (coinId: string) => {
    if (!game || game.phase !== 'ready' || paused) return;
    sound.select();
    try {
      const res = selectCoin(game, bank, coinId, shot);
      setGame(res.state);
      setError(null);
      persist(res.state);
    } catch (e) {
      setError(e instanceof EngineError ? e.message : 'Selection failed');
    }
  };

  const handleExpireIdle = () => {
    if (!game || game.phase !== 'ready') return;
    sound.wrong();
    try {
      const res = expireIdleTurn(game);
      setGame(res.state);
      persist(res.state);
      const nextName = res.state.playerNames[res.state.currentPlayer - 1];
      flash(
        res.events.some((e) => e.eventType === 'coverFailed')
          ? `Time! The Queen returns — turn passes to ${nextName}.`
          : `Time! Turn passes to ${nextName}.`,
        'bad',
      );
    } catch {
      /* ignore */
    }
  };

  // Shot clock: reset on every turn/phase change; expiry forfeits the turn.
  useEffect(() => {
    setTimeLeft(clockSecs);
    expiredRef.current = false;
  }, [game?.phase, game?.currentPlayer, game?.sessionId, clockSecs, game === null]);

  useEffect(() => {
    if (!game || paused) return;
    if (game.phase !== 'ready' && game.phase !== 'asking') return;
    if (timeLeft <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        if (game.phase === 'asking') handleAnswer(-1);
        else handleExpireIdle();
      }
      return;
    }
    if (timeLeft <= 5) sound.tick();
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  });

  const handleAnswer = (index: number) => {
    if (!game || game.phase !== 'asking') return;
    let res;
    try {
      res = answerQuestion(game, index);
    } catch (e) {
      if (e instanceof EngineError && e.code === 'DUPLICATE_ANSWER') return; // ignore double-click
      setError(e instanceof Error ? e.message : 'Answer failed');
      return;
    }
    const wasCover = game.awaitingCover && game.activeCoinId !== 'Q';
    const coin = game.activeCoinId ? getCoin(game, game.activeCoinId) : undefined;

    if (res.correct) {
      sound.correct();
      setGame(res.state);
      persist(res.state);
      if (coin) {
        const from = { ...coin.pos };
        const to = nearestPocket(from);
        const mid = waypointFor(from, to, game.activeShot ?? 'straight');
        setPocketAnim({
          kind: 'pocket',
          coin,
          from,
          mid,
          to,
          durationMs: (game.activeShot ?? 'straight') === 'defensive' ? 1200 : 850,
        });
      }
      if (coin?.color === 'queen') flash('Queen pocketed! Cover her with another coin next turn.', 'info');
      else if (wasCover) flash('Cover incoming — pocket it to secure the Queen!', 'info');
    } else {
      sound.wrong();
      setGame(res.state);
      persist(res.state);
      if (coin) {
        // Miss animation: the coin slides toward the pocket, veers off, stays in play.
        const from = { ...coin.pos };
        const to = nearestPocket(from);
        setPocketAnim({
          kind: 'miss',
          coin,
          from,
          mid: missMidpoint(from, to),
          to: from,
          durationMs: 1100,
        });
      }
      const q = game.activeQuestion;
      const right = q ? `"${q.options[q.correctIndex]}"` : '';
      const nextName = res.state.playerNames[res.state.currentPlayer - 1];
      flash(
        wasCover
          ? `Cover failed — the Queen returns! Turn passes to ${nextName}.`
          : `Wrong ${right ? `(correct: ${right}) ` : ''}— turn passes to ${nextName}.`,
        'bad',
      );
    }
  };

  const handleAnimDone = () => {
    if (!game || game.phase !== 'animating') {
      setPocketAnim(null);
      return;
    }
    if (game.animKind === 'miss') {
      try {
        const res = completeMiss(game);
        setPocketAnim(null);
        setGame(res.state);
        persist(res.state);
      } catch (e) {
        setPocketAnim(null);
        setError(e instanceof Error ? e.message : 'Miss failed');
      }
      return;
    }
    try {
      const res = completeAnimation(game);
      setPocketAnim(null);
      setGame(res.state);
      persist(res.state);
      const types = res.events.map((e) => e.eventType);
      if (types.includes('gameFinished')) {
        sound.win();
        clearGame(res.state.sessionId);
        setCanResume(hasSavedGame());
      } else if (types.includes('coverSecured')) {
        sound.queen();
        flash(`Queen secured! +${res.pointsAwarded} pts (cover + bonus). You play again.`, 'good');
      } else {
        sound.pocket();
        if (res.state.queenState === 'pendingCover') {
          // already flashed at answer time
        } else {
          flash(`Pocketed! +${res.pointsAwarded} pts — you retain the turn.`, 'good');
        }
      }
    } catch (e) {
      setPocketAnim(null);
      setError(e instanceof Error ? e.message : 'Pocket failed');
    }
  };

  const restart = () => {
    if (!game) return;
    startGame(game.playerNames[0], game.playerNames[1], game.targetScore, clockSecs);
  };

  // ---- screens ----
  if (!game) {
    return (
      <div className="app">
        {error && (
          <div className="error-banner" role="alert">
            {error} <button onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
          </div>
        )}
        <StartScreen canResume={canResume} onStart={startGame} onResume={resumeGame} />
      </div>
    );
  }

  if (game.phase === 'finished') {
    return (
      <div className="app">
        <ResultsScreen game={game} onRestart={restart} />
        <div className="btn-row center">
          <button className="btn" onClick={() => setGame(null)}>
            Back to menu
          </button>
        </div>
      </div>
    );
  }

  const me = game.currentPlayer;
  const boardDisabled = paused || game.phase !== 'ready' || pocketAnim !== null;
  const activeCoin = game.activeCoinId ? getCoin(game, game.activeCoinId) : undefined;
  const strikerX = activeCoin ? Math.min(290, Math.max(110, activeCoin.pos.x)) : 200;
  const pocketed = game.coins.filter((c) => c.state === 'pocketed').length;

  return (
    <div className="app">
      {error && (
        <div className="error-banner" role="alert">
          {error} <button onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
        </div>
      )}
      <header className="topbar">
        <h1 className="logo">🎯 Carrom Quiz Battle</h1>
        <div className="top-actions">
          <QueenBadge queenState={game.queenState} />
          <button className="btn small" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn small" onClick={restart}>
            ↺ Restart
          </button>
          <button className="btn small" onClick={() => setGame(null)}>
            Menu
          </button>
        </div>
      </header>

      <Toast msg={toast?.msg ?? null} tone={toast?.tone ?? 'info'} />

      <main className="layout">
        <div className="board-col">
          <Board
            coins={game.coins}
            queenState={game.queenState}
            activeCoinId={game.activeCoinId}
            disabled={boardDisabled}
            pocketAnim={pocketAnim}
            strikerX={strikerX}
            onSelect={handleSelect}
            onAnimDone={handleAnimDone}
          />
          <p className="board-hint" aria-live="polite">
            {paused
              ? 'Paused — press Resume to continue.'
              : game.phase === 'asking'
                ? 'Answer the question to shoot…'
                : game.phase === 'animating'
                  ? game.animKind === 'miss'
                    ? 'Off target…'
                    : 'Pocketing…'
                  : game.awaitingCover
                    ? `${game.playerNames[me - 1]} must cover the Queen — pick another coin!`
                    : `${game.playerNames[me - 1]}, pick any available coin. Pocketed ${pocketed}/19.`}
          </p>
          {(game.phase === 'ready' || game.phase === 'asking') && !paused && (
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
            name={game.playerNames[0]}
            score={game.scores[0]}
            player={1}
            isTurn={me === 1}
            mustCover={me === 1 && game.awaitingCover}
            target={game.targetScore}
          />
          <PlayerPanel
            name={game.playerNames[1]}
            score={game.scores[1]}
            player={2}
            isTurn={me === 2}
            mustCover={me === 2 && game.awaitingCover}
            target={game.targetScore}
          />
          <section className="card shots" aria-label="Shot selection">
            <h2>Shot style</h2>
            <div className="shot-grid" role="radiogroup" aria-label="Shot style">
              {SHOTS.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={shot === s.id}
                  className={`shot${shot === s.id ? ' active' : ''}`}
                  onClick={() => setShot(s.id)}
                  disabled={game.phase !== 'ready'}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="muted">Harder shots ask harder questions and pay bonus points.</p>
          </section>
        </aside>
      </main>

      {paused && (
        <div className="modal-backdrop">
          <div className="modal narrow" role="dialog" aria-modal="true" aria-label="Paused">
            <h2>Paused</h2>
            <p className="muted">Take a breath. The board is waiting.</p>
            <div className="btn-row">
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

      {game.phase === 'asking' && game.activeQuestion && game.activeCoinId && !paused && (
        <QuestionDialog
          question={game.activeQuestion}
          coinId={game.activeCoinId}
          shot={game.activeShot ?? 'straight'}
          points={10 + SHOT_BONUS[game.activeShot ?? 'straight']}
          playerName={game.playerNames[me - 1]}
          isCover={game.awaitingCover && game.activeCoinId !== 'Q'}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
