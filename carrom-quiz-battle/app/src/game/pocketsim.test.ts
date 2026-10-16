import { describe, expect, it } from 'vitest';
import {
  allSettled,
  COIN_R,
  POCKET_CAPTURE_R,
  stepBodies,
  STRIKER_R,
  type Body,
} from './physics';
import { initialCoinLayout } from './engine';

function simBodies(): Body[] {
  const bodies: Body[] = initialCoinLayout().map((c) => ({
    id: c.id,
    pos: { ...c.pos },
    vel: { x: 0, y: 0 },
    radius: c.color === 'queen' ? 12.5 : COIN_R,
  }));
  bodies.push({ id: 'S', pos: { x: 200, y: 312 }, vel: { x: 0, y: 0 }, radius: STRIKER_R });
  return bodies;
}

function shoot(sx: number, angleDeg: number, power01: number): { pocketed: string[]; foul: boolean } {
  const bodies = simBodies();
  const s = bodies.find((b) => b.id === 'S')!;
  s.pos.x = sx;
  const rad = (angleDeg * Math.PI) / 180;
  const sp = 120 + power01 * (950 - 120);
  s.vel = { x: Math.cos(rad) * sp, y: Math.sin(rad) * sp };
  const pocketed = new Set<string>();
  let foul = false;
  for (let i = 0; i < 1200 && !allSettled(bodies); i++) {
    const ev = stepBodies(bodies, 'S', 1 / 60);
    for (const id of ev.pocketed) pocketed.add(id);
    if (ev.strikerFoul) foul = true;
    const gone = new Set(ev.pocketed);
    for (let k = bodies.length - 1; k >= 0; k--) if (gone.has(bodies[k].id)) bodies.splice(k, 1);
  }
  return { pocketed: [...pocketed], foul };
}

describe('pocket reachability sweep (tuning probe)', () => {
  it('logs what a spread of honest shots achieves', () => {
    let total = 0;
    const lines: string[] = [];
    for (let a = -115; a <= -65; a += 5) {
      for (const p of [0.5, 0.75, 1]) {
        for (const sx of [160, 200, 240]) {
          const r = shoot(sx, a, p);
          const coins = r.pocketed.filter((id) => id !== 'S');
          total += coins.length;
          if (coins.length > 0) lines.push(`x ${sx} angle ${a} power ${p}: ${coins.join(',')}${r.foul ? ' +FOUL' : ''}`);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`SWEEP pocketed=${total}\n${lines.join('\n')}`);
    expect(total).toBeGreaterThan(0);
  });

  it('a dead-straight tap-in above a pocket falls', () => {
    const bodies: Body[] = [
      { id: 'W1', pos: { x: 40, y: 60 }, vel: { x: 0, y: 0 }, radius: COIN_R },
      { id: 'S', pos: { x: 40, y: 200 }, vel: { x: 0, y: -520 }, radius: STRIKER_R },
    ];
    const pocketed = new Set<string>();
    for (let i = 0; i < 600 && !allSettled(bodies); i++) {
      const ev = stepBodies(bodies, 'S', 1 / 60);
      for (const id of ev.pocketed) pocketed.add(id);
      const gone = new Set(ev.pocketed);
      for (let k = bodies.length - 1; k >= 0; k--) if (gone.has(bodies[k].id)) bodies.splice(k, 1);
    }
    expect(pocketed.has('W1')).toBe(true);
  });

  it('a rail slider along the cushion can drop into the mouth', () => {
    const bodies: Body[] = [
      { id: 'W9', pos: { x: 45, y: 200 }, vel: { x: 0, y: -260 }, radius: COIN_R },
      { id: 'S', pos: { x: 200, y: 312 }, vel: { x: 0, y: 0 }, radius: STRIKER_R },
    ];
    const pocketed = new Set<string>();
    for (let i = 0; i < 600 && !allSettled(bodies); i++) {
      const ev = stepBodies(bodies, 'S', 1 / 60);
      for (const id of ev.pocketed) pocketed.add(id);
      const gone = new Set(ev.pocketed);
      for (let k = bodies.length - 1; k >= 0; k--) if (gone.has(bodies[k].id)) bodies.splice(k, 1);
    }
    expect(pocketed.has('W9')).toBe(true);
  });

  it(`capture radius fits the striker (${POCKET_CAPTURE_R})`, () => {
    expect(POCKET_CAPTURE_R).toBeGreaterThanOrEqual(18);
  });
});
