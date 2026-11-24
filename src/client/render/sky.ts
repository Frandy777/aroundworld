import * as THREE from 'three';

const LAT = THREE.MathUtils.degToRad(38), DECL = 0;
const DAY = 600;
const STEP = THREE.MathUtils.degToRad(0.2);
const FLIP = -3;
const FLOOR = Math.sin(THREE.MathUtils.degToRad(3));

const sunAt = (h: number, v: THREE.Vector3) =>
  v.set(-Math.cos(DECL) * Math.sin(h), Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(h), Math.sin(LAT) * Math.cos(DECL) * Math.cos(h) - Math.cos(LAT) * Math.sin(DECL));

export const wallHour = (now = Date.now()) => ((now / 1000 / DAY) % 1) * 24;
export const clock = { shift: 0, stop: null as number | null };

type Row = [height: number, light: number, lightK: number, sky: number, skyK: number, zenith: number, horizon: number];
const RAMP: Row[] = [
  [-12, 0x8aa4ff, 0.3, 0x6678d8, 0.22, 0x03071a, 0x101c44],
  [-6, 0x8aa4ff, 0.15, 0x8a70b8, 0.4, 0x172456, 0x6a3f7c],
  [FLIP, 0xff7a3c, 0, 0xc6869c, 0.54, 0x283975, 0xc76d6d],
  [0, 0xff7a3c, 0.7, 0xf09878, 0.68, 0x33478c, 0xff8a5a],
  [5, 0xffa060, 0.85, 0xf8b088, 0.85, 0x4560a8, 0xf0a880],
  [15, 0xffe0b8, 0.98, 0xf8e4d8, 0.95, 0x5578b8, 0xc0c8e0],
  [35, 0xffffff, 1, 0xffffff, 1, 0x5981bf, 0xadc8f1],
];

export const sky = {
  sun: new THREE.Vector3(),
  light: new THREE.Vector3(),
  lightC: new THREE.Color(), lightK: 1,
  skyC: new THREE.Color(), skyK: 1,
  lampK: 1,
  zenith: new THREE.Color(), horizon: new THREE.Color(),
};

const c0 = new THREE.Color(), c1 = new THREE.Color();
const mix = (out: THREE.Color, a: number, b: number, t: number) => out.lerpColors(c0.set(a), c1.set(b), t);
const between = (alt: number) => {
  let i = 1;
  while (i < RAMP.length - 1 && RAMP[i][0] < alt) i++;
  const a = RAMP[i - 1], b = RAMP[i];
  return [a, b, THREE.MathUtils.clamp((alt - a[0]) / (b[0] - a[0]), 0, 1)] as const;
};

export function updateSky(now = Date.now()) {
  const hour = clock.stop ?? (wallHour(now) + clock.shift) % 24;
  const h = (hour / 24 - 0.5) * 2 * Math.PI;
  sunAt(h, sky.sun);
  sunAt(Math.round(h / STEP) * STEP, sky.light);
  const alt = THREE.MathUtils.radToDeg(Math.asin(sky.sun.y));
  if (alt < FLIP) sky.light.negate();
  else if (sky.light.y < FLOOR) sky.light.setY(FLOOR).normalize();
  const [a, b, t] = between(alt);
  mix(sky.lightC, a[1], b[1], t); mix(sky.skyC, a[3], b[3], t); mix(sky.zenith, a[5], b[5], t); mix(sky.horizon, a[6], b[6], t);
  sky.lightK = THREE.MathUtils.lerp(a[2], b[2], t); sky.skyK = THREE.MathUtils.lerp(a[4], b[4], t);
  sky.lampK = THREE.MathUtils.lerp(1, 0.12, THREE.MathUtils.smoothstep(alt, -3, 18));
}
