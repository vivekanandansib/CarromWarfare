// 2D circle physics for Classic Flick mode: slingshot striker, coin friction,
// elastic coin-coin collisions, cushion bounces, pocket capture, striker fouls.
// Pure functions + a small stepper — UI-agnostic and unit-tested.
// Board space is 400x400 (same as the quiz board).

export interface Vec {
  x: number;
  y: number;
}

export interface Body {
  id: string;
  pos: Vec;
  vel: Vec;
  radius: number;
}

export const POCKETS: Vec[] = [
  { x: 30, y: 30 },
  { x: 370, y: 30 },
  { x: 30, y: 370 },
  { x: 370, y: 370 },
];

export const POCKET_CAPTURE_R = 19;
export const COIN_R = 11;
export const QUEEN_R = 12.5;
export const STRIKER_R = 14;
/** Playable surface bounds (inside cushions). */
export const MIN = 34;
export const MAX = 366;
export const BASELINE_Y = 312;
export const BASELINE_MIN_X = 110;
export const BASELINE_MAX_X = 290;

/** Pocket mouth half-width along a cushion: rails end before the pocket so coins fall in. */
export const POCKET_MOUTH = 26;

export const COIN_FRICTION = 1.15; // exponential damping /s

function inMouth(v: number): boolean {
  return v < MIN + POCKET_MOUTH || v > MAX - POCKET_MOUTH;
}
export const STRIKER_FRICTION = 0.85;
export const REST_COIN = 0.94; // coin-coin restitution
export const REST_CUSHION = 0.75;
export const STOP_SPEED = 6; // px/s — below this a body sleeps
export const MAX_SHOT_SPEED = 950;

export function speed(v: Vec): number {
  return Math.hypot(v.x, v.y);
}

export interface StepEvents {
  pocketed: string[];
  strikerFoul: boolean;
  /** Striker touched at least one coin this step batch (break rule). */
  strikerTouched: boolean;
  clicks: number; // collision count (for sound)
  cushions: number;
}

/** Advance bodies by dt seconds. Mutates positions/velocities in place. */
export function stepBodies(
  bodies: Body[],
  strikerId: string,
  dt: number,
  friction: number = COIN_FRICTION,
): StepEvents {
  const ev: StepEvents = { pocketed: [], strikerFoul: false, strikerTouched: false, clicks: 0, cushions: 0 };
  const sub = 2;
  const h = Math.min(dt, 0.033) / sub;
  for (let s = 0; s < sub; s++) {
    // integrate + friction
    for (const b of bodies) {
      const damp = Math.exp(-(b.id === strikerId ? STRIKER_FRICTION : friction) * h);
      b.vel.x *= damp;
      b.vel.y *= damp;
      if (speed(b.vel) < STOP_SPEED) {
        b.vel.x = 0;
        b.vel.y = 0;
      }
      b.pos.x += b.vel.x * h;
      b.pos.y += b.vel.y * h;
    }
    // cushions (rails end at the pocket mouths so coins fall in;
    // mouth proximity is measured ALONG each wall)
    for (const b of bodies) {
      const lo = MIN + b.radius;
      const hi = MAX - b.radius;
      const nearCornerY = inMouth(b.pos.y); // for left/right walls
      const nearCornerX = inMouth(b.pos.x); // for top/bottom walls
      if (b.pos.x < lo) {
        b.pos.x = nearCornerY ? b.pos.x : lo;
        if (!nearCornerY && b.vel.x < 0) {
          b.vel.x = -b.vel.x * REST_CUSHION;
          ev.cushions++;
        }
      } else if (b.pos.x > hi) {
        b.pos.x = nearCornerY ? b.pos.x : hi;
        if (!nearCornerY && b.vel.x > 0) {
          b.vel.x = -b.vel.x * REST_CUSHION;
          ev.cushions++;
        }
      }
      if (b.pos.y < lo) {
        b.pos.y = nearCornerX ? b.pos.y : lo;
        if (!nearCornerX && b.vel.y < 0) {
          b.vel.y = -b.vel.y * REST_CUSHION;
          ev.cushions++;
        }
      } else if (b.pos.y > hi) {
        b.pos.y = nearCornerX ? b.pos.y : hi;
        if (!nearCornerX && b.vel.y > 0) {
          b.vel.y = -b.vel.y * REST_CUSHION;
          ev.cushions++;
        }
      }
    }
    // coin-coin elastic collisions (equal mass)
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = a.radius + b.radius;
        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          // separate overlap
          const overlap = (minDist - dist) / 2;
          a.pos.x -= nx * overlap;
          a.pos.y -= ny * overlap;
          b.pos.x += nx * overlap;
          b.pos.y += ny * overlap;
          // exchange normal components with restitution
          const rvx = b.vel.x - a.vel.x;
          const rvy = b.vel.y - a.vel.y;
          const rel = rvx * nx + rvy * ny;
          if (rel < 0) {
            if (a.id === strikerId || b.id === strikerId) ev.strikerTouched = true;
            const impulse = (-(1 + REST_COIN) * rel) / 2;
            a.vel.x -= impulse * nx;
            a.vel.y -= impulse * ny;
            b.vel.x += impulse * nx;
            b.vel.y += impulse * ny;
            if (rel < -40) ev.clicks++;
          }
        }
      }
    }
  }
  // pocket capture
  for (const b of bodies) {
    if (POCKETS.some((q) => Math.hypot(b.pos.x - q.x, b.pos.y - q.y) < POCKET_CAPTURE_R)) {
      ev.pocketed.push(b.id);
    }
  }
  const striker = bodies.find((b) => b.id === strikerId);
  if (striker && ev.pocketed.includes(strikerId)) ev.strikerFoul = true;
  return ev;
}

export function allSettled(bodies: Body[]): boolean {
  return bodies.every((b) => speed(b.vel) === 0);
}

/** Clamp a drag vector to a legal shot velocity (pull-back slingshot). */
export function dragToVelocity(drag: Vec, power = 4.5): Vec {
  const vx = -drag.x * power;
  const vy = -drag.y * power;
  const s = Math.hypot(vx, vy);
  if (s <= MAX_SHOT_SPEED) return { x: vx, y: vy };
  return { x: (vx / s) * MAX_SHOT_SPEED, y: (vy / s) * MAX_SHOT_SPEED };
}
