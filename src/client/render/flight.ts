import * as THREE from 'three';

const BOOST_TIME = 1.25;
const BOOST_RISE = 7.2;
const BOOST_TURN = 0.12;
const TERMINAL_HEIGHT = 8.4;
const TERMINAL_GRAVITY_GAIN = 2;
const BOOST_EXIT_SPEED = 2.5;
const CRUISE_TIME = ((1 - BOOST_TURN) * BOOST_TIME) / (BOOST_EXIT_SPEED * BOOST_TURN);

export interface Flight {
  boost: number;
  coast: number;
  terminal: number;
  duration: number;
  at(time: number, position: THREE.Vector3, velocity: THREE.Vector3): 0 | 1 | 2;
}

// Boost matches coast's velocity and acceleration. Horizontal speed then stays constant:
// terminal thrust only steepens the dive, rather than kicking the missile sideways at impact.
export function flight(start: THREE.Vector3, end: THREE.Vector3): Flight {
  const run = end.clone().sub(start); run.y = 0;
  const boostEnd = start.clone().addScaledVector(run, BOOST_TURN); boostEnd.y += BOOST_RISE;
  const coastVelocity = run.clone().multiplyScalar((BOOST_EXIT_SPEED * BOOST_TURN) / BOOST_TIME); coastVelocity.y = (1.6 * BOOST_RISE) / BOOST_TIME;
  const gravityAt = (coast: number) => (2 * (boostEnd.y + coastVelocity.y * coast - end.y - TERMINAL_HEIGHT)) / coast ** 2;
  // Coast and terminal share the time needed to cover the remaining run at coast speed.
  // Solving them together keeps the whole post-boost path free of lateral acceleration.
  let coast = CRUISE_TIME - 0.6;
  for (let i = 0; i < 6; i++) {
    const gravity = gravityAt(coast), down = gravity * coast - coastVelocity.y;
    const equivalentGravity = gravity * (1 + 0.3 * (TERMINAL_GRAVITY_GAIN - 1));
    const terminal = (2 * TERMINAL_HEIGHT) / (Math.sqrt(down * down + 2 * equivalentGravity * TERMINAL_HEIGHT) + down);
    coast = CRUISE_TIME - terminal;
  }
  const terminal = CRUISE_TIME - coast;
  const terminalStart = boostEnd.clone().addScaledVector(coastVelocity, coast); terminalStart.y = end.y + TERMINAL_HEIGHT;
  const gravity = gravityAt(coast);
  // Quintic ascent: starts at rest with upward acceleration, then gently rolls over into gravity.
  // Coefficients use normalized time; the endpoint constraints also keep the exhaust trail smooth.
  const rise = BOOST_RISE, exitRise = coastVelocity.y * BOOST_TIME, exitAcceleration = -gravity * BOOST_TIME ** 2;
  const b = 7 * rise - 4 * exitRise + exitAcceleration / 2;
  const c = 7 * exitRise - 12 * rise - exitAcceleration;
  const d = 5 * rise - 3 * exitRise + exitAcceleration / 2;
  const terminalVelocity = coastVelocity.clone(); terminalVelocity.y -= gravity * coast;
  const down = -terminalVelocity.y;
  // Extra acceleration is thrust * smoothstep(q). Its double integral is
  // q^4 / 4 - q^5 / 10, so the final displacement coefficient is 0.15.
  const terminalThrust = (TERMINAL_HEIGHT - down * terminal - 0.5 * gravity * terminal ** 2) / (0.15 * terminal ** 2);
  const duration = BOOST_TIME + CRUISE_TIME;

  return {
    boost: BOOST_TIME, coast, terminal, duration,
    at(time, position, velocity) {
      if (time <= BOOST_TIME) {
        const k = Math.max(0, time / BOOST_TIME);
        // Horizontal motion builds more slowly than the ascent, with zero lateral
        // acceleration at the coast boundary: a gradual pitch-over, even on long shots.
        position.copy(start).addScaledVector(run, BOOST_TURN * (2.5 * k ** 4 - 1.5 * k ** 5));
        position.y += rise * k ** 2 + b * k ** 3 + c * k ** 4 + d * k ** 5;
        velocity.copy(run).multiplyScalar((BOOST_TURN * (10 * k ** 3 - 7.5 * k ** 4)) / BOOST_TIME);
        velocity.y = (2 * rise * k + 3 * b * k ** 2 + 4 * c * k ** 3 + 5 * d * k ** 4) / BOOST_TIME;
        return 0;
      }
      if (time <= BOOST_TIME + coast) {
        const t = Math.max(0, time - BOOST_TIME);
        position.copy(boostEnd).addScaledVector(coastVelocity, t); position.y -= 0.5 * gravity * t ** 2;
        velocity.copy(coastVelocity); velocity.y -= gravity * t;
        return 1;
      }
      const t = THREE.MathUtils.clamp(time - BOOST_TIME - coast, 0, terminal);
      const q = t / terminal;
      position.copy(terminalStart).addScaledVector(terminalVelocity, t);
      position.y -= 0.5 * gravity * t ** 2 + terminalThrust * terminal ** 2 * (0.25 * q ** 4 - 0.1 * q ** 5);
      velocity.copy(terminalVelocity);
      velocity.y -= gravity * t + terminalThrust * terminal * (q ** 3 - 0.5 * q ** 4);
      return 2;
    },
  };
}
