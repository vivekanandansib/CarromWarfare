// Pure game engine: state machine, Queen+cover rules, scoring, idempotency.
// No React, no DOM — reusable from the standalone app and the future PCF control.

import { QuestionBank } from './questions';
import type {
  Coin,
  CoinPos,
  GameConfig,
  GameEvent,
  GameEventType,
  GameState,
  PlayerNumber,
  Question,
  ShotType,
} from './types';

export class EngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Standard 19-coin layout on a 400x400 board (center 200,200). */
export function initialCoinLayout(): Coin[] {
  const coins: Coin[] = [];
  const center = { x: 200, y: 200 };
  coins.push({ id: 'Q', color: 'queen', state: 'available', pos: { ...center } });

  const ring = (radius: number, n: number, offset: number, prefix: string, startWhite: boolean) => {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * Math.PI * 2;
      const pos: CoinPos = {
        x: Math.round(center.x + radius * Math.cos(a)),
        y: Math.round(center.y + radius * Math.sin(a)),
      };
      const white = (i % 2 === 0) === startWhite;
      coins.push({
        id: `${prefix}${i + 1}`,
        color: white ? 'white' : 'black',
        state: 'available',
        pos,
      });
    }
  };
  // Inner ring: 6 coins (W1..W3/B..), outer ring: 12. Queen takes center.
  ring(26, 6, -Math.PI / 2, 'W', true);
  ring(52, 12, -Math.PI / 2, 'B', false);
  // Re-label: inner ring ids W1..W6 would collide conceptually with colors; fix ids to be unique:
  // inner ring coins alternate white/black — rename by actual color below.
  const seen = new Set<string>();
  for (const c of coins) {
    if (c.id === 'Q') continue;
    const base = c.color === 'white' ? 'W' : 'B';
    let k = 1;
    while (seen.has(`${base}${k}`)) k++;
    const nid = `${base}${k}`;
    seen.add(nid);
    c.id = nid;
  }
  return coins;
}

export function createGame(config: GameConfig): GameState {
  if (!config.sessionId) throw new EngineError('BAD_CONFIG', 'sessionId is required');
  if (!config.playerNames?.[0]?.trim() || !config.playerNames?.[1]?.trim())
    throw new EngineError('BAD_CONFIG', 'both player names are required');
  if (!config.targetScore || config.targetScore <= 0)
    throw new EngineError('BAD_CONFIG', 'targetScore must be positive');
  return {
    sessionId: config.sessionId,
    playerNames: [config.playerNames[0].trim(), config.playerNames[1].trim()],
    targetScore: config.targetScore,
    pointsPerCoin: config.pointsPerCoin ?? 10,
    queenBonus: config.queenBonus ?? 20,
    coins: initialCoinLayout(),
    queenState: 'available',
    scores: [0, 0],
    currentPlayer: 1,
    phase: 'ready',
    answeredActive: false,
    usedQuestionIds: [],
    processedEventKeys: [],
    status: 'inProgress',
    awaitingCover: false,
  };
}

export function availableCoins(state: GameState): Coin[] {
  return state.coins.filter((c) => c.state === 'available');
}

export function getCoin(state: GameState, coinId: string): Coin | undefined {
  return state.coins.find((c) => c.id === coinId);
}

function buildEvent(
  state: GameState,
  type: GameEventType,
  extra?: Partial<GameEvent>,
): GameEvent {
  return {
    schemaVersion: '1.0',
    eventId: makeId('evt'),
    sessionId: state.sessionId,
    eventType: type,
    playerNumber: state.currentPlayer,
    score: [...state.scores] as [number, number],
    currentPlayer: state.currentPlayer,
    gameStatus: state.status,
    ...extra,
  };
}

function otherPlayer(p: PlayerNumber): PlayerNumber {
  return p === 1 ? 2 : 1;
}

/**
 * Idempotent scoring. Replays with the same key are ignored —
 * duplicate events never award duplicate points.
 */
export function applyCoinEvent(
  state: GameState,
  eventKey: string,
  player: PlayerNumber,
  points: number,
): { state: GameState; applied: boolean } {
  if (state.processedEventKeys.includes(eventKey)) return { state, applied: false };
  const scores: [number, number] = [...state.scores] as [number, number];
  scores[player - 1] += points;
  return {
    state: {
      ...state,
      scores,
      processedEventKeys: [...state.processedEventKeys, eventKey],
    },
    applied: true,
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export interface SelectResult {
  state: GameState;
  question: Question;
  events: GameEvent[];
}

/** ready -> asking. Throws EngineError on illegal transitions. */
export function selectCoin(
  state: GameState,
  bank: QuestionBank,
  coinId: string,
  shot: ShotType = 'straight',
): SelectResult {
  if (state.phase === 'finished') throw new EngineError('GAME_OVER', 'game is finished');
  if (state.phase !== 'ready')
    throw new EngineError('ILLEGAL_TRANSITION', `cannot select while ${state.phase}`);
  const coin = getCoin(state, coinId);
  if (!coin) throw new EngineError('NO_COIN', `coin ${coinId} does not exist`);
  if (coin.state !== 'available')
    throw new EngineError('COIN_TAKEN', `coin ${coinId} already pocketed`);
  if (coin.color === 'queen') {
    if (state.queenState !== 'available')
      throw new EngineError('QUEEN_LOCKED', 'queen cannot be selected while pending cover');
  }
  if (state.awaitingCover && coin.color === 'queen')
    throw new EngineError('NEED_COVER', 'must pocket a different coin to cover the queen');

  const isQueen = coin.color === 'queen';
  const question = bank.next({
    usedIds: state.usedQuestionIds,
    queenChallenge: isQueen || state.awaitingCover,
  });
  if (!question)
    throw new EngineError(
      'EMPTY_BANK',
      'no active questions available — add questions to the bank and retry',
    );

  const next: GameState = {
    ...state,
    phase: 'asking',
    activeCoinId: coin.id,
    activeQuestion: question,
    activeShot: shot,
    answeredActive: false,
  };
  return { state: next, question, events: [] };
}

export interface AnswerResult {
  state: GameState;
  correct: boolean;
  events: GameEvent[];
  pointsAwarded: number;
}

/** asking -> animating (correct) | ready (wrong). Duplicate submissions rejected. */
export function answerQuestion(
  state: GameState,
  selectedIndex: number,
): AnswerResult {
  if (state.phase !== 'asking')
    throw new EngineError('ILLEGAL_TRANSITION', `cannot answer while ${state.phase}`);
  if (state.answeredActive)
    throw new EngineError('DUPLICATE_ANSWER', 'this question was already answered');
  if (!state.activeCoinId || !state.activeQuestion)
    throw new EngineError('NO_ACTIVE', 'no active coin/question');

  const coin = getCoin(state, state.activeCoinId);
  if (!coin) throw new EngineError('NO_COIN', 'active coin vanished');
  const correct = selectedIndex === state.activeQuestion.correctIndex;
  const player = state.currentPlayer;
  const usedQuestionIds = state.usedQuestionIds.includes(state.activeQuestion.id)
    ? state.usedQuestionIds
    : [...state.usedQuestionIds, state.activeQuestion.id];

  const attempt: GameEvent = buildEvent(state, 'attemptMade', {
    coinId: coin.id,
    questionId: state.activeQuestion.id,
    selectedOption: selectedIndex,
    isCorrect: correct,
  });

  if (!correct) {
    // Wrong answer: coin stays; queen-cover failure returns queen to the board.
    let next: GameState = { ...state, usedQuestionIds, answeredActive: true };
    const events: GameEvent[] = [attempt];
    if (next.awaitingCover) {
      // Cover failed → queen returns, bonus cancelled, turn passes.
      next = {
        ...next,
        coins: next.coins.map((c) => (c.id === 'Q' ? { ...c, state: 'available' as const } : c)),
        queenState: 'available',
        queenPocketedBy: undefined,
        awaitingCover: false,
      };
      events.push(buildEvent(next, 'coverFailed', { coinId: coin.id }));
    }
    const to = otherPlayer(player);
    next = {
      ...next,
      phase: 'ready',
      currentPlayer: to,
      activeCoinId: undefined,
      activeQuestion: undefined,
      activeShot: undefined,
    };
    events.push(buildEvent({ ...next, currentPlayer: to }, 'turnChanged'));
    return { state: next, correct: false, events: [attempt, ...events.slice(1)], pointsAwarded: 0 };
  }

  // Correct answer → animating. Scoring is applied at pocket completion.
  let next: GameState = {
    ...state,
    usedQuestionIds,
    answeredActive: true,
    phase: 'animating',
  };
  if (coin.color === 'queen') {
    // Queen pocketed → pending cover, same player retains turn (after animation).
    next = { ...next, queenState: 'pendingCover', queenPocketedBy: player, awaitingCover: true };
  }
  return { state: next, correct: true, events: [attempt], pointsAwarded: 0 };
}

export interface PocketResult {
  state: GameState;
  events: GameEvent[];
  pointsAwarded: number;
}

/** animating -> ready | finished. Pockets exactly one coin; win check included. */
export function completeAnimation(state: GameState): PocketResult {
  if (state.phase !== 'animating')
    throw new EngineError('ILLEGAL_TRANSITION', `cannot complete pocket while ${state.phase}`);
  if (!state.activeCoinId)
    throw new EngineError('NO_ACTIVE', 'no active coin to pocket');

  const coin = getCoin(state, state.activeCoinId);
  if (!coin) throw new EngineError('NO_COIN', 'active coin vanished');
  if (coin.state !== 'available')
    throw new EngineError('COIN_TAKEN', 'active coin already pocketed');

  const player = state.currentPlayer;
  const questionId = state.activeQuestion?.id ?? 'unknown';
  const events: GameEvent[] = [];
  let next: GameState = { ...state };
  let points = 0;

  const pocket = (id: string) => {
    next = { ...next, coins: next.coins.map((c) => (c.id === id ? { ...c, state: 'pocketed' as const } : c)) };
  };

  if (coin.color === 'queen') {
    // Queen pocket: normal points now, bonus only on later cover.
    pocket(coin.id);
    const key = `${state.sessionId}:${questionId}:${coin.id}:p${player}`;
    const r = applyCoinEvent(next, key, player, next.pointsPerCoin);
    next = r.state;
    points = next.pointsPerCoin;
    events.push(
      buildEvent(next, 'coinPocketed', {
        coinId: coin.id,
        questionId,
        isCorrect: true,
        pointsAwarded: points,
      }),
    );
    // awaitingCover already true; same player retains turn.
  } else if (state.awaitingCover) {
    // Cover coin pocketed → queen secured + bonus.
    pocket(coin.id);
    const key = `${state.sessionId}:${questionId}:${coin.id}:p${player}`;
    const r1 = applyCoinEvent(next, key, player, next.pointsPerCoin);
    next = r1.state;
    const bkey = `${state.sessionId}:${questionId}:Q-cover-bonus:p${player}`;
    const r2 = applyCoinEvent(next, bkey, player, next.queenBonus);
    next = r2.state;
    points = next.pointsPerCoin + next.queenBonus;
    next = { ...next, queenState: 'secured', awaitingCover: false };
    events.push(
      buildEvent(next, 'coverSecured', {
        coinId: coin.id,
        questionId,
        isCorrect: true,
        pointsAwarded: points,
      }),
    );
  } else {
    // Normal pocket, same player retains turn.
    pocket(coin.id);
    const key = `${state.sessionId}:${questionId}:${coin.id}:p${player}`;
    const r = applyCoinEvent(next, key, player, next.pointsPerCoin);
    next = r.state;
    points = next.pointsPerCoin;
    events.push(
      buildEvent(next, 'coinPocketed', {
        coinId: coin.id,
        questionId,
        isCorrect: true,
        pointsAwarded: points,
      }),
    );
  }

  next = {
    ...next,
    phase: 'ready',
    activeCoinId: undefined,
    activeQuestion: undefined,
    activeShot: undefined,
  };

  // Edge: queen pending but no cover coin left → auto-secure + finish.
  if (next.queenState === 'pendingCover' && !next.coins.some((c) => c.color !== 'queen' && c.state === 'available')) {
    const bkey = `${state.sessionId}:auto-cover:Q:p${player}`;
    const r = applyCoinEvent(next, bkey, player, next.queenBonus);
    next = { ...r.state, queenState: 'secured', awaitingCover: false };
    points += next.queenBonus;
    events.push(buildEvent(next, 'coverSecured', { coinId: 'Q', pointsAwarded: next.queenBonus }));
  }

  const winner = checkWin(next);
  if (winner !== undefined) {
    next = { ...next, phase: 'finished', winner, status: 'completed' };
    events.push(buildEvent(next, 'gameFinished'));
  }
  return { state: next, events, pointsAwarded: points };
}

/** Returns 1 | 2 | 0 (draw) when the game is won, else undefined. */
export function checkWin(state: GameState): 0 | 1 | 2 | undefined {
  const [s1, s2] = state.scores;
  const boardCleared =
    !state.coins.some((c) => c.state === 'available') && state.queenState !== 'pendingCover';
  const targetHit = s1 >= state.targetScore || s2 >= state.targetScore;
  if (!targetHit && !boardCleared) return undefined;
  if (s1 !== s2) return s1 > s2 ? 1 : 2;
  // Tie-break: holder of the secured queen wins; else draw.
  if (state.queenState === 'secured' && state.queenPocketedBy) return state.queenPocketedBy;
  return 0;
}

/** Serialize for reload persistence (processed keys + all rules state). */
export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(raw: string): GameState | undefined {
  try {
    const s = JSON.parse(raw) as GameState;
    if (!s.sessionId || !Array.isArray(s.coins)) return undefined;
    return s;
  } catch {
    return undefined;
  }
}
