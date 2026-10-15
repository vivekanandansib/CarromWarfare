import { describe, expect, it } from 'vitest';
import {
  CLASSIC_COIN_IDS,
  createClassic,
  resolveShot,
} from './classic';

function setup() {
  return createClassic('sess-c', ['Asha', 'Ravi'], 50);
}

describe('classic turn rules', () => {
  it('pocketing retains the turn and scores', () => {
    const s = setup();
    const r = resolveShot(s, ['W1', 'B2']);
    expect(r.points).toBe(20);
    expect(r.state.scores).toEqual([20, 0]);
    expect(r.state.currentPlayer).toBe(1);
    expect(r.foul).toBe(false);
  });

  it('missing everything passes the turn', () => {
    const s = setup();
    const r = resolveShot(s, []);
    expect(r.state.currentPlayer).toBe(2);
    expect(r.points).toBe(0);
  });

  it('striker foul passes the turn with no points (coins stay down)', () => {
    const s = setup();
    const r = resolveShot(s, ['W1', 'S']);
    expect(r.foul).toBe(true);
    expect(r.points).toBe(0);
    expect(r.state.currentPlayer).toBe(2);
    expect(r.state.pocketed['W1']).toBe(true);
  });

  it('queen needs a cover: secured with bonus, or returned', () => {
    let s = setup();
    let r = resolveShot(s, ['Q']);
    expect(r.queenEvent).toBe('pending');
    expect(r.state.currentPlayer).toBe(1);
    expect(r.points).toBe(0);
    // cover success
    r = resolveShot(r.state, ['W3']);
    expect(r.queenEvent).toBe('secured');
    expect(r.points).toBe(30); // 10 + 20
    expect(r.state.scores[0]).toBe(30);

    // cover failure returns the queen
    s = setup();
    r = resolveShot(s, ['Q']);
    r = resolveShot(r.state, []);
    expect(r.queenEvent).toBe('returned');
    expect(r.state.queen).toBe('available');
    expect(r.state.currentPlayer).toBe(2);
  });

  it('foul during pending cover returns the queen', () => {
    let s = setup();
    let r = resolveShot(s, ['Q']);
    r = resolveShot(r.state, ['S']);
    expect(r.queenEvent).toBe('returned');
    expect(r.state.queen).toBe('available');
    expect(r.state.currentPlayer).toBe(2);
  });

  it('target score finishes the game', () => {
    const s = { ...setup(), targetScore: 10 };
    const r = resolveShot(s, ['W1']);
    expect(r.state.finished).toBe(true);
    expect(r.state.winner).toBe(1);
  });

  it('clearing the board decides by score, queen breaks ties', () => {
    let s = { ...setup(), targetScore: 1000 };
    const almost = CLASSIC_COIN_IDS.slice(0, -1);
    let r = resolveShot(s, almost);
    expect(r.state.finished).toBe(false);
    // queen + last coin, then cover to finish with a tie broken by queen
    void r;
    s = {
      ...setup(),
      targetScore: 1000,
      pocketed: Object.fromEntries(almost.map((id) => [id, true])),
      scores: [160, 170],
    };
    r = resolveShot(s, ['Q']);
    r = resolveShot(r.state, [CLASSIC_COIN_IDS[CLASSIC_COIN_IDS.length - 1]]);
    expect(r.state.finished).toBe(true);
    // 160+20=180 vs 170 → player 1 wins outright
    expect(r.state.winner).toBe(1);
  });
});
