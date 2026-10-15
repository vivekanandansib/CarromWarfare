// SharePoint repository for the code app: loads the question bank and persists
// sessions, attempts, and coin events using the generated connector services.
// Field mappings mirror app/src/game/sharepointSync.ts (payload builders reused).
import { CarromAttemptsService } from './generated/services/CarromAttemptsService';
import { CarromCoinEventsService } from './generated/services/CarromCoinEventsService';
import { CarromQuestionsService } from './generated/services/CarromQuestionsService';
import { CarromSessionsService } from './generated/services/CarromSessionsService';
import type { CarromQuestionsRead } from './generated/models/CarromQuestionsModel';
import { attemptPayload, coinEventPayload } from './game/sharepointSync';
import { serializeState } from './game/engine';
import type { GameEvent, GameState, Question } from './game/types';

export class SpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpError';
  }
}

function unwrap<T>(res: { success: boolean; data: T; error?: unknown }, what: string): T {
  if (!res.success || res.data === undefined || res.data === null) {
    const detail =
      res.error instanceof Error ? res.error.message : JSON.stringify(res.error ?? '');
    throw new SpError(`${what} failed. ${detail}`.trim());
  }
  return res.data;
}

/** Connector read rows use expanded choice objects — adapt to engine Questions. */
export function rowToQuestion(r: CarromQuestionsRead): Question | undefined {
  const out = rowToQuestionDetailed(r);
  return 'question' in out ? out.question : undefined;
}

function isActiveTrue(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'Yes' || v === 'yes' || v === 'true';
}

export function rowToQuestionDetailed(
  r: CarromQuestionsRead,
): { question: Question } | { reason: string } {
  const id = (r.QuestionId ?? '').trim();
  if (!id) return { reason: 'a row is missing QuestionId' };
  if (!isActiveTrue(r.IsActive))
    return { reason: `${id}: IsActive is not Yes (got ${JSON.stringify(r.IsActive)})` };
  const category = r.Category?.Value ?? '';
  if (category !== 'Learning' && category !== 'Strategy')
    return { reason: `${id}: bad Category (got ${JSON.stringify(category)})` };
  if (![1, 2, 3].includes(r.Difficulty ?? -1))
    return { reason: `${id}: bad Difficulty (got ${JSON.stringify(r.Difficulty)})` };
  const options = [r.OptionA ?? '', r.OptionB ?? '', r.OptionC ?? '', r.OptionD ?? ''];
  if (options.some((o) => !o.trim())) return { reason: `${id}: needs 4 non-empty options` };
  if (![0, 1, 2, 3].includes(r.CorrectOption ?? -1))
    return { reason: `${id}: bad CorrectOption (got ${JSON.stringify(r.CorrectOption)})` };
  if (!r.QuestionText?.trim()) return { reason: `${id}: missing QuestionText` };
  if (!r.Hint?.trim()) return { reason: `${id}: missing Hint` };
  return {
    question: {
      id,
      text: r.QuestionText,
      category,
      difficulty: r.Difficulty as 1 | 2 | 3,
      options: options as [string, string, string, string],
      correctIndex: r.CorrectOption as 0 | 1 | 2 | 3,
      hint: r.Hint,
      isActive: true,
    },
  };
}

export interface QuestionLoad {
  questions: Question[];
  skipped: number;
  fetched: number;
  reasons: string[];
}

export async function loadActiveQuestions(): Promise<QuestionLoad> {
  // No server-side filter: Yes/No + Choice filtering varies by connector —
  // fetch rows (cap 500) and filter client-side.
  const res = await CarromQuestionsService.getAll({ top: 500 });
  const rows = unwrap(res, 'Loading questions');
  const questions: Question[] = [];
  const reasons: string[] = [];
  let skipped = 0;
  for (const r of rows) {
    const out = rowToQuestionDetailed(r);
    if ('question' in out) questions.push(out.question);
    else {
      skipped++;
      if (reasons.length < 3) reasons.push(out.reason);
    }
  }
  return { questions, skipped, fetched: rows.length, reasons };
}

export async function createSessionRow(state: GameState, player2Name?: string): Promise<string> {
  const now = new Date().toISOString();
  const p2 = (player2Name ?? state.playerNames[1]).trim();
  const created = unwrap(
    await CarromSessionsService.create({
      Title: state.sessionId,
      SessionId: state.sessionId,
      Player1Name: state.playerNames[0],
      // Omit when empty: some connectors reject empty strings for text columns.
      ...(p2 ? { Player2Name: p2 } : {}),
      CurrentPlayer: state.currentPlayer,
      Player1Score: 0,
      Player2Score: 0,
      GameStatus: 'inProgress',
      StartedAt: now,
      Winner: 0,
      WinnerComputed: false,
      StateJson: serializeState(state),
    }),
    'Creating session',
  );
  if (typeof created.ID !== 'number') throw new SpError('Creating session failed (no item ID).');
  return String(created.ID);
}

export async function patchSessionRow(rowId: string, state: GameState): Promise<void> {
  const finished = state.status === 'completed';
  unwrap(
    await CarromSessionsService.update(rowId, {
      CurrentPlayer: state.currentPlayer,
      Player1Score: state.scores[0],
      Player2Score: state.scores[1],
      GameStatus: state.status,
      StateJson: serializeState(state),
      ...(finished
        ? {
            CompletedAt: new Date().toISOString(),
            Winner: state.winner ?? 0,
            // Leave WinnerComputed=false so the winner flow announces the result.
          }
        : {}),
    }),
    'Saving session',
  );
}

/** Fetch one session row by SessionId (for polling / joining). */
export async function fetchSessionRow(sessionId: string) {
  const rows = unwrap(
    await CarromSessionsService.getAll({
      filter: `SessionId eq '${sessionId.replace(/'/g, "''")}'`,
      top: 1,
    }),
    'Reading session',
  );
  return rows[0] as
    | {
        ID?: number;
        SessionId?: string;
        Player1Name?: string;
        Player2Name?: string;
        StateJson?: string;
        GameStatus?: { Value?: string };
      }
    | undefined;
}

/** List recent sessions (for room-code join). No server-side status filter — Choice
 *  filtering varies by connector, so callers filter client-side. */
export async function listOpenSessions() {
  const rows = unwrap(
    await CarromSessionsService.getAll({
      orderBy: ['StartedAt desc'],
      top: 50,
    }),
    'Listing sessions',
  );
  return rows as {
    ID?: number;
    SessionId?: string;
    Player1Name?: string;
    Player2Name?: string;
    GameStatus?: { Value?: string };
    StateJson?: string;
  }[];
}

/** Guest claims seat 2 in an open session. */
export async function joinSessionAsPlayer2(rowId: number, name: string): Promise<void> {
  unwrap(await CarromSessionsService.update(String(rowId), { Player2Name: name }), 'Joining session');
}

export async function saveAttempt(ev: GameEvent): Promise<void> {
  const p = attemptPayload(ev);
  if (!p) return;
  unwrap(
    await CarromAttemptsService.create({
      Title: p.Title,
      AttemptId: p.AttemptId,
      SessionId: p.SessionId,
      QuestionId: p.QuestionId,
      PlayerNumber: p.PlayerNumber,
      CoinId: p.CoinId,
      SelectedOption: p.SelectedOption,
      IsCorrect: p.IsCorrect,
      AttemptedAt: p.AttemptedAt,
    }),
    'Saving attempt',
  );
}

/** Idempotent coin-event write: EventKey is unique — replays are skipped. */
export async function saveCoinEvent(ev: GameEvent): Promise<'saved' | 'duplicate' | 'skipped'> {
  const p = coinEventPayload(ev);
  if (!p) return 'skipped';
  const existing = unwrap(
    await CarromCoinEventsService.getAll({
      filter: `EventKey eq '${p.EventKey.replace(/'/g, "''")}'`,
      top: 1,
      select: ['ID'],
    }),
    'Checking coin event',
  );
  if (existing.length > 0) return 'duplicate';
  unwrap(
    await CarromCoinEventsService.create({
      Title: p.Title,
      EventKey: p.EventKey,
      SessionId: p.SessionId,
      CoinId: p.CoinId,
      PlayerNumber: p.PlayerNumber,
      EventType: p.EventType,
      PointsAwarded: p.PointsAwarded,
      EventAt: p.EventAt,
    }),
    'Saving coin event',
  );
  return 'saved';
}
