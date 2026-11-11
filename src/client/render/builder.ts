import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lodMap, pixelTexture, texels, toon, DENSITY } from './scene';
import { glow, nightlit, type Pbr } from './light';
import { canvas, paint, hex, shade, ink, inkWidth, inkHeight } from './art';
import { SZ, SLAB } from './layout';

type Fill = (c: string, x: number, y: number, w: number, h: number) => void;

// ---- Pixel textures: one drawing per zoom level L (0 far, 1 mid, 2 near; see scene.js), each a design on its own grid of 1/4, 1/2 or all of the world pixel
// density (DENSITY, ~22 texels per world unit). Shapes and materials are shared through memo ----
export const memo = <A extends unknown[], R>(fn: (...a: A) => R) => { const c = new Map<string, R>(); return (...a: A): R => { const k = a.join('|'); if (!c.has(k)) c.set(k, fn(...a)); return c.get(k)!; }; };
const tex = (w: number, h: number, draw: (f: Fill, w: number, h: number, g: CanvasRenderingContext2D) => void, repeat?: number) => pixelTexture(canvas(w, h, (g, W, H) => draw((c, x, y, bw, bh) => { g.fillStyle = c; g.fillRect(x, y, bw, bh); }, W, H, g)), repeat);

// side wall: stone courses with a lit top edge and a dark waterline (grey, tinted per tile by the material colour). Half a wall wide, shown twice.
// Courses are 8 texels tall near, 4 mid, 3 far (two of them, with bigger stones)
export const sideTex = memo((L: number) => {
  const c = [3, 4, 8][L], rows = [2, 3, 3][L], wl = [1, 2, 5][L], jp = [8, 8, 16][L], top = L === 2 ? 2 : 1; // (the near wall is 31 texels: 2 + 3 courses of 8, and the wet base)
  const t = tex(texels(SZ / 2, L), texels(SLAB, L), (f, w, h) => {
    f('#bcbcbc', 0, 0, w, h); f('#f2f2f2', 0, 0, w, 1); if (L === 2) f('#dadada', 0, 1, w, 1);
    for (let r = 0; r < rows; r++) {
      const y = top + r * c;
      f('#d2d2d2', 0, y, w, 1); f('#7c7c7c', 0, y + c - 1, w, 1);
      for (let x = (r & 1) * (jp / 2); x < w; x += jp) f('#7c7c7c', x, y, 1, c - 1);
    }
    f('#6a6a6a', 0, h - wl, w, wl);
  });
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2;
  return t;
});
// one storey (0.9 tall, `cols` x 0.5 wide, the nearest whole texels to each level's density): STOREY = [texels per column, texels tall]. 'win' windows, 'door' windows
// + entrance, 'lobby' windows + glass double doors under a sign band, 'glass' curtain wall. The windows get a frame, glint and sill near, a head and sill mid, and are bare slits far
const STOREY: [number, number][] = [[3, 5], [5, 10], [11, 20]];
const WINDOW: ((f: Fill, x: number) => void)[] = [
  (f, x) => { f('#3f6fd0', x + 1, 1, 1, 3); f('#7db6ff', x + 1, 1, 1, 1); },
  (f, x) => { f('#1a2250', x + 1, 1, 3, 1); f('#7db6ff', x + 1, 2, 3, 2); f('#3f6fd0', x + 1, 4, 3, 3); f('#dce8ff', x + 1, 2, 1, 1); f('#aaa', x, 7, 5, 1); },
  (f, x) => { f('#1a2250', x + 2, 4, 7, 10); f('#7db6ff', x + 3, 5, 5, 3); f('#3f6fd0', x + 3, 8, 5, 5); f('#dce8ff', x + 3, 5, 1, 2); f('#f4f4f4', x + 1, 14, 9, 1); f('#aaa', x + 1, 15, 9, 1); }, // frame, sky, shade, glint, sill
];
const PANELS: ((f: Fill, x: number) => void)[] = [
  (f, x) => { f('#27479c', x, 0, 2, 3); f('#4f86e8', x, 0, 2, 1); },
  (f, x) => { for (const y of [0, 5]) { f('#27479c', x, y, 4, 4); f('#4f86e8', x, y, 4, 1); f('#cfe8ff', x + 1, y + 1, 1, 1); } },
  (f, x) => { for (const y of [1, 10]) { f('#27479c', x + 1, y, 9, 8); f('#4f86e8', x + 1, y, 9, 3); f('#cfe8ff', x + 2, y + 1, 2, 1); } },
];
const DOOR: ((f: Fill, w: number, dw: number) => void)[] = [ // dw = the door's width
  (f, w, dw) => { const x = (w - dw) / 2; f('#3a2008', x - 1, 2, dw + 2, 3); f('#8a5a2b', x, 3, dw, 2); },
  (f, w, dw) => { const x = (w - dw) / 2; f('#3a2008', x - 1, 3, dw + 2, 7); f('#7db6ff', x, 4, dw, 2); f('#8a5a2b', x, 6, dw, 3); f('#ffd23f', x + dw - 1, 7, 1, 1); f('#ffe9a0', (w >> 1) - 1, 1, 2, 1); f('#bdbdbd', x - 1, 9, dw + 2, 1); },
  (f, w, dw) => { const x = (w - dw) / 2; f('#3a2008', x - 1, 5, dw + 2, 15); f('#8a5a2b', x, 6, dw, 14); f('#a8743c', x, 6, dw, 1); f('#7db6ff', x + 1, 7, dw - 2, 4); f('#ffd23f', x + dw - 2, 14, 1, 1); f('#ffe9a0', (w >> 1) - 1, 3, 2, 1); f('#bdbdbd', x - 2, 19, dw + 4, 1); },
];
const LOBBY: ((f: Fill, w: number) => void)[] = [ // two glass leaves in a dark surround, under a navy sign band with a gold rule; the doors take the two middle columns of a 4-column storey
  (f, w) => { const x = (w >> 1) - 2; f('#1a2250', x, 1, 4, 4); f('#7db6ff', x + 1, 2, 2, 2); },
  (f, w) => { const x = (w >> 1) - 4; f('#1a2250', x - 1, 1, 10, 2); f('#ffd23f', x + 1, 2, 6, 1); f('#2b3350', x - 1, 3, 10, 7); for (const d of [0, 5]) { f('#7db6ff', x + d, 4, 3, 3); f('#4a5a7a', x + d, 7, 3, 2); } f('#bdbdbd', x - 1, 9, 10, 1); },
  (f, w) => {
    const x = (w >> 1) - 8; f('#1a2250', x - 2, 3, 20, 2); f('#ffd23f', x, 5, 16, 1); f('#2b3350', x - 2, 6, 20, 14);
    for (const d of [0, 9]) { f('#7db6ff', x + d, 7, 7, 3); f('#3f6fd0', x + d, 10, 7, 4); f('#dce8ff', x + d + 1, 8, 2, 1); f('#4a5a7a', x + d, 14, 7, 5); f('#ffd23f', x + (d ? 9 : 6), 10, 1, 3); }
    f('#bdbdbd', x - 3, 19, 22, 1);
  },
];
const facade = memo((cols: number, kind: string, L: number) => {
  const [cw, h] = STOREY[L], entrance = kind === 'door' || kind === 'lobby';
  return tex(cols * cw, h, (f, w) => {
    f(kind === 'glass' ? '#d8e4f8' : '#fff', 0, 0, w, h);
    if (L === 2) f('#e2e2e2', 0, 18, w, 1);
    f('#c4c4c4', 0, h - 1, w, 1); // ledge
    for (let c = 0; c < cols; c++) {
      if (entrance && Math.abs(c * cw + cw / 2 - w / 2) < [2, 4, 8][L]) continue;
      (kind === 'glass' ? PANELS : WINDOW)[L](f, c * cw);
    }
    if (kind === 'door') DOOR[L](f, w, [1, 3, 7][L] + (cols % 2 ? 0 : 1));
    if (kind === 'lobby') LOBBY[L](f, w);
  });
});

// ---- A city building's walls (see models/city.ts) ----
// A face is one tall texture of whole storeys (`rows`, kinds from the bottom up), drawn twice: its day look, and its night, which is the emissive map of the material (see `nightlit`): black walls, and the glass of the windows that
// are lit, in the colour of their lamps (a lighter tone over a darker one). Whether a window is lit, and in which lamp, comes of a hash of its place and the face's seed: some are dark, the lamps differ, and a face is always the same.
// win / door: a house's windows, one to a column, and its door. flat / lobby: a flat's taller windows, and its entrance, glass doors under a sign. glass / atrium: a tower's curtain wall (two floors to a storey, small panes between
// mullions: a tower is made of many little windows, never a few big ones) and its glazed lobby. A face that is not the front has no entrance (`PLAIN`).
// foyer / lounge / ribbon / clad: a villa's. A modern house is glass in long panes, never a window to a column: lounge is a wall of it (foyer, the same with the door in its last column), ribbon a band low on a plain wall,
// and clad upright boards of timber with a slot of window to each two columns (the block is made in the timber's colour, which tints its boards).
// All of it is `villa` glass: aqua, lighter than a house's blue, with a pair of glints across each pane. By night a pane is a row of lamps in a house's amber, each lit or dark like any window: a long pane never glows as one sheet,
// which in HD-2D would be the biggest, whitest thing in the scene (the others keep their light to small, saturated lamps).
const rnd = (...k: number[]) => { let h = 0x811c9dc5; for (const v of k) { h = Math.imul(h ^ v, 0x01000193); h ^= h >>> 15; } return (h >>> 0) / 2 ** 32; }; // a hash of its arguments, in [0, 1)
const PLAIN: Record<string, string> = { door: 'win', lobby: 'flat', atrium: 'glass', foyer: 'ribbon', lounge: 'ribbon' }; // what a storey is on a face without the entrance
const LAMPS: Record<string, number[]> = { // a kind's windows: the share of them that is lit by night, and the tones of their lamps (warm in a house, a blue screen now and then in the flats, cold in a tower, bright in a lobby)
  win: [0.7, 0xff9f3a, 0xffb457, 0xffca7d], flat: [0.55, 0xff9f3a, 0xffc063, 0xffdca4, 0x86b8ff], glass: [0.4, 0xcfe8ff, 0xaed6ff, 0xffe2b4], atrium: [0.9, 0xffdca0, 0xffe6b8],
  foyer: [0.6, 0xcc7f2e, 0xcc9046, 0xcca264], lounge: [0.55, 0xcc7f2e, 0xcc9046, 0xcca264], ribbon: [0.45, 0xcc7f2e, 0xcc9046, 0xcca264], clad: [0.6, 0xcc9046, 0xcca264], // a villa's are fewer and dimmer: the owner's colour, not the amber, is what it is known by after dusk
};
const WIDE: Record<string, { y: number[]; h: number[]; panes: (cols: number) => number }> = { // a villa's panes, far, mid, near: where the glass starts, how tall it is, and how many panes there are to so many columns
  lounge: { y: [1, 2, 3], h: [3, 6, 12], panes: (c) => Math.ceil(c / 1.5) }, ribbon: { y: [2, 3, 5], h: [2, 4, 8], panes: (c) => Math.max(1, Math.round(c / 2)) },
};
const GLAZING: Record<string, [number, number, number, number][]> = { // the glass of a window, [x, y, w, h] from the left of its column and the top of its storey, far, mid, near: a flat's are taller than a house's
  win: [[1, 1, 1, 3], [1, 2, 3, 5], [3, 5, 5, 8]], flat: [[1, 1, 1, 3], [1, 1, 3, 6], [3, 3, 5, 10]],
};
const TOWER: [number, number, number, number][] = [[1, 5, 1, 1], [2, 5, 1, 0], [2, 10, 2, 0]]; // a tower's storey: floors to it, rows to a floor, rows of spandrel over and under the glass of a floor
const PANES: [number, number][][] = [[[1, 2]], [[1, 4]], [[1, 4], [6, 5]]]; // and the panes of a column: [x, width] (the last pane of a face is one narrower, to close it with a mullion)
const HALL: ((f: Fill, w: number) => void)[] = [ // a flat's entrance: two glass leaves in a dark surround under a navy sign band with a gold rule, the leaves tall (the glass takes all but a low kickplate); the two middle columns of 4
  (f, w) => { const x = (w >> 1) - 2; f('#1a2250', x, 1, 4, 4); f('#7db6ff', x + 1, 2, 2, 2); },
  (f, w) => { const x = (w >> 1) - 4; f('#1a2250', x - 1, 1, 10, 2); f('#ffd23f', x + 1, 2, 6, 1); f('#2b3350', x - 1, 3, 10, 7); for (const d of [0, 5]) { f('#7db6ff', x + d, 4, 3, 2); f('#3f6fd0', x + d, 6, 3, 2); f('#4a5a7a', x + d, 8, 3, 1); } f('#bdbdbd', x - 1, 9, 10, 1); },
  (f, w) => {
    const x = (w >> 1) - 8; f('#1a2250', x - 2, 3, 20, 2); f('#ffd23f', x, 5, 16, 1); f('#2b3350', x - 2, 6, 20, 14);
    for (const d of [0, 9]) { f('#7db6ff', x + d, 7, 7, 4); f('#3f6fd0', x + d, 11, 7, 6); f('#dce8ff', x + d + 1, 8, 2, 1); f('#4a5a7a', x + d, 17, 7, 2); f('#ffd23f', x + (d ? 9 : 6), 10, 1, 3); }
    f('#bdbdbd', x - 3, 19, 22, 1);
  },
];
const HALL_LIT: ((w: number) => number[][])[] = [(w) => [[(w >> 1) - 1, 2, 2, 2]], (w) => [0, 5].map((d) => [(w >> 1) - 4 + d, 4, 3, 4]), (w) => [0, 9].map((d) => [(w >> 1) - 8 + d, 7, 7, 10])]; // what of it is lit: the glass of the leaves, all of it
const ATRIUM: ((f: Fill, w: number) => void)[] = [ // a tower's lobby, its columns glass between mullions under a frieze; in the middle two the doors, two leaves in a dark surround, on a step
  (f, w) => { f('#e8eefb', 0, 0, w, 5); f('#2f3a5c', 0, 0, w, 1); for (const x of [1, w - 3]) { f('#3f6fd0', x, 1, 2, 3); f('#6c7596', x - 1, 4, 4, 1); } f('#2b3350', 3, 1, w - 6, 4); f('#7db6ff', 4, 2, w - 8, 2); },
  (f, w) => {
    f('#e8eefb', 0, 0, w, 10); f('#2f3a5c', 0, 0, w, 1); f('#ffd23f', 0, 1, w, 1); f('#2b3350', 5, 2, 10, 7); f('#bdbdbd', 4, 9, 12, 1);
    for (const x of [1, w - 4]) { f('#3f6fd0', x, 2, 3, 6); f('#6a8bd8', x, 2, 3, 2); f('#6c7596', x - 1, 8, 5, 1); }
    for (const x of [6, 11]) { f('#7db6ff', x, 3, 3, 2); f('#3f6fd0', x, 5, 3, 2); f('#4a5a7a', x, 7, 3, 1); }
  },
  (f, w) => {
    f('#e8eefb', 0, 0, w, 20); f('#2f3a5c', 0, 0, w, 3); f('#ffd23f', 0, 3, w, 1); f('#2b3350', 11, 4, 22, 15); f('#bdbdbd', 10, 19, 24, 1);
    for (const x of [1, w - 10]) { f('#3f6fd0', x, 4, 9, 13); f('#6a8bd8', x, 4, 9, 4); f('#6c7596', x - 1, 17, 11, 3); }
    for (const x of [12, 23]) { f('#7db6ff', x, 5, 9, 5); f('#3f6fd0', x, 10, 9, 6); f('#dce8ff', x + 1, 6, 2, 1); f('#4a5a7a', x, 16, 9, 2); }
    f('#ffd23f', 20, 9, 1, 3); f('#ffd23f', 23, 9, 1, 3);
  },
];
const ATRIUM_LIT: ((w: number) => { bays: number[][]; doors: number[][] })[] = [ // its lit parts: the glass of the two end columns (a hash picks the lamp of each) and of the doors
  (w) => ({ bays: [[1, 1, 2, 3], [w - 3, 1, 2, 3]], doors: [[4, 2, w - 8, 2]] }),
  (w) => ({ bays: [[1, 2, 3, 6], [w - 4, 2, 3, 6]], doors: [[6, 3, 3, 4], [11, 3, 3, 4]] }),
  (w) => ({ bays: [[1, 4, 9, 13], [w - 10, 4, 9, 13]], doors: [[12, 5, 9, 11], [23, 5, 9, 11]] }),
];
const lamp = (f: Fill, L: number, x: number, y: number, w: number, h: number, tone: number) => { const k = L === 2 ? 3 : 2; f(hex(tone), x, y, w, h); if (L && h > k) f(shade(tone, 0.8), x, y + k, w, h - k); }; // a lit window: a lighter upper part over a darker one
// A window with its glass at (x, y), w x h: by day in a frame with a glint and a sill, by night a lamp if `tone` says it is lit. A curtain-wall `cell` is bare glass, lighter at the top.
const BLUE = ['#1a2250', '#3f6fd0', '#7db6ff', '#dce8ff'], AQUA = ['#2b3a5c', '#5cc0d8', '#a8ecf6', '#f2feff']; // a pane's frame, glass, sky (the top of it) and glint: a house's, and a villa's, which is lighter
const pane = (f: Fill, L: number, night: boolean, x: number, y: number, w: number, h: number, tone?: number, [frame, glass, sky, glint] = BLUE) => {
  if (night) return tone !== undefined && lamp(f, L, x, y, w, h, tone);
  if (L === 2) { f(frame, x - 1, y - 1, w + 2, h + 2); f('#f4f4f4', x - 2, y + h + 1, w + 4, 1); f('#aaa', x - 2, y + h + 2, w + 4, 1); }
  if (L === 1) { f(frame, x, y - 1, w, 1); f('#aaa', x - 1, y + h, w + 2, 1); }
  f(glass, x, y, w, h); f(sky, x, y, w, L === 2 ? 3 : L ? 2 : 1);
  if (L) f(glint, x, y, 1, L === 2 ? 2 : 1);
};
const villa = (f: Fill, L: number, night: boolean, x: number, y: number, w: number, h: number, tone: (c: number) => number | undefined) => { // a villa's window: aqua glass with two glints slanting across it (a long one and a short, from near and mid up); by night lamps 3 and 5 texels apart from mid up
  if (night) {
    const n = Math.max(1, Math.round(w / [w, 3, 5][L])), at = (c: number) => x + Math.round((c * w) / n); // n lamps across, a texel of mullion between them
    for (let c = 0; c < n; c++) { const t = tone(c); if (t !== undefined) lamp(f, L, at(c), y, at(c + 1) - at(c) - +(c < n - 1), h, t); }
    return;
  }
  pane(f, L, false, x, y, w, h, undefined, AQUA);
  if (L) for (const [a, n] of L === 2 ? [[3, 6], [8, 3]] : [[2, 3]]) for (let k = 0; k < n && a + k < w - 1 && k < h - 1; k++) f(AQUA[2], x + a + k, y + h - 2 - k, 1, 1);
};
const cell = (f: Fill, L: number, night: boolean, x: number, y: number, w: number, h: number, tone?: number) => {
  if (night) return tone !== undefined && lamp(f, L, x, y, w, h, tone);
  f('#3f6fd0', x, y, w, h); f('#6aa8f7', x, y, w, Math.max(1, Math.round(h / 3)));
};
const city = memo((cols: number, rows: string, L: number, night: boolean, seed: number) => {
  const kinds = rows.split(' '), [cw, h] = STOREY[L];
  return tex(cols * cw, kinds.length * h, (g, w, H) => {
    if (night) g('#000', 0, 0, w, H);
    kinds.forEach((kind, i) => {
      const f: Fill = (c, x, y, bw, bh) => g(c, x, H - (i + 1) * h + y, bw, bh), [on, ...tones] = LAMPS[kind === 'lobby' ? 'flat' : kind === 'door' ? 'win' : kind]; // the storey's own coordinates, from its top
      const lit = (p: number, ...k: number[]) => (rnd(seed, i, ...k) < p ? tones[Math.floor(rnd(seed, i, ...k, 1) * tones.length)] : undefined); // the tone of a window's lamp, if it is lit
      const base = () => { if (!night) { f('#fff', 0, 0, w, h); if (L === 2) f('#e2e2e2', 0, 18, w, 1); f('#c4c4c4', 0, h - 1, w, 1); } }; // wall and ledge
      const entry = (x0: number, n: number) => { // the original door (see DOOR), centred in the n columns from x0 on: by night its glass and the lamp over it
        const sub: Fill = (c, x, y, bw, bh) => f(c, x0 + x, y, bw, bh), sw = n * cw, dw = [1, 3, 7][L] + (n % 2 ? 0 : 1), x = (sw - dw) / 2;
        if (!night) DOOR[L](sub, sw, dw);
        else if (L) { lamp(sub, L, L === 2 ? x + 1 : x, L === 2 ? 7 : 4, L === 2 ? dw - 2 : dw, L === 2 ? 4 : 2, 0xffc070); sub('#ffe9a0', (sw >> 1) - 1, L === 2 ? 3 : 1, 2, 1); }
      };
      if (kind === 'glass') {
        const [nf, fh, sp, sq] = TOWER[L], gh = fh - sp - sq;
        if (!night) f('#e8eefb', 0, 0, w, h); // the mullions
        for (let fl = 0; fl < nf; fl++) {
          const y = fl * fh, p = on * 2 * rnd(seed, i, fl, 7); // a floor has more of its windows lit, or fewer: some floors are dark, some are on
          if (!night) { f('#8da4cb', 0, y, w, fh); if (L === 2) f('#a9bde0', 0, y, w, 1); f('#e8eefb', 0, y + sp, w, gh); } // spandrel, a pale edge to it near, and the band of glass in its mullions
          for (let c = 0; c < cols; c++) PANES[L].forEach(([dx, pw], k) => cell(f, L, night, c * cw + dx, y + sp, pw - +(c === cols - 1 && k === PANES[L].length - 1), gh, lit(p, fl, c, k)));
        }
      } else if (kind === 'atrium') {
        if (!night) ATRIUM[L](f, w);
        const { bays, doors } = ATRIUM_LIT[L](w);
        if (night) { bays.forEach(([x, y, bw, bh], k) => { const t = lit(on, k); t !== undefined && lamp(f, L, x, y, bw, bh, t); }); doors.forEach(([x, y, bw, bh]) => lamp(f, L, x, y, bw, bh, 0xffe9c0)); }
      } else if (kind === 'clad') {
        base();
        if (!night) for (let x = 0, b = [2, 3, 4][L]; x < w; x += b) f(x % (2 * b) ? '#fff' : '#d6d6d6', x, 0, 1, h - (L === 2 ? 2 : 1)); // a seam to every board, every other one picked out
        for (let j = 0, n = Math.max(1, Math.round(cols / 2)), sw = [1, 2, 4][L]; j < n; j++) villa(f, L, night, Math.round(((j + 0.5) * w) / n - sw / 2), WIDE.lounge.y[L], sw, WIDE.lounge.h[L], (c) => lit(on, j, c));
      } else if (kind === 'foyer' || kind in WIDE) {
        base();
        const { y, h: gh, panes } = WIDE[kind === 'foyer' ? 'lounge' : kind], gw = kind === 'foyer' ? cols - 1 : cols, m = [1, 1, 2][L], gap = [1, 1, 2][L], span = gw * cw - 2 * m + gap, n = panes(gw); // foyer: glass but for the last column, which is the door's
        for (let j = 0; j < n; j++) {
          const a = m + Math.round((j * span) / n), b = m + Math.round(((j + 1) * span) / n) - gap;
          villa(f, L, night, a, y[L], b - a, gh[L], (c) => lit(on, j, c));
        }
        if (kind === 'foyer') entry(gw * cw, 1);
      } else {
        base();
        if (kind === 'door') entry(0, cols);
        else {
          const [gx, gy, gw, gh] = GLAZING[kind === 'win' ? 'win' : 'flat'][L];
          for (let c = 0; c < cols; c++) if (kind !== 'lobby' || Math.abs(c * cw + cw / 2 - w / 2) >= [2, 4, 8][L]) pane(f, L, night, c * cw + gx, gy, gw, gh, lit(on, c)); // not in front of the entrance
          if (kind === 'lobby') { if (!night) HALL[L](f, w); else HALL_LIT[L](w).forEach(([x, y, bw, bh]) => lamp(f, L, x, y, bw, bh, 0xffe2ac)); }
        }
      }
    });
  });
});
const ROOF = 8; // roof tile size in near texels (4 and 2 on the mid and far grids)
const roofTex = memo((L: number) => tex(ROOF >> (2 - L), ROOF >> (2 - L), (f, n) => { // shingle courses: 4 rows near (with a light row and joints), 2 mid and far
  const c = L === 2 ? 4 : 2;
  f('#fff', 0, 0, n, n);
  for (let y = 0; y < n; y += c) {
    if (L === 2) f('#d4d4d4', 0, y + 2, n, 1);
    f('#a8a8a8', 0, y + c - 1, n, 1);
    if (L) f('#bdbdbd', y % (2 * c) ? c : 0, y, 1, c - 1);
  }
}, 1));
// sign face, W x H near texels (a level draws it on 1/4, 1/2 or all of them): a 1-texel frame when tall enough, and its text (the hand-drawn 3 x 5 letters, or a pictogram) in the middle,
// s texels to a letter pixel near and half that a level down: it is drawn only where that is a whole texel or more and fits
const plate = memo((bg: string, fg: string, W: number, H: number, text: string, s: number, L: number) => {
  const k = 2 ** (2 - L), sl = s / k;
  return tex(Math.round(W / k), Math.round(H / k), (f, w, h, g) => {
    f(bg, 0, 0, w, h);
    if (H > 8) for (const [x, y, bw, bh] of [[0, 0, w, 1], [0, h - 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]]) f(fg, x, y, bw, bh);
    const tw = inkWidth(text) * sl, th = inkHeight(text) * sl;
    if (sl >= 1 && tw + 2 <= w && th + (H > 8 ? 2 : 0) <= h) { g.fillStyle = fg; ink(g, text, (w - tw) >> 1, ((h - th) >> 1) + th, sl); }
  });
});
const plateMat = memo((bg: string, fg: string, W: number, H: number, text: string, s: number) => lodMap(new THREE.MeshBasicMaterial(), (L) => plate(bg, fg, W, H, text, s, L))); // unlit like the cards: colours stay the same in any light

// ---- Voxel helpers ----
export const GOLD = 0xffd23f, IRON = 0x555a6e, INK = 0x23263a, LAVA = 0xff7a1a;
const geo = memo((w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d));
const cylGeo = memo((r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 10));
// hip roof: the 4-sided cone (shaded from its corners), each face laid flat in UV space so a roof texel is a world texel
const roofGeo = memo((w: number, d: number, h: number) => {
  const g = new THREE.ConeGeometry(w * Math.SQRT1_2, h, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, d / w).toNonIndexed(), p = g.attributes.position;
  const [a, b, c, u, v] = [...Array(5)].map(() => new THREE.Vector3()), uv: number[] = [], k = DENSITY / ROOF;
  for (let i = 0; i < p.count; i += 3) { // every triangle is one face: eave corner a, next eave corner b, apex c
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1).sub(a); c.fromBufferAttribute(p, i + 2).sub(a);
    u.copy(b).normalize(); v.copy(c).addScaledVector(u, -c.dot(u)).normalize(); // along the eave, up the slope
    uv.push(0, 0, b.dot(u) * k, 0, c.dot(u) * k, c.dot(v) * k);
  }
  return g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
});
// gable roof, the ridge `w` long along x over a footprint `d` deep (`turn`: along z), rising h: its two slopes laid flat in UV space like a hip's (group 0), its two ends plain wall (group 1)
const gableGeo = memo((w: number, d: number, h: number, turn: boolean) => {
  const [a, b, c, k] = [w / 2, d / 2, h / 2, DENSITY / ROOF], s = Math.hypot(b, h) * k, pos: number[] = [], uv: number[] = [];
  const quad = (p: number[][]) => { for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); uv.push(...[[0, 0], [w * k, 0], [w * k, s], [0, s]][i]); } }; // corners counter-clockwise from outside, the eave first
  quad([[-a, -c, b], [a, -c, b], [a, c, 0], [-a, c, 0]]); quad([[a, -c, -b], [-a, -c, -b], [-a, c, 0], [a, c, 0]]);
  for (const p of [[a, -c, b], [a, -c, -b], [a, c, 0], [-a, -c, -b], [-a, -c, b], [-a, c, 0]]) { pos.push(...p); uv.push(0, 0); }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.addGroup(0, 12, 0); g.addGroup(12, 6, 1);
  if (turn) g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
});
const NEON = new Set([0xff5de0, 0x5dfff0, 0xff3b3b, 0x3b6bff, 0xfff6b0, LAVA]); // neon, lamps, flames and lava are unlit: they glow in the shade as in the sun
const METAL = new Map<number, Pbr>([[GOLD, [0.3, 1, 0.55, 0]], [IRON, [0.45, 1, 0.5, 0]]]); // metal throws the HD-2D light back as a highlight (a metalness short of 1: there is no sky to mirror but the hemisphere's)
export const mat = memo((c: THREE.ColorRepresentation) => (NEON.has(c as number) ? glow(new THREE.MeshBasicMaterial({ color: c })) : toon(c, {}, METAL.get(c as number))));
// The same two special materials, picked explicitly rather than guessed from the colour — a new lamp or alloy need not join the colour tables (and so cannot change another model's parts that share the colour).
// Shared through memo: never mutate a shared material's state in a `tick` — build a local `glow`/`toon` for that (see models/invest/oil.ts, which colours its own lamp each frame).
export const emissive = memo((c: THREE.ColorRepresentation) => glow(new THREE.MeshBasicMaterial({ color: c })));
export const metal = memo((c: THREE.ColorRepresentation, pbr: Pbr) => toon(c, {}, pbr));
export const lamplit = memo((c: number, night: number, k: number) => nightlit(toon(c, {}, METAL.get(c)), night, k)); // `mat(c)` by day, and by night it shines in `night` x k (see `nightlit`): a lit path, a strip of light
const wallMat = memo((cols: number, kind: string, c: number) => lodMap(toon(c), (L) => facade(cols, kind, L)));
const cityMat = memo((cols: number, rows: string, c: number, seed: number, lamps: boolean) => { // lamps: the night's drawing is the emissive map (white, so that the map alone says what is lit)
  const m = lodMap(toon(c, lamps ? { emissive: 0xffffff } : {}), (L) => city(cols, rows, L, false, seed));
  return lamps ? lodMap(m, (L) => city(cols, rows, L, true, seed), 'emissiveMap') : m;
});
const roofMat = memo((c: number) => lodMap(toon(c), roofTex));
// Tower prism: a quarter of a square tower, its apex at the centre. Groups: 0 the outer wall (half-width a, height h), 1 the two walls beside it, 2 the roof (rises r to the apex).
// A wall is textured along its length and up it in modules m tall, the roof in panes of 4 texels, so a texel is a world texel on every face
export const prism = memo((a: number, h: number, r: number, m: number) => {
  const T = 4 / DENSITY, pos: number[] = [], uv: number[] = [], g = new THREE.BufferGeometry();
  const faces: [number, number[][]][] = [[0, [[-a, 0, a], [a, 0, a], [a, h, a], [-a, h, a]]], [1, [[0, 0, 0], [-a, 0, a], [-a, h, a], [0, h + r, 0]]], [1, [[a, 0, a], [0, 0, 0], [0, h + r, 0], [a, h, a]]], [2, [[-a, h, a], [a, h, a], [0, h + r, 0]]]]; // corners, counter-clockwise seen from outside
  for (const [k, pts] of faces) {
    const start = pos.length / 3, [p0, p1] = pts, dx = p1[0] - p0[0], dz = p1[2] - p0[2], len = dx * dx + dz * dz; // a face's first edge runs along its wall
    for (let i = 1; i < pts.length - 1; i++) for (const p of [p0, pts[i], pts[i + 1]]) { // a fan of triangles
      pos.push(...p);
      uv.push(...(k < 2 ? [((p[0] - p0[0]) * dx + (p[2] - p0[2]) * dz) / len, p[1] / m] : [p[0] / T, ((a - p[2]) * Math.hypot(a, r)) / (a * T)])); // along and up the wall, or across the roof and up its slope
    }
    g.addGroup(start, pos.length / 3 - start, k);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)).computeVertexNormals();
  return g;
});
const curtain = memo((w: number, m: number, L: number) => tex(texels(w, L), texels(m, L), (f, W, H) => { // curtain wall, w x m: silver-blue glass, an X of white bracing and posts along the edges, repeated up the tower
  f('#86aadf', 0, 0, W, H);
  if (L === 2) for (let k = 0; k < 4; k++) f('#7298d4', 0, Math.round((k * H) / 4), W, 1); // four floors to a module
  const brace = (c: string, dy: number) => { const n = Math.max(W, H); for (let i = 0; i < n; i++) { const x = Math.round((i * (W - 1)) / (n - 1)), y = Math.round((i * (H - 1)) / (n - 1)) + dy; f(c, x, y, 1, 1); f(c, W - 1 - x, y, 1, 1); } }; // both diagonals
  if (L === 2) brace('#b8cdee', 1); // a pale shadow under the braces, near
  brace('#ffffff', 0);
  if (L) { f('#e6eefb', 0, 0, 1, H); f('#e6eefb', W - 1, 0, 1, H); }
}, 1));
const panes = memo((L: number) => { const n = Math.max(1, texels(4 / DENSITY, L)); return tex(n, n, (f) => { f('#e4eeff', 0, 0, n, n); if (L === 2) { f('#b9cdee', 0, 0, n, 1); f('#b9cdee', 0, 0, 1, n); } }, 1); }); // glass roof: panes between mullions
export const prismMat = memo((a: number, m: number) => [2 * a, a * Math.SQRT2].map((w) => lodMap(toon(0xffffff), (L) => curtain(w, m, L))).concat(lodMap(toon(0xffffff), panes))); // the materials of group 0, 1, 2: one lattice per wall width
export const part = (g: THREE.Group, geometry: THREE.BufferGeometry, h: number, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
};
// K = how much bigger than authored the thing being built is: props are drawn at PK by default (a model's `scale` overrides it, see ModelDef; their authored numbers stay at the old size), buildings at 1.
// Textured parts keep one texel per world texel at any K: roofs and signs size their texture from the final geometry, storeys (floor) are whole
// modules and never stretch, so a bigger facade simply gets more windows.
let K = 1;
export const PK = 1.25; // the default draw scale of a registered model's authored numbers
export const box = (g: THREE.Group, w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, m: THREE.Material | THREE.Material[] = mat(color)) => part(g, geo(w * K, h * K, d * K), h * K, m, x * K, y * K, z * K);
export const cyl = (g: THREE.Group, r: number, h: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) => part(g, cylGeo(r * K, h * K), h * K, mat(color), x * K, y * K, z * K);
export const hip = (g: THREE.Group, w: number, d: number, h: number, y: number, color: number, x = 0, z = 0) => part(g, roofGeo(w * K, d * K, h * K), h * K, roofMat(color), x * K, y * K, z * K);
export const gable = (g: THREE.Group, w: number, d: number, h: number, y: number, color: number, wall: number, x = 0, z = 0, turn = false) => part(g, gableGeo(w * K, d * K, h * K, turn), h * K, [roofMat(color), mat(wall)], x * K, y * K, z * K);
export const plaque = (g: THREE.Group, text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, s = 1) => { // sized in whole texels; s: texels to a pixel of its text (see plate)
  const side = mat(bg), W = Math.max(texels(w * K), inkWidth(text) * s + 2), H = texels(h * K);
  return part(g, geo(W / DENSITY, H / DENSITY, 0.12 * K), H / DENSITY, [side, side, side, side, plateMat(bg, fg, W, H, text, s), side], x * K, y * K, z * K);
};
export const floor = (g: THREE.Group, cols: number, dcols: number, kind: string, color: number, y: number, x = 0, z = 0) => { // one storey, `cols` x `dcols` half-units, in final units; the entrance faces the viewer
  const alt = kind === 'glass' ? kind : 'win', side = wallMat(dcols, alt, color), plain = mat(color);
  return part(g, geo(cols / 2, 0.9, dcols / 2), 0.9, [side, side, plain, plain, wallMat(cols, kind, color), wallMat(cols, alt, color)], x, y, z);
};
export const block = (g: THREE.Group, cols: number, dcols: number, rows: string, color: number, y = 0, x = 0, z = 0, lamps = true, seed = 0) => { // a city building's walls (see `city`): a box of storeys, `rows` of them from the bottom up, cols x dcols half-units, in final units, the entrance facing the viewer; lamps: lit after dusk
  const bare = rows.split(' ').map((k) => PLAIN[k] ?? k).join(' '), h = rows.split(' ').length * 0.9, side = cityMat(dcols, bare, color, seed + 2, lamps), plain = mat(color);
  return part(g, geo(cols / 2, h, dcols / 2), h, [side, side, plain, plain, cityMat(cols, rows, color, seed, lamps), cityMat(cols, bare, color, seed + 1, lamps)], x, y, z);
};
export const final = (fn: (g: THREE.Group) => void) => (g: THREE.Group) => { const k = K; K = 1; fn(g); K = k; }; // props made of storeys are authored in final units
// A static prop: a box [color, w, h, d, x, y, z] (y from the tile top, z from the lot centre), or a function drawing into the group
export type Prop = [color: number, w: number, h: number, d: number, x: number, y: number, z: number] | ((g: THREE.Group) => void);
// One registered model, one file under models/{special,invest,public}/: `key` is the tile name or kind it builds (a tile's name wins over its kind, see buildProps),
// `props` its static parts and `scale` its authored-units draw scale (PK by default). The registry finds the files itself (import.meta.glob): a new or tuned model never touches a shared table.
export interface ModelDef { key: string; props: Prop[]; scale?: number }
export const drawProps = (g: THREE.Group, props: Prop[], k = PK) => { // props are drawn k times bigger than authored (see K)
  K = k;
  for (const r of props) typeof r === 'function' ? r(g) : box(g, r[1], r[2], r[3], r[0], r[4], r[5], r[6]);
  K = 1;
};
// Masonry, in final units: a block whose faces repeat one stone tile in world texels (a bigger block just shows more courses), and string-art sprites laid on a wall as decals
const STONE = 16; // the stone tile, in near texels
const brick = memo((w: number, h: number, d: number) => {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, k = DENSITY / STONE;
  [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]].forEach(([u, v], f) => { for (let i = 4 * f; i < 4 * f + 4; i++) uv.setXY(i, uv.getX(i) * u * k, uv.getY(i) * v * k); }); // the faces: +x -x +y -y +z -z
  return g;
});
const stoneTex = memo((L: number) => tex(STONE >> (2 - L), STONE >> (2 - L), (f, n) => { // courses of ashlar, a mortar row under each, the joints staggered from one course to the next
  const c = [4, 2, 4][L], b = [4, 4, 8][L];
  f('#fff', 0, 0, n, n);
  for (let r = 0; r * c < n; r++) { f('#bdbdbd', 0, r * c + c - 1, n, 1); for (let x = (r & 1) * (b >> 1); x < n; x += b) f('#d4d4d4', x, r * c, 1, c - 1); }
}, 1));
const stoneMat = memo((c: number) => lodMap(toon(c), stoneTex));
export const stone = (g: THREE.Group, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) => part(g, brick(w, h, d), h, stoneMat(color), x, y, z); // a block of masonry
export const sprite = memo((rows: string[]) => pixelTexture(canvas(rows[0].length, rows.length, (g) => paint(g, rows, 0, 0)))); // string art as a texture
export const decal = (g: THREE.Group, rows: string[], x: number, y: number, z: number) => { // a sprite on a wall that faces the viewer, a sprite pixel to the near texel
  const [w, h] = [rows[0].length / DENSITY, rows.length / DENSITY], m = part(g, new THREE.PlaneGeometry(w, h), h, toon(0xffffff, { map: sprite(rows), alphaTest: 0.5 }), x, y, z);
  m.castShadow = false;
  return m;
};
// A built model is baked into a few meshes: everything under `root` is brought into root's own space (each mesh by its own matrix and its parents', not root's: the model is still moved as one) and what shares a
// material and a shadow setting is merged, so a hundred boxes cost a handful of draw calls, in the shadow pass as in the main one. A mesh of several materials (a storey, a sign) is cut along its groups first.
// The geometries from memo are shared, so they are copied, never changed; each merged one is marked `userData.own` — it belongs to root alone, and `freeBaked` frees it when root is rebuilt.
// A node with a `userData.tick` moves every frame (the board calls it, see board.ts), and a node with a name is looked up (a strike finds its missile): either is left out of the batch wherever it sits in the
// tree and put back under a group holding the place its parents had (their matrices end up merged), its insides baked by whoever made it.
const IDENT = new THREE.Matrix4();
export function bake(root: THREE.Group) {
  const kept: [THREE.Object3D, THREE.Matrix4][] = [];
  const hold = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      if (c.userData.tick || c.name) { // a kept node's own transform is left alone: put it back under a group carrying the transform of the parents it loses
        const m = new THREE.Matrix4();
        for (let p = c.parent!; p !== root; p = p.parent!) { p.updateMatrix(); m.premultiply(p.matrix); }
        kept.push([c, m]);
        c.removeFromParent();
      } else hold(c);
    }
  };
  hold(root);
  const bins = new Map<string, { src: THREE.Mesh; material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const to = new THREE.Matrix4(), mats = [m.material].flat(), g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    for (let p: THREE.Object3D = m; p !== root; p = p.parent!) { p.updateMatrix(); to.premultiply(p.matrix); }
    for (const { start, count, materialIndex = 0 } of Array.isArray(m.material) ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }]) {
      const material = mats[materialIndex], k = [material.uuid, m.castShadow, m.receiveShadow].join(), cut = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g.attributes)) cut.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
      (bins.get(k) ?? bins.set(k, { src: m, material, geometries: [] }).get(k)!).geometries.push(cut.applyMatrix4(to));
    }
  });
  root.clear();
  for (const { src, material, geometries } of bins.values()) {
    const m = new THREE.Mesh(mergeGeometries(geometries), material);
    m.castShadow = src.castShadow; m.receiveShadow = src.receiveShadow;
    m.geometry.userData.own = true;
    root.add(m);
  }
  for (const [o, m] of kept) {
    if (m.equals(IDENT)) { root.add(o); continue; }
    const w = new THREE.Group();
    m.decompose(w.position, w.quaternion, w.scale);
    w.add(o);
    root.add(w);
  }
}
/** Frees the merged geometries a `bake` produced (marked `userData.own`); the shared, memoized source geometries are left alone. Called before a baked tree is rebuilt or thrown away. */
export const freeBaked = (root: THREE.Object3D) => root.traverse((o) => {
  const m = o as THREE.Mesh;
  if (m.isMesh && m.geometry.userData.own) m.geometry.dispose();
});
