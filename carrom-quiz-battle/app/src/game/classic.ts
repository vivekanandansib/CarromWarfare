// Classic Flick turn rules (pure, tested): scoring, fouls, Queen + cover, win.
// Separate from the quiz engine — same spirit, physics shots instead of questions.
import type { PlayerNumber } from './types';

export type ClassicQueen = 'available' | 'pendingCover' | 'secured';

export interface ClassicState {
  sessionId: string;
  playerNames: [string, string];
  targetScore: number;
  /** coinId -> true once pocketed */
  pocketed: Record<string, boolean>;
  queen: ClassicQueen;
  queenPocketedBy?: PlayerNumber;
  scores: [number, number];
  currentPlayer: PlayerNumber;
  finished: boolean;
  winner?: 0 | PlayerNumber;
}

export const CLASSIC_POINTS = 10;
export const CLASSIC_QUEEN_BONUS = 20;
export const CLASSIC_COIN_IDS = [
  'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9',
];

export function createClassic(
  sessionId: string,
  playerNames: [string, string],
  targetScore: number,
): ClassicState {
  return {
    sessionId,
    playerNames,
    targetScore,
    pocketed: {},
    queen: 'available',
    scores: [0, 0],
    currentPlayer: 1,
    finished: false,
  };
}

export interface ShotResolution {
  state: ClassicState;
  points: number;
  pocketedNow: string[];
  foul: boolean;
  queenEvent: 'none' | 'pending' | 'secured' | 'returned';
}

function other(p: PlayerNumber): PlayerNumber {
  return p === 1 ? 2 : 1;
}

function checkClassicWin(s: ClassicState): 0 | 1 | 2 | undefined {
  const [a, b] = s.scores;
  const allIn =
    CLASSIC_COIN_IDS.every((id) => s.pocketed[id]) && s.queen !== 'pendingCover';
  if (a < s.targetScore && b < s.targetScore && !allIn) return undefined;
  if (a !== b) return a > b ? 1 : 2;
  if (s.queen === 'secured' && s.queenPocketedBy) return s.queenPocketedBy;
  return 0;
}

/**
 * Resolve one settled shot.
 * @param pocketedIds coins that fell this shot (ids; 'Q' = queen, 'S' = striker)
 */
export function resolveShot(
  state: ClassicState,
  pocketedIds: string[],
  queenId = 'Q',
  strikerId = 'S',
): ShotResolution {
  if (state.finished) throw new Error('game is finished');
  const player = state.currentPlayer;
  const next: ClassicState = {
    ...state,
    pocketed: { ...state.pocketed },
    scores: [...state.scores] as [number, number],
  };
  const fresh = pocketedIds.filter((id) => id !== strikerId && !next.pocketed[id]);
  const foul = pocketedIds.includes(strikerId);
  let points = 0;
  let queenEvent: ShotResolution['queenEvent'] = 'none';

  const queenFell = fresh.includes(queenId);
  const coinsFell = fresh.filter((id) => id !== queenId);

  if (foul) {
    // Foul: pocketed coins stay down but score nothing; queen returns.
    for (const id of fresh) next.pocketed[id] = true;
    if (queenFell || next.queen === 'pendingCover') {
      next.queen = 'available';
      next.queenPocketedBy = undefined;
      queenEvent = 'returned';
    }
    next.currentPlayer = other(player);
  } else if (next.queen === 'pendingCover') {
    // Cover attempt: must pocket a fresh non-queen coin.
    if (coinsFell.length > 0) {
      for (const id of fresh) next.pocketed[id] = true;
      next.scores[player - 1] += coinsFell.length * CLASSIC_POINTS + CLASSIC_QUEEN_BONUS;
      points = coinsFell.length * CLASSIC_POINTS + CLASSIC_QUEEN_BONUS;
      next.queen = 'secured';
      queenEvent = 'secured';
      // retains turn
    } else {
      if (queenFell) next.pocketed[queenId] = true; // stays down but unsecured
      next.queen = 'available';
      next.queenPocketedBy = undefined;
      queenEvent = 'returned';
      next.currentPlayer = other(player);
    }
  } else {
    // Normal shot.
    for (const id of fresh) next.pocketed[id] = true;
    if (queenFell) {
      next.queen = 'pendingCover';
      next.queenPocketedBy = player;
      queenEvent = 'pending';
      next.scores[player - 1] += coinsFell.length * CLASSIC_POINTS;
      points = coinsFell.length * CLASSIC_POINTS;
      // retains turn (must cover)
    } else if (coinsFell.length > 0) {
      next.scores[player - 1] += coinsFell.length * CLASSIC_POINTS;
      points = coinsFell.length * CLASSIC_POINTS;
      // retains turn
    } else {
      next.currentPlayer = other(player);
    }
  }

  const winner = checkClassicWin(next);
  if (winner !== undefined) {
    next.finished = true;
    next.winner = winner;
  }
  return { state: next, points, pocketedNow: fresh, foul, queenEvent };
}
