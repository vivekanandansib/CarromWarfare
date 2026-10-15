// Classic Flick turn rules (pure, tested): scoring, fouls, Queen + cover, win.
// Separate from the quiz engine — same spirit, physics shots instead of questions.
import type { PlayerNumber } from './types';
import type { Body } from './physics';
import { initialCoinLayout } from './engine';

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
  /** Player 1 (breaker) plays White, player 2 plays Black. */
  duesOwed: [number, number];
  /** Own-color coins pocketed so far (queen eligibility + dues base). */
  ownCount: [number, number];
  breakTaken: boolean;
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
    duesOwed: [0, 0],
    ownCount: [0, 0],
    breakTaken: false,
    finished: false,
  };
}

/** Assigned color: breaker (player 1) is White, player 2 is Black. */
export function colorOfPlayer(player: PlayerNumber): 'white' | 'black' {
  return player === 1 ? 'white' : 'black';
}

export function coinColorOf(id: string): 'white' | 'black' | 'queen' {
  if (id === 'Q') return 'queen';
  return id.startsWith('W') ? 'white' : 'black';
}

function ownIds(player: PlayerNumber): string[] {
  const prefix = player === 1 ? 'W' : 'B';
  return CLASSIC_COIN_IDS.filter((id) => id.startsWith(prefix));
}

export interface ShotResolution {
  state: ClassicState;
  points: number;
  /** Coins that stayed down this shot (excl. striker). */
  pocketedNow: string[];
  /** Coins put back on the board (dues). */
  returnedNow: string[];
  foul: boolean;
  /** Break stroke touched nothing and pocketed nothing. */
  breakFail: boolean;
  queenEvent: 'none' | 'pending' | 'secured' | 'returned';
}

function other(p: PlayerNumber): PlayerNumber {
  return p === 1 ? 2 : 1;
}

function checkClassicWin(s: ClassicState, mover: PlayerNumber): 1 | 2 | undefined {
  if (s.scores[mover - 1] >= s.targetScore) return mover;
  // Board-clear win: mover cleared their own color and the queen is secured.
  if (s.queen === 'secured' && ownIds(mover).every((id) => s.pocketed[id])) return mover;
  return undefined;
}

/**
 * Resolve one settled shot. House rules, ICF-inspired:
 * assigned colors (P1 White breaks), break must touch a coin, queen needs a
 * prior own coin + same-or-next-stroke cover, striker fouls incur dues,
 * opponent coins stay down without points.
 */
export function resolveShot(
  state: ClassicState,
  pocketedIds: string[],
  opts?: { touched?: boolean },
  queenId = 'Q',
  strikerId = 'S',
): ShotResolution {
  if (state.finished) throw new Error('game is finished');
  const player = state.currentPlayer;
  const myColor = colorOfPlayer(player);
  const next: ClassicState = {
    ...state,
    pocketed: { ...state.pocketed },
    scores: [...state.scores] as [number, number],
    duesOwed: [...state.duesOwed] as [number, number],
    ownCount: [...state.ownCount] as [number, number],
    breakTaken: true,
  };
  const fresh = pocketedIds.filter((id) => id !== strikerId && !next.pocketed[id]);
  const foul = pocketedIds.includes(strikerId);
  const touched = opts?.touched ?? fresh.length > 0;
  const isBreak = !state.breakTaken;
  const queenFell = fresh.includes(queenId);
  const ownFell = fresh.filter((id) => id !== queenId && coinColorOf(id) === myColor);
  const oppFell = fresh.filter((id) => id !== queenId && coinColorOf(id) !== myColor);
  const eligible = next.ownCount[player - 1] > 0;
  let points = 0;
  let queenEvent: ShotResolution['queenEvent'] = 'none';
  let breakFail = false;
  const returnedNow: string[] = [];
  const pocketedNow: string[] = [];

  if (foul) {
    if (isBreak) {
      // Failed break with striker down: turn passes, everything returns, no due.
      breakFail = true;
      next.currentPlayer = other(player);
    } else {
      // Foul: pocketed coins stay down without points; queen returns; due owed.
      for (const id of fresh) {
        if (id === queenId) continue;
        next.pocketed[id] = true;
        pocketedNow.push(id);
      }
      if (queenFell || next.queen === 'pendingCover') {
        next.queen = 'available';
        next.queenPocketedBy = undefined;
        queenEvent = 'returned';
      }
      next.duesOwed[player - 1]++;
      settleDue(next, player, returnedNow);
      next.currentPlayer = other(player);
    }
  } else if (isBreak && !touched && fresh.length === 0) {
    // Break touched nothing: turn passes, no due (house uses a single attempt).
    breakFail = true;
    next.currentPlayer = other(player);
  } else {
    // Outstanding dues settle from this shot's own coins first, then older ones.
    let own = [...ownFell];
    while (next.duesOwed[player - 1] > 0 && own.length > 0) {
      const id = own.shift()!;
      next.pocketed[id] = true; // briefly down, then placed back (no umpire in app)
      delete next.pocketed[id];
      returnedNow.push(id);
      next.duesOwed[player - 1]--;
    }
    if (next.duesOwed[player - 1] > 0) {
      const older = ownIds(player).filter((id) => next.pocketed[id] && !ownFell.includes(id));
      while (next.duesOwed[player - 1] > 0 && older.length > 0) {
        const id = older.shift()!;
        delete next.pocketed[id];
        returnedNow.push(id);
        next.duesOwed[player - 1]--;
      }
    }
    // Opponent coins stay down without points.
    for (const id of oppFell) {
      next.pocketed[id] = true;
      pocketedNow.push(id);
    }
    // Queen logic.
    if (next.queen === 'pendingCover') {
      if (own.length > 0) {
        for (const id of own) {
          next.pocketed[id] = true;
          pocketedNow.push(id);
        }
        next.scores[player - 1] += own.length * CLASSIC_POINTS + CLASSIC_QUEEN_BONUS;
        next.ownCount[player - 1] += own.length;
        points = own.length * CLASSIC_POINTS + CLASSIC_QUEEN_BONUS;
        next.queen = 'secured';
        queenEvent = 'secured';
      } else {
        next.queen = 'available';
        next.queenPocketedBy = undefined;
        queenEvent = 'returned';
        next.currentPlayer = other(player);
      }
    } else if (queenFell) {
      next.pocketed[queenId] = true;
      if (!eligible) {
        // Too early — queen returns at end of turn; own coins still count.
        delete next.pocketed[queenId];
        queenEvent = 'returned';
        for (const id of own) {
          next.pocketed[id] = true;
          pocketedNow.push(id);
        }
        next.scores[player - 1] += own.length * CLASSIC_POINTS;
        next.ownCount[player - 1] += own.length;
        points = own.length * CLASSIC_POINTS;
        if (own.length === 0) next.currentPlayer = other(player);
      } else if (own.length > 0) {
        // Same-stroke cover: secured immediately.
        for (const id of own) {
          next.pocketed[id] = true;
          pocketedNow.push(id);
        }
        next.scores[player - 1] += own.length * CLASSIC_POINTS + CLASSIC_QUEEN_BONUS;
        next.ownCount[player - 1] += own.length;
        points = own.length * CLASSIC_POINTS + CLASSIC_QUEEN_BONUS;
        next.queen = 'secured';
        queenEvent = 'secured';
      } else {
        next.queen = 'pendingCover';
        next.queenPocketedBy = player;
        queenEvent = 'pending';
      }
    } else {
      for (const id of own) {
        next.pocketed[id] = true;
        pocketedNow.push(id);
      }
      next.scores[player - 1] += own.length * CLASSIC_POINTS;
      next.ownCount[player - 1] += own.length;
      points = own.length * CLASSIC_POINTS;
      if (own.length === 0) next.currentPlayer = other(player);
    }
  }

  const winner = checkClassicWin(next, player);
  if (winner !== undefined) {
    next.finished = true;
    next.winner = winner;
  }
  return { state: next, points, pocketedNow, returnedNow, foul, breakFail, queenEvent };
}

/** Pay outstanding dues by returning pocketed own coins to the board. */
function settleDue(next: ClassicState, player: PlayerNumber, returnedNow: string[]): void {
  while (next.duesOwed[player - 1] > 0) {
    const mine = ownIds(player).filter((id) => next.pocketed[id]);
    if (mine.length === 0) break; // stays outstanding until a coin is available
    const id = mine[0];
    delete next.pocketed[id];
    returnedNow.push(id);
    next.duesOwed[player - 1]--;
  }
}

// ---------------------------------------------------------------------------
// Online snapshots: the full rest-state of a classic game travels in StateJson.
// Only ever written at rest (after a settle, restart, or creation) — the live
// ball motion is never synced; the other device mirrors the outcome.
// ---------------------------------------------------------------------------

export interface ClassicSnapshotBody {
  id: string;
  x: number;
  y: number;
}

export interface ClassicSnapshot {
  mode: 'classic';
  /** Lobby rooms carry a full opening snapshot plus this flag (game not started). */
  lobby?: boolean;
  rules: ClassicState;
  bodies: ClassicSnapshotBody[];
  strikerX: number;
}

export function serializeClassicSnapshot(
  rules: ClassicState,
  bodies: { id: string; x: number; y: number }[],
  strikerX: number,
  lobby = false,
): string {
  return JSON.stringify({
    mode: 'classic',
    lobby: lobby || undefined,
    rules,
    bodies: bodies.map((b) => ({ id: b.id, x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10 })),
    strikerX,
  });
}

export function deserializeClassicSnapshot(json: string): ClassicSnapshot | undefined {
  try {
    const s = JSON.parse(json) as Partial<ClassicSnapshot>;
    if (!s || s.mode !== 'classic' || !s.rules || typeof s.rules.sessionId !== 'string') return undefined;
    if (!Array.isArray(s.bodies) || typeof s.strikerX !== 'number') return undefined;
    if (!Array.isArray(s.rules.scores) || typeof s.rules.currentPlayer !== 'number') return undefined;
    return s as ClassicSnapshot;
  } catch {
    return undefined;
  }
}

/** Opening position for a fresh room (also used as the lobby snapshot). */
export function openingSnapshot(
  sessionId: string,
  playerNames: [string, string],
  targetScore: number,
  strikerX = 200,
  lobby = false,
): ClassicSnapshot {
  const rules = createClassic(sessionId, playerNames, targetScore);
  const bodies = initialCoinLayout().map((c) => ({ id: c.id, x: c.pos.x, y: c.pos.y }));
  return { mode: 'classic', lobby: lobby || undefined, rules, bodies, strikerX };
}
export function snapshotBodies(snap: ClassicSnapshot, queenR: number, strikerR: number, coinR: number): Body[] {
  return snap.bodies.map((b) => ({
    id: b.id,
    pos: { x: b.x, y: b.y },
    vel: { x: 0, y: 0 },
    radius: b.id === 'Q' ? queenR : b.id === 'S' ? strikerR : coinR,
  }));
}
