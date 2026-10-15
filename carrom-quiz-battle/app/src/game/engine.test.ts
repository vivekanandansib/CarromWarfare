import { describe, expect, it } from 'vitest';
import { SAMPLE_QUESTIONS } from '../data/questions';
import {
  answerQuestion,
  applyCoinEvent,
  availableCoins,
  checkWin,
  completeAnimation,
  completeMiss,
  createGame,
  EngineError,
  expireIdleTurn,
  selectCoin,
} from './engine';
import { QuestionBank } from './questions';
import type { GameState, PlayerNumber } from './types';

function setup(targetScore = 50) {
  const bank = new QuestionBank(SAMPLE_QUESTIONS);
  let state = createGame({
    sessionId: 'sess-test',
    playerNames: ['Asha', 'Ravi'],
    targetScore,
  });
  return { bank, state };
}

function answerCorrectly(state: GameState) {
  const idx = state.activeQuestion!.correctIndex;
  return answerQuestion(state, idx);
}

function answerWrongly(state: GameState) {
  const idx = ((state.activeQuestion!.correctIndex + 1) % 4) as 0 | 1 | 2 | 3;
  return answerQuestion(state, idx);
}

function selectFirst(state: GameState, bank: QuestionBank, excludeQueen = true) {
  const coin = availableCoins(state).find((c) =>
    excludeQueen ? c.color !== 'queen' : true,
  )!;
  return selectCoin(state, bank, coin.id);
}

describe('open coin selection', () => {
  it('either player can select any available coin regardless of color', () => {
    const { bank, state } = setup();
    const white = availableCoins(state).find((c) => c.color === 'white')!;
    const black = availableCoins(state).find((c) => c.color === 'black')!;
    // P1 takes a white coin, answers wrong → miss animation → turn passes
    let s = selectCoin(state, bank, white.id).state;
    s = answerWrongly(s).state;
    expect(s.phase).toBe('animating');
    expect(s.currentPlayer).toBe(1); // turn passes only at miss completion
    s = completeMiss(s).state;
    expect(s.currentPlayer).toBe(2);
    // P2 can take a black coin
    const r = selectCoin(s, bank, black.id);
    expect(r.state.phase).toBe('asking');
    expect(r.state.currentPlayer).toBe(2);
  });
});

describe('pocket + turn rules', () => {
  it('correct answer pockets exactly one coin and retains the turn', () => {
    const { bank, state } = setup();
    const before = availableCoins(state).length;
    let s = selectFirst(state, bank).state;
    const coinId = s.activeCoinId!;
    s = answerCorrectly(s).state;
    expect(s.phase).toBe('animating');
    const done = completeAnimation(s);
    expect(done.state.phase).toBe('ready');
    expect(availableCoins(done.state).length).toBe(before - 1);
    expect(done.state.scores[0]).toBe(10);
    expect(done.state.currentPlayer).toBe(1); // turn retained
    expect(done.pointsAwarded).toBe(10);
    expect(done.state.coins.find((c) => c.id === coinId)!.state).toBe('pocketed');
  });

  it('wrong answer plays a miss animation, then leaves the coin and passes the turn once', () => {
    const { bank, state } = setup();
    const before = availableCoins(state).length;
    let s = selectFirst(state, bank).state;
    const coinId = s.activeCoinId!;
    const res = answerWrongly(s);
    expect(res.correct).toBe(false);
    expect(res.state.phase).toBe('animating');
    expect(res.state.animKind).toBe('miss');
    expect(res.state.currentPlayer).toBe(1); // not yet passed
    expect(res.state.coins.find((c) => c.id === coinId)!.state).toBe('available');
    const done = completeMiss(res.state);
    expect(done.state.phase).toBe('ready');
    expect(done.state.currentPlayer).toBe(2);
    expect(availableCoins(done.state).length).toBe(before);
    expect(done.state.coins.find((c) => c.id === coinId)!.state).toBe('available');
    expect(done.events.some((e) => e.eventType === 'turnChanged')).toBe(true);
    // A second completion of the same miss is rejected (turn passes exactly once)
    expect(() => completeMiss(done.state)).toThrowError(EngineError);
    // Duplicate submission while the miss is in flight is rejected
    s = selectFirst(done.state, bank).state;
    const once = answerWrongly(s);
    expect(() => answerQuestion(once.state, 0)).toThrowError(EngineError);
  });
});

describe('queen + cover', () => {
  it('queen requires a successful follow-up cover for the bonus', () => {
    const { bank, state } = setup();
    // 1. pocket queen
    let s = selectCoin(state, bank, 'Q').state;
    expect(s.activeQuestion!.difficulty).toBe(3); // harder challenge
    s = answerCorrectly(s).state;
    expect(s.queenState).toBe('pendingCover');
    let done = completeAnimation(s);
    expect(done.state.scores[0]).toBe(10); // normal points, no bonus yet
    expect(done.state.currentPlayer).toBe(1);
    expect(done.state.awaitingCover).toBe(true);

    // 2. cover with a different coin
    s = selectFirst(done.state, bank).state;
    expect(s.activeCoinId).not.toBe('Q');
    s = answerCorrectly(s).state;
    done = completeAnimation(s);
    expect(done.state.queenState).toBe('secured');
    expect(done.state.scores[0]).toBe(10 + 10 + 20); // queen + cover coin + bonus
    expect(done.pointsAwarded).toBe(30);
    expect(done.state.awaitingCover).toBe(false);
  });

  it('failed cover returns the queen, cancels the bonus, passes the turn', () => {
    const { bank, state } = setup();
    let s = selectCoin(state, bank, 'Q').state;
    s = answerCorrectly(s).state;
    let done = completeAnimation(s);
    expect(done.state.queenState).toBe('pendingCover');
    const coverCoin = availableCoins(done.state).find((c) => c.color !== 'queen')!;
    s = selectCoin(done.state, bank, coverCoin.id).state;
    const res = answerWrongly(s);
    expect(res.state.animKind).toBe('miss');
    const miss = completeMiss(res.state);
    expect(miss.state.queenState).toBe('available');
    expect(miss.state.coins.find((c) => c.id === 'Q')!.state).toBe('available');
    expect(miss.state.coins.find((c) => c.id === coverCoin.id)!.state).toBe('available');
    expect(miss.state.scores).toEqual([10, 0]); // only the queen pocket, no bonus
    expect(miss.state.currentPlayer).toBe(2);
    expect(miss.events.some((e) => e.eventType === 'coverFailed')).toBe(true);
  });

  it('queen cannot be selected while pending cover', () => {
    const { bank, state } = setup();
    let s = selectCoin(state, bank, 'Q').state;
    s = answerCorrectly(s).state;
    s = completeAnimation(s).state;
    // Queen coin is pocketed (pendingCover) → selecting it throws
    expect(() => selectCoin(s, bank, 'Q')).toThrowError(EngineError);
  });
});

describe('idempotency + illegal transitions', () => {
  it('duplicate coin events never award duplicate points', () => {
    const { state } = setup();
    const key = 'sess-test:evt-1';
    const r1 = applyCoinEvent(state, key, 1, 10);
    expect(r1.applied).toBe(true);
    expect(r1.state.scores[0]).toBe(10);
    const r2 = applyCoinEvent(r1.state, key, 1, 10);
    expect(r2.applied).toBe(false);
    expect(r2.state.scores[0]).toBe(10);
  });

  it('completing the same animation twice is rejected (no double pocket)', () => {
    const { bank, state } = setup();
    let s = selectFirst(state, bank).state;
    s = answerCorrectly(s).state;
    const done = completeAnimation(s);
    expect(() => completeAnimation(done.state)).toThrowError(EngineError);
    expect(done.state.scores[0]).toBe(10);
  });

  it('rejects select while asking/animating and answer while ready', () => {
    const { bank, state } = setup();
    const asking = selectFirst(state, bank).state;
    const other = availableCoins(asking)[1];
    expect(() => selectCoin(asking, bank, other.id)).toThrowError(EngineError);
    expect(() => answerQuestion(state, 0)).toThrowError(EngineError);
    const anim = answerCorrectly(asking).state;
    expect(() => selectCoin(anim, bank, other.id)).toThrowError(EngineError);
  });

  it('empty question bank is a recoverable error, game stays ready', () => {
    const empty = new QuestionBank([]);
    const { state } = setup();
    expect(() => selectCoin(state, empty, availableCoins(state)[0].id)).toThrowError(
      expect.objectContaining({ code: 'EMPTY_BANK' }),
    );
    expect(state.phase).toBe('ready');
  });
});

describe('win conditions', () => {
  it('reaching the target score finishes the game', () => {
    const { bank, state } = setup(10);
    let s = selectFirst(state, bank).state;
    s = answerCorrectly(s).state;
    const done = completeAnimation(s);
    expect(done.state.phase).toBe('finished');
    expect(done.state.winner).toBe(1);
    expect(done.state.status).toBe('completed');
    expect(done.events.some((e) => e.eventType === 'gameFinished')).toBe(true);
  });

  it('end-of-board tie goes to the queen holder, else draw', () => {
    const { state } = setup(1000);
    const cleared: GameState = {
      ...state,
      coins: state.coins.map((c) => ({ ...c, state: 'pocketed' as const })),
      scores: [30, 30] as [number, number],
      queenState: 'secured',
      queenPocketedBy: 2 as PlayerNumber,
    };
    expect(checkWin(cleared)).toBe(2);
    const draw: GameState = { ...cleared, queenState: 'available', queenPocketedBy: undefined };
    expect(checkWin(draw)).toBe(0);
  });
});

describe('shots matter: difficulty gating + bonus points', () => {
  it('bank shots ask the hardest questions and pay +5', () => {
    const { bank, state } = setup();
    const coin = availableCoins(state).find((c) => c.color !== 'queen')!;
    const s = selectCoin(state, bank, coin.id, 'bank').state;
    expect(s.activeQuestion!.difficulty).toBe(3);
    const done = completeAnimation(answerCorrectly(s).state);
    expect(done.pointsAwarded).toBe(15);
    expect(done.state.scores[0]).toBe(15);
  });

  it('cut shots ask difficulty 2+ and pay +2', () => {
    const { bank, state } = setup();
    const coin = availableCoins(state).find((c) => c.color !== 'queen')!;
    const s = selectCoin(state, bank, coin.id, 'cut').state;
    expect(s.activeQuestion!.difficulty).toBeGreaterThanOrEqual(2);
    const done = completeAnimation(answerCorrectly(s).state);
    expect(done.pointsAwarded).toBe(12);
  });

  it('defensive shots ask easy questions for standard points', () => {
    const { bank, state } = setup();
    const coin = availableCoins(state).find((c) => c.color !== 'queen')!;
    const s = selectCoin(state, bank, coin.id, 'defensive').state;
    expect(s.activeQuestion!.difficulty).toBe(1);
    const done = completeAnimation(answerCorrectly(s).state);
    expect(done.pointsAwarded).toBe(10);
  });

  it('queen challenges stay hard no matter the shot', () => {
    const { bank, state } = setup();
    for (const shot of ['straight', 'cut', 'bank', 'defensive'] as const) {
      const s = selectCoin(state, bank, 'Q', shot).state;
      expect(s.activeQuestion!.difficulty).toBe(3);
    }
  });
});

describe('shot clock', () => {
  it('idle expiry passes the turn with no scoring and no animation', () => {
    const { state } = setup();
    const r1 = expireIdleTurn(state);
    expect(r1.state.phase).toBe('ready');
    expect(r1.state.currentPlayer).toBe(2);
    expect(r1.state.scores).toEqual([0, 0]);
    expect(availableCoins(r1.state).length).toBe(availableCoins(state).length);
    const r2 = expireIdleTurn(r1.state);
    expect(r2.state.currentPlayer).toBe(1);
  });

  it('idle expiry during a queen cover returns the queen', () => {
    const { bank, state } = setup();
    let s = selectCoin(state, bank, 'Q').state;
    s = answerCorrectly(s).state;
    s = completeAnimation(s).state;
    expect(s.awaitingCover).toBe(true);
    const r = expireIdleTurn(s);
    expect(r.state.queenState).toBe('available');
    expect(r.state.coins.find((c) => c.id === 'Q')!.state).toBe('available');
    expect(r.state.currentPlayer).toBe(2);
    expect(r.events.some((e) => e.eventType === 'coverFailed')).toBe(true);
  });

  it('answering with an out-of-range pick (clock expiry) counts as a wrong answer', () => {
    const { bank, state } = setup();
    let s = selectFirst(state, bank).state;
    const res = answerQuestion(s, -1);
    expect(res.correct).toBe(false);
    expect(res.state.animKind).toBe('miss');
    s = completeMiss(res.state).state;
    expect(s.currentPlayer).toBe(2);
  });

  it('expiry is rejected while asking/animating/finished', () => {
    const { bank, state } = setup();
    const asking = selectFirst(state, bank).state;
    expect(() => expireIdleTurn(asking)).toThrowError(EngineError);
    const anim = answerCorrectly(asking).state;
    expect(() => expireIdleTurn(anim)).toThrowError(EngineError);
  });
});
