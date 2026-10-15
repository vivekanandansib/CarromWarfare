// Online-room helpers (pure, UI-agnostic, unit-tested).
// Transport = the CarromSessions row: StateJson carries the full GameState,
// Modified/StateJson comparison detects remote moves. Turns strictly alternate,
// so only the current player's device ever writes — no merge conflicts.

/** Short room code derived deterministically from a sessionId (6 uppercase alnum). */
export function roomCodeForSession(sessionId: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < sessionId.length; i++) {
    const c = sessionId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = (Math.imul(h2 + c, 31) + (h1 & 0xffff)) >>> 0;
  }
  const n = (BigInt(h1) << 32n) | BigInt(h2);
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no confusables (0/O/1/I/L)
  const base = BigInt(alphabet.length);
  let code = '';
  let v = n;
  for (let i = 0; i < 6; i++) {
    code += alphabet[Number(v % base)];
    v = v / base;
  }
  return code;
}

export interface RoomRow {
  ID?: number;
  SessionId?: string;
  Player1Name?: string;
  Player2Name?: string;
  GameStatus?: { Value?: string } | string;
  StateJson?: string;
}

function statusOf(row: RoomRow): string {
  const gs = row.GameStatus;
  if (typeof gs === 'string') return gs;
  if (gs && typeof gs.Value === 'string' && gs.Value) return gs.Value;
  // Fallback: Choice columns sometimes read back empty through the connector —
  // the row's own snapshot always knows the phase.
  try {
    const s = row.StateJson ? (JSON.parse(row.StateJson) as { status?: unknown }) : undefined;
    if (s && (s.status === 'inProgress' || s.status === 'completed'))
      return s.status as string;
  } catch {
    /* ignore */
  }
  return '';
}

/** Which game a session row hosts, read from its own snapshot (connector-proof). */
export function snapshotMode(row: RoomRow): 'quiz' | 'classic' | 'unknown' {
  try {
    const s = row.StateJson ? (JSON.parse(row.StateJson) as { mode?: unknown; status?: unknown }) : undefined;
    if (s && typeof s === 'object') {
      if (s.mode === 'classic') return 'classic';
      if (s.status === 'inProgress' || s.status === 'completed') return 'quiz';
    }
  } catch {
    /* ignore */
  }
  return 'unknown';
}

/** Find a joinable in-progress session by room code (client-side match). */
export function findSessionByCode(
  rows: RoomRow[],
  code: string,
  mode: 'quiz' | 'classic' = 'quiz',
): RoomRow | undefined {
  const want = code.trim().toUpperCase();
  return rows.find((r) => {
    if (typeof r.SessionId !== 'string' || roomCodeForSession(r.SessionId) !== want) return false;
    const st = statusOf(r);
    if (st !== 'inProgress' && st !== '') return false;
    const snapMode = snapshotMode(r);
    // Quiz rooms predate snapshots ('unknown'); classic rooms always carry theirs.
    return mode === 'classic' ? snapMode === 'classic' : snapMode !== 'classic';
  });
}

/** One-line diagnostic of scanned rows: #ID:CODE(status). No secrets, rooms only. */
export function describeRows(rows: RoomRow[]): string {
  return rows
    .map((r) => {
      const code = typeof r.SessionId === 'string' ? roomCodeForSession(r.SessionId) : '?';
      return `#${r.ID ?? '?'}:${code}(${statusOf(r) || 'no-status'})`;
    })
    .join(', ');
}

/**
 * Should this device adopt the server snapshot?
 * Never adopt our own just-written state (echo) or an unchanged snapshot.
 */
export function shouldAdopt(args: {
  serverJson: string | undefined;
  lastWrittenJson: string | null;
  lastSeenJson: string | null;
}): boolean {
  const { serverJson, lastWrittenJson, lastSeenJson } = args;
  if (!serverJson) return false;
  if (serverJson === lastWrittenJson) return false;
  if (serverJson === lastSeenJson) return false;
  return true;
}
