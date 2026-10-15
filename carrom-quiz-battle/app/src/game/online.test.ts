import { describe, expect, it } from 'vitest';
import {
  describeRows,
  findSessionByCode,
  roomCodeForSession,
  shouldAdopt,
  snapshotMode,
} from './online';

describe('room codes', () => {
  it('derives a stable 6-char readable code', () => {
    const a = roomCodeForSession('sess-abc123-xyz');
    expect(a).toMatch(/^[A-Z2-9]{6}$/);
    expect(roomCodeForSession('sess-abc123-xyz')).toBe(a); // deterministic
    expect(roomCodeForSession('sess-other-456')).not.toBe(a);
    // bulk: never undefined chars, always length 6
    for (let i = 0; i < 200; i++) {
      const c = roomCodeForSession(`sess-bulk-${i}-zzz`);
      expect(c).toMatch(/^[A-Z2-9]{6}$/);
    }
  });

  it('finds a joinable session by code, case-insensitive', () => {
    const rows = [
      { ID: 1, SessionId: 'sess-aaa', Player1Name: 'A', GameStatus: 'completed' },
      { ID: 2, SessionId: 'sess-bbb', Player1Name: 'B', Player2Name: '', GameStatus: 'inProgress' },
    ];
    const code = roomCodeForSession('sess-bbb');
    expect(findSessionByCode(rows, code.toLowerCase())?.ID).toBe(2);
    expect(findSessionByCode(rows, 'ZZZZZZ')).toBeUndefined();
    // completed sessions never match even with the right code
    expect(findSessionByCode(rows, roomCodeForSession('sess-aaa'))).toBeUndefined();
  });

  it('falls back to the snapshot status when the Choice column reads empty', () => {
    const live = {
      ID: 9,
      SessionId: 'sess-live',
      StateJson: JSON.stringify({ status: 'inProgress' }),
    };
    const done = {
      ID: 10,
      SessionId: 'sess-done',
      StateJson: JSON.stringify({ status: 'completed' }),
    };
    expect(findSessionByCode([live], roomCodeForSession('sess-live'))?.ID).toBe(9);
    expect(findSessionByCode([done], roomCodeForSession('sess-done'))).toBeUndefined();
    // unknown status (no snapshot either) still allows the join attempt
    const unknown = { ID: 11, SessionId: 'sess-mystery' };
    expect(findSessionByCode([unknown], roomCodeForSession('sess-mystery'))?.ID).toBe(11);
  });

  it('describes scanned rows for diagnostics', () => {
    const rows = [{ ID: 7, SessionId: 'sess-diag', GameStatus: 'inProgress' }];
    const d = describeRows(rows);
    expect(d).toContain('#7:');
    expect(d).toContain(roomCodeForSession('sess-diag'));
    expect(d).toContain('(inProgress)');
  });
});

describe('adopt logic', () => {
  it('adopts only genuinely new remote snapshots', () => {
    expect(
      shouldAdopt({ serverJson: undefined, lastWrittenJson: null, lastSeenJson: null }),
    ).toBe(false);
    expect(shouldAdopt({ serverJson: 'A', lastWrittenJson: 'A', lastSeenJson: null })).toBe(false); // own echo
    expect(shouldAdopt({ serverJson: 'A', lastWrittenJson: null, lastSeenJson: 'A' })).toBe(false); // unchanged
    expect(shouldAdopt({ serverJson: 'B', lastWrittenJson: 'A', lastSeenJson: 'A' })).toBe(true);
  });

  it('separates quiz and classic rooms by snapshot mode', () => {
    const quiz = { ID: 20, SessionId: 'sess-q1', StateJson: JSON.stringify({ status: 'inProgress' }) };
    const classic = {
      ID: 21,
      SessionId: 'sess-c1',
      StateJson: JSON.stringify({ mode: 'classic', rules: { status: 'inProgress' } }),
    };
    const legacy = { ID: 22, SessionId: 'sess-old' };
    expect(snapshotMode(quiz)).toBe('quiz');
    expect(snapshotMode(classic)).toBe('classic');
    expect(snapshotMode(legacy)).toBe('unknown');
    // quiz join ignores classic rooms, accepts quiz + legacy
    expect(findSessionByCode([quiz, classic, legacy], roomCodeForSession('sess-c1'))).toBeUndefined();
    expect(findSessionByCode([quiz, classic, legacy], roomCodeForSession('sess-q1'))?.ID).toBe(20);
    expect(findSessionByCode([quiz, classic, legacy], roomCodeForSession('sess-old'))?.ID).toBe(22);
    // classic join only takes classic rooms
    expect(findSessionByCode([quiz, classic, legacy], roomCodeForSession('sess-c1'), 'classic')?.ID).toBe(21);
    expect(findSessionByCode([quiz, classic, legacy], roomCodeForSession('sess-q1'), 'classic')).toBeUndefined();
  });
});
