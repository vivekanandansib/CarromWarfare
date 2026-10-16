import { describe, expect, it } from 'vitest';
import { createClassic, resolveShot } from './classic';

function setup() {
  return createClassic('sess-c', ['Asha', 'Ravi'], 50);
}

/** P1 (White) pockets one own coin to become queen-eligible. */
function eligible(s: ReturnType<typeof setup>) {
  return resolveShot(s, ['W1'], { touched: true }).state;
}

describe('classic turn rules (ICF-inspired, house-scored)', () => {
  it('assigns White to the breaker; own coins score and retain the turn', () => {
    const s = setup();
    const r = resolveShot(s, ['W1'], { touched: true });
    expect(r.points).toBe(10);
    expect(r.state.scores).toEqual([10, 0]);
    expect(r.state.currentPlayer).toBe(1);
    expect(r.foul).toBe(false);
    expect(r.breakFail).toBe(false);
  });

  it('break must touch a coin — untouched break passes the turn with no due', () => {
    const s = setup();
    const r = resolveShot(s, [], { touched: false });
    expect(r.breakFail).toBe(true);
    expect(r.state.currentPlayer).toBe(2);
    expect(r.state.duesOwed).toEqual([0, 0]);
    expect(r.state.breakTaken).toBe(true);
  });

  it("opponent coins stay down without points and pass the turn (no due)", () => {
    const s = setup();
    const r = resolveShot(s, ['B5'], { touched: true });
    expect(r.points).toBe(0);
    expect(r.state.pocketed['B5']).toBe(true);
    expect(r.state.currentPlayer).toBe(2);
    expect(r.foul).toBe(false);
    expect(r.state.duesOwed).toEqual([0, 0]);
  });

  it('mixed pocket scores only own color and retains the turn', () => {
    const s = setup();
    const r = resolveShot(s, ['W1', 'B2'], { touched: true });
    expect(r.points).toBe(10);
    expect(r.scoredIds).toEqual(['W1']);
    expect(r.state.scores).toEqual([10, 0]);
    expect(r.state.pocketed['B2']).toBe(true);
    expect(r.state.currentPlayer).toBe(1);
  });

  it('missing everything passes the turn', () => {
    const s = setup();
    const r = resolveShot(s, [], { touched: true });
    expect(r.state.currentPlayer).toBe(2);
    expect(r.points).toBe(0);
  });

  it('striker foul passes the turn and incurs a due (immediate return when possible)', () => {
    let s = eligible(setup());
    const r = resolveShot(s, ['W2', 'S'], { touched: true });
    expect(r.foul).toBe(true);
    expect(r.points).toBe(0);
    expect(r.state.currentPlayer).toBe(2);
    // due settled immediately from pocketed own coins (oldest first): W1 returned
    expect(r.returnedNow).toContain('W1');
    expect(r.state.pocketed['W1']).toBeUndefined();
    expect(r.state.duesOwed).toEqual([0, 0]);
    // W2 stayed down but scored nothing
    expect(r.state.pocketed['W2']).toBe(true);
    expect(r.state.scores).toEqual([10, 0]); // only the earlier eligibility coin
  });

  it('foul with no coins to give leaves an outstanding due', () => {
    let s = eligible(setup());
    // hand the turn to P2 (who has pocketed nothing)
    s = resolveShot(s, [], { touched: true }).state;
    expect(s.currentPlayer).toBe(2);
    const r = resolveShot(s, ['S'], { touched: true });
    expect(r.foul).toBe(true);
    expect(r.state.duesOwed).toEqual([0, 1]);
    expect(r.returnedNow).toEqual([]);
    // P2's next own pocket pays the due: returned, no points, turn passes.
    // (foul passed the turn to P1 first, so P1 takes an empty shot)
    const mid = resolveShot(r.state, [], { touched: true }).state;
    expect(mid.currentPlayer).toBe(2);
    const r2 = resolveShot(mid, ['B1'], { touched: true });
    expect(r2.returnedNow).toContain('B1');
    expect(r2.points).toBe(0);
    expect(r2.state.duesOwed).toEqual([0, 0]);
    expect(r2.state.currentPlayer).toBe(1);
  });

  it('early queen (no prior own coin) returns at end of turn', () => {
    const s = setup();
    const r = resolveShot(s, ['Q'], { touched: true });
    expect(r.queenEvent).toBe('returned');
    expect(r.state.queen).toBe('available');
    expect(r.state.pocketed['Q']).toBeUndefined();
    expect(r.state.currentPlayer).toBe(2);
  });

  it('queen needs a cover: pending, then secured with bonus or returned', () => {
    let s = eligible(setup());
    let r = resolveShot(s, ['Q'], { touched: true });
    expect(r.queenEvent).toBe('pending');
    expect(r.state.currentPlayer).toBe(1);
    expect(r.points).toBe(0);
    // cover success
    r = resolveShot(r.state, ['W3'], { touched: true });
    expect(r.queenEvent).toBe('secured');
    expect(r.points).toBe(30); // 10 + 20
    expect(r.state.scores[0]).toBe(40); // 10 (eligibility) + 30

    // cover failure returns the queen
    s = eligible(setup());
    r = resolveShot(s, ['Q'], { touched: true });
    r = resolveShot(r.state, [], { touched: true });
    expect(r.queenEvent).toBe('returned');
    expect(r.state.queen).toBe('available');
    expect(r.state.currentPlayer).toBe(2);
  });

  it('queen + own coin in the same stroke covers immediately', () => {
    const s = eligible(setup());
    const r = resolveShot(s, ['Q', 'W4'], { touched: true });
    expect(r.queenEvent).toBe('secured');
    expect(r.points).toBe(30);
    expect(r.state.currentPlayer).toBe(1);
  });

  it('foul during pending cover returns the queen', () => {
    let s = eligible(setup());
    let r = resolveShot(s, ['Q'], { touched: true });
    r = resolveShot(r.state, ['S'], { touched: true });
    expect(r.queenEvent).toBe('returned');
    expect(r.state.queen).toBe('available');
    expect(r.state.currentPlayer).toBe(2);
  });

  it('target score finishes the game', () => {
    const s = { ...setup(), targetScore: 10 };
    const r = resolveShot(s, ['W1'], { touched: true });
    expect(r.state.finished).toBe(true);
    expect(r.state.winner).toBe(1);
  });

  it('clearing your color with the queen secured wins the board', () => {
    const allW = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9'];
    const s = {
      ...setup(),
      targetScore: 1000,
      pocketed: Object.fromEntries(allW.map((id) => [id, true])),
      ownCount: [9, 0] as [number, number],
      queen: 'secured' as const,
      queenPocketedBy: 1 as const,
      breakTaken: true,
    };
    const r = resolveShot(s, [], { touched: true });
    expect(r.state.finished).toBe(true);
    expect(r.state.winner).toBe(1);
  });

  it('no board win without a secured queen', () => {
    const allW = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9'];
    const s = {
      ...setup(),
      targetScore: 1000,
      pocketed: Object.fromEntries(allW.map((id) => [id, true])),
      ownCount: [9, 0] as [number, number],
      breakTaken: true,
    };
    const r = resolveShot(s, [], { touched: true });
    expect(r.state.finished).toBe(false);
  });
});
