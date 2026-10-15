// GameEvent helpers shared with the future PCF output (schema v1.0).
import type { GameEvent, GameEventType, PlayerNumber } from './types';
import { makeId } from './engine';

export const GAME_EVENT_SCHEMA = '1.0' as const;

export function createGameEvent(
  sessionId: string,
  eventType: GameEventType,
  playerNumber: PlayerNumber,
  fields?: Partial<GameEvent>,
): GameEvent {
  return {
    schemaVersion: GAME_EVENT_SCHEMA,
    eventId: makeId('evt'),
    sessionId,
    eventType,
    playerNumber,
    score: [0, 0],
    currentPlayer: playerNumber,
    gameStatus: 'inProgress',
    ...fields,
  };
}

/** Unique idempotency key for a coin/cover event (SharePoint EventKey column). */
export function eventKeyFor(sessionId: string, eventId: string): string {
  return `${sessionId}-${eventId}`;
}

export function parseGameEvent(raw: string): GameEvent | undefined {
  try {
    const e = JSON.parse(raw) as GameEvent;
    if (e.schemaVersion !== '1.0' || !e.sessionId || !e.eventType) return undefined;
    return e;
  } catch {
    return undefined;
  }
}
