import * as React from 'react';
import type { PlayerNumber, QueenState } from '../game/types';

export function PlayerPanel({
  name,
  score,
  player,
  isTurn,
  mustCover,
  target,
}: {
  name: string;
  score: number;
  player: PlayerNumber;
  isTurn: boolean;
  mustCover: boolean;
  target: number;
}) {
  return (
    <section className={`player${isTurn ? ' turn' : ''}`} aria-label={`Player ${player}: ${name}`}>
      <div className="player-head">
        <span className={`p-disc p${player}`} aria-hidden="true" />
        <div>
          <div className="player-name">
            {name} {isTurn && <span className="turn-badge">● to play</span>}
          </div>
          <div className="player-sub">Player {player}</div>
        </div>
        <div className="player-score" aria-label={`${name} score ${score}`}>
          {score}
          <span className="score-target">/ {target}</span>
        </div>
      </div>
      {mustCover && <p className="cover-note">Must cover the Queen — pocket any other coin!</p>}
    </section>
  );
}

export function QueenBadge({ queenState }: { queenState: QueenState }) {
  return (
    <div className={`queen-badge ${queenState}`} aria-live="polite" aria-label={`Queen status: ${queenState}`}>
      <span className="queen-dot" aria-hidden="true" />
      Queen:{' '}
      <strong>
        {queenState === 'available' && 'on board'}
        {queenState === 'pendingCover' && 'needs cover!'}
        {queenState === 'secured' && 'secured ✓'}
      </strong>
    </div>
  );
}

export function Toast({ msg, tone }: { msg: string | null; tone: 'good' | 'bad' | 'info' }) {
  if (!msg) return null;
  return (
    <div className={`toast ${tone}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
