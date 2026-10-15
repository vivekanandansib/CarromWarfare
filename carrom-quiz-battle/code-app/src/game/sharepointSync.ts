// SharePoint synchronization contracts (pure functions — no network).
// The Canvas App Power Fx mirrors these exact field mappings; unit tests pin
// the contract so divergence is caught. Live connector calls happen only in
// the Canvas App via the SharePoint connector (see canvas-app/powerfx-carrom.ts).

import type { GameEvent, GameState, Question } from './types';

/** Raw SharePoint CarromQuestions row (as returned by the connector). */
export interface SPQuestionRow {
  QuestionId: string;
  Title?: string;
  QuestionText: string;
  Category: string;
  Difficulty: number;
  OptionA: string;
  OptionB: string;
  OptionC: string;
  OptionD: string;
  CorrectOption: number;
  Hint: string;
  IsActive: boolean;
}

/** PCF-safe question: everything the board needs, WITHOUT the answer key. */
export interface PCFQuestion {
  id: string;
  text: string;
  category: string;
  difficulty: number;
  options: [string, string, string, string];
  hint: string;
  /** Present in v1 casual builds; STRIPPED in production (server-side verdict). */
  correctIndex?: number;
}

/** Validate + convert a SharePoint row. Returns undefined for bad rows (skipped). */
export function fromQuestionRow(row: SPQuestionRow): Question | undefined {
  try {
    if (!row || typeof row.QuestionId !== 'string' || !row.QuestionId.trim()) return undefined;
    if (row.Category !== 'Learning' && row.Category !== 'Strategy') return undefined;
    if (![1, 2, 3].includes(row.Difficulty)) return undefined;
    const options = [row.OptionA, row.OptionB, row.OptionC, row.OptionD];
    if (options.some((o) => typeof o !== 'string' || !o.trim())) return undefined;
    if (![0, 1, 2, 3].includes(row.CorrectOption)) return undefined;
    if (typeof row.QuestionText !== 'string' || !row.QuestionText.trim()) return undefined;
    if (typeof row.Hint !== 'string' || !row.Hint.trim()) return undefined;
    if (row.IsActive !== true) return undefined;
    return {
      id: row.QuestionId,
      text: row.QuestionText,
      category: row.Category,
      difficulty: row.Difficulty as 1 | 2 | 3,
      options: options as [string, string, string, string],
      correctIndex: row.CorrectOption as 0 | 1 | 2 | 3,
      hint: row.Hint,
      isActive: true,
    };
  } catch {
    return undefined;
  }
}

/** Strip the answer key before sending questions to an untrusted client. */
export function stripAnswerKey(q: Question): PCFQuestion {
  const { correctIndex: _dropped, isActive: _also, ...rest } = q;
  void _dropped;
  void _also;
  return { ...rest };
}

/** Server-side verdict: compare a held-back row against the player's pick. */
export function resolveVerdict(row: SPQuestionRow, selectedOption: number): boolean {
  return row.CorrectOption === selectedOption;
}

// ---------------------------------------------------------------------------
// Canvas App Patch payloads (mirrored 1:1 in powerfx-carrom.ts)
// ---------------------------------------------------------------------------

export interface AttemptPayload {
  Title: string;
  AttemptId: string;
  SessionId: string;
  QuestionId: string;
  PlayerNumber: number;
  CoinId: string;
  SelectedOption: number;
  IsCorrect: boolean;
  AttemptedAt: string;
}

export function attemptPayload(ev: GameEvent, nowIso?: string): AttemptPayload | undefined {
  if (ev.eventType !== 'attemptMade' || !ev.questionId || !ev.coinId) return undefined;
  return {
    Title: ev.eventId,
    AttemptId: ev.eventId,
    SessionId: ev.sessionId,
    QuestionId: ev.questionId,
    PlayerNumber: ev.playerNumber,
    CoinId: ev.coinId,
    SelectedOption: ev.selectedOption ?? -1,
    IsCorrect: ev.isCorrect ?? false,
    AttemptedAt: nowIso ?? new Date().toISOString(),
  };
}

export interface CoinEventPayload {
  Title: string;
  EventKey: string;
  SessionId: string;
  CoinId: string;
  PlayerNumber: number;
  EventType: 'coinPocketed' | 'coverSecured' | 'coverFailed';
  PointsAwarded: number;
  EventAt: string;
}

/** Only scoring events produce coin rows; EventKey is the dedup key. */
export function coinEventPayload(ev: GameEvent, nowIso?: string): CoinEventPayload | undefined {
  if (ev.eventType !== 'coinPocketed' && ev.eventType !== 'coverSecured' && ev.eventType !== 'coverFailed')
    return undefined;
  return {
    Title: `${ev.sessionId}-${ev.eventId}`,
    EventKey: `${ev.sessionId}-${ev.eventId}`,
    SessionId: ev.sessionId,
    CoinId: ev.coinId ?? '',
    PlayerNumber: ev.playerNumber,
    EventType: ev.eventType,
    PointsAwarded: ev.pointsAwarded ?? 0,
    EventAt: nowIso ?? new Date().toISOString(),
  };
}

export interface SessionPayload {
  Title: string;
  SessionId: string;
  Player1Name: string;
  Player2Name: string;
  CurrentPlayer: number;
  Player1Score: number;
  Player2Score: number;
  GameStatus: 'inProgress' | 'completed';
  Winner: number;
}

export function sessionPayload(state: GameState): SessionPayload {
  return {
    Title: state.sessionId,
    SessionId: state.sessionId,
    Player1Name: state.playerNames[0],
    Player2Name: state.playerNames[1],
    CurrentPlayer: state.currentPlayer,
    Player1Score: state.scores[0],
    Player2Score: state.scores[1],
    GameStatus: state.status,
    Winner: state.winner ?? 0,
  };
}
