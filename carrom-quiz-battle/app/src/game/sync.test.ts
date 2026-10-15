import { describe, expect, it } from 'vitest';
import { createGameEvent, eventKeyFor, parseGameEvent } from './events';
import { EventBridge } from './eventBridge';
import {
  answerQuestion,
  completeAnimation,
  createGame,
  selectCoin,
} from './engine';
import { QuestionBank } from './questions';
import { SAMPLE_QUESTIONS } from '../data/questions';
import {
  attemptPayload,
  coinEventPayload,
  fromQuestionRow,
  resolveVerdict,
  sessionPayload,
  stripAnswerKey,
  type SPQuestionRow,
} from './sharepointSync';

const ROW: SPQuestionRow = {
  QuestionId: 'L-01',
  QuestionText: 'Which gas do plants absorb for photosynthesis?',
  Category: 'Learning',
  Difficulty: 1,
  OptionA: 'Oxygen',
  OptionB: 'Carbon dioxide',
  OptionC: 'Nitrogen',
  OptionD: 'Hydrogen',
  CorrectOption: 1,
  Hint: 'It is what we exhale.',
  IsActive: true,
};

describe('SharePoint question rows', () => {
  it('converts a valid row', () => {
    const q = fromQuestionRow(ROW)!;
    expect(q.id).toBe('L-01');
    expect(q.correctIndex).toBe(1);
    expect(q.isActive).toBe(true);
  });

  it('skips invalid/inactive rows without throwing', () => {
    expect(fromQuestionRow({ ...ROW, Category: 'X' })).toBeUndefined();
    expect(fromQuestionRow({ ...ROW, IsActive: false })).toBeUndefined();
    expect(fromQuestionRow({ ...ROW, CorrectOption: 9 })).toBeUndefined();
    expect(fromQuestionRow({ ...ROW, OptionA: '' })).toBeUndefined();
    expect(fromQuestionRow(undefined as never)).toBeUndefined();
  });

  it('strips the answer key for untrusted clients', () => {
    const q = fromQuestionRow(ROW)!;
    const safe = stripAnswerKey(q);
    expect('correctIndex' in safe).toBe(false);
    expect(safe.id).toBe('L-01');
    expect(safe.options).toHaveLength(4);
  });

  it('resolves verdicts server-side from the held-back row', () => {
    expect(resolveVerdict(ROW, 1)).toBe(true);
    expect(resolveVerdict(ROW, 0)).toBe(false);
  });
});

describe('persistence payloads mirror the Power Fx formulas', () => {
  it('attempt payload carries the full attempt grain', () => {
    const bank = new QuestionBank(SAMPLE_QUESTIONS);
    let s = createGame({ sessionId: 'sess-1', playerNames: ['A', 'B'], targetScore: 50 });
    s = selectCoin(s, bank, 'W1').state;
    const ans = answerQuestion(s, s.activeQuestion!.correctIndex);
    const ev = ans.events.find((e) => e.eventType === 'attemptMade')!;
    const p = attemptPayload(ev, '2026-01-01T00:00:00Z')!;
    expect(p.SessionId).toBe('sess-1');
    expect(p.QuestionId).toBe(s.activeQuestion!.id);
    expect(p.CoinId).toBe('W1');
    expect(p.IsCorrect).toBe(true);
    expect(p.AttemptId).toBe(ev.eventId);
  });

  it('coin payload uses sessionId-eventId as the unique EventKey', () => {
    const bank = new QuestionBank(SAMPLE_QUESTIONS);
    let s = createGame({ sessionId: 'sess-1', playerNames: ['A', 'B'], targetScore: 50 });
    s = selectCoin(s, bank, 'W1').state;
    s = answerQuestion(s, s.activeQuestion!.correctIndex).state;
    const done = completeAnimation(s);
    const pocket = done.events.find((e) => e.eventType === 'coinPocketed')!;
    const p = coinEventPayload(pocket)!;
    expect(p.EventKey).toBe(`sess-1-${pocket.eventId}`);
    expect(p.PointsAwarded).toBe(10);
    // non-scoring events produce no coin row
    const bank2 = new QuestionBank(SAMPLE_QUESTIONS);
    let s2 = createGame({ sessionId: 'sess-2', playerNames: ['A', 'B'], targetScore: 50 });
    s2 = selectCoin(s2, bank2, 'W1').state;
    const wrong = answerQuestion(s2, (s2.activeQuestion!.correctIndex + 1) % 4);
    const attemptEv = wrong.events.find((e) => e.eventType === 'attemptMade')!;
    expect(coinEventPayload(attemptEv)).toBeUndefined();
  });

  it('session payload reflects scores, turn, status, winner', () => {
    let s = createGame({ sessionId: 'sess-9', playerNames: ['Asha', 'Ravi'], targetScore: 10 });
    const bank = new QuestionBank(SAMPLE_QUESTIONS);
    s = selectCoin(s, bank, 'W1').state;
    s = answerQuestion(s, s.activeQuestion!.correctIndex).state;
    s = completeAnimation(s).state;
    const p = sessionPayload(s);
    expect(p).toMatchObject({
      SessionId: 'sess-9',
      Player1Score: 10,
      GameStatus: 'completed',
      Winner: 1,
    });
  });
});

describe('PCF output bridge', () => {
  it('emits valid versioned JSON with a monotonic sequence', () => {
    const bridge = new EventBridge();
    const ev = createGameEvent('sess-1', 'coinPocketed', 1, {
      coinId: 'W1',
      pointsAwarded: 10,
      score: [10, 0],
    });
    const o1 = bridge.push(ev);
    expect(o1.eventSequence).toBe(1);
    const parsed = parseGameEvent(o1.gameEventJson)!;
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.eventType).toBe('coinPocketed');
    const o2 = bridge.push({ ...ev });
    expect(o2.eventSequence).toBe(2);
    // same eventId replayed => same idempotency key, never double-scored
    expect(eventKeyFor(parsed.sessionId, parsed.eventId)).toBe(
      eventKeyFor('sess-1', ev.eventId),
    );
  });

  it('starts empty (sequence 0) so the Canvas App ignores it until first event', () => {
    expect(new EventBridge().getOutputs()).toEqual({ gameEventJson: '', eventSequence: 0 });
  });
});
