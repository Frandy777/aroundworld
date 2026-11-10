import * as THREE from 'three';

const BOOST_TIME = 1.25;
const BOOST_RISE = 7.2;
const BOOST_TURN = 0.12;
const TERMINAL_RUN = 0.25;
const TERMINAL_HEIGHT = 8.4;
const TERMINAL_GRAVITY_GAIN = 2.4;
const BOOST_EXIT_SPEED = 2.5;
const COAST_TIME = ((1 - BOOST_TURN - TERMINAL_RUN) * BOOST_TIME) / (BOOST_EXIT_SPEED * BOOST_TURN);

export interface Flight {
  boost: number;
  coast: number;
  terminal: number;
  duration: number;
  at(time: number, position: THREE.Vector3, velocity: THREE.Vector3): 0 | 1 | 2;
}

// Boost eases into the turn and matches coast's velocity AND acceleration, so aiming along
// the tangent cannot snap at engine hand-off. Terminal thrust ramps up from zero extra
// acceleration, keeping both hand-offs smooth while making the final dive gather speed.
export function flight(start: THREE.Vector3, end: THREE.Vector3): Flight {
  const run = end.clone().sub(start); run.y = 0;
  const boostEnd = start.clone().addScaledVector(run, BOOST_TURN); boostEnd.y += BOOST_RISE;
  const coastVelocity = run.clone().multiplyScalar((BOOST_EXIT_SPEED * BOOST_TURN) / BOOST_TIME); coastVelocity.y = (1.6 * BOOST_RISE) / BOOST_TIME;
  const terminalStart = start.clone().addScaledVector(run, 1 - TERMINAL_RUN); terminalStart.y = end.y + TERMINAL_HEIGHT;
  const gravity = (2 * (boostEnd.y + coastVelocity.y * COAST_TIME - terminalStart.y)) / COAST_TIME ** 2;
  // Quintic ascent: starts at rest with upward acceleration, then gently rolls over into gravity.
  // Coefficients use normalized time; the endpoint constraints also keep the exhaust trail smooth.
  const rise = BOOST_RISE, exitRise = coastVelocity.y * BOOST_TIME, exitAcceleration = -gravity * BOOST_TIME ** 2;
  const b = 7 * rise - 4 * exitRise + exitAcceleration / 2;
  const c = 7 * exitRise - 12 * rise - exitAcceleration;
  const d = 5 * rise - 3 * exitRise + exitAcceleration / 2;
  const terminalVelocity = coastVelocity.clone(); terminalVelocity.y -= gravity * COAST_TIME;
  const down = -terminalVelocity.y;
  // Equivalent gravity sets the arrival time. A cubic correction spreads the extra
  // thrust across the dive, starting at coast's acceleration and reaching the exact target.
  const terminalGravity = gravity * TERMINAL_GRAVITY_GAIN;
  const terminal = (2 * TERMINAL_HEIGHT) / (Math.sqrt(down * down + 2 * terminalGravity * TERMINAL_HEIGHT) + down);
  const correction = end.clone().sub(terminalStart).addScaledVector(terminalVelocity, -terminal);
  correction.y += 0.5 * gravity * terminal ** 2;
  const duration = BOOST_TIME + COAST_TIME + terminal;

  return {
    boost: BOOST_TIME, coast: COAST_TIME, terminal, duration,
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
      if (time <= BOOST_TIME + COAST_TIME) {
        const t = Math.max(0, time - BOOST_TIME);
        position.copy(boostEnd).addScaledVector(coastVelocity, t); position.y -= 0.5 * gravity * t ** 2;
        velocity.copy(coastVelocity); velocity.y -= gravity * t;
        return 1;
      }
      const t = THREE.MathUtils.clamp(time - BOOST_TIME - COAST_TIME, 0, terminal);
      const q = t / terminal;
      position.copy(terminalStart).addScaledVector(terminalVelocity, t).addScaledVector(correction, q ** 3);
      position.y -= 0.5 * gravity * t ** 2;
      velocity.copy(terminalVelocity).addScaledVector(correction, (3 * q ** 2) / terminal);
      velocity.y -= gravity * t;
      return 2;
    },
  };
}
