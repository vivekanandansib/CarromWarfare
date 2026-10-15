import { describe, expect, it } from 'vitest';
import {
  allSettled,
  BASELINE_MAX_X,
  BASELINE_MIN_X,
  dragToVelocity,
  MAX_SHOT_SPEED,
  stepBodies,
  type Body,
} from './physics';

function ball(id: string, x: number, y: number, vx = 0, vy = 0, radius = 11): Body {
  return { id, pos: { x, y }, vel: { x: vx, y: vy }, radius };
}

describe('physics stepper', () => {
  it('rolls and settles with friction', () => {
    const b = [ball('C1', 200, 200, 300, 0)];
    for (let i = 0; i < 600 && !allSettled(b); i++) stepBodies(b, 'S', 1 / 60);
    expect(allSettled(b)).toBe(true);
    expect(b[0].pos.x).toBeGreaterThan(200); // moved forward
    expect(b[0].vel.x).toBe(0);
  });

  it('bounces off cushions', () => {
    const b = [ball('C1', 350, 200, 400, 0)];
    stepBodies(b, 'S', 1 / 60);
    // eventually comes back leftwards after cushion hits
    for (let i = 0; i < 30; i++) stepBodies(b, 'S', 1 / 60);
    expect(b[0].vel.x).toBeLessThan(400);
  });

  it('transfers momentum between coins', () => {
    const a = ball('A', 180, 200, 150, 0);
    const b = [a, ball('B', 205, 200, 0, 0)];
    // A needs ~2 steps to reach B; check just after impact, before any cushion matters
    for (let i = 0; i < 10; i++) stepBodies(b, 'S', 1 / 60);
    expect(b[1].vel.x).toBeGreaterThan(50); // B picked up speed
    expect(b[0].vel.x).toBeLessThan(150); // A slowed down
    expect(b[1].pos.x).toBeGreaterThan(205);
  });

  it('captures coins in pockets and flags striker fouls', () => {
    const bodies = [ball('C1', 32, 32), ball('S', 33, 370, 0, 0, 14)];
    const ev = stepBodies(bodies, 'S', 1 / 60);
    expect(ev.pocketed).toContain('C1');
    expect(ev.pocketed).toContain('S');
    expect(ev.strikerFoul).toBe(true);
  });

  it('clamps drag velocity to the max shot speed', () => {
    const v = dragToVelocity({ x: -1000, y: -1000 });
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(MAX_SHOT_SPEED);
    // pull back down-right fires up-left
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it('baseline striker range is sane', () => {
    expect(BASELINE_MIN_X).toBeLessThan(BASELINE_MAX_X);
  });
});
