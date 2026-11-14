import * as THREE from 'three';

// ---- The sky: where the sun is, and what the light of that hour is like ----
// The sun goes round the board as it goes round the Earth. The clock is the hour angle (15 degrees an hour, 0 at noon); with the observer's latitude and the sun's declination (its distance
// from the celestial equator, which is the season) it fixes the sun's direction, in the board's own axes: x east, y up, z south (see layout.ts). The board stands at 38 degrees north on an
// equinox: the sun rises due east, stands due south at noon 52 degrees up (as high as it stood when it was fixed there), sets due west, and is gone for as long as it was up.
const LAT = THREE.MathUtils.degToRad(38), DECL = 0;
const DAY = 600; // seconds from noon to noon. The wall clock sets the hour, so everybody in a room has the same sky, and a reload does not begin the day again
const STEP = THREE.MathUtils.degToRad(0.2); // the light moves in steps this big: the shadows are drawn again at each, and a step is about a shadow texel at the end of a long shadow
const FLIP = -3; // the sun's height (degrees) where the light turns over to the moon, on the other side of the sky: it is out there (see RAMP), or the shadows would jump half way round
const FLOOR = Math.sin(THREE.MathUtils.degToRad(3)); // until then the sun's light is kept at least this high (the sine of its elevation) as the sun goes under the horizon: it grazes the board and its shadows run long, instead of coming up from under it

/** The unit vector to the sun at hour angle `h`: (east, up, south) = (-cos d sin h, sin f sin d + cos f cos d cos h, sin f cos d cos h - cos f sin d), for latitude f and declination d. */
const sunAt = (h: number, v: THREE.Vector3) =>
  v.set(-Math.cos(DECL) * Math.sin(h), Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(h), Math.sin(LAT) * Math.cos(DECL) * Math.cos(h) - Math.cos(LAT) * Math.sin(DECL));

/** The hour of the day by the wall clock, 0 to 24 (0 at midnight, 12 at noon): the same for everybody. */
export const wallHour = (now = Date.now()) => ((now / 1000 / DAY) % 1) * 24;
/** The dev panel's hand on the clock (ui/debug.tsx): the hours it has moved the clock on by, or the hour it has stopped it at. */
export const clock = { shift: 0, stop: null as number | null };

// The light of the hour by the sun's height (degrees), each row a stop and the hours between them a straight line from one to the next, so the sky goes from night to dawn to day to dusk with no step:
// [height, light colour, light strength, sky colour, sky strength, zenith, horizon]. The light is the sun, and the moon once the sun is FLIP degrees down: it is none as it turns over to the other side
// of the sky, so that the shadows do not jump, but the sun's is still full as it touches the horizon (red, grazing, with long shadows and shafts); the sky is the light of the hemisphere. Colours and
// strengths are shares of full daylight, which is a look's own sun and sky (see scene.ts), so the day's row is white and 1. The zenith and the horizon are the sky as HD-2D draws it (the day's are the blues it has always had).
type Row = [height: number, light: number, lightK: number, sky: number, skyK: number, zenith: number, horizon: number];
const RAMP: Row[] = [
  [-12, 0x8aa4ff, 0.3, 0x6678d8, 0.22, 0x03071a, 0x101c44], // night: moonlight, and a faint blue sky
  [-6, 0x8aa4ff, 0.15, 0x8a70b8, 0.4, 0x172456, 0x6a3f7c], // dusk or the first light: a violet sky over a pink horizon
  [FLIP, 0xff7a3c, 0, 0xc6869c, 0.54, 0x283975, 0xc76d6d], // the light turns over, from the sun's side of the sky to the moon's or back: it is out as it does (the sky is the straight line between the rows either side)
  [0, 0xff7a3c, 0.7, 0xf09878, 0.68, 0x33478c, 0xff8a5a], // sunrise or sunset: the sun grazes the horizon, red, and the sky itself glows
  [5, 0xffa060, 0.85, 0xf8b088, 0.85, 0x4560a8, 0xf0a880], // low and orange
  [15, 0xffe0b8, 0.98, 0xf8e4d8, 0.95, 0x5578b8, 0xc0c8e0], // warm
  [35, 0xffffff, 1, 0xffffff, 1, 0x5981bf, 0xadc8f1], // day
];

/** The sky now: what the lights (scene.ts), the sea's shadow (world.ts) and HD-2D's sky (hd2d.ts) take their hour from. Kept by `updateSky`, once a frame. */
export const sky = {
  sun: new THREE.Vector3(), // the way to the sun: below the horizon at night
  light: new THREE.Vector3(), // the way to the light that casts the shadows: the sun (kept above FLOOR), or by night the moon, a full one: opposite the sun. It moves in steps (see STEP)
  lightC: new THREE.Color(), lightK: 1, // that light's colour and strength
  skyC: new THREE.Color(), skyK: 1, // the hemisphere's
  lampK: 1, // artificial light: a hint of it by day, full strength after dusk
  glow: 1, // the sun's share of the glow on the horizon: it stays on the sun's side down to dusk, and by night it is on the moon's
  zenith: new THREE.Color(), horizon: new THREE.Color(),
};

const c0 = new THREE.Color(), c1 = new THREE.Color();
const mix = (out: THREE.Color, a: number, b: number, t: number) => out.lerpColors(c0.set(a), c1.set(b), t);

export function updateSky(now = Date.now()) {
  const hour = clock.stop ?? (wallHour(now) + clock.shift) % 24;
  const h = (hour / 24 - 0.5) * 2 * Math.PI; // the hour angle: 0 at noon
  sunAt(h, sky.sun);
  sunAt(Math.round(h / STEP) * STEP, sky.light);
  const alt = THREE.MathUtils.radToDeg(Math.asin(sky.sun.y));
  if (alt < FLIP) sky.light.negate(); // the moon, a full one, stands opposite the sun
  else if (sky.light.y < FLOOR) sky.light.setY(FLOOR).normalize(); // the sun's light does not follow it under the horizon
  let i = 1;
  while (i < RAMP.length - 1 && RAMP[i][0] < alt) i++;
  const a = RAMP[i - 1], b = RAMP[i], t = THREE.MathUtils.clamp((alt - a[0]) / (b[0] - a[0]), 0, 1);
  mix(sky.lightC, a[1], b[1], t); mix(sky.skyC, a[3], b[3], t); mix(sky.zenith, a[5], b[5], t); mix(sky.horizon, a[6], b[6], t);
  sky.lightK = THREE.MathUtils.lerp(a[2], b[2], t); sky.skyK = THREE.MathUtils.lerp(a[4], b[4], t);
  sky.lampK = THREE.MathUtils.lerp(1, 0.12, THREE.MathUtils.smoothstep(alt, -3, 18));
  sky.glow = THREE.MathUtils.smoothstep(alt, -12, -6);
}
