// Reload-safe persistence (localStorage cache; SharePoint becomes authoritative in Phase 2).
import { deserializeState, serializeState } from './engine';
import type { GameState } from './types';

const KEY_PREFIX = 'carrom-quiz-battle:';

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY_PREFIX + state.sessionId, serializeState(state));
    localStorage.setItem(KEY_PREFIX + 'last', state.sessionId);
    return true;
  } catch {
    return false; // storage full / private mode → recoverable, game continues in memory
  }
}

export function loadGame(sessionId: string): GameState | undefined {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + sessionId);
    if (!raw) return undefined;
    return deserializeState(raw);
  } catch {
    return undefined;
  }
}

export function loadLastGame(): GameState | undefined {
  try {
    const id = localStorage.getItem(KEY_PREFIX + 'last');
    if (!id) return undefined;
    return loadGame(id);
  } catch {
    return undefined;
  }
}

export function clearGame(sessionId: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + sessionId);
  } catch {
    /* ignore */
  }
}
