// CarromQuizBoard PCF host: board + dialog + panels + results.
// Session bootstrap (names/target/questions) comes from Canvas App inputs.
// Every engine event is forwarded via onEvent -> notifyOutputChanged() -> Power Fx.
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import Board, { nearestPocket, waypointFor, PocketAnim } from './components/Board';
import { PlayerPanel, QueenBadge, Toast } from './components/Panels';
import QuestionDialog from './components/QuestionDialog';
import {
  answerQuestion,
  completeAnimation,
  createGame,
  EngineError,
  getCoin,
  selectCoin,
} from './game/engine';
import { createGameEvent } from './game/events';
import { QuestionBank } from './game/questions';
import { sound } from './game/sound';
import type { GameEvent, GameState, ShotType } from './game/types';

export interface PcfSessionConfig {
  sessionId: string;
  player1: string;
  player2: string;
  targetScore: number;
  pointsPerCoin?: number;
  queenBonus?: number;
}

interface HostProps {
  bank: QuestionBank;
  config: PcfSessionConfig;
  resumeState?: GameState;
  inputError: string | null;
  onEvent: (ev: GameEvent) => void;
}

const SHOTS: { id: ShotType; label: string }[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'cut', label: 'Cut' },
  { id: 'bank', label: 'Bank' },
  { id: 'defensive', label: 'Defensive' },
];

export default function CarromPcfHost({ bank, config, resumeState, inputError, onEvent }: HostProps) {
  const [game, setGame] = useState<GameState>(() => resumeState ?? createGame({
    sessionId: config.sessionId,
    playerNames: [config.player1, config.player2],
    targetScore: config.targetScore,
    pointsPerCoin: config.pointsPerCoin,
    queenBonus: config.queenBonus,
  }));
  const [shot, setShot] = useState<ShotType>('straight');
  const [pocketAnim, setPocketAnim] = useState<PocketAnim | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'good' | 'bad' | 'info' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const toastTimer = useRef<number>(0);
  const startedRef = useRef(false);

  const emit = (events: GameEvent[]) => {
    for (const e of events) onEvent(e);
  };

  // Session start is an explicit event so the Canvas App can create the row.
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      onEvent(
        createGameEvent(config.sessionId, 'sessionStarted', 1, {
          score: [...game.scores] as [number, number],
          currentPlayer: game.currentPlayer,
          gameStatus: game.status,
        }),
      );
    }
    // mount-only: session start event
  }, []);

  const flash = (msg: string, tone: 'good' | 'bad' | 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  const handleSelect = (coinId: string) => {
    if (!game || game.phase !== 'ready' || paused) return;
    sound.select();
    try {
      const res = selectCoin(game, bank, coinId, shot);
      setGame(res.state);
      setError(null);
    } catch (e) {
      setError(e instanceof EngineError ? e.message : 'Selection failed');
    }
  };

  const handleAnswer = (index: number) => {
    if (!game || game.phase !== 'asking') return;
    let res;
    try {
      res = answerQuestion(game, index);
    } catch (e) {
      if (e instanceof EngineError && e.code === 'DUPLICATE_ANSWER') return;
      setError(e instanceof Error ? e.message : 'Answer failed');
      return;
    }
    emit(res.events);
    const wasCover = game.awaitingCover && game.activeCoinId !== 'Q';
    const coin = game.activeCoinId ? getCoin(game, game.activeCoinId) : undefined;
    if (res.correct) {
      sound.correct();
      setGame(res.state);
      if (coin) {
        const from = { ...coin.pos };
        const to = nearestPocket(from);
        setPocketAnim({
          coin,
          from,
          mid: waypointFor(from, to, game.activeShot ?? 'straight'),
          to,
          durationMs: (game.activeShot ?? 'straight') === 'defensive' ? 1200 : 850,
        });
      }
      if (coin?.color === 'queen') flash('Queen pocketed! Cover her with another coin next turn.', 'info');
      else if (wasCover) flash('Cover incoming — pocket it to secure the Queen!', 'info');
    } else {
      sound.wrong();
      setGame(res.state);
      const q = game.activeQuestion;
      const right = q ? `"${q.options[q.correctIndex]}"` : '';
      flash(
        wasCover
          ? `Cover failed — the Queen returns! Turn passes to ${res.state.playerNames[res.state.currentPlayer - 1]}.`
          : `Wrong ${right ? `(correct: ${right}) ` : ''}— turn passes to ${res.state.playerNames[res.state.currentPlayer - 1]}.`,
        'bad',
      );
    }
  };

  const handleAnimDone = () => {
    if (!game || game.phase !== 'animating') {
      setPocketAnim(null);
      return;
    }
    try {
      const res = completeAnimation(game);
      setPocketAnim(null);
      setGame(res.state);
      emit(res.events);
      const types = res.events.map((e) => e.eventType);
      if (!types.includes('gameFinished')) {
        if (types.includes('coverSecured')) {
          sound.queen();
          flash(`Queen secured! +${res.pointsAwarded} pts (cover + bonus). You play again.`, 'good');
        } else {
          sound.pocket();
          if (res.state.queenState !== 'pendingCover')
            flash(`Pocketed! +${res.pointsAwarded} pts — you retain the turn.`, 'good');
        }
      }
    } catch (e) {
      setPocketAnim(null);
      setError(e instanceof Error ? e.message : 'Pocket failed');
    }
  };

  const restart = () => {
    const g = createGame({
      sessionId: config.sessionId,
      playerNames: [config.player1, config.player2],
      targetScore: config.targetScore,
      pointsPerCoin: config.pointsPerCoin,
      queenBonus: config.queenBonus,
    });
    setGame(g);
    setPocketAnim(null);
    setPaused(false);
    setError(null);
    onEvent(
      createGameEvent(config.sessionId, 'sessionStarted', 1, {
        score: [0, 0],
        currentPlayer: 1,
        gameStatus: 'inProgress',
      }),
    );
  };

  const fatal = inputError ?? error;

  if (game.phase === 'finished') {
    const [s1, s2] = game.scores;
    return (
      <div className="carrom-pcf">
        <div className="card results">
          <h1>
            {game.winner === 0
              ? 'A hard-fought draw!'
              : `🏆 ${game.winner === 1 ? game.playerNames[0] : game.playerNames[1]} wins!`}
          </h1>
          <p className="final-score">
            {game.playerNames[0]} <strong>{s1}</strong> — <strong>{s2}</strong> {game.playerNames[1]}
          </p>
          <div className="btn-row center">
            <button className="btn primary" onClick={restart} autoFocus>
              Play again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const me = game.currentPlayer;
  const boardDisabled = paused || game.phase !== 'ready' || pocketAnim !== null || bank.size === 0;
  const activeCoin = game.activeCoinId ? getCoin(game, game.activeCoinId) : undefined;
  const strikerX = activeCoin ? Math.min(290, Math.max(110, activeCoin.pos.x)) : 200;
  const pocketed = game.coins.filter((c) => c.state === 'pocketed').length;

  return (
    <div className="carrom-pcf">
      {fatal && (
        <div className="error-banner" role="alert">
          {fatal}
        </div>
      )}
      <header className="topbar">
        <div className="top-actions">
          <QueenBadge queenState={game.queenState} />
          <button className="btn small" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn small" onClick={restart}>
            ↺ Restart
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
                  ? 'Pocketing…'
                  : game.awaitingCover
                    ? `${game.playerNames[me - 1]} must cover the Queen — pick another coin!`
                    : `${game.playerNames[me - 1]}, pick any available coin. Pocketed ${pocketed}/19.`}
          </p>
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
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </main>

      {game.phase === 'asking' && game.activeQuestion && game.activeCoinId && !paused && (
        <QuestionDialog
          question={game.activeQuestion}
          coinId={game.activeCoinId}
          shot={game.activeShot ?? 'straight'}
          playerName={game.playerNames[me - 1]}
          isCover={game.awaitingCover && game.activeCoinId !== 'Q'}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
