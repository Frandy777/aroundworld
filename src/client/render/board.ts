import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, renderer, camera, controls, lod, toon, lodMap, pixelTexture, texels, toScreen, DENSITY, BOARD_K } from './scene';
import { TILES, type Tile } from '../../shared/data';
import { canvas, paint, shade, ink, inkWidth, inkHeight } from './art';
import { CARD_SIZE, cardText, drawCard, drawCode, drawGround, drawPad } from './labels';

type Fill = (c: string, x: number, y: number, w: number, h: number) => void;
type Block = ReturnType<typeof cardText>[number];
type Prop = [color: number, w: number, h: number, d: number, x: number, y: number, z: number] | ((g: THREE.Group) => void); // a static prop: a box, or a function drawing into the group

// ---- Layout: the map design (see the map in game-rules.md), one closed loop of straight runs, walked counter-clockwise from START in the bottom-right corner ----
const S = 3 * BOARD_K, SZ = 128 / DENSITY, TOP = 0.6, SLAB = TOP + 0.8, WIDE = SZ + S; // cell size, tile size (128 texels, 4 short of the cell), tile top height, slab height (its foot is at the sea, y = -0.8), START's slab: two cells
const DIRS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const MOVES = 'N6 W4 N3 E4 N6 W4 S4 W7 N4 W4 S6 E4 S3 W4 S6 E4 N4 E7 S4 E4';
const cells: [number, number][] = [[0, 0]];
for (const [, d, n] of MOVES.matchAll(/([NSEW])(\d+)/g))
  for (let k = 0; k < +n; k++) { const [x, y] = cells[cells.length - 1], [dx, dy] = DIRS[d]; cells.push([x + dx, y + dy]); }
cells.pop(); // the final step lands back on START
const mid = (a: number[]) => (Math.min(...a) + Math.max(...a)) / 2;
const cx = mid(cells.map((c) => c[0])), cy = mid(cells.map((c) => c[1]));
// 92 cells for 91 tiles: START is two cells wide, and the loop's last cell (POS[TILES.length]) is its wing
export const POS = cells.map(([x, y]) => new THREE.Vector3((x - cx) * S, TOP, (y - cy) * S));
// START's slab covers its own cell and the wing: MID is the way from START's centre to the slab's, CENTRE the slab's centre
const MID = POS[TILES.length].clone().sub(POS[0]).multiplyScalar(0.5), CENTRE = POS[0].clone().add(MID);
export { TOP, SLAB, SZ };
// Every slab as [centre x, centre z, half width, half depth] (seen from above): what the sea washes against
export const FOOT = [...POS.slice(1, TILES.length).map((p) => [p.x, p.z, SZ / 2, SZ / 2]), [CENTRE.x, CENTRE.z, WIDE / 2, SZ / 2]];

// ---- Tile layout (tile space: x east, z south toward the default camera; the tiles are fixed, only the camera turns) ----
// The tile is split in two. RIGHT strip = the city: an owner-coloured plot with the building (or props) on it, the one thing that carries
// ownership and level, so it takes the most room and all the height. LEFT half = information: the card at the back, the tokens' yard in front
// (the dice land between its two rows). Nothing tall stands in the left half, so from the default camera no tower can hide a card or a token, not even
// the tower of the tile in front of it.
const M = 0.25;                                             // margin between the tile edge and what stands on it
export const LOT = { x: 1.6, z: 1.0 };                      // building / props group centre, in the middle of the strip
const PAD = { x: 1.6, z: 1.225, w: 2.5, d: 3.25, h: 0.3 };  // the plot: the whole strip, the building's depth + a front apron; owner colour shows all round the base
const CARD = { w: 2.9, d: 2.175, x: M + 1.45 - SZ / 2, z: M + 1.0875 - SZ / 2 }; // info card, tucked into the back-left corner
// START is two cells wide, so its contents make two clusters, each laid out exactly like a tile's own (same margins) in one of its cells: the information (card, tokens'
// yard, dice) in the wing, west of START's own cell, and the props (the gate) in START's own cell. home(i) is what a tile's information is laid out around: its centre, or for START the wing's
export const home = (i: number) => POS[i || TILES.length];
const VACANT = 0xb9b2a0;                                    // the plot of a tile nobody owns
const PK = 1.25;                                            // props are drawn this much bigger than authored (see FIT for the wide ones)
const FIT: Record<string, number> = { bank: 1.2, exchange: 1.15, jail: 1.45 }; // per-kind scale where PK would overflow the strip (or, the jail, can hold four prisoners)

// ---- Pixel textures: one drawing per zoom level L (0 far, 1 mid, 2 near; see scene.js), each a design on its own grid of 1/4, 1/2 or all of the world pixel
// density (DENSITY, ~22 texels per world unit). Shapes and materials are shared through memo ----
const memo = <A extends unknown[], R>(fn: (...a: A) => R) => { const c = new Map<string, R>(); return (...a: A): R => { const k = a.join('|'); if (!c.has(k)) c.set(k, fn(...a)); return c.get(k)!; }; };
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
    const tw = inkWidth(text, 1) * sl, th = inkHeight(text, 1) * sl;
    if (sl >= 1 && tw + 2 <= w && th + (H > 8 ? 2 : 0) <= h) { g.fillStyle = fg; ink(g, text, 1, (w - tw) >> 1, ((h - th) >> 1) + th, sl); }
  });
});
const plateMat = memo((bg: string, fg: string, W: number, H: number, text: string, s: number) => lodMap(new THREE.MeshBasicMaterial(), (L) => plate(bg, fg, W, H, text, s, L))); // unlit like the cards: colours stay the same in any light
const cardTex = (t: Tile, L: number) => pixelTexture(canvas(...CARD_SIZE[L], (g) => drawCard(g, t, L)));
const groundTex = memo((type: string, kind: string, color: number, L: number) => pixelTexture(canvas(32 << L, 32 << L, (g) => drawGround(g, type, kind, color, L))));
// START's ground, one texture over both its cells (see createBoard), with its finish line along the bottom edge
const startTex = memo((color: number, L: number) => pixelTexture(canvas(texels(WIDE, L), texels(SZ, L), (g, w, h) => drawGround(g, 'public', 'start', color, L, w, h))));
// the plot, in whole texels of each level: top face carries the carpet, the walls are a darker tone of the same colour
const padMats = memo((color: number) => {
  const side = toon(shade(color, 0.6)), top = lodMap(toon(0xffffff), (L) => pixelTexture(canvas(texels(PAD.w, L), texels(PAD.d, L), (g, w, h) => drawPad(g, color, w, h, L))));
  return [side, top];
});

// ---- Voxel helpers ----
const GOLD = 0xffd23f, IRON = 0x555a6e, INK = 0x23263a;
const geo = memo((w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d));
// The tile's slab and the plot are boxes of two materials, the walls with the bottom and the top: their faces are put in that order and cut into two groups, so each costs two draws, not six.
const twoGroups = (g: THREE.BoxGeometry) => {
  const i = g.index!.array;
  g.setIndex([0, 1, 3, 4, 5, 2].flatMap((f) => [...i.slice(6 * f, 6 * f + 6)])); // the faces are +x -x +y -y +z -z, six indices each: the top (+y) goes last
  g.clearGroups(); g.addGroup(0, 30, 0); g.addGroup(30, 6, 1);
  return g;
};
const slabGeo = memo((w: number, h: number, d: number) => twoGroups(new THREE.BoxGeometry(w, h, d)));
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
const NEON = new Set([0xff5de0, 0x5dfff0, 0xff3b3b, 0x3b6bff, 0xfff6b0]); // neon, lamps and flames are unlit: they glow in the shade as in the sun
const mat = memo((c: THREE.ColorRepresentation) => (NEON.has(c as number) ? new THREE.MeshBasicMaterial({ color: c }) : toon(c)));
const wallMat = memo((cols: number, kind: string, c: number) => lodMap(toon(c), (L) => facade(cols, kind, L)));
const roofMat = memo((c: number) => lodMap(toon(c), roofTex));
// Tower prism: a quarter of a square tower, its apex at the centre. Groups: 0 the outer wall (half-width a, height h), 1 the two walls beside it, 2 the roof (rises r to the apex).
// A wall is textured along its length and up it in modules m tall, the roof in panes of 4 texels, so a texel is a world texel on every face
const prism = memo((a: number, h: number, r: number, m: number) => {
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
const prismMat = memo((a: number, m: number) => [2 * a, a * Math.SQRT2].map((w) => lodMap(toon(0xffffff), (L) => curtain(w, m, L))).concat(lodMap(toon(0xffffff), panes))); // the materials of group 0, 1, 2: one lattice per wall width
const part = (g: THREE.Group, geometry: THREE.BufferGeometry, h: number, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
};
// K = how much bigger than authored the thing being built is: props are drawn at PK (their authored numbers stay at the old size), buildings at 1.
// Textured parts keep one texel per world texel at any K: roofs and signs size their texture from the final geometry, storeys (floor) are whole
// modules and never stretch, so a bigger facade simply gets more windows.
let K = 1;
const box = (g: THREE.Group, w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, m: THREE.Material | THREE.Material[] = mat(color)) => part(g, geo(w * K, h * K, d * K), h * K, m, x * K, y * K, z * K);
const cyl = (g: THREE.Group, r: number, h: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) => part(g, cylGeo(r * K, h * K), h * K, mat(color), x * K, y * K, z * K);
const hip = (g: THREE.Group, w: number, d: number, h: number, y: number, color: number, x = 0, z = 0) => part(g, roofGeo(w * K, d * K, h * K), h * K, roofMat(color), x * K, y * K, z * K);
const plaque = (g: THREE.Group, text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, s = 1) => { // sized in whole texels; s: texels to a pixel of its text (see plate)
  const side = mat(bg), W = Math.max(texels(w * K), inkWidth(text, 1) * s + 2), H = texels(h * K);
  return part(g, geo(W / DENSITY, H / DENSITY, 0.12 * K), H / DENSITY, [side, side, side, side, plateMat(bg, fg, W, H, text, s), side], x * K, y * K, z * K);
};
const floor = (g: THREE.Group, cols: number, dcols: number, kind: string, color: number, y: number, x = 0, z = 0) => { // one storey, `cols` x `dcols` half-units, in final units; the entrance faces the viewer
  const alt = kind === 'glass' ? kind : 'win', side = wallMat(dcols, alt, color), plain = mat(color);
  return part(g, geo(cols / 2, 0.9, dcols / 2), 0.9, [side, side, plain, plain, wallMat(cols, kind, color), wallMat(cols, alt, color)], x, y, z);
};
const final = (fn: (g: THREE.Group) => void) => (g: THREE.Group) => { const k = K; K = 1; fn(g); K = k; }; // props made of storeys are authored in final units
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
const stone = (g: THREE.Group, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) => part(g, brick(w, h, d), h, stoneMat(color), x, y, z); // a block of masonry
const sprite = memo((rows: string[]) => pixelTexture(canvas(rows[0].length, rows.length, (g) => paint(g, rows, 0, 0)))); // string art as a texture
const decal = (g: THREE.Group, rows: string[], x: number, y: number, z: number) => { // a sprite on a wall that faces the viewer, a sprite pixel to the near texel
  const [w, h] = [rows[0].length / DENSITY, rows.length / DENSITY], m = part(g, new THREE.PlaneGeometry(w, h), h, toon(0xffffff, { map: sprite(rows), alphaTest: 0.5 }), x, y, z);
  m.castShadow = false;
  return m;
};
// A built model is baked into a few meshes: everything under `root` is brought into root's own space (each mesh by its own matrix and its parents', not root's: the model is still moved as one) and what shares a
// material and a shadow setting is merged, so a hundred boxes cost a handful of draw calls, in the shadow pass as in the main one. A mesh of several materials (a storey, a sign) is cut along its groups first.
// The geometries from memo are shared, so they are copied, never changed; the merged ones belong to root alone (see setOwner, which frees them).
function bake(root: THREE.Group) {
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
    root.add(m);
  }
}

// Buildings on the plot, built from whole storey modules (so a taller house has more windows, never bigger texels): walls in the region's tint, the roof in the owner's colour
// (hip roof, parapet, tower cap), the trim in gold; all of it grey when mortgaged. Each level has a silhouette and a storey count of its own (1, 3, 5), so they read apart at
// any zoom: lv1 cottage under a hip roof, with a dormer and a garden path, lv2 apartments round a roof terrace, lv3 stepped glass tower, both with a lobby. Nothing juts out of a
// facade: from this camera it would hide what is below it.
function building(g: THREE.Group, lv: number, wall: number, roof: number, m: boolean) {
  const dim = (c: number) => (m ? 0x8c8c8c : c), gold = dim(GOLD), glass = dim(0xe4e9f4), grey = dim(0xcfd6e6), green = dim(0x4f9d4f);
  let y = 0;
  const add = (n: number, kind: string, color = wall) => { floor(g, n, n, kind, color, y); y += 0.9; };       // a square storey, n modules (0.5 each) a side
  const belt = (color = 0xf4f4f4, w = 2.12) => box(g, w, 0.1, w, color, 0, y - 0.05);         // a band round the joint between two storeys
  const walk = (w: number, z: number) => box(g, w, 0.03, 1.72 - z, dim(0xdad3c0), 0, 0, (z + 1.72) / 2);      // paving from the door (at depth z) to the front of the plot, inside its rim
  const bed = (x: number, y: number, z: number, w: number) => { box(g, w, 0.1, 0.22, dim(0x8a5a2b), x, y, z); box(g, w - 0.08, 0.15, 0.14, green, x, y + 0.1, z); }; // a planter, w long: a wooden box and its shrubs
  if (lv === 1) {
    add(3, 'door'); hip(g, 1.8, 1.8, 1, y, roof); walk(0.5, 0.75);
    box(g, 0.25, 0.85, 0.25, dim(0xa8503c), 0.4, y + 0.1, -0.25); box(g, 0.3, 0.05, 0.3, dim(0xa39a8c), 0.4, y + 0.95, -0.25);  // chimney and its cap
    box(g, 0.4, 0.44, 0.4, wall, 0, y + 0.15, 0.5); hip(g, 0.56, 0.5, 0.18, y + 0.59, roof, 0, 0.5);                     // dormer: its body sunk into the slope, its roof
    box(g, 0.26, 0.2, 0.02, 0x1a2250, 0, y + 0.33, 0.7); box(g, 0.2, 0.14, 0.03, 0x5b8fe8, 0, y + 0.36, 0.7);             // and its window
    bed(-0.8, 0, 1.5, 0.5); bed(0.8, 0, 1.5, 0.5);                                                                         // a flower bed either side of the path
  } else if (lv === 2) {
    add(4, 'lobby'); belt(); add(4, 'win'); belt(); add(4, 'win'); walk(0.6, 1);
    box(g, 2, 0.04, 2, dim(0xa3a9bd), 0, y);                                                   // roof deck, inside a parapet of the owner's colour
    for (const [w, d, x, z] of [[2.2, 0.1, 0, 1.05], [2.2, 0.1, 0, -1.05], [0.1, 2, -1.05, 0], [0.1, 2, 1.05, 0]]) box(g, w, 0.22, d, roof, x, y, z);
    box(g, 0.5, 0.4, 0.5, wall, -0.55, y, -0.4); cyl(g, 0.2, 0.4, grey, 0.5, y, -0.3); box(g, 0.4, 0.2, 0.3, grey, -0.4, y, 0.4); // stair head, water tank, air-con
    bed(0.5, y, 0.5, 0.4);                                                                     // a planter on the roof
  } else {
    add(4, 'lobby'); belt(roof); add(4, 'glass', glass); add(4, 'glass', glass); walk(0.8, 1); // the top of a tier is the next one's terrace, with a gold band round its foot
    box(g, 1.58, 0.12, 1.58, gold, 0, y); add(3, 'glass', glass); box(g, 1.08, 0.12, 1.08, gold, 0, y); add(2, 'glass', glass);
    hip(g, 1.3, 1.3, 0.55, y, roof);                                                           // the cap
    box(g, 0.08, 1, 0.08, 0xdddddd, 0, y + 0.4); box(g, 0.2, 0.2, 0.2, dim(0xff3b3b), 0, y + 1.35); // mast and beacon
  }
}
// Owner flag (empty lots and investments) / "for sale" sign: both stand at the front-left corner of the plot, in the building group's space
const SPOT = [-0.85, 1.2];
const flag = (g: THREE.Group, color: number) => {
  const [x, z] = SPOT, cx = x + 0.75, dark = shade(new THREE.Color(color).getHex(), 0.7);
  box(g, 0.45, 0.14, 0.45, 0xb9b2a0, x, 0, z); box(g, 0.14, 2.6, 0.14, 0xe8e8e8, x, 0.14, z); box(g, 0.28, 0.28, 0.28, GOLD, x, 2.74, z);
  box(g, 1.4, 0.85, 0.08, color, cx, 1.8, z); box(g, 1.4, 0.16, 0.09, dark, cx, 1.8, z);
};
const sign = (g: THREE.Group) => { const z = SPOT[1] + 0.35; box(g, 0.14, 0.9, 0.14, 0x8a5a2b, 0, 0, z - 0.1); plaque(g, 'SALE', '#fff', '#d9423e', 1.8, 0.85, 0, 0.7, z, 2); }; // out on the apron, clear of the props behind it
// A special city's landmark stands on its plot at every level, so an upgrade is posted on a small gold sign at the front-left corner instead
const level = (g: THREE.Group, lv: number, m: boolean) => {
  if (!lv) return;
  const [x, z] = SPOT;
  box(g, 0.1, 0.4, 0.1, 0x8a5a2b, x + 0.5, 0, z - 0.1); plaque(g, 'LV ' + lv, m ? '#8c8c8c' : '#ffd23f', '#23263a', 1.0, 0.5, x + 0.5, 0.35, z);
};

// Static props per tile kind: rows [color, w, h, d, x, y, z] (y from the tile top, z from the lot centre) or functions drawing into the group
const bars = (xs: number[], h: number, y: number, z: number, c = INK) => xs.map((x): Prop => [c, 0.08, h, 0.08, x, y, z]);
const PROPS: Record<string, Prop[]> = {
  start: [ // finish gate with a gold ingot
    [0xe8e8e8, 0.24, 2.3, 0.24, -0.8, 0, 0], [0xe8e8e8, 0.24, 2.3, 0.24, 0.8, 0, 0], [GOLD, 0.36, 0.16, 0.36, -0.8, 2.3, 0], [GOLD, 0.36, 0.16, 0.36, 0.8, 2.3, 0],
    (g) => plaque(g, 'START', '#38b764', '#fff', 1.4, 0.55, 0, 1.55, 0),
    [0xb36a14, 0.9, 0.12, 0.7, 0, 0, 0.1], [GOLD, 0.7, 0.5, 0.5, 0, 0.12, 0.1], [0xfff6b0, 0.7, 0.08, 0.5, 0, 0.62, 0.1],
  ],
  jail: [ // barred cage around the prisoners' slots
    [IRON, 1.8, 0.14, 1.3, 0, 0, 0],
    ...bars([-0.64, -0.32, 0, 0.32, 0.64], 1.4, 0.14, 0.62), ...bars([-0.64, -0.32, 0, 0.32, 0.64], 1.4, 0.14, -0.58),
    ...[-0.3, 0.05, 0.4].flatMap((z) => [-0.84, 0.84].map((x): Prop => [INK, 0.08, 1.4, 0.08, x, 0.14, z])),
    ...[[-0.84, -0.58], [0.84, -0.58], [-0.84, 0.62], [0.84, 0.62]].map(([x, z]): Prop => [IRON, 0.18, 1.7, 0.18, x, 0, z]),
    [IRON, 1.8, 0.12, 0.14, 0, 1.54, 0.62], [IRON, 1.8, 0.12, 0.14, 0, 1.54, -0.58], [IRON, 0.14, 0.12, 1.2, -0.84, 1.54, 0.02], [IRON, 0.14, 0.12, 1.2, 0.84, 1.54, 0.02],
    (g) => plaque(g, 'JAIL', '#23263a', '#ffd23f', 1.0, 0.4, 0, 1.66, -0.58), // on the back wall: it must not hide the prisoners
  ],
  gojail: [ // police booth with a siren and a boom barrier
    [0x3b5dc9, 1.0, 1.0, 0.8, -0.4, 0, 0], [0xbfe0ff, 0.5, 0.3, 0.06, -0.4, 0.5, 0.41], [0xeeeeee, 1.2, 0.14, 1.0, -0.4, 1.0, 0],
    [0xff3b3b, 0.3, 0.3, 0.3, -0.6, 1.14, 0], [0x3b6bff, 0.3, 0.3, 0.3, -0.2, 1.14, 0],
    [IRON, 0.2, 0.85, 0.2, 0.45, 0, 0], [0xffffff, 0.5, 0.14, 0.14, 0.7, 0.75, 0], [0xd9423e, 0.14, 0.16, 0.16, 0.58, 0.74, 0], [0xd9423e, 0.14, 0.16, 0.16, 0.82, 0.74, 0],
  ],
  exchange: [ // rising stock chart
    [0x1b4d44, 2.1, 0.12, 1.1, 0, 0, 0.05],
    ...[0.5, 0.85, 1.2, 1.6, 2.0].flatMap((h, i): Prop[] => [[i < 4 ? 0x4cc36b : GOLD, 0.3, h, 0.36, -0.8 + i * 0.4, 0.12, 0.05], [i < 4 ? 0xa6f0b8 : 0xfff6b0, 0.3, 0.07, 0.36, -0.8 + i * 0.4, 0.12 + h, 0.05]]),
  ],
  tax: [ // bureau with a stepped roof (storey props are authored in final units, see `final`)
    final((g) => {
      box(g, 2.2, 0.14, 1.7, 0xb9b2a0); floor(g, 4, 3, 'door', 0xe8dcb8, 0.14);
      box(g, 2.3, 0.16, 1.8, 0x8a3b3b, 0, 1.04); box(g, 1.8, 0.16, 1.4, 0x8a3b3b, 0, 1.2); box(g, 1.2, 0.16, 0.9, 0x8a3b3b, 0, 1.36);
      plaque(g, 'TAX', '#6e2d2d', '#ffd23f', 1.1, 0.4, 0, 1.52, 0);
    }),
  ],
  casino: [ // marquee, neon pillars and rooftop dice
    [0x7a1d4b, 1.7, 1.2, 1.1, 0, 0, 0], [0x5a1838, 1.9, 0.14, 1.3, 0, 1.2, 0], [GOLD, 1.9, 0.1, 0.1, 0, 1.2, 0.6], [GOLD, 0.1, 0.1, 1.3, -0.9, 1.2, 0], [GOLD, 0.1, 0.1, 1.3, 0.9, 1.2, 0],
    (g) => plaque(g, '♠ ♥ ♦', '#b02a6b', '#ffd23f', 1.5, 0.45, 0, 0.66, 0.56),
    [GOLD, 0.4, 0.55, 0.06, 0, 0, 0.56], [0xd9423e, 0.5, 0.04, 0.3, 0, 0, 0.6], [0xff5de0, 0.14, 1.2, 0.14, -0.82, 0, 0.55], [0x5dfff0, 0.14, 1.2, 0.14, 0.82, 0, 0.55],
    [0xffffff, 0.5, 0.5, 0.5, -0.4, 1.34, 0], [INK, 0.1, 0.1, 0.05, -0.55, 1.7, 0.26], [INK, 0.1, 0.1, 0.05, -0.4, 1.58, 0.26], [INK, 0.1, 0.1, 0.05, -0.25, 1.46, 0.26],
    [0xffffff, 0.4, 0.4, 0.4, 0.45, 1.34, 0.1], [0xd9423e, 0.14, 0.14, 0.05, 0.45, 1.47, 0.31],
  ],
  club: [ // dark box, speakers, neon and a disco ball
    [0x2a2d3e, 1.8, 1.0, 1.1, 0, 0, 0], [0x111111, 0.4, 0.85, 0.36, -0.7, 0, 0.45], [0x111111, 0.4, 0.85, 0.36, 0.7, 0, 0.45],
    [0x444a6e, 0.22, 0.22, 0.04, -0.7, 0.12, 0.64], [0x444a6e, 0.22, 0.22, 0.04, 0.7, 0.12, 0.64], [0x444a6e, 0.12, 0.12, 0.04, -0.7, 0.5, 0.64], [0x444a6e, 0.12, 0.12, 0.04, 0.7, 0.5, 0.64],
    [0xff5de0, 1.0, 0.08, 0.05, 0, 0.9, 0.57], [0x5dfff0, 1.0, 0.08, 0.05, 0, 0.4, 0.57], [GOLD, 0.3, 0.5, 0.05, 0, 0, 0.57],
    (g) => plaque(g, 'CLUB', '#6a3fb5', '#fff', 0.8, 0.28, 0, 0.5, 0.56),
    [0x777777, 0.06, 0.3, 0.06, 0, 1.0, 0], [0xdfe6ff, 0.55, 0.55, 0.55, 0, 1.3, 0], [0xffffff, 0.1, 0.1, 0.1, -0.45, 1.5, 0.1], [0xffffff, 0.1, 0.1, 0.1, 0.5, 1.7, -0.1],
  ],
  bank: [ // temple front: steps, columns, stepped pediment
    [0xe9e0c9, 2.0, 0.14, 1.3, 0, 0, 0], [0xf4eedb, 1.8, 0.14, 1.1, 0, 0.14, 0], [0xd6ccb0, 1.6, 1.0, 0.2, 0, 0.28, -0.4],
    ...[-0.7, -0.35, 0, 0.35, 0.7].map((x): Prop => [0xf7f1de, 0.22, 1.0, 0.22, x, 0.28, 0.35]),
    [0xcfc3a3, 1.9, 0.22, 1.0, 0, 1.28, 0], [0xdcd2b4, 1.5, 0.16, 0.8, 0, 1.5, 0], [0xe8dfc4, 1.0, 0.16, 0.6, 0, 1.66, 0], [0xf4eedb, 0.5, 0.14, 0.4, 0, 1.82, 0],
    [GOLD, 0.34, 0.34, 0.06, 0, 1.34, 0.52], [0x8a6a14, 0.1, 0.2, 0.07, 0, 1.41, 0.53],
  ],
  news: [ // two-storey office with a roof billboard, dish and mast
    final((g) => {
      box(g, 2.2, 0.14, 1.7, 0xb9b2a0); floor(g, 4, 3, 'door', 0xf0d890, 0.14); floor(g, 4, 3, 'win', 0xf0d890, 1.04); box(g, 2.2, 0.16, 1.7, IRON, 0, 1.94);
      plaque(g, 'NEWS', '#c9962a', '#fff', 1.3, 0.5, -0.45, 2.1, 0.3);
      box(g, 0.1, 0.4, 0.1, 0x888888, 0.7, 2.1, -0.25); box(g, 0.4, 0.08, 0.4, 0xcfcfcf, 0.7, 2.5, -0.25); box(g, 0.65, 0.08, 0.65, 0xcfcfcf, 0.7, 2.58, -0.25);
      box(g, 0.9, 0.08, 0.9, 0xe8e8e8, 0.7, 2.66, -0.25); box(g, 0.5, 0.06, 0.5, 0x666a7e, 0.7, 2.74, -0.25); box(g, 0.12, 0.3, 0.12, 0xd9423e, 0.7, 2.74, -0.25); // dish
      box(g, 0.1, 1.1, 0.1, 0x333333, -0.95, 2.1, -0.5); box(g, 0.18, 0.18, 0.18, 0xff3b3b, -0.95, 3.2, -0.5); // mast
    }),
  ],
  'United Airlines': [ // an airport apron: a jet at its stand between a glass terminal and the control tower, with a fuel truck, a baggage train, airstairs and traffic cones
    final((g) => {
      const Z = 0.25, WHITE = 0xf4f6fa, BLUE = 0x2447a8, NAVY = 0x1a2250, WING = 0xe3e8f2, GLASS = 0x7db6ff, DARK = 0x4a5170, YEL = 0xe0a020, RED = 0xd9423e; // Z: the jet's centre line
      const tube = (r: number, len: number, c: number, x: number, y: number, z: number) => { cyl(g, r, len, c, x, y - len / 2, z).rotation.z = Math.PI / 2; };                                         // a cylinder lying along x, centred at height y
      box(g, 2.2, 0.08, 1.9, 0x676c82); box(g, 0.06, 0.01, 0.62, GOLD, 0.66, 0.08, 0.64);                                                               // apron, the yellow lead-in line to the nose wheel
      box(g, 1.5, 0.22, 0.4, WHITE, 0, 0.28, Z); box(g, 1.5, 0.08, 0.28, WHITE, 0, 0.5, Z); box(g, 1.5, 0.08, 0.28, BLUE, 0, 0.2, Z);                    // airliner (nose to the right): body, rounded by a crown and a blue keel
      box(g, 0.12, 0.26, 0.34, WHITE, 0.81, 0.26, Z); box(g, 0.09, 0.2, 0.26, WHITE, 0.915, 0.29, Z); box(g, 0.06, 0.14, 0.16, DARK, 0.99, 0.32, Z);    // nose: two steps and the radome
      box(g, 0.1, 0.02, 0.22, NAVY, 0.78, 0.52, Z); box(g, 0.08, 0.05, 0.02, NAVY, 0.84, 0.42, Z + 0.17);                                              // cockpit glass, on top and at the side
      box(g, 0.14, 0.26, 0.3, WHITE, -0.82, 0.3, Z); box(g, 0.1, 0.2, 0.18, WHITE, -0.94, 0.38, Z); box(g, 0.04, 0.08, 0.1, DARK, -1.01, 0.44, Z);      // tail cone, rising to the exhaust
      box(g, 0.36, 0.3, 0.06, BLUE, -0.73, 0.58, Z); box(g, 0.24, 0.26, 0.06, BLUE, -0.8, 0.88, Z); box(g, 0.2, 0.04, 0.76, WING, -0.9, 0.44, Z);       // fin in two steps, tailplane
      box(g, 0.14, 0.14, 0.02, 0xdce8ff, -0.74, 0.66, Z + 0.04); box(g, 0.14, 0.02, 0.03, BLUE, -0.74, 0.72, Z + 0.04); box(g, 0.02, 0.14, 0.03, BLUE, -0.74, 0.66, Z + 0.04); // the globe on the fin
      for (const s of [1, -1]) { // each side: a wing swept in three steps with its winglet, an engine under it, a main wheel
        [[0.64, 0.2, 0.02, 0.3], [0.5, 0.16, -0.08, 0.48], [0.36, 0.12, -0.18, 0.62]].forEach(([w, d, x, z]) => box(g, w, 0.05, d, WING, x, 0.28, Z + s * z));
        box(g, 0.1, 0.1, 0.03, BLUE, -0.3, 0.3, Z + s * 0.67); tube(0.075, 0.34, WING, 0.2, 0.25, Z + s * 0.42); tube(0.063, 0.03, NAVY, 0.37, 0.25, Z + s * 0.42);
        box(g, 0.04, 0.12, 0.04, IRON, 0.02, 0.08, Z + s * 0.13); box(g, 0.14, 0.07, 0.06, INK, 0.02, 0.08, Z + s * 0.13);
      }
      box(g, 0.04, 0.12, 0.04, IRON, 0.66, 0.08, Z); box(g, 0.1, 0.06, 0.12, INK, 0.66, 0.08, Z);                                                      // nose wheel
      for (let x = -0.6; x < 0.4; x += 0.11) box(g, 0.06, 0.06, 0.02, NAVY, x, 0.4, Z + 0.205);                                                        // cabin windows
      box(g, 1.5, 0.04, 0.02, BLUE, 0, 0.28, Z + 0.205); box(g, 0.09, 0.16, 0.02, 0xaeb8d0, 0.55, 0.3, Z + 0.205);                                       // cheat line, forward door
      floor(g, 3, 1, 'glass', 0xdce8ff, 0.08, -0.35, -0.7); box(g, 1.62, 0.08, 0.62, BLUE, -0.35, 0.98, -0.7); plaque(g, '⊕', '#fff', '#2447a8', 1.1, 0.3, -0.35, 1.06, -0.46); // terminal: glass concourse, blue roof, its sign (the globe of the tail)
      box(g, 0.5, 0.3, 0.46, 0xe8e8ee, 0.82, 0.08, -0.7); box(g, 0.24, 1.0, 0.24, WHITE, 0.82, 0.38, -0.7); box(g, 0.26, 0.08, 0.26, BLUE, 0.82, 0.7, -0.7); // control tower: base, shaft, blue band
      box(g, 0.56, 0.08, 0.56, IRON, 0.82, 1.38, -0.7); box(g, 0.5, 0.26, 0.5, GLASS, 0.82, 1.46, -0.7); box(g, 0.52, 0.04, 0.52, NAVY, 0.82, 1.56, -0.7); box(g, 0.62, 0.06, 0.62, WHITE, 0.82, 1.72, -0.7); // its cab: deck, glass, frame, roof
      box(g, 0.04, 0.3, 0.04, INK, 0.82, 1.78, -0.7); box(g, 0.3, 0.05, 0.06, WING, 0.82, 1.98, -0.7); box(g, 0.08, 0.08, 0.08, 0xff3b3b, 0.82, 2.08, -0.7); // mast, radar bar, beacon
      box(g, 0.6, 0.05, 0.22, IRON, 0.78, 0.12, 0.72); tube(0.1, 0.4, WHITE, 0.72, 0.29, 0.72); tube(0.105, 0.05, RED, 0.72, 0.29, 0.72);               // fuel truck: chassis, tank, red band
      box(g, 0.18, 0.2, 0.22, RED, 1.0, 0.12, 0.72); box(g, 0.1, 0.07, 0.02, GLASS, 1.0, 0.24, 0.83); [0.6, 0.95].forEach((x) => box(g, 0.12, 0.1, 0.03, INK, x, 0.08, 0.84)); // cab, its window, wheels
      box(g, 0.2, 0.12, 0.14, YEL, -0.5, 0.08, 0.78); box(g, 0.1, 0.08, 0.12, 0xb87c14, -0.54, 0.2, 0.78);                                              // baggage tug and its cab
      [[-0.74, RED], [-0.98, 0x3f6fd0]].forEach(([x, c]) => { box(g, 0.22, 0.04, 0.16, IRON, x, 0.1, 0.78); box(g, 0.16, 0.1, 0.12, c, x, 0.14, 0.78); }); // two carts with a case each
      [0.06, 0.12, 0.18].forEach((h, i) => box(g, 0.14, h, 0.05, WING, 0.5, 0.08, 0.64 - i * 0.05)); box(g, 0.14, 0.02, 0.07, WING, 0.5, 0.26, 0.5);       // airstairs up to the forward door
      [0.84, 0.98].forEach((x) => { box(g, 0.05, 0.08, 0.05, 0xff8a1f, x, 0.08, 0.5); box(g, 0.055, 0.02, 0.055, 0xffffff, x, 0.12, 0.5); });                // two traffic cones
    }),
  ],
  'China Railway': [ // a high-speed rail station: a white train at its platform under the overhead wire, a station hall with a stepped red roof, a signal shed, a signal and a second track
    final((g) => {
      const Z = 0.18, WHITE = 0xf4f6fa, RED = 0xd9423e, NAVY = 0x23338f, STEEL = 0x7b86a0, DARK = 0x333a52, CREAM = 0xf0e6c8, TILE = 0x9c2f2f; // Z: the train's centre line
      box(g, 2.2, 0.08, 1.9, 0xb9b2a0);                                                                                                           // station ground
      for (const z of [Z, 0.7]) { // two tracks: ballast, sleepers, rails
        box(g, 2.2, 0.05, 0.5, 0x8d887a, 0, 0.08, z);
        for (let x = -1; x < 1.05; x += 0.2) box(g, 0.08, 0.03, 0.42, 0x5a3a1a, x, 0.13, z);
        for (const s of [-0.13, 0.13]) box(g, 2.2, 0.03, 0.03, 0xb4bccf, 0, 0.16, z + s);
      }
      box(g, 1.9, 0.08, 0.3, DARK, -0.04, 0.17, Z); [-0.8, -0.3, 0.1, 0.5].forEach((x) => box(g, 0.22, 0.1, 0.03, INK, x, 0.15, Z + 0.16));          // train (nose to the right): underframe and bogies
      box(g, 0.96, 0.36, 0.4, WHITE, -0.56, 0.26, Z); box(g, 0.64, 0.36, 0.4, WHITE, 0.28, 0.26, Z);                                                // two cars
      [[0.66, 0.12, 0.36, 0.34], [0.77, 0.1, 0.3, 0.3], [0.86, 0.08, 0.22, 0.24], [0.93, 0.06, 0.14, 0.16]].forEach(([x, l, w, h]) => box(g, l, h, w, WHITE, x, 0.26, Z)); // nose in four steps
      [-0.9, -0.72, -0.54, -0.36, -0.18, 0.02, 0.2, 0.38].forEach((x) => box(g, 0.11, 0.11, 0.02, NAVY, x, 0.44, Z + 0.205));                      // windows
      [-0.12, 0.52].forEach((x) => box(g, 0.1, 0.24, 0.02, 0x8e98b4, x, 0.28, Z + 0.205));                                                          // doors
      box(g, 0.96, 0.05, 0.02, RED, -0.56, 0.3, Z + 0.205); box(g, 0.64, 0.05, 0.02, RED, 0.28, 0.3, Z + 0.205);                                    // red stripe, along both cars
      [[0.66, 0.185], [0.77, 0.155], [0.86, 0.115]].forEach(([x, z]) => box(g, 0.1, 0.05, 0.02, RED, x, 0.3, Z + z));                                // and round the nose
      box(g, 0.1, 0.02, 0.24, NAVY, 0.66, 0.6, Z); box(g, 0.1, 0.02, 0.2, NAVY, 0.77, 0.56, Z); box(g, 0.1, 0.08, 0.02, NAVY, 0.66, 0.46, Z + 0.185); // driver's windscreen and side window
      [-0.75, 0.3].forEach((x) => box(g, 0.3, 0.05, 0.24, 0xcfd6e6, x, 0.62, Z));                                                                    // air-conditioning units
      box(g, 0.22, 0.03, 0.14, DARK, -0.38, 0.62, Z); box(g, 0.04, 0.16, 0.04, DARK, -0.44, 0.65, Z); box(g, 0.04, 0.16, 0.04, DARK, -0.34, 0.77, Z); box(g, 0.1, 0.03, 0.3, DARK, -0.34, 0.92, Z); // pantograph
      for (const x of [-0.65, 0.55]) { box(g, 0.05, 1.05, 0.05, STEEL, x, 0.18, -0.04); box(g, 0.05, 0.04, 0.28, STEEL, x, 1.1, 0.1); box(g, 0.03, 0.12, 0.03, STEEL, x, 0.97, Z); } // masts, their arms and droppers
      box(g, 2.2, 0.03, 0.03, STEEL, 0, 1.1, Z); box(g, 2.2, 0.03, 0.03, STEEL, 0, 0.95, Z);                                                         // the overhead wire and its carrier
      box(g, 2.2, 0.1, 0.4, 0xd6d0c0, 0, 0.08, -0.26); box(g, 2.2, 0.01, 0.04, GOLD, 0, 0.18, -0.09);                                              // platform, its yellow edge
      floor(g, 3, 1, 'lobby', CREAM, 0.08, 0.35, -0.7); floor(g, 3, 1, 'win', CREAM, 0.98, 0.35, -0.7);                                             // station hall: doors below, windows above
      box(g, 1.7, 0.1, 0.7, TILE, 0.35, 1.88, -0.7); box(g, 1.3, 0.1, 0.54, RED, 0.35, 1.98, -0.7); box(g, 0.8, 0.1, 0.38, TILE, 0.35, 2.08, -0.7); box(g, 0.1, 0.16, 0.1, GOLD, 0.35, 2.18, -0.7); // stepped roof, gold finial
      plaque(g, 'CRH', '#d9423e', '#fff', 0.7, 0.3, 0.35, 0.62, -0.5);                                                                              // its sign over the doors
      box(g, 0.6, 0.36, 0.36, 0xd8c08a, -0.75, 0.08, -0.72); hip(g, 0.76, 0.5, 0.2, 0.44, TILE, -0.75, -0.72); box(g, 0.14, 0.22, 0.02, 0x8a5a2b, -0.75, 0.08, -0.53); // signal shed: walls, roof, door
      [-0.2, -0.95].forEach((x) => { box(g, 0.04, 0.55, 0.04, IRON, x, 0.18, -0.2); box(g, 0.12, 0.04, 0.08, INK, x, 0.73, -0.2); box(g, 0.06, 0.03, 0.05, 0xfff6b0, x, 0.7, -0.2); }); // platform lamps
      box(g, 0.3, 0.05, 0.1, 0x8a5a2b, -0.55, 0.26, -0.33); box(g, 0.26, 0.08, 0.04, 0x8a5a2b, -0.55, 0.31, -0.37);                                // bench, with its back
      box(g, 0.04, 0.5, 0.04, IRON, 1.04, 0.08, 0.44); box(g, 0.08, 0.16, 0.06, INK, 1.04, 0.5, 0.44); box(g, 0.04, 0.04, 0.02, 0xff3b3b, 1.04, 0.6, 0.475); // signal, at red
      box(g, 0.14, 0.04, 0.34, IRON, -1.0, 0.13, 0.7); box(g, 0.1, 0.14, 0.3, RED, -1.0, 0.17, 0.7);                                               // buffer stop at the end of the second track
    }),
  ],
  Maersk: [ // a container terminal: a ship at the quay under a gantry crane, a yard of stacked boxes, a truck and the line's office with its sign
    final((g) => {
      const Z = 0.25, NAVY = 0x1a2c5a, RED = 0xb02a2a, BLUE = 0x42b0d5, WHITE = 0xf2f2f2, DARK = 0x3a4056, GLASS = 0x7db6ff, BOX = [BLUE, 0xd9423e, 0xe0a020, WHITE, 0x3fa65a]; // Z: the ship's centre line
      const stack = (x: number, z: number, n: number, k: number, y: number) => { // a bay of boxes, two wide, the top level split in two
        for (let i = 0; i < n - 1; i++) box(g, 0.26, 0.12, 0.44, BOX[(k + i * 2) % 5], x, y + i * 0.12, z);
        [-0.11, 0.11].forEach((dz, j) => box(g, 0.26, 0.12, 0.2, BOX[(k * 2 + j + 1) % 5], x, y + (n - 1) * 0.12, z + dz));
      };
      box(g, 2.2, 0.08, 1.9, 0x8d9099); box(g, 2.2, 0.02, 0.99, 0x2c6fd2, 0, 0.08, 0.455); box(g, 2.2, 0.1, 0.91, 0xb7b9c4, 0, 0.08, -0.495);        // ground, water in front, the quay behind it
      box(g, 2.2, 0.01, 0.03, GOLD, 0, 0.18, -0.08); box(g, 0.9, 0.02, 0.04, DARK, 0.24, 0.18, -0.1); box(g, 0.9, 0.02, 0.04, DARK, 0.24, 0.18, -0.42);   // yellow edge line, crane rails
      box(g, 1.7, 0.28, 0.5, NAVY, -0.2, 0.08, Z); box(g, 1.7, 0.05, 0.52, RED, -0.2, 0.1, Z); box(g, 1.64, 0.02, 0.44, 0x6d7388, -0.2, 0.36, Z);          // ship: hull, red bottom, deck
      [[0.75, 0.2, 0.4], [0.91, 0.12, 0.28], [1.0, 0.06, 0.14]].forEach(([x, l, w]) => { box(g, l, 0.28, w, NAVY, x, 0.08, Z); box(g, l, 0.05, w + 0.02, RED, x, 0.1, Z); }); // bow in three steps
      box(g, 1.72, 0.012, 0.03, 0xdcefff, -0.2, 0.1, Z + 0.27); box(g, 2.2, 0.012, 0.03, 0xdcefff, 0, 0.1, -0.02);                                      // foam along the hull and the quay
      [[-0.6, 3], [-0.32, 3], [-0.04, 3], [0.24, 2], [0.52, 3]].forEach(([x, n], k) => stack(x, Z, n, k, 0.38));                                          // five bays of cargo
      box(g, 0.24, 0.3, 0.4, WHITE, -0.92, 0.36, Z); [0.5, 0.58].forEach((y) => box(g, 0.2, 0.05, 0.02, NAVY, -0.92, y, Z + 0.205));                        // accommodation block, two rows of windows
      box(g, 0.28, 0.1, 0.46, WHITE, -0.92, 0.66, Z); box(g, 0.22, 0.05, 0.02, NAVY, -0.92, 0.7, Z + 0.235); box(g, 0.3, 0.03, 0.48, 0xcfd6e6, -0.92, 0.76, Z); // wheelhouse with its wings, windows and roof
      box(g, 0.14, 0.26, 0.24, BLUE, -1.0, 0.79, Z); box(g, 0.15, 0.03, 0.25, INK, -1.0, 1.05, Z); box(g, 0.08, 0.03, 0.02, WHITE, -1.0, 0.9, Z + 0.13); box(g, 0.03, 0.08, 0.02, WHITE, -1.0, 0.875, Z + 0.13); // funnel, with its star
      box(g, 0.03, 0.2, 0.03, INK, -0.86, 0.79, Z); box(g, 0.14, 0.03, 0.03, 0xcfd6e6, -0.86, 0.96, Z);                                                  // mast, radar
      [0.06, 0.42].forEach((x) => { [-0.1, -0.42].forEach((z) => box(g, 0.05, 1.0, 0.05, BLUE, x, 0.2, z)); box(g, 0.05, 0.06, 0.4, BLUE, x, 1.2, -0.26); }); // gantry crane: four legs, the top frame
      [-0.1, -0.42].forEach((z) => { box(g, 0.42, 0.06, 0.07, BLUE, 0.24, 1.2, z); box(g, 0.36, 0.04, 0.04, BLUE, 0.24, 0.6, z); });                     // beams, tie bars
      box(g, 0.34, 0.12, 0.26, WHITE, 0.24, 1.26, -0.26); box(g, 0.08, 0.06, 1.0, BLUE, 0.24, 1.26, 0.14);                                               // machinery house, the boom reaching over the ship
      box(g, 0.16, 0.06, 0.12, DARK, 0.24, 1.2, 0.25); [-0.06, 0.06].forEach((dx) => box(g, 0.015, 0.28, 0.015, INK, 0.24 + dx, 0.925, 0.25));          // trolley, hoist ropes
      box(g, 0.28, 0.025, 0.14, DARK, 0.24, 0.9, 0.25); box(g, 0.26, 0.12, 0.2, 0xd9423e, 0.24, 0.78, 0.25);                                            // spreader, the box it is lifting
      [[0.58, 3], [0.86, 2]].forEach(([x, n], k) => stack(x, -0.7, n, k, 0.18));                                                                          // the yard beside the crane
      box(g, 0.14, 0.04, 0.44, INK, 0.95, 0.18, -0.26); box(g, 0.14, 0.1, 0.28, 0xe0a020, 0.95, 0.22, -0.34); box(g, 0.14, 0.12, 0.12, 0xd9423e, 0.95, 0.22, -0.1); box(g, 0.1, 0.05, 0.02, GLASS, 0.95, 0.28, -0.035); // truck: chassis, box, cab, windscreen
      floor(g, 2, 1, 'win', 0xe8ecf4, 0.18, -0.6, -0.68); box(g, 1.1, 0.08, 0.6, BLUE, -0.6, 1.08, -0.68); plaque(g, '★', '#42b0d5', '#fff', 1.0, 0.3, -0.6, 1.16, -0.5); // office, its roof and sign (the star of the funnel)
      [-0.85, -0.35].forEach((x) => box(g, 0.2, 0.08, 0.16, 0xcfd6e6, x, 1.16, -0.75));                                                                  // roof air-conditioners
    }),
  ],
  build: [ // a tower going up: glass floors below, a bare frame and concrete core above, a crane hanging a bundle of beams over it; hazard kerb, cabin and materials at the foot
    final((g) => {
      const [tx, tz, mx, mz, jy, hx] = [-0.3, -0.35, 0.8, -0.5, 5.25, -0.62], YEL = 0xffc83d, DARK = 0x333333;     // tower centre (1.5 x 1.0), crane mast, jib height, hook
      box(g, 2.1, 0.08, 1.7, 0xb9b2a0);                                                                          // site ground
      for (const y of [0.08, 0.98]) floor(g, 3, 2, 'glass', 0xdce8ff, y, tx, tz);                                // glazed storeys
      [1.88, 2.78].forEach((y, k) => {                                                                           // bare storeys: a slab, a yellow guard rail, posts (the top ones end in rebar)
        box(g, 1.6, 0.1, 1.1, 0xd4d8e4, tx, y, tz); box(g, 1.5, 0.04, 0.04, YEL, tx, y + 0.5, tz + 0.52);
        for (const x of [-0.7, -0.23, 0.23, 0.7]) for (const z of [-0.45, 0.45]) { box(g, 0.1, 0.8, 0.1, 0x8f97ad, tx + x, y + 0.1, tz + z); if (k) box(g, 0.04, 0.25, 0.04, 0x7a4a2a, tx + x, y + 0.9, tz + z); }
      });
      box(g, 0.5, 2, 0.6, 0x6c7390, tx + 0.35, 1.88, tz - 0.1);                                                  // the core runs ahead of the floors
      box(g, 0.5, 0.2, 0.5, 0x8a8fa3, mx, 0.08, mz); box(g, 0.2, jy - 0.28, 0.2, YEL, mx, 0.28, mz);            // crane: base, mast
      for (let y = 0.5; y < jy; y += 0.4) box(g, 0.26, 0.06, 0.26, 0xe0a020, mx, y, mz);                          // rungs
      for (const y of [jy, jy + 0.24]) box(g, 2.15, 0.06, 0.2, YEL, 0.125, y, mz);                                // jib chords
      for (let x = -0.9; x < 1.2; x += 0.25) box(g, 0.05, 0.3, 0.2, YEL, x, jy, mz);                              // jib struts
      box(g, 0.2, 0.3, 0.26, IRON, 1.05, jy - 0.3, mz); box(g, 0.3, 0.3, 0.3, 0xf4f6fa, mx - 0.3, jy - 0.3, mz); box(g, 0.2, 0.14, 0.04, 0x7db6ff, mx - 0.3, jy - 0.2, mz + 0.16); // counterweight, cab
      box(g, 0.14, 0.45, 0.14, YEL, mx, jy + 0.3, mz); box(g, 0.14, 0.14, 0.14, 0xff3b3b, mx, jy + 0.75, mz);    // apex, beacon
      box(g, 0.18, 0.1, 0.24, DARK, hx, jy - 0.1, mz); box(g, 0.04, 0.36, 0.04, DARK, hx, jy - 0.46, mz); box(g, 0.14, 0.14, 0.14, 0xd9423e, hx, jy - 0.6, mz); // trolley, cable, hook
      for (let i = 0; i < 3; i++) box(g, 0.8, 0.1, 0.14, i & 1 ? 0xd9684a : 0xc2523a, hx, jy - 0.9 + i * 0.1, mz); // the bundle of beams hung from it
      box(g, 2.1, 0.07, 0.1, YEL, 0, 0.08, 0.75); for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) box(g, 0.2, 0.08, 0.1, INK, x, 0.08, 0.75); // hazard kerb
      box(g, 0.55, 0.38, 0.38, 0xdfe3ee, -0.72, 0.08, 0.42); box(g, 0.62, 0.05, 0.44, 0x4f6fc0, -0.72, 0.46, 0.42); box(g, 0.2, 0.12, 0.03, 0x7db6ff, -0.8, 0.26, 0.62); // cabin: body, roof, window
      box(g, 0.44, 0.3, 0.3, 0xc86b3c, 0.1, 0.08, 0.42); box(g, 0.44, 0.04, 0.3, 0xe0906a, 0.1, 0.38, 0.42); box(g, 0.45, 0.02, 0.31, 0xa8503c, 0.1, 0.23, 0.42); // bricks
      [[0.56, 0.4], [0.4, 0.3], [0.22, 0.18]].forEach(([w, d], i) => box(g, w, 0.1, d, 0xd8c08a, 0.82, 0.08 + i * 0.1, 0.45)); // sand heap
    }),
  ],
  military: [ // a base: a two-storey command block under a radome and a roof star, a watchtower, a helicopter on its pad and a tank behind sandbags
    final((g) => {
      const [bx, bz, wx, wz, hx, hz, tx, tz] = [-0.33, -0.42, 0.82, -0.5, 0.66, 0.5, -0.55, 0.5];                          // centres: command block, watchtower, helipad, tank
      const OD = 0x5b6b3a, DARK = 0x3a4528, TAN = 0xc9b68a, STEEL = 0x7b86a0, WALL = 0xb7bd96, GLASS = 0x7db6ff;
      box(g, 2.2, 0.08, 1.9, 0xa9a48f, 0, 0, 0);                                                                           // site ground
      floor(g, 3, 2, 'door', WALL, 0.08, bx, bz); floor(g, 3, 2, 'win', WALL, 0.98, bx, bz); box(g, 1.54, 0.1, 1.04, DARK, bx, 1.88, bz); // command block, its roof
      for (const [w, d, x, z] of [[1.54, 0.08, 0, 0.48], [1.54, 0.08, 0, -0.48], [0.08, 0.88, -0.73, 0], [0.08, 0.88, 0.73, 0]]) box(g, w, 0.14, d, OD, bx + x, 1.98, bz + z); // parapet
      cyl(g, 0.34, 0.08, STEEL, bx + 0.35, 1.98, bz); [0.3, 0.29, 0.26, 0.21, 0.13].forEach((r, i) => cyl(g, r, 0.1, i & 1 ? 0xdfe6f2 : 0xf4f6fa, bx + 0.35, 2.06 + i * 0.1, bz)); // radome: a stepped ball
      ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'].forEach((row, r) => { for (const m of row.matchAll(/#+/g)) box(g, 0.08 * m[0].length, 0.01, 0.08, 0xffffff, bx - 0.35 + 0.08 * (m.index + m[0].length / 2 - 3.5), 1.98, bz + 0.05 + 0.08 * (r - 3)); }); // roof star
      box(g, 0.06, 0.9, 0.06, INK, bx - 0.6, 1.98, bz - 0.25); box(g, 0.12, 0.12, 0.12, 0xff3b3b, bx - 0.6, 2.88, bz - 0.25);   // mast, beacon
      for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) box(g, 0.07, 1.2, 0.07, STEEL, wx + x, 0.08, wz + z);          // watchtower: legs
      for (const y of [0.4, 0.75, 1.1]) { box(g, 0.47, 0.04, 0.04, STEEL, wx, y, wz + 0.2); for (const x of [-0.2, 0.2]) box(g, 0.04, 0.04, 0.47, STEEL, wx + x, y, wz); } // braces
      box(g, 0.64, 0.06, 0.64, DARK, wx, 1.28, wz); box(g, 0.5, 0.32, 0.5, OD, wx, 1.34, wz); box(g, 0.4, 0.12, 0.02, GLASS, wx, 1.44, wz + 0.25); // deck, cabin, window
      box(g, 0.7, 0.06, 0.7, DARK, wx, 1.66, wz); box(g, 0.16, 0.12, 0.16, 0xfff6b0, wx + 0.15, 1.72, wz + 0.05);               // roof, searchlight
      box(g, 0.8, 0.03, 0.7, 0xb4b9c8, hx, 0.08, hz); for (const x of [-0.2, 0.2]) box(g, 0.06, 0.01, 0.46, GOLD, hx + x, 0.11, hz); box(g, 0.34, 0.01, 0.06, GOLD, hx, 0.11, hz); // pad, its H
      for (const z of [-0.15, 0.15]) { box(g, 0.5, 0.03, 0.04, INK, hx, 0.11, hz + z); for (const x of [-0.14, 0.14]) box(g, 0.03, 0.1, 0.03, INK, hx + x, 0.11, hz + z); } // helicopter: skids, struts
      box(g, 0.5, 0.22, 0.3, OD, hx, 0.2, hz); box(g, 0.1, 0.16, 0.22, GLASS, hx + 0.24, 0.24, hz); box(g, 0.16, 0.1, 0.02, 0x1a2250, hx + 0.02, 0.3, hz + 0.15); // fuselage, nose glass, window
      box(g, 0.36, 0.08, 0.08, OD, hx - 0.43, 0.31, hz); box(g, 0.05, 0.22, 0.05, DARK, hx - 0.58, 0.31, hz);                  // tail boom, fin
      box(g, 0.07, 0.1, 0.07, INK, hx - 0.02, 0.42, hz); box(g, 0.9, 0.02, 0.08, INK, hx - 0.02, 0.52, hz);                       // rotor mast, one blade at rest
      for (const z of [-0.2, 0.2]) box(g, 0.74, 0.2, 0.12, INK, tx, 0.08, tz + z);                                            // tank: tracks
      for (const x of [-0.24, -0.08, 0.08, 0.24]) box(g, 0.11, 0.11, 0.02, 0x4a4f6e, tx + x, 0.13, tz + 0.26);                // road wheels
      box(g, 0.66, 0.16, 0.46, OD, tx, 0.2, tz); box(g, 0.36, 0.15, 0.32, DARK, tx - 0.04, 0.36, tz);                         // hull, turret
      box(g, 0.3, 0.06, 0.06, INK, tx + 0.29, 0.41, tz); box(g, 0.1, 0.05, 0.1, OD, tx - 0.1, 0.51, tz - 0.05);               // gun, hatch
      for (const [n, y, x] of [[3, 0.08, -0.3], [2, 0.18, -0.15]]) for (let i = 0; i < n; i++) box(g, 0.3, 0.1, 0.14, (i + n) & 1 ? 0xb8a578 : TAN, tx + x + i * 0.3, y, 0.85); // sandbags, two courses
    }),
  ],
  choke: [ // a harbour mouth: twin lighthouses (port red, starboard green) at the back, a gas carrier held in the channel by the red-and-white boom, its toll booth and stop signal on the quays
    final((g) => {
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, WHITE = 0xf4f6fa, RED = 0xd9423e, GREEN = 0x2fa84f, NAVY = 0x1a2250, STONE = 0xb4bccf, GLASS = 0x7db6ff, STEEL = 0xcfd6e6, Z = 0.3; // Z: the boom
      box(g, 2.2, 0.08, 1.9, 0x6b6f7a); box(g, 0.9, 0.02, 1.9, WATER, 0, 0.08);                                                     // foundation, the channel (x -0.45 to 0.45)
      for (const s of [-1, 1]) {                                                                                                     // the two quays: sand deck, stone curb, yellow edge line, foam along the water, bollards
        box(g, 0.65, 0.14, 1.9, 0xd8c08a, s * 0.775, 0.08); box(g, 0.08, 0.04, 1.9, STONE, s * 0.49, 0.22); box(g, 0.025, 0.012, 1.9, GOLD, s * 0.57, 0.22); box(g, 0.025, 0.012, 1.9, FOAM, s * 0.4375, 0.1);
        for (const z of [-0.15, 0.7]) box(g, 0.07, 0.08, 0.07, INK, s * 0.49, 0.26, z);
      }
      for (const [x, band] of [[-0.78, RED], [0.78, GREEN]]) {                                                                       // twin lighthouses at the harbour mouth: port (red) and starboard (green)
        const z = -0.6, top = [[0.36, 0.46, WHITE], [0.32, 0.42, band], [0.28, 0.42, WHITE], [0.24, 0.36, band]].reduce((y, [w, h, c]) => (box(g, w, h, w, c, x, y, z), y + h), 0.34); // the shaft, tapering in four bands
        box(g, 0.46, 0.12, 0.46, STONE, x, 0.22, z); box(g, 0.12, 0.2, 0.02, 0x8a5a2b, x, 0.34, z + 0.19);                            // plinth, door
        [[1.0, 0.17], [1.45, 0.15]].forEach(([y, d]) => box(g, 0.05, 0.12, 0.02, INK, x, y, z + d));                                  // slit windows
        box(g, 0.46, 0.06, 0.46, IRON, x, top, z); box(g, 0.24, 0.28, 0.24, 0xfff6b0, x, top + 0.06, z);                              // gallery, the glowing lantern
        for (const k of [-1, 1]) box(g, 0.03, 0.28, 0.03, INK, x + k * 0.105, top + 0.06, z + 0.125);                                 // its mullions
        hip(g, 0.36, 0.36, 0.26, top + 0.34, band, x, z); box(g, 0.05, 0.14, 0.05, GOLD, x, top + 0.6, z);                            // cap, finial
      }
      [[0.5, -0.5, 0.8], [0.4, -0.05, 0.1], [0.28, 0.035, 0.07], [0.14, 0.095, 0.05]].forEach(([w, z, l]) => {                       // gas carrier (bow to us): the hull in four steps, each with its red boot-topping and its rusty deck inside a rim
        box(g, w, 0.22, l, 0x2d3550, 0, 0.08, z); box(g, w + 0.02, 0.05, l + 0.02, RED, 0, 0.1, z); box(g, w - 0.04, 0.03, l - 0.02, 0xa8503c, 0, 0.3, z);
      });
      for (const z of [-0.46, -0.14]) {                                                                                              // two spherical gas tanks: a cradle and a stepped white dome
        cyl(g, 0.16, 0.04, 0x8f97ad, 0, 0.33, z); [0.15, 0.13, 0.1, 0.06].forEach((r, i) => cyl(g, r, 0.05, i & 1 ? 0xdfe6f2 : WHITE, 0, 0.37 + i * 0.05, z));
      }
      box(g, 0.42, 0.22, 0.26, WHITE, 0, 0.33, -0.77); box(g, 0.34, 0.16, 0.2, WHITE, 0, 0.55, -0.78); box(g, 0.42, 0.1, 0.18, WHITE, 0, 0.71, -0.79); // accommodation: two decks and the wheelhouse
      [[0.4, -0.64], [0.59, -0.68]].forEach(([y, z]) => [-0.1, 0, 0.1].forEach((x) => box(g, 0.05, 0.05, 0.02, NAVY, x, y, z)));      // windows, on the face of each deck
      box(g, 0.36, 0.05, 0.02, GLASS, 0, 0.74, -0.7); box(g, 0.44, 0.03, 0.2, STEEL, 0, 0.81, -0.79);                               // bridge glass, roof
      box(g, 0.1, 0.2, 0.1, 0xe0a020, 0, 0.81, -0.84); box(g, 0.11, 0.04, 0.11, INK, 0, 1.01, -0.84);                               // funnel
      box(g, 0.025, 0.2, 0.025, INK, 0.12, 0.84, -0.76); box(g, 0.2, 0.02, 0.04, STEEL, 0.12, 1.0, -0.76); box(g, 0.04, 0.04, 0.04, 0xff3b3b, 0.12, 1.02, -0.76); // mast, radar, beacon
      box(g, 0.02, 0.14, 0.02, INK, 0, 0.33, 0.07);                                                                                  // jackstaff
      box(g, 0.2, 0.012, 0.03, FOAM, 0, 0.1, 0.14); [-0.2725, 0.2725].forEach((x) => box(g, 0.025, 0.012, 0.7, FOAM, x, 0.1, -0.45)); // foam at the bow and along the hull
      [[-0.36, 0.65], [0.36, 0.5], [-0.36, -0.6], [0.36, -0.8]].forEach(([x, z]) => box(g, 0.1, 0.012, 0.025, 0x5ec2dc, x, 0.1, z));  // ripples
      for (let i = 0; i < 7; i++) box(g, 0.14, 0.07, 0.07, i & 1 ? WHITE : RED, -0.52 + i * 0.14, 0.5, Z);                           // the boom across the channel, red and white, from the booth to the post
      box(g, 0.08, 0.16, 0.12, IRON, -0.5, 0.45, Z); box(g, 0.1, 0.5, 0.1, IRON, 0.5, 0.22, Z);                                      // its hinge, and the post it rests on
      box(g, 0.1, 0.24, 0.08, INK, 0.5, 0.72, Z); box(g, 0.05, 0.05, 0.02, 0xff3b3b, 0.5, 0.86, Z + 0.05); box(g, 0.05, 0.05, 0.02, GREEN, 0.5, 0.77, Z + 0.05); // the signal on the post: red on, green off
      [-0.25, 0.25].forEach((x) => box(g, 0.05, 0.05, 0.05, 0xff3b3b, x, 0.57, Z));                                                  // warning lights
      box(g, 0.5, 0.4, 0.38, WHITE, -0.77, 0.22, Z); box(g, 0.51, 0.06, 0.39, RED, -0.77, 0.22, Z); box(g, 0.6, 0.05, 0.46, RED, -0.77, 0.62, Z); // toll booth: cabin, red skirt, roof
      box(g, 0.34, 0.14, 0.02, GLASS, -0.77, 0.38, Z + 0.19); box(g, 0.03, 0.14, 0.03, WHITE, -0.77, 0.38, Z + 0.19);                // window and mullion
      plaque(g, 'TOLL', '#fff', '#d9423e', 0.77, 0.26, -0.77, 0.67, Z);                                                              // its roof sign
      for (const x of [-0.6, -0.95]) { box(g, 0.05, 0.08, 0.05, 0xff8a1f, x, 0.22, 0.62); box(g, 0.055, 0.02, 0.055, 0xffffff, x, 0.26, 0.62); } // traffic cones
      box(g, 0.2, 0.18, 0.2, 0x8a5a2b, 0.7, 0.22, 0.62); box(g, 0.2, 0.18, 0.2, 0xa8743c, 0.93, 0.22, 0.6); box(g, 0.18, 0.16, 0.18, 0xa8743c, 0.8, 0.4, 0.61); // a stack of crates
      [[-0.95, -0.12], [0.95, -0.12]].forEach(([x, z]) => { box(g, 0.26, 0.2, 0.26, GREEN, x, 0.22, z); box(g, 0.16, 0.12, 0.16, 0x4cc36b, x, 0.42, z); }); // shrubs
      [[-0.33, 0.78, RED], [0.33, 0.78, GREEN]].forEach(([x, z, c]) => { cyl(g, 0.07, 0.1, c, x, 0.1, z); cyl(g, 0.04, 0.08, WHITE, x, 0.2, z); box(g, 0.02, 0.1, 0.02, INK, x, 0.28, z); }); // channel buoys
    }),
  ],
  oil: [ // a derrick and its doghouse over the well, a pumpjack, two tanks and a flare stack on a concrete site, barrels at the front
    final((g) => {
      const [dx, dz] = [-0.62, -0.58], STEEL = 0x7b86a0, DARK = 0x2a2d3e, RED = 0xd9423e, WHITE = 0xf4f6fa;                  // derrick centre
      const strut = (c: number, t: number, a: [number, number, number], b: [number, number, number]) => { // a bar of section t from point a to point b
        const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), m = box(g, t, d.length(), t, c);
        m.position.set(...a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
      };
      box(g, 2.2, 0.08, 1.9, 0xb9b2a0, 0, 0, -0.05);                                                                         // site ground
      for (const x of [-1, 1]) for (const z of [-1, 1]) strut(STEEL, 0.07, [dx + 0.36 * x, 0.08, dz + 0.36 * z], [dx + 0.08 * x, 3.58, dz + 0.08 * z]); // derrick: four legs leaning in
      for (let i = 0; i < 8; i++) {                                                                                          // a girth ring every 0.5 and, between two rings, a brace on each visible face
        const [a, b, y, s] = [0.36 - i * 0.04, 0.32 - i * 0.04, 0.08 + i * 0.5, i & 1 ? -1 : 1], L = 2 * a + 0.07;
        for (const [w, d, x, z] of [[L, 0.05, 0, a], [0.05, L, -a, 0], [0.05, L, a, 0]]) box(g, w, 0.05, d, STEEL, dx + x, y - 0.025, dz + z);
        if (i < 7) for (const [x0, z0, x1, z1] of [[-s * a, a, s * b, b], [a, -s * a, b, s * b], [-a, -s * a, -b, s * b]]) strut(STEEL, 0.04, [dx + x0, y, dz + z0], [dx + x1, y + 0.5, dz + z1]); // front, right, left
      }
      box(g, 0.66, 0.06, 0.66, 0x8a8fa3, dx, 0.4, dz);                                                                       // drill floor
      box(g, 0.07, 3.5, 0.07, DARK, dx, 0.08, dz); box(g, 0.2, 0.2, 0.2, RED, dx, 2.2, dz);                                   // drill pipe, travelling block
      box(g, 0.28, 0.14, 0.28, DARK, dx, 3.58, dz); box(g, 0.1, 0.1, 0.1, 0xff3b3b, dx, 3.72, dz);                            // crown block, beacon
      box(g, 0.22, 0.26, 0.26, 0xe8e8e8, -0.08, 0.08, -0.34); box(g, 0.28, 0.05, 0.32, RED, -0.08, 0.34, -0.34); box(g, 0.08, 0.1, 0.02, 0x7db6ff, -0.08, 0.2, -0.2); // doghouse: walls, roof, window
      cyl(g, 0.38, 0.9, WHITE, 0.45, 0.08, -0.5); cyl(g, 0.395, 0.14, RED, 0.45, 0.45, -0.5); cyl(g, 0.4, 0.05, 0xcfd6e6, 0.45, 0.93, -0.5); // tank: body, band, rim
      cyl(g, 0.28, 0.06, 0x9aa5bd, 0.45, 0.98, -0.5); cyl(g, 0.15, 0.06, 0x9aa5bd, 0.45, 1.04, -0.5);                         // stepped roof
      cyl(g, 0.27, 0.6, 0xcfd6e6, 0.75, 0.08, 0.15); cyl(g, 0.285, 0.1, STEEL, 0.75, 0.35, 0.15); cyl(g, 0.19, 0.06, 0x9aa5bd, 0.75, 0.68, 0.15); // small tank
      box(g, 0.2, 0.12, 0.2, 0x8a8fa3, 1, 0.08, -0.8); box(g, 0.07, 2.4, 0.07, IRON, 1, 0.2, -0.8); box(g, 0.14, 0.08, 0.14, DARK, 1, 2.6, -0.8); // flare stack, its nozzle
      box(g, 0.24, 0.2, 0.24, 0xff8a1f, 1, 2.68, -0.8); box(g, 0.18, 0.22, 0.18, GOLD, 1.02, 2.88, -0.8); box(g, 0.1, 0.2, 0.1, 0xfff6b0, 1.05, 3.1, -0.8); // flame, leaning with the wind
      box(g, 0.04, 0.85, 0.07, DARK, 0.2, 0.1, -0.2);                                                                        // tank ladder
      const [px, pz] = [-0.4, 0.46];
      box(g, 1.05, 0.05, 0.3, 0x3a3f5a, px, 0.08, pz);                                                                       // pumpjack: skid
      strut(STEEL, 0.08, [px - 0.2, 0.13, pz], [px, 0.66, pz]); strut(STEEL, 0.08, [px + 0.2, 0.13, pz], [px, 0.66, pz]);     // samson post
      box(g, 1, 0.09, 0.2, RED, px, 0.62, pz).rotation.z = 0.1;                                                              // walking beam, nodding
      cyl(g, 0.15, 0.2, RED, px - 0.49, 0.5, pz).rotation.x = Math.PI / 2;                                                   // horse head
      box(g, 0.3, 0.22, 0.24, 0x3b5dc9, px + 0.3, 0.13, pz - 0.04); cyl(g, 0.17, 0.1, DARK, px + 0.3, 0.3, pz + 0.1).rotation.x = Math.PI / 2; // gearbox, crank
      strut(0xcfd6e6, 0.05, [px + 0.49, 0.7, pz + 0.12], [px + 0.4, 0.4, pz + 0.12]);                                        // pitman arm
      box(g, 0.07, 0.3, 0.07, RED, px - 0.49, 0.13, pz); cyl(g, 0.24, 0.02, 0x14161f, px - 0.46, 0.08, pz + 0.05);          // wellhead, oil pool
      for (const [x, z, c] of [[0.2, 0.62, RED], [0.45, 0.64, 0x3b5dc9], [0.32, 0.82, 0xe0a020]]) cyl(g, 0.1, 0.24, c, x, 0.08, z); // barrels
    }),
  ],
  bbc: [ // Broadcasting House: a stepped Art Deco tower in Portland stone (statue over the doors, the three black BBC squares on its frieze, a red ON AIR sign and a banded mast on top), on its forecourt an outside-broadcast van with a dish, a camera on its dolly and a studio light
    final((g) => {
      const Z = -0.45, STONE = 0xffffff, TRIM = 0xe4ddc8, WHITE = 0xf4f6fa, GREY = 0xcfd6e6, DARK = 0x3a4056, RED = 0xd9423e, GLASS = 0x7db6ff, BRONZE = 0xb89a5a; // Z: the tower's centre line
      box(g, 2.2, 0.08, 1.9, 0xb9b2a0); box(g, 1.1, 0.04, 0.18, TRIM, 0, 0.08, 0.14);                                                         // forecourt, the step at the doors
      floor(g, 4, 2, 'lobby', STONE, 0.08, 0, Z); floor(g, 4, 2, 'win', STONE, 0.98, 0, Z);                                                  // the tower: glass doors, a storey of windows
      box(g, 2, 0.5, 1, STONE, 0, 1.88, Z); box(g, 2.02, 0.03, 1.02, GOLD, 0, 1.88, Z); box(g, 2.12, 0.1, 1.12, TRIM, 0, 2.38, Z);           // frieze on a gold rule, cornice
      floor(g, 3, 2, 'win', STONE, 2.48, 0, Z); box(g, 1.62, 0.1, 1.12, TRIM, 0, 3.38, Z);                                                    // second tier, set in
      floor(g, 2, 2, 'win', STONE, 3.48, 0, Z); box(g, 1.12, 0.1, 1.12, TRIM, 0, 4.38, Z);                                                    // third tier and its roof
      [[0.97, 0.08, 2.3], [0.72, 2.48, 0.9], [0.47, 3.48, 0.9]].forEach(([x, y, h]) => [-1, 1].forEach((s) => box(g, 0.08, h, 0.08, TRIM, s * x, y, Z + 0.52))); // a pier up each front corner of the three tiers
      ['B', 'B', 'C'].forEach((c, i) => plaque(g, c, '#14161f', '#fff', 0.41, 0.36, (i - 1) * 0.47, 1.95, Z + 0.56));                        // the logo: three black squares on the frieze
      box(g, 0.16, 0.06, 0.08, TRIM, 0, 1.2, Z + 0.54); box(g, 0.09, 0.26, 0.06, BRONZE, -0.03, 1.26, Z + 0.54); box(g, 0.06, 0.06, 0.06, BRONZE, -0.03, 1.52, Z + 0.54); box(g, 0.05, 0.16, 0.05, BRONZE, 0.05, 1.26, Z + 0.54); // Prospero and Ariel on the pier over the doors
      box(g, 0.05, 0.12, 0.05, GREY, 0.88, 2.48, -0.3); cyl(g, 0.14, 0.03, WHITE, 0.88, 2.7, -0.28).rotation.x = Math.PI / 4; box(g, 0.04, 0.04, 0.04, DARK, 0.88, 2.78, -0.2); // a satellite dish on the first terrace
      for (const x of [-0.45, 0.45]) box(g, 0.06, 0.12, 0.06, DARK, x, 4.48, Z + 0.4); plaque(g, 'ON AIR', '#d9423e', '#fff', 1.1, 0.3, 0, 4.6, Z + 0.4); // the roof sign on two posts
      box(g, 0.3, 0.1, 0.3, TRIM, 0.2, 4.48, -0.6); for (let i = 0; i < 5; i++) box(g, 0.12, 0.34, 0.12, i & 1 ? WHITE : RED, 0.2, 4.58 + i * 0.34, -0.6); // the mast on its plinth, in red and white bands
      box(g, 0.5, 0.04, 0.04, WHITE, 0.2, 5.35, -0.6); [-0.05, 0.45].forEach((x) => box(g, 0.08, 0.16, 0.04, GREY, x, 5.19, -0.6));                // a crossarm with a panel antenna at each end
      box(g, 0.03, 0.26, 0.03, GREY, 0.2, 6.28, -0.6); box(g, 0.08, 0.08, 0.08, 0xff3b3b, 0.2, 6.54, -0.6);                                  // aerial and its red beacon
      const [vx, vz, kx, kz] = [-0.7, 0.42, 0.6, 0.45];                                                                                         // the van's centre, the camera's
      box(g, 0.72, 0.06, 0.3, DARK, vx, 0.1, vz); box(g, 0.46, 0.32, 0.34, WHITE, vx - 0.13, 0.16, vz); box(g, 0.26, 0.22, 0.34, GREY, vx + 0.23, 0.16, vz);  // van (nose to the right): chassis, studio box, cab
      box(g, 0.72, 0.045, 0.02, RED, vx, 0.2, vz + 0.175); box(g, 0.14, 0.09, 0.02, GLASS, vx + 0.23, 0.27, vz + 0.175);                     // red stripe, cab window
      for (let i = -1; i < 2; i++) box(g, 0.09, 0.09, 0.02, 0x14161f, vx - 0.13 + i * 0.11, 0.3, vz + 0.175);                                  // the BBC squares on its side
      [-0.2, 0.22].forEach((dx) => box(g, 0.14, 0.14, 0.05, INK, vx + dx, 0.08, vz + 0.15));                                                  // wheels
      box(g, 0.04, 0.18, 0.04, GREY, vx - 0.2, 0.48, vz); cyl(g, 0.17, 0.03, WHITE, vx - 0.2, 0.74, vz + 0.03).rotation.x = Math.PI / 4; box(g, 0.04, 0.04, 0.04, DARK, vx - 0.2, 0.83, vz + 0.12); // roof dish on its post, tilted to the sky, its feed horn
      box(g, 0.03, 0.3, 0.03, GREY, vx, 0.48, vz - 0.1); box(g, 0.05, 0.05, 0.05, 0xff3b3b, vx, 0.78, vz - 0.1);                              // telescopic aerial and its red tip
      box(g, 0.94, 0.012, 0.025, INK, 0.13, 0.08, 0.52);                                                                                      // cable from the van to the camera
      box(g, 0.36, 0.03, 0.05, DARK, kx, 0.08, kz); box(g, 0.05, 0.03, 0.36, DARK, kx, 0.08, kz); box(g, 0.05, 0.32, 0.05, 0x7b86a0, kx, 0.11, kz); // camera dolly: crossed legs and column
      box(g, 0.12, 0.05, 0.1, INK, kx, 0.43, kz); box(g, 0.24, 0.16, 0.14, GREY, kx, 0.48, kz); box(g, 0.16, 0.1, 0.1, INK, kx - 0.2, 0.51, kz);  // pan head, body, lens
      box(g, 0.05, 0.14, 0.14, DARK, kx - 0.3, 0.49, kz); box(g, 0.12, 0.07, 0.07, INK, kx + 0.02, 0.64, kz); box(g, 0.04, 0.04, 0.04, 0xff3b3b, kx - 0.06, 0.64, kz + 0.07); // lens hood, viewfinder, red tally lamp
      box(g, 0.03, 0.5, 0.03, IRON, 0.95, 0.08, 0.3); box(g, 0.2, 0.15, 0.1, INK, 0.95, 0.58, 0.3); box(g, 0.16, 0.11, 0.02, 0xfff6b0, 0.95, 0.6, 0.36); // studio light on its stand, its glowing lens
    }),
  ],
  devil: [ // Alcatraz Island: the cellhouse on its rock in the bay, the lighthouse and the water tower beside it, a guard tower on the dock and the ferry moored at the quay
    final((g) => {
      const P = 1.1, SEA = 0x2c6fd2, FOAM = 0xdcefff, WHITE = 0xf4f6fa, CREAM = 0xe4ddc8, TRIM = 0xf4eedb, NAVY = 0x1a2250, GLASS = 0x7db6ff, BLUE = 0x2447a8, LEAF = 0x4f9d4f, GREY = 0xcfd6e6; // the plateau's height, sea, foam, white paint, cellhouse concrete and its trim, windows, glass, ferry blue, planting, light steel
      box(g, 2.2, 0.1, 1.9, SEA); box(g, 2.16, 0.012, 1.62, 0x3d88e0, 0, 0.1, -0.14); box(g, 2.1, 0.02, 1.25, FOAM, 0, 0.1, -0.325);                  // the bay, its shallows, the foam round the rock
      [[2, 0.2, 1.15, 0x4f5565, 0, 0.1, -0.325], [1.92, 0.28, 1.01, 0x6b6d72, 0, 0.3, -0.375], [1.84, 0.34, 0.87, 0x8a857a, 0, 0.58, -0.425], [1.76, 0.18, 0.75, 0xa59f8c, 0, 0.92, -0.465]]
        .forEach(([w, h, d, c, x, y, z]) => box(g, w, h, d, c, x, y, z));                                                                                // the rock in four courses, dark and wet at the waterline, gravel on top
      [[0.16, 0.2, 0.3, 0x6b6d72, -1, 0.1, -0.55], [0.16, 0.14, 0.24, 0x4f5565, 1, 0.1, -0.15], [0.18, 0.2, 0.2, 0x8a857a, -0.96, 0.3, -0.2], [0.16, 0.2, 0.26, 0x8a857a, 0.96, 0.3, -0.5]]
        .forEach(([w, h, d, c, x, y, z]) => box(g, w, h, d, c, x, y, z));                                                                                // boulders on the shore, ledges on the cliff
      [[-0.6, 0.1, 0.2, 0.254], [-0.62, 0.3, 0.28, 0.134], [-0.18, 0.3, 0.28, 0.134], [0.4, 0.3, 0.28, 0.134], [0.8, 0.58, 0.34, 0.014]].forEach(([x, y, h, z]) => box(g, 0.03, h, 0.012, 0x3b4050, x, y, z)); // crevices down the cliff faces
      box(g, 0.8, 0.04, 0.08, LEAF, -0.55, 0.58, 0.07);                                                                                                    // ice plant on the lower ledge
      box(g, 0.24, 0.2, 0.24, 0x2f7a4a, -0.88, 0.3, 0.18); box(g, 0.16, 0.14, 0.16, 0x3f9a5c, -0.88, 0.5, 0.18);                                          // a cypress on the shore
      plaque(g, '🔒', '#6e6a61', '#ffffff', 1.5, 0.3, -0.1, 0.6, -0.045);                                                                                 // the padlock, painted on the cliff wall
      box(g, 1.5, 0.06, 0.06, LEAF, -0.1, 0.92, -0.04); [[-0.5, 0xff8fb8], [0, 0xffd23f], [0.45, 0xff8fb8]].forEach(([x, c]) => box(g, 0.05, 0.04, 0.05, c, x, 0.98, -0.04)); // the hedge along the top terrace, in flower
      [-0.4, 0.4].forEach((x) => box(g, 0.5, 0.014, 0.2, 0x5fae5a, x, P, -0.24)); box(g, 0.2, 0.012, 0.3, 0xd6d0c0, 0, P, -0.27);                          // two lawns and the path to the door

      box(g, 1.64, 0.08, 0.44, 0xbdb6a0, 0, P, -0.62); box(g, 1.6, 0.76, 0.4, CREAM, 0, P + 0.08, -0.62);                                                 // the cellhouse: plinth, walls
      box(g, 1.64, 0.04, 0.42, TRIM, 0, P + 0.44, -0.62); box(g, 1.66, 0.06, 0.46, TRIM, 0, P + 0.84, -0.62);                                             // a belt between the floors, the cornice
      for (const x of [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6]) { if (x) box(g, 0.1, 0.26, 0.02, NAVY, x, P + 0.15, -0.415); box(g, 0.1, 0.26, 0.02, NAVY, x, P + 0.53, -0.415); } // two rows of barred windows
      box(g, 0.2, 0.3, 0.03, 0x8a5a2b, 0, P + 0.08, -0.41); box(g, 0.28, 0.04, 0.05, TRIM, 0, P + 0.38, -0.41);                                          // the door and its lintel
      box(g, 1.52, 0.08, 0.4, 0x59606e, 0, P + 0.9, -0.62); box(g, 1.36, 0.08, 0.28, 0x6a7282, 0, P + 0.98, -0.62); box(g, 1.2, 0.06, 0.16, 0x7b8496, 0, P + 1.06, -0.62); // the roof in three steps
      box(g, 1, 0.06, 0.1, 0xaadcff, 0, P + 1.12, -0.62);                                                                                                  // the skylight along the ridge

      box(g, 0.34, 0.1, 0.34, 0xb4bccf, 0.7, P, -0.28);                                                                                                    // the lighthouse: plinth
      [[0.17, 0.44], [0.155, 0.42], [0.14, 0.4], [0.125, 0.38]].reduce((y, [r, h]) => (cyl(g, r, h, WHITE, 0.7, y, -0.28), y + h), P + 0.1);              // the white shaft, tapering in four stages
      box(g, 0.07, 0.15, 0.03, 0x8a5a2b, 0.7, P + 0.1, -0.11); [[P + 0.7, 0.155], [P + 1.1, 0.14]].forEach(([y, r]) => box(g, 0.03, 0.12, 0.02, INK, 0.7, y, -0.28 + r)); // door and slit windows
      cyl(g, 0.2, 0.05, INK, 0.7, P + 1.74, -0.28); cyl(g, 0.1, 0.26, 0xfff6b0, 0.7, P + 1.79, -0.28);                                                    // the gallery, the glowing lantern
      [-1, 1].forEach((s) => box(g, 0.025, 0.26, 0.025, INK, 0.7 + s * 0.075, P + 1.79, -0.205));                                                          // its two front mullions
      cyl(g, 0.16, 0.05, INK, 0.7, P + 2.05, -0.28); cyl(g, 0.1, 0.08, 0x3a4056, 0.7, P + 2.1, -0.28); box(g, 0.04, 0.1, 0.04, GOLD, 0.7, P + 2.18, -0.28); // cap, dome, finial

      for (const x of [-0.85, -0.59]) for (const z of [-0.36, -0.16]) box(g, 0.05, 0.8, 0.05, IRON, x, P, z);                                              // the water tower: four legs
      [-0.36, -0.16].forEach((z) => box(g, 0.31, 0.04, 0.04, IRON, -0.72, P + 0.4, z)); [-1, 1].forEach((s) => (box(g, 0.025, 0.48, 0.025, IRON, -0.72, P - 0.04, -0.16).rotation.z = s * 0.58)); // a ring of beams, cross-bracing in front
      box(g, 0.44, 0.04, 0.4, IRON, -0.72, P + 0.8, -0.26); cyl(g, 0.2, 0.5, 0xe4e1d8, -0.72, P + 0.84, -0.26); cyl(g, 0.205, 0.07, 0xb4573a, -0.72, P + 0.84, -0.26); // platform, the tank, its rust band
      cyl(g, 0.21, 0.04, GREY, -0.72, P + 1.34, -0.26); cyl(g, 0.13, 0.1, 0x9aa5bd, -0.72, P + 1.38, -0.26);                                               // the stepped roof

      box(g, 1.1, 0.16, 0.2, 0xc9c2ae, 0.4, 0.1, 0.35); box(g, 1.1, 0.012, 0.025, GOLD, 0.4, 0.26, 0.425);                                                // the quay, its yellow edge line
      [0, 0.45].forEach((x) => box(g, 0.06, 0.07, 0.06, INK, x, 0.26, 0.4));                                                                              // bollards
      box(g, 0.2, 0.62, 0.18, 0xd6d0c0, 0.8, 0.26, 0.36); box(g, 0.34, 0.26, 0.26, CREAM, 0.8, 0.88, 0.36); box(g, 0.28, 0.12, 0.02, GLASS, 0.8, 0.95, 0.495); // the guard tower on the dock: shaft, cab, its glass
      box(g, 0.42, 0.04, 0.34, 0x4a5170, 0.8, 1.14, 0.36); box(g, 0.08, 0.1, 0.08, 0xfff6b0, 0.8, 1.18, 0.36);                                            // roof, searchlight

      box(g, 0.9, 0.12, 0.22, WHITE, 0.4, 0.1, 0.58); box(g, 0.92, 0.04, 0.23, NAVY, 0.4, 0.1, 0.58); box(g, 0.9, 0.025, 0.225, BLUE, 0.4, 0.18, 0.58);   // the ferry: hull, dark waterline, blue stripe
      box(g, 0.1, 0.12, 0.16, WHITE, 0.9, 0.1, 0.58); box(g, 0.06, 0.12, 0.09, WHITE, 0.96, 0.1, 0.58);                                                   // bow in two steps
      box(g, 0.72, 0.1, 0.18, WHITE, 0.32, 0.22, 0.58); box(g, 0.64, 0.045, 0.02, NAVY, 0.32, 0.245, 0.675);                                              // main deck and its windows
      box(g, 0.46, 0.09, 0.15, WHITE, 0.26, 0.32, 0.58); box(g, 0.4, 0.04, 0.02, NAVY, 0.26, 0.34, 0.66); box(g, 0.5, 0.025, 0.18, GREY, 0.26, 0.41, 0.58); // upper deck, windows, roof
      box(g, 0.18, 0.1, 0.13, WHITE, 0.58, 0.32, 0.58); box(g, 0.14, 0.05, 0.02, GLASS, 0.58, 0.35, 0.65); box(g, 0.22, 0.025, 0.16, GREY, 0.58, 0.42, 0.58); // wheelhouse, its glass, roof
      box(g, 0.1, 0.16, 0.1, BLUE, 0.2, 0.435, 0.58); box(g, 0.105, 0.035, 0.105, WHITE, 0.2, 0.5, 0.58); box(g, 0.11, 0.02, 0.11, INK, 0.2, 0.595, 0.58); // funnel, its band and cap
      box(g, 0.96, 0.012, 0.03, FOAM, 0.42, 0.1, 0.7); box(g, 0.1, 0.012, 0.22, FOAM, 1.02, 0.1, 0.58);                                                   // foam along the hull and at the bow

      cyl(g, 0.07, 0.1, 0xd9423e, -0.75, 0.1, 0.8); cyl(g, 0.04, 0.08, WHITE, -0.75, 0.2, 0.8); box(g, 0.02, 0.1, 0.02, INK, -0.75, 0.28, 0.8);             // a channel buoy
      [[-0.85, 0.55], [-0.3, 0.82], [0.9, 0.8]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x5ec2dc, x, 0.1, z));                                     // ripples
      [[-0.2, 2.7, -0.3], [0.3, 2.95, -0.1]].forEach(([x, y, z]) => { box(g, 0.07, 0.035, 0.04, WHITE, x, y, z); [-1, 1].forEach((s) => (box(g, 0.1, 0.012, 0.05, WHITE, x + s * 0.07, y + 0.03, z).rotation.z = -s * 0.35)); }); // two gulls on the wing
    }),
  ],

  // ---- Landmarks: the special cities, each with a monument of its own (keyed by city name, see createBoard) ----
  Singapore: [ // the Merlion: a white lion-headed fish on a round pedestal in a pool, a spiked mane round its face, its tail curled up behind, spouting water from its mouth
    final((g) => {
      const WHITE = 0xffffff, PALE = 0xe4eaf5, FACE = 0xfff3d6, MANE = 0xa9b8d6, SPIKE = 0xd0daee, GREY = 0xb4bccf, WATER = 0x4da3ff, JET = 0x9fd8ff, FOAM = 0xdcefff, hx = -0.25, zc = -0.15, zf = zc + 0.25; // hx, zc: the statue's centre line; zf: the front of its face
      const disc = (p: THREE.Group, r: number, t: number, c: number, x: number, y: number, z: number) => { cyl(p, r, t, c, x, y - t / 2, z).rotation.x = Math.PI / 2; };                                                                                                        // a cylinder facing the viewer, centred at height y
      box(g, 2.4, 0.14, 1.8, 0xb9b2a0); box(g, 2.12, 0.08, 1.52, WATER, 0, 0.14);                                                                                                                                // foundation, the pool
      for (const [w, d, x, z] of [[2.4, 0.14, 0, 0.83], [2.4, 0.14, 0, -0.83], [0.14, 1.52, -1.13, 0], [0.14, 1.52, 1.13, 0]]) box(g, w, 0.12, d, 0xe8e2d2, x, 0.14, z);                                       // its curb
      cyl(g, 0.66, 0.03, FOAM, hx + 0.15, 0.22, zc); cyl(g, 0.58, 0.2, GREY, hx + 0.15, 0.22, zc); cyl(g, 0.48, 0.16, PALE, hx + 0.15, 0.42, zc);                                                            // the pedestal in its ring of foam, in two steps
      for (let i = 0; i < 14; i++) cyl(g, 0.3 + 0.13 * Math.sin((Math.PI * (i + 2)) / 16), 0.12, i & 1 ? PALE : WHITE, hx, 0.58 + i * 0.12, zc);                                                                  // the fish: rings of scales, plump at the belly, slim at the neck
      for (let j = 0; j < 9; j++) cyl(g, 0.2 - j * 0.011, 0.15, j & 1 ? PALE : WHITE, hx + 0.37 + 0.55 * Math.sin((j * Math.PI) / 12), 0.62 + j * 0.15, zc - 0.1);                                              // the tail, curling out and back up behind
      disc(g, 0.18, 0.1, WHITE, hx + 0.85, 2.05, zc - 0.1); for (const s of [-1, 1]) box(g, 0.22, 0.6, 0.1, PALE, hx + 0.85 + s * 0.14, 2.08, zc - 0.1).rotation.z = -s * 0.5;                                 // its fin, forked in a V
      const head = new THREE.Group(); head.position.set(hx, 2.66, zc + 0.035); head.rotation.x = -0.45; g.add(head);                                                                                            // the head, tipped back to look up at the water it spouts
      const bx = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => box(head, w, h, d, c, x, y - h / 2, z);                                                                                                                               // a box centred on x, y, z in the head's own frame
      disc(head, 0.55, 0.3, MANE, 0, -0.1, -0.25);                                                                                                                                                              // the mane: a dark base, under a ring of pointed locks
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k & 1 ? 0.5 : 0.56; bx(0.3, 0.3, k & 1 ? 0.16 : 0.2, k & 1 ? PALE : SPIKE, r * Math.sin(a), r * Math.cos(a) - 0.1, -0.1).rotation.z = Math.PI / 4 - a; } // diamonds turned point-out, long and short in turn
      disc(head, 0.36, 0.2, FACE, 0, 0, 0); bx(0.44, 0.3, 0.14, WHITE, 0, -0.21, 0.17);                                                                                                                         // the face, the muzzle
      for (const s of [-1, 1]) { bx(0.1, 0.09, 0.03, INK, s * 0.15, 0.07, 0.1); bx(0.24, 0.07, 0.04, IRON, s * 0.15, 0.19, 0.1).rotation.z = s * 0.4; bx(0.05, 0.07, 0.05, WHITE, s * 0.125, -0.225, 0.27); }  // eyes, frowning brows, fangs
      bx(0.26, 0.09, 0.05, INK, 0, -0.08, 0.25); bx(0.05, 0.1, 0.05, INK, 0, -0.17, 0.25); bx(0.36, 0.14, 0.05, INK, 0, -0.26, 0.25);                                                                           // a broad nose, the line down from it, the open mouth
      box(g, 0.1, 0.1, 0.2, JET, hx, 2.5, zf + 0.17); box(g, 0.1, 0.1, 0.14, JET, hx, 2.4, zf + 0.31); box(g, 0.1, 2.18, 0.1, JET, hx, 0.22, zf + 0.43);                                                      // the water: out of the mouth, then falling
      box(g, 0.34, 0.05, 0.26, FOAM, hx, 0.22, zf + 0.45);                                                                                                                                                       // its splash
    }),
  ],
  'Hong Kong': [ // Bank of China Tower: four glass prisms stepping up to twin masts on a granite podium with flags, a rock garden with a red bridge over its pond, and Victoria Harbour with a red-sailed junk and a Star Ferry
    final((g) => {
      const HW = 0.6, MOD = 1.1, RISE = 0.5, TX = -0.4, TZ = -0.35, BASE = 0.44, RED = 0xd9423e, WHITE = 0xf4f6fa, GREEN = 0x2f8f5a, WOOD = 0x6e3a12, TAR = 0x3a2008, PANE = 0xe8edf6, ROCK = 0x8a8f9c, SHRUB = 0x4f9d4f; // the prisms' half-width, storey module and roof rise, the tower's centre and base height; paints
      const disc = (p: THREE.Group, r: number, t: number, c: number, x: number, y: number, z: number) => { cyl(p, r, t, c, x, y - t / 2, z).rotation.x = Math.PI / 2; };                                               // a cylinder facing the viewer, centred at height y
      const peak = (d: number) => BASE + 4 * MOD + (RISE * (HW - d)) / HW;                                                                                         // the tallest roof's height, d from the tower's centre line
      box(g, 2.4, 0.1, 1.9, 0x3a86e0); box(g, 2.4, 0.06, 1.42, 0xb9bdc8, 0, 0.1, -0.24); box(g, 2.4, 0.03, 0.05, 0xe6e9f0, 0, 0.16, 0.42);                   // the harbour, the plaza on it, its kerb
      box(g, 1.46, 0.14, 1.37, 0x8a92a3, -0.39, 0.16, -0.265); box(g, 1.34, 0.14, 1.27, 0xb3bac8, TX, 0.3, -0.315);                                         // the granite podium in two courses
      [[0, 1], [-Math.PI / 2, 2], [Math.PI, 3], [Math.PI / 2, 4]].forEach(([r, n]) => { part(g, prism(HW, n * MOD, RISE, MOD), 0, prismMat(HW, MOD), TX, BASE, TZ).rotation.y = r; }); // the four prisms, south, west, north, east: one module taller each
      box(g, 0.05, 1, 0.05, INK, TX + 0.1, peak(0.1) - 0.03, TZ); box(g, 0.05, 0.75, 0.05, INK, TX + 0.26, peak(0.26) - 0.03, TZ); box(g, 0.07, 0.07, 0.07, 0xff3b3b, TX + 0.1, peak(0.1) + 0.97, TZ); // the twin masts on the tallest roof, a beacon on the higher one
      box(g, 0.46, 0.34, 0.03, PANE, TX, BASE, 0.265); box(g, 0.36, 0.28, 0.03, 0x1d2c4d, TX, BASE, 0.285); box(g, 0.025, 0.28, 0.035, PANE, TX, BASE, 0.287); // the entrance: frame, dark glass doors, the bar between them
      disc(g, 0.075, 0.03, RED, TX, 0.89, 0.265); disc(g, 0.052, 0.04, 0xffffff, TX, 0.89, 0.265); box(g, 0.036, 0.036, 0.05, RED, TX, 0.872, 0.265);          // the bank's coin over it, between the braces: red disc, white ring, red square hole
      for (const d of [-0.31, 0.31]) { box(g, 0.16, 0.1, 0.07, 0x9aa1b0, TX + d, BASE, 0.285); box(g, 0.13, 0.1, 0.05, SHRUB, TX + d, BASE + 0.1, 0.285); }   // a planter either side of the entrance
      for (const x of [-1.04, 0.22]) { box(g, 0.03, 0.9, 0.03, 0xdddddd, x, 0.3, 0.37); box(g, 0.3, 0.18, 0.02, RED, x + 0.165, 1.02, 0.37); }                // a flagpole at each front corner of the podium, with a red flag
      box(g, 0.06, 0.06, 0.025, GOLD, -0.98, 1.14, 0.375); box(g, 0.025, 0.025, 0.025, GOLD, -0.91, 1.17, 0.375); box(g, 0.025, 0.025, 0.025, GOLD, -0.91, 1.1, 0.375); // the Chinese flag's stars
      box(g, 0.08, 0.08, 0.025, 0xffffff, 0.38, 1.07, 0.375);                                                                                                // the Hong Kong flag's bauhinia
      box(g, 0.6, 0.06, 0.44, 0xd8d2c0, 0.82, 0.16, -0.02); box(g, 0.5, 0.04, 0.34, 0x4da3ff, 0.82, 0.17, -0.02);                                           // the garden pond: stone coping, water
      [[0.26, 0.22, 0.2, 0.97, -0.34, ROCK], [0.2, 0.34, 0.16, 0.8, -0.38, 0x767b8a], [0.14, 0.16, 0.14, 0.62, -0.32, 0x9a9fac]].forEach(([w, h, d, x, z, c]) => box(g, w, h, d, c, x, 0.16, z)); // three rocks behind it
      box(g, 0.12, 0.12, 0.1, ROCK, 0.82, 0.5, -0.38); box(g, 0.06, 0.3, 0.02, 0xbfe6ff, 0.8, 0.2, -0.29);                                                   // a stone on the tallest rock, the waterfall down its front
      box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.68, 0.21, 0.04); box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.96, 0.21, 0.1);                                           // two goldfish
      box(g, 0.2, 0.04, 0.1, RED, 0.6, 0.22, -0.02); box(g, 0.22, 0.04, 0.1, RED, 1.04, 0.22, -0.02); box(g, 0.3, 0.04, 0.1, RED, 0.82, 0.26, -0.02); box(g, 0.62, 0.025, 0.02, 0xf4eedb, 0.82, 0.3, 0.03); // the red bridge over it: two ramps, the arch, a white rail
      box(g, 0.06, 0.3, 0.06, WOOD, 1.05, 0.16, -0.72); [[0.34, 0x2f7a4a], [0.26, 0x3f9a5c], [0.18, 0x4fb06a]].forEach(([w, c], i) => box(g, w, 0.16, w, c, 1.05, 0.4 + i * 0.14, -0.72)); // a pine: trunk, three tiers of needles
      box(g, 0.18, 0.14, 0.16, SHRUB, 0.45, 0.16, 0.3); box(g, 0.18, 0.14, 0.16, SHRUB, 1.08, 0.16, 0.36);                                                   // two shrubs
      const jx = -0.8;                                                                                                                                       // the junk's centre
      box(g, 0.68, 0.03, 0.21, TAR, jx, 0.1, 0.74); box(g, 0.66, 0.1, 0.2, WOOD, jx, 0.13, 0.74);                                                            // the junk: a tarred waterline, the hull
      box(g, 0.16, 0.2, 0.2, WOOD, jx + 0.25, 0.13, 0.74); box(g, 0.18, 0.03, 0.22, 0x8a5a2b, jx + 0.25, 0.33, 0.74); box(g, 0.1, 0.16, 0.18, WOOD, jx - 0.35, 0.13, 0.74); // the raised stern and its roof, the upturned bow
      [[-0.22, 0.5], [-0.03, 0.62], [0.16, 0.4]].forEach(([dx, h]) => {                                                                                       // three masts, each with a battened sail
        box(g, 0.025, h + 0.08, 0.025, TAR, jx + dx, 0.23, 0.74); box(g, 0.14, h, 0.03, RED, jx + dx + 0.055, 0.25, 0.74);                                  // the mast, the sail
        for (const k of [1, 2]) box(g, 0.14, 0.018, 0.035, 0x8a1f1f, jx + dx + 0.055, 0.25 + (k * h) / 3, 0.74);                                             // two battens across it
      });
      box(g, 0.08, 0.04, 0.015, GOLD, jx + 0.01, 0.93, 0.74);                                                                                                // a pennant at the main masthead
      const fx = 0.8;                                                                                                                                        // the ferry's centre
      box(g, 0.64, 0.1, 0.2, WHITE, fx, 0.1, 0.74); box(g, 0.65, 0.035, 0.205, GREEN, fx, 0.1, 0.74); box(g, 0.08, 0.1, 0.14, WHITE, fx + 0.35, 0.1, 0.74);   // the Star Ferry: hull, its green band, the narrow bow
      box(g, 0.52, 0.09, 0.17, WHITE, fx - 0.02, 0.2, 0.74); box(g, 0.46, 0.035, 0.02, INK, fx - 0.02, 0.23, 0.835);                                         // the main deck and its windows
      box(g, 0.42, 0.08, 0.15, WHITE, fx - 0.05, 0.29, 0.74); box(g, 0.36, 0.03, 0.02, INK, fx - 0.05, 0.32, 0.82);                                          // the upper deck and its windows
      box(g, 0.46, 0.025, 0.18, GREEN, fx - 0.05, 0.37, 0.74); box(g, 0.07, 0.1, 0.07, GREEN, fx + 0.03, 0.395, 0.74);                                       // the green roof, the funnel
      [[-0.3, 0.9], [0.1, 0.65], [-0.05, 0.86], [0.3, 0.55]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                           // ripples on the harbour
    }),
  ],
  Pyongyang: [ // Juche Tower: a tapering shaft of granite tiers with gold characters up its front, under a red glass torch on a gold collar; beside it the statue of the worker, peasant and intellectual raising hammer, sickle and brush; the Taedong in front with two fountains and a rowing boat
    final((g) => {
      const [TX, TZ, SX, SZ, FY, P] = [-0.26, -0.5, 0.76, 0.1, 5.05, 0.63];                                                                                    // the shaft's centre line, the statue's, the foot of the torch, the top of the statue's pedestal
      const WATER = 0x3a86e0, FOAM = 0xdcefff, JET = 0x9fd8ff, GREY = 0xd7d4cb, LIGHT = 0xf6f4ee, LEDGE = 0xe9e6dc, CRIMSON = 0xb13e53, RED = 0xe43b44, WOOD = 0x6e3a12, DGOLD = 0xf0a020, BRONZE = 0xa8673f, BRONZE2 = 0xc4824e; // paints
      const GLYPH: Record<number, string[]> = { 9: ['.Y..Y.Y', 'YYY.Y.Y', '.Y.YY.Y', '.Y..Y.Y', 'Y.Y.Y.Y', 'Y.Y.Y.Y'], 10: ['YYYYY', '..Y..', '.Y.Y.', 'YYYYY', '..Y..', '..Y..'] };         // 체 and 주, the gold characters on the front pier of the top two tiers
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.4, 0.14, 1.28, 0xd3d0c4, 0, 0.1, -0.31); box(g, 2.4, 0.03, 0.06, 0xf4eedb, 0, 0.24, 0.3); box(g, 2.4, 0.012, 0.05, FOAM, 0, 0.1, 0.355); // the Taedong, the plaza on its bank, the kerb along it, foam at the quay wall
      box(g, 1.3, 0.07, 0.9, 0xe2dfd3, TX, 0.24, TZ); box(g, 1.1, 0.07, 0.78, 0xece9de, TX, 0.31, TZ);                                                         // two granite steps
      stone(g, 0.94, 0.32, 0.68, 0xe4e1d6, TX, 0.38, TZ); box(g, 1.02, 0.05, 0.76, LEDGE, TX, 0.7, TZ);                                                          // the base hall and its cornice
      box(g, 0.58, 0.3, 0.04, 0x3a3f4e, TX, 0.41, TZ + 0.35); decal(g, ['xtaSyxktaSb', 'aSxkytxaStx', 'tyaxbSxkaty', 'Sxktaxysbxa', 'kaSxyatxStb', 'xbtyaSkxyat'], TX, 0.435, TZ + 0.375); // the niche of the friendship plaques, a mosaic of them
      for (let i = 0; i < 11; i++) {                                                                                                                              // the shaft: eleven tiers, each a little narrower than the one below
        const w = 0.78 - 0.028 * i, y = 0.75 + i * 0.36;                                                                                                          // its width, its foot
        stone(g, w, 0.36, w, GREY, TX, y, TZ); stone(g, 0.62 * w, 0.32, 0.04, LIGHT, TX, y, TZ + w / 2); box(g, w + 0.1, 0.04, w + 0.1, LEDGE, TX, y + 0.32, TZ); // the tier's grey wings, the lighter pier up its front, the ledge that caps it
        if (GLYPH[i]) decal(g, GLYPH[i], TX, y + 0.045, TZ + w / 2 + 0.026);                                                                                      // its gold characters, on the pier
      }
      stone(g, 0.46, 0.26, 0.46, GREY, TX, 4.71, TZ); [-0.13, 0, 0.13].forEach((x) => box(g, 0.06, 0.14, 0.02, 0x2a3050, TX + x, 4.78, TZ + 0.23)); box(g, 0.56, 0.04, 0.56, LEDGE, TX, 4.97, TZ); // the viewing gallery with its slit windows, the last ledge
      cyl(g, 0.25, 0.05, DGOLD, TX, FY, TZ); cyl(g, 0.31, 0.08, GOLD, TX, FY + 0.05, TZ);                                                                         // the gold collar
      [0.15, 0.19, 0.21, 0.21, 0.2, 0.18, 0.155, 0.13, 0.105, 0.08, 0.057, 0.037, 0.02].forEach((r, i) => cyl(g, r, 0.085, [CRIMSON, RED, RED, 0xff3b3b, RED, 0xff3b3b, 0xff3b3b][i >> 1], TX + Math.max(0, i - 3) * 0.013, FY + 0.13 + i * 0.085, TZ)); // the torch: slices of red glass swelling, then licking up to the right, the upper ones glowing (unlit)
      box(g, 0.8, 0.07, 0.46, 0xd6d0c0, SX, 0.24, SZ); box(g, 0.68, 0.27, 0.36, 0xe9e4d6, SX, 0.31, SZ); box(g, 0.74, 0.05, 0.4, 0xcfc8b4, SX, 0.58, SZ);         // the statue's pedestal, in three courses
      const rod = (x: number, y: number, len: number, a: number, c: number) => { box(g, 0.045, len, 0.045, c, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2, SZ).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; }; // a bar from (x, y) tipped a to the left: where its top end is
      const person = (x: number, s: number, a: number) => { const d = Math.sign(a); box(g, 0.13, 0.2 * s, 0.09, BRONZE, x, P, SZ); box(g, 0.18, 0.25 * s, 0.1, BRONZE, x, P + 0.2 * s, SZ); box(g, 0.1, 0.12 * s, 0.1, BRONZE2, x, P + 0.46 * s, SZ); box(g, 0.045, 0.2 * s, 0.07, BRONZE, x + d * 0.115, P + 0.22 * s, SZ); return rod(x - d * 0.09, P + 0.42 * s, 0.3, a, BRONZE); }; // a bronze figure s tall: legs, coat, head, one arm at his side, the other raised leaning a to the left (the tip of it returned)
      const [bx, by] = person(SX - 0.2, 1, 0.3), [hx, hy] = person(SX, 1.15, -0.08), [sx, sy] = person(SX + 0.2, 0.95, -0.3);                                    // the intellectual, the worker and the peasant, and their hands
      box(g, 0.06, 0.12, 0.06, 0x3b2418, bx - 0.015, by, SZ); box(g, 0.17, 0.08, 0.07, 0x7a4a28, hx, hy - 0.01, SZ);                                             // the brush, the hammer
      box(g, 0.13, 0.04, 0.04, 0x7a4a28, sx, sy + 0.08, SZ); box(g, 0.04, 0.1, 0.04, 0x7a4a28, sx + 0.045, sy - 0.02, SZ);                                       // the sickle: its curved back and its blade
      for (const x of [-0.95, 0.95]) {                                                                                                                            // a fountain in the river at each side
        cyl(g, 0.19, 0.012, FOAM, x, 0.1, 0.62); cyl(g, 0.12, 0.02, 0xffffff, x, 0.1, 0.62);                                                                      // the splash at its foot
        [[0.14, 0.26, FOAM], [0.1, 0.24, 0xffffff], [0.07, 0.22, FOAM], [0.05, 0.2, 0xffffff]].reduce((y, [w, h, c]) => { box(g, w, h, w, c, x, y, 0.62); return y + h - 0.02; }, 0.1); // the plume, thinning as it climbs
        box(g, 0.13, 0.04, 0.13, FOAM, x, 0.9, 0.62);                                                                                                             // the spray at its head
        [[0.09, 0.84], [0.19, 0.66]].forEach(([dx, y]) => [-1, 1].forEach((s) => box(g, 0.05, 0.07, 0.05, JET, x + s * dx, y, 0.62)));                           // the arcs of water falling to both sides
      }
      const [rx, rz] = [-0.2, 0.55];                                                                                                                              // the rowing boat's centre
      box(g, 0.4, 0.07, 0.14, 0x8a5a2b, rx, 0.1, rz); [-1, 1].forEach((s) => box(g, 0.06, 0.13, 0.1, 0x8a5a2b, rx + s * 0.22, 0.1, rz));                         // the hull and its upturned ends
      box(g, 0.08, 0.1, 0.07, 0xd9423e, rx - 0.02, 0.17, rz); box(g, 0.05, 0.05, 0.05, 0xf5b88c, rx - 0.02, 0.27, rz);                                           // the rower and his head
      [[0.45, 0.45], [-0.6, 0.5]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, JET, x, 0.1, z));                                                                // ripples
      [[-1.03, -0.7], [-1.03, -0.3]].forEach(([x, z]) => { box(g, 0.06, 0.3, 0.06, WOOD, x, 0.24, z); cyl(g, 0.2, 0.14, 0x2f7a4a, x, 0.5, z); cyl(g, 0.17, 0.12, 0x3f9a5c, x, 0.64, z); cyl(g, 0.11, 0.1, 0x4fb06a, x, 0.76, z); }); // two trees on the plaza
    }),
  ],
  Zurich: [ // Grossmünster: twin sandstone towers on a plinth by the Limmat, each with a slate dome and gold cross, Charlemagne seated in a niche on the right one, a lattice window and the dark red ridge turret between them; swans and ripples on the river, lindens, lamps, and the flags of Zürich and Switzerland
    final((g) => {
      const W = 0.59, TX = 0.48, TZ = 0.02, R = (W + 0.06) / 2, FZ = TZ + W / 2;                                                                                // a tower: its width, its centre line (x either side of the middle, z), half a cornice, its front face
      const SAND = 0xd8cdb4, TRIM = 0xece4d0, DARK = 0xb4a78d, SLATE = 0x56627e, SLATE2 = 0x7280a0, ROOF = 0x8c6a42, MAROON = 0x7a1f35, DGOLD = 0xe0a020, WATER = 0x35a0b0, FOAM = 0xdcefff, PAVE = 0xcfc8b6, WOOD = 0x6e3a12, JET = 0x9fd8ff; // paints
      const gap = (n: number) => Array(n).fill('.............');                                                                                                        // n bare rows of a tower face
      const quoin = (rows: string[]) => rows.map((r) => 'x' + r.slice(1, 12) + 'x');                                                                                      // a pale pilaster up either edge of every row
      const SLIT = Array(4).fill('...O.....O...');                                                                                                              // the slit windows of the shaft
      const BELFRY = ['...O.....O...', ...Array(2).fill('..OdO...OdO..'), ...Array(5).fill('.OedeO.OedeO.'), 'xxxxxxxxxxxxx'];                                  // the belfry's pointed windows over a sill
      const UPPER = ['...O.....O...', ...Array(4).fill('..OeO...OeO..'), '.xxxxxxxxxxx.'];                                                                      // the upper stage's small windows over a sill
      const FRONT = quoin([...gap(5), ...UPPER, ...gap(8), ...BELFRY, ...gap(20), ...SLIT, ...gap(4)]);                                                         // a tower's face, top to foot: upper windows, belfry windows, slits, 56 rows
      const LANCET = ['....O....', ...Array(13).fill('.O.OdO.O.')];                                                                                             // the lancets round the octagon
      const KARL = ['.OOOOO.', '.OYOYO.', '.OYYYO.', '.OaaaO.', '.ObwbO.', 'YaaaaaO', '.ObbbO.', 'xxxxxxx', '.xxxxx.'];                                         // Charlemagne: crown, beard, sword across his lap, in his niche
      const LATTICE = ['.OOO.', ...Array(5).fill(['OabaO', 'ObabO']).flat(), 'OOOOO'];                                                                          // the diamond lattice of the big window
      const ZURICH = ['wwwwwww', 'LLwwwww', 'LLLwwww', 'LLLLLww', 'LLLLLLw'], SWISS = ['RRRRRR', 'RRwwRR', 'RwwwwR', 'RwwwwR', 'RRwwRR', 'RRRRRR'];             // the flags: Zürich's blue and white split on the diagonal, the Swiss white cross on red
      box(g, 2.4, 0.1, 1.9, WATER); stone(g, 2.4, 0.12, 1.5, PAVE, 0, 0.1, -0.2); box(g, 2.4, 0.07, 0.05, TRIM, 0, 0.22, 0.525); box(g, 2.4, 0.012, 0.05, FOAM, 0, 0.1, 0.575); // the Limmat, the quay, its parapet, foam along the wall
      stone(g, 1.66, 0.08, 1.31, DARK, 0, 0.22, -0.295);                                                                                                        // the church's plinth
      for (const s of [-1, 1]) {                                                                                                                                // the twin towers; the south one (right) is the Karlsturm
        const x = s * TX; let y = 0.3;                                                                                                                          // this tower's centre line, the height built so far
        const up = (h: number, w = W, c = SAND, m = stone) => { m(g, w, h, w, c, x, y, TZ); y += h; };                                                                  // the next stage of the shaft: ashlar, or a plain box for a cornice
        decal(g, FRONT, x, y, FZ + 0.02);                                                                                                                       // its windows and pilasters
        up(1.2); up(0.06, W + 0.06, TRIM, box); up(0.72); up(0.06, W + 0.06, TRIM, box); up(0.5); up(0.05, W + 0.1, TRIM, box);                                 // shaft, cornice, belfry, cornice, upper stage, terrace slab
        [[W + 0.1, 0.04, 0, 1], [W + 0.1, 0.04, 0, -1], [0.04, W + 0.1, 1, 0], [0.04, W + 0.1, -1, 0]].forEach(([w, d, a, b]) => box(g, w, 0.1, d, TRIM, x + a * R, y, TZ + b * R)); // its balustrade
        [[0.205, SAND], [0.19, SAND]].forEach(([r, c], k) => { cyl(g, r, 0.33, c, x, y + 0.33 * k, TZ).rotation.y = Math.PI / 10; });                           // the octagonal stage, tapering
        decal(g, LANCET, x, y + 0.04, TZ + 0.2);                                                                                                                // its lancets
        y += 0.66; cyl(g, 0.235, 0.05, TRIM, x, y, TZ); y += 0.05;                                                                                              // the crown ring under the dome
        [0.215, 0.25, 0.255, 0.23, 0.18, 0.11, 0.05].forEach((r, i) => cyl(g, r, 0.06, i & 1 ? SLATE2 : SLATE, x, y + i * 0.06, TZ));                           // the dome: a stepped onion in slate
        y += 0.42; cyl(g, 0.015, 0.08, GOLD, x, y, TZ); cyl(g, 0.04, 0.05, GOLD, x, y + 0.06, TZ); box(g, 0.03, 0.14, 0.03, GOLD, x, y + 0.11, TZ); box(g, 0.1, 0.03, 0.03, GOLD, x, y + 0.18, TZ); // the gold post, ball and cross
      }
      decal(g, KARL, TX, 0.95, FZ + 0.02);                                                                                                                      // Charlemagne, seated in his niche on the south tower
      stone(g, 0.37, 0.9, 0.42, SAND, 0, 0.3, -0.01); decal(g, LATTICE, 0, 0.7, 0.22);                                                                          // the wall between the towers and its lattice window
      [0.37, 0.3, 0.23, 0.16, 0.09].forEach((w, i) => stone(g, w, 0.05, 0.42, SAND, 0, 1.2 + i * 0.05, -0.01));                                                 // its stepped gable
      stone(g, 1.52, 0.3, 0.73, SAND, 0, 0.3, -0.585);                                                                                                          // the nave and aisles behind
      [1.52, 1.3, 1.08].forEach((w, i) => box(g, w, 0.07, 0.73, ROOF, 0, 0.6 + i * 0.07, -0.585));                                                              // the aisle roofs
      stone(g, 0.74, 0.16, 0.73, SAND, 0, 0.81, -0.585);                                                                                                        // the clerestory
      [0.84, 0.62, 0.4, 0.18].forEach((w, i) => box(g, w, 0.08, 0.73, ROOF, 0, 0.97 + i * 0.08, -0.585));                                                       // the nave roof, stepped
      box(g, 0.16, 0.1, 0.16, TRIM, 0, 1.29, -0.5); box(g, 0.1, 0.12, 0.1, MAROON, 0, 1.39, -0.5); box(g, 0.14, 0.03, 0.14, DGOLD, 0, 1.51, -0.5);              // the ridge turret: base, lantern, gold gallery
      [0.09, 0.065, 0.045, 0.025].forEach((w, i) => box(g, w, 0.15, w, MAROON, 0, 1.54 + i * 0.15, -0.5)); box(g, 0.02, 0.1, 0.02, GOLD, 0, 2.14, -0.5);        // its needle spire and vane
      for (const x of [-1.03, 1.03]) { box(g, 0.07, 0.3, 0.07, WOOD, x, 0.22, 0.2); cyl(g, 0.21, 0.14, 0x2f7a4a, x, 0.5, 0.2); cyl(g, 0.17, 0.12, 0x3f9a5c, x, 0.64, 0.2); cyl(g, 0.11, 0.1, 0x4fb06a, x, 0.76, 0.2); } // two lindens
      [-0.9, 0.9].forEach((x) => { box(g, 0.04, 0.5, 0.04, INK, x, 0.22, 0.45); box(g, 0.09, 0.08, 0.09, 0xfff6b0, x, 0.72, 0.45); });                          // two street lamps
      ([[-1.1, ZURICH], [1.1, SWISS]] as [number, string[]][]).forEach(([x, rows]) => { box(g, 0.03, 0.9, 0.03, 0xdddddd, x, 0.22, 0.45); decal(g, rows, x - Math.sign(x) * rows[0].length / 44, 0.95, 0.45); }); // the flags of Zürich and Switzerland on their masts
      [[-0.45, 0.8], [0.55, 0.74]].forEach(([x, z]) => { box(g, 0.14, 0.06, 0.08, 0xffffff, x, 0.1, z); box(g, 0.03, 0.1, 0.03, 0xffffff, x + 0.06, 0.16, z); box(g, 0.05, 0.03, 0.04, 0xffffff, x + 0.08, 0.26, z); box(g, 0.03, 0.02, 0.02, 0xff9a2e, x + 0.115, 0.26, z); }); // two swans
      [[-0.1, 0.9], [0.2, 0.68], [0.95, 0.85]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, JET, x, 0.1, z));                                                 // ripples on the river
    }),
  ],
  'New York': [ // Statue of Liberty: a verdigris copper figure on a granite pedestal inside the eleven-pointed star of Fort Wood on Liberty Island, torch raised in one hand and the tablet in the other under a crown of seven rays; trees and the Stars and Stripes on the lawn, a Staten Island ferry in the harbour
    final((g) => {
      const [SX, SZ, FY, P] = [0, -0.38, 0.46, 2.04];                                                                                                           // the monument's centre line, the top of Fort Wood, the top of the pedestal (the plinth she stands on)
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, GRASS = 0x4f9d4f, WALL = 0xcfc8b6, PATH = 0xdba596, FORT = 0xb4ab95, GR = 0xcbc3ae, GRL = 0xded8c6, GRD = 0xa9a08a, DARK = 0x3f392e;  // paints: sea, foam, lawn, seawall, the pink promenade, fort stone, granite in three tones, the loggia's shade
      const WOOD = 0x6e3a12, WHITE = 0xf4f6fa, NAVY = 0x1a2250, ORANGE = 0xf26b1d;                                                                              // trunks, the ferry's white paint, its windows, its orange
      const PAT = 0x5cc6a6, PATL = 0x8fe4cc, PATD = 0x419e83, PATDD = 0x2d7662, DGOLD = 0xe0a020;                                                               // the statue's verdigris in four tones, the flame's darker gold
      const rod = (x: number, y: number, len: number, a: number, w: number, c: number, z = SZ, d = w) => { box(g, w, len, d, c, x - Math.sin(a) * len / 2, y + (Math.cos(a) - 1) * len / 2, z).rotation.z = a; return [x - Math.sin(a) * len, y + Math.cos(a) * len]; };  // a bar standing on (x, y), len long, tipped over by a (to the viewer's left when positive); returns its tip
      const Y = (h: number) => P + h;                                                                                                                                   // a height above the plinth
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.2, 0.012, 1.7, 0x3d88e0, 0, 0.1, -0.15);                                                                           // the harbour, its shallows
      const isle = (r: number, h: number, c: number, y: number) => { cyl(g, r, h, c, SX, y, SZ + 0.08).scale.set(1.2, 1, 1); };                                                                 // a round slab of the island, wider than it is deep
      isle(0.95, 0.02, FOAM, 0.1); isle(0.9, 0.14, WALL, 0.1); isle(0.84, 0.03, PATH, 0.24); isle(0.78, 0.03, GRASS, 0.27);                                     // foam round the shore, the seawall, the pink promenade along it, the lawn
      const [N, D] = [11, 0.25];                                                                                                                                // Fort Wood's eleven bastions, each a diamond with this half-diagonal
      for (let k = 0; k < N; k++) { const a = (k * 2 * Math.PI) / N; stone(g, D * Math.SQRT2, 0.22, D * Math.SQRT2, FORT, SX + (0.8 - D) * Math.sin(a), 0.24, SZ + (0.8 - D) * Math.cos(a)).rotation.y = a + Math.PI / 4; }  // the star: a pointed bastion every 33 degrees
      cyl(g, 0.55, 0.22, FORT, SX, 0.24, SZ);                                                                                                                   // the keep inside it
      const ped = (m: typeof stone, w: number, h: number, y: number, c: number, d = w) => m(g, w, h, d, c, SX, y, SZ);                                                                                        // a course of the pedestal, on the monument's axis
      ped(stone, 1.06, 0.07, FY, GRL); ped(stone, 1, 0.07, FY + 0.07, GRL);                                                                                     // the stepped base
      ped(stone, 0.92, 0.32, 0.6, GR); ped(box, 0.99, 0.05, 0.92, GRL);                                                                                         // the lower plinth in rusticated granite, its cornice
      box(g, 0.16, 0.22, 0.02, DARK, SX, 0.62, SZ + 0.47); box(g, 0.22, 0.03, 0.03, GRL, SX, 0.84, SZ + 0.47);                                                  // the doorway and its lintel
      ped(stone, 0.84, 0.22, 0.97, GR); ped(box, 0.9, 0.05, 1.19, GRL);                                                                                         // the dado, a string course
      ped(box, 0.8, 0.46, 1.24, DARK);                                                                                                                          // the loggia: its dark back wall
      for (const s of [-1, 1]) stone(g, 0.12, 0.46, 0.84, GRD, SX + s * 0.34, 1.24, SZ);                                                                        // a rusticated pier at either end
      for (const x of [-0.24, -0.08, 0.08, 0.24]) box(g, 0.07, 0.46, 0.07, GRL, SX + x, 1.24, SZ + 0.41);                                                       // four columns across its front
      ped(box, 0.98, 0.07, 1.7, GRL); ped(box, 1.06, 0.05, 1.77, GR);                                                                                           // the cornice, the balcony slab
      box(g, 1.04, 0.1, 0.04, GRL, SX, 1.82, SZ + 0.51);                                                                                                        // the balustrade along the front
      for (const s of [-1, 1]) { box(g, 0.04, 0.1, 1, GRL, SX + s * 0.51, 1.82, SZ); box(g, 0.07, 0.14, 0.07, GRL, SX + s * 0.51, 1.82, SZ + 0.51); }           // along both sides, a post at each front corner
      ped(stone, 0.8, 0.16, 1.82, GR); ped(box, 0.76, 0.06, 1.98, PAT);                                                                                         // the plinth she stands on, its copper plate
      box(g, 0.14, 0.05, 0.2, PATD, SX + 0.1, P, SZ + 0.12); box(g, 0.14, 0.07, 0.2, PATD, SX - 0.12, P, SZ - 0.1);                                             // her feet, the right one raised behind
      box(g, 0.1, 0.02, 0.05, IRON, SX - 0.04, P, SZ + 0.24); box(g, 0.06, 0.02, 0.04, INK, SX + 0.04, P, SZ + 0.27);                                           // the broken chain at her feet
      box(g, 0.66, 0.1, 0.42, PATD, SX, P, SZ); box(g, 0.58, 0.9, 0.34, PATD, SX, Y(0.1), SZ);                                                                  // the hem of her robe, the skirt
      [[-0.29, 0.1, PAT, 0], [-0.19, 0.13, PATL, 0.03], [-0.06, 0.13, PAT, 0.05], [0.07, 0.12, PATD, 0.03], [0.19, 0.1, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.46, 0.04, c, SX + x + w / 2, Y(0.1), SZ + 0.17 + z));  // folds down the skirt
      [[-0.27, 0.12, PATL, 0.01], [-0.15, 0.14, PAT, 0.04], [-0.01, 0.14, PATD, 0.03], [0.13, 0.12, PAT, 0]].forEach(([x, w, c, z]) => box(g, w, 0.4, 0.04, c, SX + x + w / 2, Y(0.56), SZ + 0.17 + z));  // and over the hips
      box(g, 0.6, 0.3, 0.32, PAT, SX, Y(1), SZ); box(g, 0.52, 0.2, 0.3, PAT, SX - 0.03, Y(1.3), SZ); box(g, 0.36, 0.12, 0.28, PATL, SX - 0.02, Y(1.5), SZ);     // the bodice, narrowing to the shoulders
      rod(SX + 0.3, Y(0.55), 0.95, 0.58, 0.1, PATL, SZ + 0.2, 0.08); rod(SX + 0.14, Y(0.4), 0.8, 0.58, 0.07, PATD, SZ + 0.2, 0.06);                             // two long folds of the cloak across her body, one light, one dark
      box(g, 0.2, 0.36, 0.28, PAT, SX - 0.25, Y(1.4), SZ); box(g, 0.08, 0.5, 0.2, PATL, SX - 0.3, Y(1), SZ + 0.04);                                             // the shoulder under the raised arm, the sleeve's fold hanging down its outside
      const HX = SX - 0.015;                                                                                                                                    // the head's centre line
      box(g, 0.1, 0.16, 0.1, PATL, HX, Y(1.56), SZ);                                                                                                            // the neck
      box(g, 0.18, 0.2, 0.15, PATL, HX, Y(1.7), SZ); box(g, 0.22, 0.26, 0.1, PATD, HX, Y(1.66), SZ - 0.09);                                                     // the face, the hair behind it
      for (const s of [-1, 1]) box(g, 0.05, 0.22, 0.07, PATD, HX + s * 0.12, Y(1.5), SZ);                                                                       // a lock of hair down to either shoulder
      box(g, 0.25, 0.09, 0.19, PATD, HX, Y(1.9), SZ - 0.01);                                                                                                    // the diadem
      [-0.06, 0, 0.06].forEach((x) => box(g, 0.03, 0.05, 0.012, PATDD, HX + x, Y(1.92), SZ + 0.086));                                                           // its windows
      box(g, 0.14, 0.025, 0.012, PATDD, HX, Y(1.82), SZ + 0.076); box(g, 0.035, 0.08, 0.03, PAT, HX, Y(1.74), SZ + 0.085); box(g, 0.07, 0.015, 0.012, PATDD, HX, Y(1.72), SZ + 0.076);  // her stern brow, nose and mouth
      for (const s of [-1, 1]) box(g, 0.03, 0.025, 0.012, PATDD, HX + s * 0.04, Y(1.78), SZ + 0.076);                                                           // the deep-set eyes
      [90, 60, 30, 0, -30, -60, -90].forEach((d) => { const a = (d * Math.PI) / 180; rod(HX - 0.075 * Math.sin(a), Y(1.93) + 0.075 * Math.cos(a), 0.14, a, 0.05, PATL); });  // the seven rays of the crown, fanned out through half a circle
      const [hx] = rod(SX - 0.26, Y(1.65), 0.55, 0.05, 0.1, PAT, SZ + 0.01, 0.12);                                                                              // the raised arm, a hair off the vertical; hx: the torch's centre line
      box(g, 0.13, 0.2, 0.12, PATL, hx, Y(2.12), SZ + 0.02); box(g, 0.07, 0.4, 0.07, PATD, hx, Y(2.1), SZ); box(g, 0.1, 0.035, 0.1, PATDD, hx, Y(2.34), SZ);    // her hand, the torch's handle through it, a collar above the fist
      cyl(g, 0.075, 0.04, PATDD, hx, Y(2.4), SZ); cyl(g, 0.115, 0.035, PATD, hx, Y(2.44), SZ); cyl(g, 0.105, 0.05, PATL, hx, Y(2.475), SZ);                     // the gallery: its bowl, the platter, the railing
      [[0.12, 0.06, DGOLD], [0.14, 0.07, GOLD], [0.1, 0.07, GOLD], [0.06, 0.05, 0xfff6b0]].reduce((y, [w, h, c], i) => { box(g, w, h, w, c, hx + i * 0.01, y, SZ); return y + h; }, Y(2.525));  // the gilded flame, leaning a little, pale at its tip
      rod(SX + 0.27, Y(0.95), 0.62, 0.25, 0.15, PAT, SZ + 0.03, 0.2); box(g, 0.14, 0.1, 0.18, PATD, SX + 0.29, Y(0.9), SZ + 0.04);                              // the other arm, sloping out from the shoulder to the elbow, the cloth gathered there
      box(g, 0.22, 0.4, 0.05, PATD, SX + 0.4, Y(0.98), SZ + 0.2).rotation.z = -0.4; box(g, 0.16, 0.32, 0.03, PATL, SX + 0.4, Y(1.02), SZ + 0.225).rotation.z = -0.4;  // the tablet, tipped outward: its frame, its face
      box(g, 0.08, 0.1, 0.08, PATL, SX + 0.47, Y(1.05), SZ + 0.2);                                                                                              // her hand on its edge
      const fx = 0.72;                                                                                                                                          // the ferry's centre
      box(g, 0.7, 0.1, 0.22, ORANGE, fx, 0.1, 0.74); box(g, 0.72, 0.03, 0.225, INK, fx, 0.1, 0.74); box(g, 0.1, 0.1, 0.16, ORANGE, fx + 0.38, 0.1, 0.74);       // the Staten Island ferry: its orange hull, the dark waterline, the narrow bow
      box(g, 0.58, 0.1, 0.19, WHITE, fx - 0.03, 0.2, 0.74); box(g, 0.52, 0.04, 0.02, NAVY, fx - 0.03, 0.23, 0.84);                                              // the main deck and its windows
      box(g, 0.42, 0.09, 0.16, WHITE, fx - 0.05, 0.3, 0.74); box(g, 0.36, 0.035, 0.02, NAVY, fx - 0.05, 0.33, 0.82); box(g, 0.46, 0.025, 0.18, ORANGE, fx - 0.05, 0.39, 0.74);  // the upper deck, its windows, the orange roof
      box(g, 0.16, 0.09, 0.12, WHITE, fx + 0.2, 0.3, 0.74); box(g, 0.12, 0.04, 0.02, NAVY, fx + 0.2, 0.33, 0.8);                                                // the wheelhouse and its glass
      box(g, 0.1, 0.22, 0.1, ORANGE, fx - 0.18, 0.415, 0.74); box(g, 0.105, 0.03, 0.105, INK, fx - 0.18, 0.635, 0.74);                                          // the funnel, its black cap
      box(g, 0.76, 0.012, 0.03, FOAM, fx, 0.1, 0.86); box(g, 0.08, 0.012, 0.22, FOAM, fx + 0.45, 0.1, 0.74);                                                    // foam along the hull and at the bow
      [[-1, -0.2], [1, -0.2], [-0.86, 0.22]].forEach(([x, z]) => { box(g, 0.05, 0.2, 0.05, WOOD, x, 0.27, z); cyl(g, 0.15, 0.12, 0x2f7a4a, x, 0.42, z); cyl(g, 0.12, 0.11, 0x3f9a5c, x, 0.52, z); cyl(g, 0.07, 0.09, 0x4fb06a, x, 0.61, z); });  // three trees on the island: a trunk and three tiers of leaves
      box(g, 0.03, 0.9, 0.03, 0xdddddd, 0.62, 0.3, 0.3); box(g, 0.05, 0.05, 0.05, GOLD, 0.62, 1.2, 0.3); decal(g, ['uuurrrr', 'uuuwwww', 'rrrrrrr', 'wwwwwww'], 0.8, 1, 0.31);  // the Stars and Stripes on its mast: a blue canton over the stripes
      [[-0.9, 0.78], [-0.4, 0.9], [0.1, 0.93]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                                            // ripples on the harbour
    }),
  ],
  'Las Vegas': [ // Welcome to Fabulous Las Vegas: the diamond sign on its median, seven silver-dollar coins spelling WELCOME across its top, a star between the two poles that carry it, palms and boulders round its foot; behind it the Strat, a concrete tripod under a two-tier glass pod with neon bracing and a red-lit mast; the boulevard in front with a taxi
    final((g) => {
      const [TX, TZ, SX, SZ, SY] = [0.8, -0.5, -0.34, 0.2, 0.99];                                                                                               // the tower's centre line, the sign's, its depth, the foot of its board
      const PLAZA = 0xb9b3a2, PAVE = 0xcfc8b6, KERB = 0xe6e9f0, ASPHALT = 0x3d4254, GRAVEL = 0xb8825c, ROCK = 0xc99a74, CREAM = 0xf0e6bd, CREAM2 = 0xdccfa0, GLASS = 0x34426e, GLASS2 = 0x4a5c92, DOME = 0x6b7391, WHITE = 0xf4f6fa, POLE = 0x4a9ac8, STAR = 0xe8502a, WOOD = 0x8a5a2b;  // paints
      const SIGN = [                                                                                                                                            // the sign's face, 37 x 24: seven coins across the top, WELCOME TO FABULOUS, LAS VEGAS and NEVADA inside a border of bulbs
        '............bbb..bbb..bbb............',
        '.......bbb.bRwwbbRRRbbRRRb.bbb.......',
        '..bbb.bRRRbbRwwbbRwwbbRwRbbRRRb.bbb..',
        '.bRwRbbRRwbbRRRbbRRRbbRRRbbRRRbbRRRb.',
        '.bRRRbbRRRb.bbbwwbbbwwbbb.bRwRbbRRwb.',
        '.bRRRb.bbbyYYwwwwwwwwwwwyYYbbb.bRRRb.',
        '..bbb...yYwwwwwwwwwwwwwwwwwYy...bbb..',
        '......YYuwuwwuwwwuuwwuuwwuuwwyY......',
        '....YywwuuwuuwuuuwwwuwwuwwwuuwwYY....',
        '..yYwwwwuwwwwwwwwwwuwwwwuwwwwwwwwYy..',
        'YYRwwwwRwwwRRwwwRwRwRRRwwRRwwRwwwRRyY',
        'YwRwwwRwRwRwwwwwRwRwRwwwRwwwRwRwRwwwy',
        'YwRwwwRRRwwRwwwwRwRwRRwwRwRwRRRwwRwwY',
        'ywRwwwRwRwwwRwwwRwRwRwwwRwRwRwRwwwRwY',
        'YwRRRwRwRwRRwwwwwRwwRRRwwRRwRwRwRRwwy',
        'YYwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwyY',
        '..YywwwuuuwuuuwuwuwwuwwuuwwwuwwwwYY..',
        '....yYwuwuwuuwwuwuwuuuwuwuwuuuwYy....',
        '......YuwuwuuuwwuwwuwuwuuwwuwuY......',
        '........YywwwwwwwwwwwwwwwwwYY........',
        '..........yYYwwwwwwwwwwwyYY..........',
        '.............yYwwwwwwwYy.............',
        '...............YYwwwyY...............',
        '.................YyY.................',
      ];
      const LENS = [3, 11, 21, 29, 37, 37, 37, 29, 21, 11, 3];                                                                                                  // the width of the board in texels, two rows to a step from its top: the diamond's outline behind rows 2 to 23 of its face
      stone(g, 2.4, 0.1, 1.9, PLAZA); box(g, 2.4, 0.03, 0.4, ASPHALT, 0, 0.1, 0.75);                                                                            // the paved plaza, the boulevard along its front
      [-1, -0.55, -0.1, 0.35, 0.8].forEach((x) => box(g, 0.24, 0.01, 0.04, GOLD, x, 0.13, 0.75));                                                               // its dashed yellow centre line
      stone(g, 1.8, 0.07, 0.74, KERB, SX + 0.04, 0.1, 0.2); box(g, 1.68, 0.03, 0.62, GRAVEL, SX + 0.04, 0.17, 0.2);                                             // the median the sign stands on: its kerb, the gravel bed
      cyl(g, 0.42, 0.05, KERB, TX, 0.1, TZ); cyl(g, 0.34, 0.05, PAVE, TX, 0.15, TZ);                                                                            // the tower's round plinth, in two steps
      cyl(g, 0.12, 3.1, CREAM, TX, 0.14, TZ);                                                                                                                   // the concrete shaft
      for (const a of [Math.PI, (Math.PI * 5) / 3, Math.PI / 3]) {                                                                                              // the three legs, 120 degrees apart: one behind the shaft, two in front
        const fin = (y: number, h: number, L: number) => { const r = 0.08 + L / 2; box(g, 0.08, h, L, CREAM2, TX + r * Math.sin(a), y, TZ + r * Math.cos(a)).rotation.y = a; };         // a slab of a leg, L long, standing off the shaft along this leg's bearing
        for (let i = 0; i < 6; i++) fin(0.14 + i * 0.2, 0.2, 0.34 - 0.04 * i);                                                                                  // the leg, stepping in until it meets the shaft
        for (let i = 0; i < 4; i++) fin(2.8 + i * 0.12, 0.12, 0.16 + 0.07 * i);                                                                                 // the tulip flaring out under the pod
      }
      let y = 3.3;                                                                                                                                              // the height built so far: the foot of the pod
      cyl(g, 0.34, 0.06, 0xe8e4d4, TX, y, TZ); y += 0.06;                                                                                                       // the concrete collar
      [0.28, 0.3, 0.32].forEach((r, i) => cyl(g, r, 0.1, GLASS, TX, y + i * 0.1, TZ));                                                                          // the lower tier of dark glass, widening
      [[-0.2, 0xfff6b0, 0.24], [0, 0x5dfff0, 0.31], [0.2, 0xff5de0, 0.24]].forEach(([x, c, z]) => [-1, 1].forEach((s) => { box(g, 0.03, 0.34, 0.03, c, TX + x, y - 0.02, TZ + z).rotation.z = s * 0.55; }));  // three Xs of neon bracing across its front, following the curve of the drum
      y += 0.3; cyl(g, 0.4, 0.06, WHITE, TX, y, TZ); y += 0.06;                                                                                                 // the white belt between the tiers
      [0.36, 0.39, 0.42, 0.44].forEach((r, i) => cyl(g, r, 0.08, i & 1 ? GLASS2 : GLASS, TX, y + i * 0.08, TZ)); y += 0.32;                                     // the upper tier, flaring wider still
      cyl(g, 0.45, 0.04, WHITE, TX, y, TZ); y += 0.04;                                                                                                          // the roof deck round the dome
      [0.3, 0.26, 0.2, 0.1].forEach((r, i) => cyl(g, r, 0.07, DOME, TX, y + i * 0.07, TZ)); y += 0.28;                                                          // the dome
      for (const x of [-0.04, 0.04]) box(g, 0.035, 0.95, 0.035, 0xff3b3b, TX + x, y, TZ);                                                                       // the mast: two red-lit uprights
      box(g, 0.03, 0.95, 0.03, WHITE, TX, y, TZ); box(g, 0.1, 0.1, 0.1, 0xff3b3b, TX, y + 0.95, TZ); cyl(g, 0.1, 0.05, 0xfff6b0, TX, y + 0.5, TZ);              // a white core between them, the red lamp on its tip, the Big Shot's ring of lights
      LENS.forEach((w, i) => box(g, w / 22, 2 / 22, 0.1, 0xffffff, SX, SY + (20 - 2 * i) / 22, SZ));                                                            // the board's thickness: a white slab behind every two rows of its outline
      part(g, new THREE.PlaneGeometry(37 / 22, 24 / 22), 24 / 22, new THREE.MeshBasicMaterial({ map: sprite(SIGN), alphaTest: 0.5 }), SX, SY, SZ + 0.06).castShadow = false;  // its face, unlit: the sign is lit from inside
      for (const x of [-0.52, -0.16]) box(g, 0.08, 2.32, 0.05, POLE, SX + x, 0.17, SZ - 0.06);                                                                  // the two pale blue poles, off to the left of the board's middle
      box(g, 0.44, 0.07, 0.05, POLE, SX - 0.34, 2.42, SZ - 0.06);                                                                                               // the crossbar joining them above the board
      const arm = (w: number, h: number, a: number) => { box(g, w, h, 0.05, STAR, SX - 0.34, 2.17 - h / 2, SZ + 0.02).rotation.z = a; };                                                // a bar through the star's centre, tipped over by a
      arm(0.6, 0.08, 0); arm(0.08, 0.6, 0); arm(0.42, 0.07, Math.PI / 4); arm(0.42, 0.07, -Math.PI / 4);                                                        // the eight-pointed star between the poles: a flat bar, an upright one, two diagonals
      [[0, 0.3], [0, -0.3], [0.3, 0], [-0.3, 0]].forEach(([x, dy]) => box(g, 0.06, 0.06, 0.06, 0xfff6b0, SX - 0.34 + x, 2.14 + dy, SZ + 0.02));                 // its yellow neon tips
      const palm = (x: number, z: number, h: number, n = 6) => {                                                                                                                        // a date palm h tall with n arching fronds
        for (let i = 0; i < 4; i++) box(g, 0.08 - 0.006 * i, h / 4, 0.08 - 0.006 * i, i & 1 ? WOOD : 0x7a4a22, x + 0.015 * i, 0.2 + (i * h) / 4, z);            // the trunk: four banded sections, tapering and leaning a little
        box(g, 0.12, 0.08, 0.12, 0x5a3a1a, x + 0.06, 0.16 + h, z);                                                                                              // the knot of the crown
        for (let k = 0; k < n; k++) {                                                                                                                           // each frond
          const a = (k * 2 * Math.PI) / n + 0.3; let [px, py, pz] = [x + 0.06, 0.2 + h, z];                                                                     // its bearing, where it has got to
          [[0.2, -0.3], [0.26, 0.9]].forEach(([L, p], j) => {                                                                                                   // two stretches: first rising a little, then drooping by p
            const [dx, dy, dz] = [Math.sin(a) * Math.cos(p) * L, -Math.sin(p) * L, Math.cos(a) * Math.cos(p) * L];                                              // the way the stretch runs
            const f = box(g, 0.09, 0.025, L, (k + j) & 1 ? 0x2fa84f : 0x4cc36b, px + dx / 2, py + dy / 2 - 0.0125, pz + dz / 2);                                // a blade of leaf, light and dark in turn
            f.rotation.order = 'YXZ'; f.rotation.set(p, a, 0);                                                                                                  // pitched down by p, then turned to its bearing
            px += dx; py += dy; pz += dz;                                                                                                                       // the next stretch starts where this one ends
          });
        }
      };
      palm(0.15, -0.05, 1.9); palm(-1.02, 0.5, 0.7, 5); palm(0.5, 0.5, 0.7, 5);                                                                                 // a tall palm rising behind the sign, a small one at either front corner of the median
      const rock = (x: number, z: number, s: number) => { box(g, 0.22 * s, 0.1 * s, 0.16 * s, ROCK, x, 0.2, z); box(g, 0.14 * s, 0.08 * s, 0.11 * s, 0xb5835e, x + 0.03 * s, 0.2 + 0.1 * s, z).rotation.y = 0.5; box(g, 0.07 * s, 0.05 * s, 0.07 * s, 0xd8b08c, x - 0.03 * s, 0.2 + 0.18 * s, z).rotation.y = -0.4; };  // a boulder s big: a block, a smaller turned one and a chip piled on it
      rock(-0.78, 0.46, 1.2); rock(0.2, 0.5, 1); rock(-0.5, 0, 0.8);                                                                                            // three on the gravel
      const [cx, cz] = [0.6, 0.82];                                                                                                                             // the taxi's centre
      box(g, 0.44, 0.09, 0.2, 0xf2c230, cx, 0.13, cz); box(g, 0.24, 0.09, 0.18, 0xf2c230, cx - 0.02, 0.22, cz); box(g, 0.2, 0.05, 0.19, 0x1a2250, cx - 0.02, 0.24, cz);  // the taxi: its yellow body and cabin, the dark glass round it
      box(g, 0.08, 0.03, 0.06, 0xffffff, cx - 0.02, 0.31, cz); [-0.14, 0.14].forEach((dx) => [-0.1, 0.1].forEach((dz) => box(g, 0.08, 0.07, 0.03, 0x23263a, cx + dx, 0.1, cz + dz)));  // its roof light, its four wheels
    }),
  ],
  Rio: [ // Christ the Redeemer: the soapstone statue, arms spread, on its chapel pedestal and viewing terrace (visitors posing arms wide) on the granite summit of Corcovado, the rainforest mountain with its stair and flowering ipês rising from Guanabara Bay; behind its shoulder the Sugarloaf and its red cable car, on the beach palms and the Brazilian flag, a sailboat in the bay
    final((g) => {
      const [SX, SZ, H, D] = [0, -0.15, 0.115, 0.7];                                                                                                            // the statue's centre line, the height of a tier of the mountain, how deep a tier is for its width
      const WATER = 0x2c6fd2, FOAM = 0xdcefff, SAND = 0xf0dca0, STAIR = 0xdcd0b0, GR = 0xcbc3ae, GRL = 0xded8c6, DARK = 0x3f392e, WOOD = 0x6e3a12, WHITE = 0xf4f6fa;  // paints: bay, foam, beach, the stair's stone, granite in two tones, the doorway's shade, trunks, white
      const SOAP = 0xf0f4ec, SOAPL = 0xfcfdf9, SOAPD = 0xcad5cc, SOAPDD = 0x96a79a;                                                                             // the statue's soapstone in four tones
      const RX = [0.98, 0.93, 0.87, 0.81, 0.75, 0.69, 0.63, 0.58, 0.54, 0.5, 0.46];                                                                             // the half-width of each tier of the mountain, from the shore up
      const LEAF = [0x2a7f48, 0x2f8a4e, 0x359654, 0x3ba35a, 0x42b062, 0x4abd6a, 0x55ca75], ROCK = [0xb2a994, 0xa39b88, 0x948c7a, 0x877f6f];                     // the forest's greens climbing, then the four granite tiers of the crown
      const T = 0.12 + RX.length * H, P = T + 0.65, Y = (h: number) => P + h;                                                                                           // the summit, the top of the pedestal, a height above it
      const Z = (k: number) => SZ + D * RX[k] * 0.951;                                                                                                                  // where the flat front face of tier k stands
      const topAt = (x: number, z: number) => 0.12 + H * (1 + Math.max(-1, ...RX.map((rx, i) => (((x - SX) / rx) ** 2 + ((z - SZ) / (rx * D)) ** 2 < 0.8 ? i : -1))));          // the height of the mountain at (x, z)
      const DECAGON = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, Math.PI / 10);                                                                          // a unit slab with a flat face to the front, stretched into ellipses
      const slab = (rx: number, rz: number, x: number, z: number, y: number, h: number, c: number) => part(g, DECAGON, h, mat(c), x, y, z).scale.set(rx, h, rz);                                                        // an elliptical slab rx wide, rz deep
      box(g, 2.4, 0.1, 1.9, WATER); box(g, 2.2, 0.012, 1.7, 0x3d88e0, 0, 0.1, -0.15);                                                                           // Guanabara Bay, its shallows
      slab(1.1, 1.1 * D, SX, SZ, 0.1, 0.02, FOAM); slab(1.06, 1.06 * D, SX, SZ, 0.1, 0.04, SAND); slab(0.85, 0.26, SX, SZ + 0.6, 0.1, 0.05, SAND);              // foam round the shore, the beach, the sand spit in front
      RX.forEach((rx, i) => slab(rx, rx * D, SX, SZ, 0.12 + i * H, H, i < 7 ? LEAF[i] : ROCK[i - 7]));                                                          // the mountain: seven tiers of forest under four of granite
      RX.forEach((_, k) => box(g, 0.16, H, 0.14, STAIR, SX, 0.12 + k * H, Z(k) - 0.04));                                                                        // the stair of pale stone up its front face
      [[0.24, 0x2a7f48], [0.24, 0x359654], [0.22, 0xb5aa98], [0.19, 0xc4baa8], [0.15, 0xb5aa98], [0.1, 0xc4baa8], [0.05, 0xb5aa98]].forEach(([r, c], i) => slab(r, r * 0.8, 0.96, -0.66, 0.1 + i * 0.12, 0.12, c));  // Sugarloaf behind the mountain's shoulder: green flanks, a rounded granite dome
      box(g, 0.1, 0.06, 0.07, 0xe43b44, 0.96, 0.94, -0.66);                                                                                                     // the red cable car at its summit
      const rock = (x: number, z: number, s: number) => { const y = topAt(x, z); box(g, 0.2 * s, 0.1 * s, 0.14 * s, 0xa39b88, x, y, z); box(g, 0.12 * s, 0.08 * s, 0.1 * s, 0xb2a994, x + 0.03 * s, y + 0.1 * s, z).rotation.y = 0.5; };  // a boulder s big: a block and a smaller turned one on it
      rock(-0.5, SZ + 0.1, 1.2); rock(0.5, SZ + 0.08, 1); rock(-0.28, SZ + 0.2, 0.8);                                                                           // three on the granite ledges
      const CROWN = [[0x2f7a4a, 0x3f9a5c, 0x4fb06a], [0x277043, 0x358f55, 0x45a862], [0xe0a020, 0xf4c430, 0xffe066]];                                           // a tree's three tiers of leaves: two greens, and an ipê in yellow bloom
      const tree = (x: number, z: number, s: number, c: number) => { const y = topAt(x, z); [[0.15, 0.12], [0.12, 0.11], [0.08, 0.1]].forEach(([r, h], i) => cyl(g, r * s, h * s, CROWN[c][i], x, y + (0.03 + i * 0.09) * s, z)); };  // three tiers of leaves down to the ground, s big
      for (let i = 0; i < 26; i++) { const a = i * 2.4, t = Math.sqrt((i + 0.5) / 26), x = SX + t * 0.92 * Math.cos(a), z = SZ + t * 0.64 * Math.sin(a); if (t > 0.6 && (Math.abs(x - SX) > 0.2 || z < SZ)) tree(x, z, 0.8 + (i % 3) * 0.12, i % 7 === 3 ? 2 : i & 1); }  // the jungle: trees spread over the slopes a golden angle apart, the stair kept clear
      stone(g, 1, 0.08, 0.74, GRL, SX, T, SZ); box(g, 0.96, 0.08, 0.04, GR, SX, T + 0.08, SZ + 0.34);                                                           // the viewing terrace on the summit, its balustrade along the front
      for (const s of [-1, 1]) box(g, 0.04, 0.08, 0.7, GR, SX + s * 0.48, T + 0.08, SZ);                                                                        // and along both sides
      stone(g, 0.72, 0.06, 0.54, GR, SX, T + 0.08, SZ); stone(g, 0.54, 0.46, 0.4, GR, SX, T + 0.14, SZ); box(g, 0.62, 0.05, 0.48, GRL, SX, T + 0.6, SZ);        // the pedestal: its footing, the chapel in granite, the cornice
      box(g, 0.1, 0.18, 0.02, DARK, SX, T + 0.14, SZ + 0.2); box(g, 0.15, 0.03, 0.03, GRL, SX, T + 0.32, SZ + 0.2);                                             // the chapel door and its lintel
      [[-0.32, 0xe43b44], [-0.14, 0xffd23f], [0.15, 0x41a6f6], [0.33, 0x38b764]].forEach(([x, c]) => { box(g, 0.05, 0.08, 0.04, c, SX + x, T + 0.08, SZ + 0.26); box(g, 0.04, 0.04, 0.04, 0xf5b88c, SX + x, T + 0.16, SZ + 0.26); box(g, 0.12, 0.02, 0.025, c, SX + x, T + 0.145, SZ + 0.26); });  // visitors posing with their arms wide: shirt, head, arms
      box(g, 0.4, 0.14, 0.28, SOAPD, SX, P, SZ); box(g, 0.37, 0.41, 0.25, SOAP, SX, Y(0.14), SZ); box(g, 0.34, 0.4, 0.23, SOAP, SX, Y(0.55), SZ); box(g, 0.31, 0.35, 0.21, SOAP, SX, Y(0.95), SZ);  // the robe: the hem, three stages narrowing
      [[-0.13, SOAPD], [-0.045, SOAPL], [0.045, SOAPD], [0.13, SOAPL]].forEach(([x, c]) => box(g, 0.075, 1.1, 0.03, c, SX + x, Y(0.16), SZ + 0.115));           // folds down its front
      box(g, 0.35, 0.32, 0.2, SOAPL, SX, Y(1.3), SZ);                                                                                                           // the chest and shoulders
      const sleeve = (s: number) => new THREE.ExtrudeGeometry(new THREE.Shape([[0.17, 1.612], [0.694, 1.535], [0.694, 1.47], [0.56, 1.28], [0.17, 1.28]].map(([x, y]) => new THREE.Vector2(s * x, Y(y)))), { depth: 0.15, bevelEnabled: false }).translate(0, 0, -0.075);  // a sleeve in profile: the top sloping to the wrist, a flat hem, the cuff cut steeply back up to the wrist
      for (const s of [-1, 1]) {                                                                                                                                // an arm either side: the sleeve, then the thin hand past its cuff
        part(g, sleeve(s), 0, mat(SOAP), SX, 0, SZ);
        box(g, 0.14, 0.065, 0.085, SOAPL, SX + s * 0.75, Y(1.47), SZ); box(g, 0.12, 0.05, 0.075, SOAP, SX + s * 0.88, Y(1.475), SZ); box(g, 0.07, 0.035, 0.04, SOAPL, SX + s * 0.74, Y(1.535), SZ + 0.025);  // the hand: palm, fingers, thumb on top
      }
      box(g, 0.1, 0.1, 0.1, SOAPD, SX, Y(1.6), SZ); box(g, 0.18, 0.22, 0.17, SOAP, SX, Y(1.67), SZ); box(g, 0.2, 0.05, 0.19, SOAPD, SX, Y(1.86), SZ - 0.005);   // the neck, the head, the hair on top
      for (const s of [-1, 1]) box(g, 0.035, 0.27, 0.18, SOAPD, SX + s * 0.11, Y(1.6), SZ - 0.01);                                                              // long locks down to the shoulders
      box(g, 0.14, 0.02, 0.02, SOAPDD, SX, Y(1.8), SZ + 0.09); box(g, 0.03, 0.08, 0.03, SOAPL, SX, Y(1.7), SZ + 0.095); box(g, 0.1, 0.1, 0.05, SOAPD, SX, Y(1.58), SZ + 0.08);  // the brow, the nose, the beard
      const palm = (x: number, z: number, h: number) => {                                                                                                                               // a palm h tall on the beach: a trunk in three leaning sections, five drooping fronds
        for (let i = 0; i < 3; i++) box(g, 0.08 - 0.008 * i, h / 3, 0.08 - 0.008 * i, i & 1 ? WOOD : 0x7a4a22, x + 0.025 * i, 0.15 + (i * h) / 3, z);
        for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5 + 0.3; box(g, 0.11, 0.025, 0.36, k & 1 ? 0x2fa84f : 0x4cc36b, x + 0.08 + Math.sin(a) * 0.16, 0.11 + h, z + Math.cos(a) * 0.16).rotation.set(0.45, a, 0, 'YXZ'); }
      };
      palm(-0.7, SZ + 0.62, 0.7); palm(-0.5, SZ + 0.7, 0.5);                                                                                                    // two on the beach
      const BR = ['mmmmYYYmmmm', 'mmYYuuuYYmm', 'mYYuuuuuYYm', 'YYYwwwwwYYY', 'mYYuuuuuYYm', 'mmYYuuuYYmm', 'mmmmYYYmmmm'];                                     // Brazil's green field, yellow rhombus and blue globe with its white band
      box(g, 0.03, 0.8, 0.03, 0xdddddd, 0.3, 0.15, 0.52); decal(g, BR, 0.3 + 11 / 44, 0.62, 0.52);                                                              // the flag on its pole
      const [bx, bz] = [0.78, 0.82];                                                                                                                            // the sailboat's centre
      box(g, 0.38, 0.06, 0.13, WHITE, bx, 0.1, bz); box(g, 0.39, 0.02, 0.135, 0x2b68d4, bx, 0.1, bz); box(g, 0.08, 0.06, 0.09, WHITE, bx + 0.22, 0.1, bz);      // the sailboat: hull, its blue waterline, the narrow bow
      box(g, 0.16, 0.05, 0.1, 0xdce4ff, bx - 0.03, 0.16, bz); box(g, 0.02, 0.5, 0.02, 0xdddddd, bx, 0.16, bz);                                                  // the cabin, the mast
      decal(g, ['.....w', '....ww', '....ww', '...www', '...www', '..wwww', '..wwww', '.wwwww', '.wwwww', 'wwwwww'], bx - 3 / 22 - 0.01, 0.2, bz); decal(g, ['R...', 'RR..', 'RR..', 'RRR.', 'RRR.', 'RRRR', 'RRRR'], bx + 2 / 22 + 0.02, 0.2, bz);  // the mainsail, the red jib
      [[-0.9, 0.85], [0.3, 0.9], [1.0, 0.65]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                                             // ripples on the bay
    }),
  ],
  Jerusalem: [ // Dome of the Rock: the octagonal shrine in marble and blue Ottoman tile, a frieze of white script under its battlements, a porch on three of its faces and a gilded dome on its windowed drum under a crescent; on the limestone platform of the Temple Mount, with its stair, a free-standing arch at each front corner, the Dome of the Chain, cypresses, olives, pilgrims and doves
    final((g) => {
      const [CX, CZ, PY] = [0, -0.2, 0.236];                                                                                                                    // the shrine's centre line, the top of the platform it stands on
      const A = (12 / 44) * (1 + Math.SQRT2), C8 = Math.cos(Math.PI / 8), Y0 = PY + 0.09, DY = Y0 + 0.63;                                                       // the octagon's apothem (a side is 12 texels), cos 22.5°, the foot of its walls, the foot of the drum
      const PLAZA = 0xd5c9ab, DECK = 0xe6dabb, TRIM = 0xf4eedb, MARBLE = 0xf0e9d4, BLUE = 0x2b68d4, LEAD = 0x8e97ab, LEAD2 = 0xa9b1c4, DGOLD = 0xf0a020, GLASS = 0x1a2250, WOOD = 0x6e3a12, WHITE = 0xf4f6fa;  // paints: plaza and platform limestone, trim and marble, tile blue, lead in two tones, the dome's darker gold, the windows' shade, trunks, white
      const CYPRESS = [0x1f5a3a, 0x2a6e45, 0x35804f], OLIVE = [0x6f8f5a, 0x8aa86c, 0xa3bf86];                                                                   // the greens of the cypresses and of the olive leaves, dark to light
      const FACE = [                                                                                                                                            // an octagon's face, 12 x 11 texels: a frieze of white script on navy, three tiled windows over a string course, three marble panels
        'eaaeaeaaeaae', 'eeaeaaeeaeea',
        'LuaaLaauaaLu', 'uLOOuOOLOOuL', 'LueOLeOueOLu', 'uLeOueOLeOuL', 'LuaaLaauaaLu',
        'xxxxxxxxxxxx', 'xxbaxbaxbaxx', 'xxbaxbaxbaxx', 'aaaaaaaaaaaa',
      ];
      const PORTAL = ['..xxx..', '.xOOOx.', 'xxOOOxx', 'xOOOOOx', 'xOOYOOx', 'xOOOOOx', 'xOOOOOx'];                                                             // a porch's pointed doorway
      const OCT = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, Math.PI / 8), ROUND = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, Math.PI / 16);       // unit slabs with a flat face to the front: an octagon, a 16-gon
      const ARCH = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(-0.22, 0).lineTo(-0.22, 0.26).quadraticCurveTo(-0.16, 0.42, 0, 0.58).quadraticCurveTo(0.16, 0.42, 0.22, 0.26).lineTo(0.22, 0).lineTo(0.14, 0).lineTo(0.14, 0.26).quadraticCurveTo(0.1, 0.36, 0, 0.47).quadraticCurveTo(-0.1, 0.36, -0.14, 0.26).lineTo(-0.14, 0), { depth: 0.08, bevelEnabled: false });  // a free-standing pointed arch, 0.44 wide and 0.58 tall: the outline of a lancet, extruded
      const MOON = new THREE.TorusGeometry(0.1, 0.024, 4, 10, 4.7);                                                                                             // the finial's crescent: a ring open at the top
      const at = (a: number, r: number, t = 0) => [CX + Math.sin(a) * r + Math.cos(a) * t, CZ + Math.cos(a) * r - Math.sin(a) * t];                                             // the point r out from the shrine's axis at angle a from the south, t along the face's tangent
      const oct = (a: number, h: number, c: number, y: number) => { part(g, OCT, h, mat(c), CX, y, CZ).scale.set(a / C8, h, a / C8); };                                                         // an octagonal slab of apothem a, on the shrine's axis
      const disc = (r: number, h: number, c: number, y: number, x = CX, z = CZ) => { part(g, ROUND, h, mat(c), x, y, z).scale.set(r, h, r); };                                                  // a round slab of radius r
      const porch = (a: number) => { const [x, z] = at(a, A + 0.06), [px, pz] = at(a, A + 0.162); stone(g, 0.318, 0.318, 0.2, MARBLE, x, Y0, z).rotation.y = a; box(g, 0.41, 0.04, 0.28, LEAD, x, Y0 + 0.318, z).rotation.y = a; decal(g, PORTAL, px, Y0, pz).rotation.y = a; };  // the porch on the face at angle a: a marble block, its lead roof, the doorway
      stone(g, 2.4, 0.1, 1.9, PLAZA);                                                                                                                           // the plaza
      stone(g, 2.2, 0.136, 1.6, DECK, 0, 0.1, -0.1);                                                                                                            // the platform of the mount, flagged in limestone
      [0, 1, 2].forEach((k) => stone(g, 0.64, 0.0455 * (k + 1), 0.083, DECK, CX, 0.1, 0.9075 - 0.083 * k));                                                    // its stair: three steps
      oct(A + 0.09, 0.045, PLAZA, PY); oct(A + 0.045, 0.045, 0xe6dcc3, PY + 0.045);                                                                             // the shrine's plinth, two steps
      oct(A, 0.182, MARBLE, Y0); oct(A, 0.318, BLUE, Y0 + 0.182); oct(A + 0.04, 0.045, TRIM, Y0 + 0.5);                                                         // the walls: marble below, blue tile above; the cornice
      [0, 1, -1, 2, -2].forEach((k) => { const a = (k * Math.PI) / 4, [x, z] = at(a, A + 0.015); decal(g, FACE, x, Y0, z).rotation.y = a; });                  // the tiled face to the south, the two beside it and the two to east and west
      for (let k = 0; k < 8; k++) for (const t of [-0.19, 0, 0.19]) { const a = (k * Math.PI) / 4, [x, z] = at(a, A + 0.01, t); box(g, 0.09, 0.08, 0.05, TRIM, x, Y0 + 0.545, z).rotation.y = a; }  // the battlements: three merlons on each side
      oct(A - 0.04, 0.045, LEAD, Y0 + 0.545); oct(A - 0.15, 0.04, LEAD2, Y0 + 0.59);                                                                            // the lead roof, in two steps
      [0, Math.PI / 2, -Math.PI / 2].forEach(porch);                                                                                                           // the porches: south, east and west
      disc(0.4, 0.3, BLUE, DY); disc(0.44, 0.03, DGOLD, DY + 0.3);                                                                                              // the drum, its gold band
      for (let k = -4; k <= 4; k++) { const a = (k * Math.PI) / 8, [x, z] = at(a, 0.397); box(g, 0.06, 0.14, 0.03, GLASS, x, DY + 0.08, z).rotation.y = a; }    // nine of its sixteen windows
      Array.from({ length: 14 }, (_, i) => 0.42 * Math.sqrt(1 - ((i + 0.5) / 14) ** 2.4)).forEach((r, i) => disc(r, 0.04, i & 1 ? 0xf6c534 : GOLD, DY + 0.33 + i * 0.04));  // the dome: fourteen slices of a flattened hemisphere, in two golds
      box(g, 0.03, 0.14, 0.03, GOLD, CX, DY + 0.87, CZ); disc(0.045, 0.05, GOLD, DY + 0.97); part(g, MOON, 0, mat(0xfff6b0), CX, DY + 1.12, CZ).rotation.z = Math.PI / 2 + (2 * Math.PI - 4.7) / 2;  // the finial: a mast, its ball and the crescent opening upward
      for (const s of [-1, 1]) part(g, ARCH, 0, mat(TRIM), s * 0.88, PY, 0.58);                                                                                 // an arch at each front corner of the platform
      const [DX, DZ] = [0.92, 0.26];                                                                                                                            // the Dome of the Chain: its centre
      disc(0.16, 0.04, TRIM, PY, DX, DZ); disc(0.15, 0.03, TRIM, PY + 0.2, DX, DZ);                                                                             // its base and its entablature
      for (let k = 0; k < 8; k++) box(g, 0.03, 0.16, 0.03, TRIM, DX + Math.sin((k * Math.PI) / 4) * 0.13, PY + 0.04, DZ + Math.cos((k * Math.PI) / 4) * 0.13);  // eight slim columns
      [0.15, 0.135, 0.105, 0.06].forEach((r, i) => disc(r, 0.04, i & 1 ? LEAD2 : LEAD, PY + 0.23 + i * 0.04, DX, DZ)); box(g, 0.02, 0.07, 0.02, GOLD, DX, PY + 0.39, DZ);  // its lead dome and finial
      const cypress = (x: number, z: number, h: number) => [0.08, 0.1, 0.1, 0.085, 0.06, 0.03].forEach((r, i) => cyl(g, (r * h) / 0.9, h / 6, CYPRESS[i % 3], x, PY + (i * h) / 6, z));  // a cypress h tall: six tiers of a dark flame
      cypress(-0.95, -0.5, 1); cypress(-0.97, 0.12, 0.75); cypress(1, -0.55, 0.9);                                                                              // three of them either side of the shrine
      const olive = (x: number, z: number) => { box(g, 0.05, 0.16, 0.05, WOOD, x, 0.1, z); [[0.15, 0.11], [0.12, 0.09], [0.08, 0.08]].forEach(([r, h], i) => cyl(g, r, h, OLIVE[i], x, 0.2 + i * 0.08, z)); };  // an olive: a trunk, three tiers of silver-green leaves
      olive(-1.06, 0.84); olive(1.06, 0.84);                                                                                                                    // one at each front corner of the plaza
      const pilgrim = (x: number, z: number, c: number) => { box(g, 0.07, 0.11, 0.06, c, x, PY, z); box(g, 0.05, 0.05, 0.05, 0xf5b88c, x, PY + 0.11, z); box(g, 0.056, 0.02, 0.056, c, x, PY + 0.15, z); };  // a pilgrim: body, head and cap
      pilgrim(-0.45, 0.55, 0x3b5dc9); pilgrim(0.5, 0.5, 0xf4f6fa);                                                                                              // two on the platform, one in blue and one in white
      const dove = (x: number, z: number) => { box(g, 0.07, 0.04, 0.04, WHITE, x, PY, z); box(g, 0.03, 0.03, 0.03, WHITE, x + 0.045, PY + 0.03, z); };                          // a dove: body and head
      dove(-0.6, 0.62); dove(0.62, 0.56); dove(0.2, 0.66);                                                                                                      // three of them
    }),
  ],
};

const CARD_GEO = new THREE.PlaneGeometry(CARD.w, CARD.d).rotateX(-Math.PI / 2);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
// START's slab, two cells wide: its long walls (the +z and -z faces, vertices 16-23) repeat their courses of stone over the extra length, so no stone is stretched
const START_GEO = twoGroups(new THREE.BoxGeometry(WIDE, SLAB, SZ)), START_UV = START_GEO.attributes.uv;
for (let i = 16; i < 24; i++) START_UV.setX(i, (START_UV.getX(i) * WIDE) / SZ);
// The tile cursor (hover, selection) is a bracket at each corner of the cell: an L of voxels, its corner at the origin and its two arms (30 texels long, 6 across and tall) along +x and +z.
// A line one pixel wide breaks into dashes and stairs on the half-size buffer and is cut by whatever stands before it; blocks are drawn like everything else, and the ink pass gives them their edges.
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]], ARM = 30 / DENSITY, BAR = 6 / DENSITY;
const BRACKET_Y = PAD.h + BAR / 2; // they hover just over the plot's top, so that the one at the plot's corner does not sink into it
const BRACKET = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(0, 0).lineTo(ARM, 0).lineTo(ARM, BAR).lineTo(BAR, BAR).lineTo(BAR, ARM).lineTo(0, ARM), { depth: BAR, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, BAR, 0);

// ---- Board ----
export function createBoard() {
  const root = new THREE.Group();
  scene.add(root);
  const cursor = (color: number) => { // four brackets, each turned to its corner by a negative scale (arms pointing in)
    const g = new THREE.Group(), m = toon(color);
    CORNERS.forEach(([x, z]) => { const b = new THREE.Mesh(BRACKET, m); b.scale.set(-x, 1, -z); g.add(b); });
    g.visible = false; scene.add(g); return g;
  };
  const hoverCursor = cursor(0xffffff), selCursor = cursor(0xffe066);
  // START is two cells wide, its own and the wing (the loop's last cell): one slab over both, so the ground, the walls and the finish line run across the join.
  const tiles = TILES.map((t) => {
    const g = new THREE.Group(), wide = !t.i;
    g.position.set(POS[t.i].x, 0, POS[t.i].z);
    g.userData = { lift: 0 };
    const side = lodMap(toon(t.color), sideTex);
    const ground = lodMap(toon(0xffffff), (L) => (wide ? startTex(t.color, L) : groundTex(t.type, t.kind, t.color, L))); // lit: buildings and tokens cast their shadows on it
    const slab = new THREE.Mesh(wide ? START_GEO : slabGeo(SZ, SLAB, SZ), [side, ground]);
    slab.position.y = (TOP - 0.8) / 2;
    slab.receiveShadow = slab.castShadow = true;
    const card = new THREE.Mesh(CARD_GEO, lodMap(new THREE.MeshBasicMaterial(), (L) => cardTex(t, L))); // unlit: exact colours, no shadow smudges
    card.position.set(CARD.x, TOP + 0.03, CARD.z);
    if (wide) { slab.position.add(MID); card.position.add(home(0)).sub(POS[0]); } // START: the slab spans its own cell and the wing, the card stands in the wing and the props in its own cell
    const pad = t.type === 'public' ? null : new THREE.Mesh(slabGeo(PAD.w, PAD.h, PAD.d), padMats(VACANT)); // the plot: city tiles only
    if (pad) { pad.position.set(PAD.x, TOP + PAD.h / 2, PAD.z); pad.castShadow = pad.receiveShadow = true; }
    const props = new THREE.Group(), bld = new THREE.Group();
    props.position.set(LOT.x, TOP + (pad ? PAD.h : 0), LOT.z); bld.position.copy(props.position);
    const key = PROPS[t.name] ? t.name : t.kind; // every special city and every carrier has a model of its own; the rest share one per kind
    K = FIT[key] ?? PK;
    for (const r of PROPS[key] ?? []) typeof r === 'function' ? r(props) : box(props, r[1], r[2], r[3], r[0], r[4], r[5], r[6]);
    K = 1;
    bake(props);
    g.add(slab, card, props, bld);
    if (pad) g.add(pad);
    root.add(g);
    if (pad) { sign(bld); bake(bld); }
    return { g, slab, card, props, side, tint: [ground, card.material], pad, bld, key: '', pop: 1 };
  });
  type Plot = (typeof tiles)[number];
  // A new owner or a new level: the building rises from the plot, squashed wide and flat first, with a little overshoot (ease out back)
  const squash = (o: Plot) => { const e = 1 + 2.70158 * (o.pop - 1) ** 3 + 1.70158 * (o.pop - 1) ** 2; o.bld.scale.set(1 + (1 - e) * 0.3, Math.max(e, 0.01), 1 + (1 - e) * 0.3); };

  // Far level: the cards' codes are stamped on a canvas laid over the 3D one (same size, same pixels), see drawCode
  const over = Object.assign(document.createElement('canvas'), { id: 'codes' }), ctx = over.getContext('2d')!, at = new THREE.Vector3();
  renderer.domElement.after(over);
  let shown = false;
  function codes(on: boolean, across: number, down: number) { // put every card's code over it, or take them off (the zoom has left the far level, or there is no lettering, see labels)
    if (!on && !shown) return;
    const { width: w, height: h } = renderer.domElement; // the overlay has the 3D canvas's own pixels
    if (over.width !== w || over.height !== h) { over.width = w; over.height = h; }
    ctx.clearRect(0, 0, w, h);
    shown = on;
    if (!shown) return;
    const k = (w * camera.zoom) / (camera.right - camera.left), ph = down * k * Math.cos(controls.getPolarAngle()); // pixels per world unit, and the card's height on screen
    tiles.forEach((o, i) => {
      const [x, y] = toScreen(o.card.getWorldPosition(at)).map((v) => (v * w) / innerWidth);
      if (x > -30 && x < w + 30 && y > -20 && y < h + 20) drawCode(ctx, TILES[i], x, y, ph, across * k, (o.card.material.color.getHex() & 255) / 255); // last: how bright the card looks (mortgaged = half)
    });
  }

  // Mid and near levels: the lettering (the name of each card) is laid over the scene as quads, flat on the card.
  // They are in the 3D scene, so a token standing in front of a card hides its lettering; they write no depth, so the ink pass never sees them.
  const FLAT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), BLANK = pixelTexture(canvas(1, 1, () => {})), texts = new Map<string, THREE.Texture>(), quads: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const quad = () => { const m = new THREE.Mesh(FLAT, new THREE.MeshBasicMaterial({ map: BLANK, transparent: true, depthWrite: false })); scene.add(m); return m; };
  const right = new THREE.Vector3(), away = new THREE.Vector3(), look = new THREE.Vector3(), c = new THREE.Vector3();
  function names(on: boolean, across: number, down: number) {
    let n = 0; // quads in use
    if (on) {
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements, u = (camera.top - camera.bottom) / (camera.zoom * renderer.domElement.height); // world units per pixel
      const cos = Math.hypot(e[4], e[6]), theta = Math.atan2(-e[2], e[0]); // a length along the ground looks this much shorter up the screen; the camera's azimuth
      right.set(e[0], 0, e[2]); away.set(e[4], 0, e[6]).divideScalar(cos); look.set(e[8], e[9], e[10]);
      // Block b is centred on c. Each quad is turned to the camera's azimuth, which squares it with the cards (see labels), so it shows as an upright rectangle, sized so that one of its texels is
      // one buffer pixel, and moved to the pixel lattice that render() puts the camera on (see snap): each texel then covers exactly one pixel, whatever the zoom or tilt.
      const lay = (b: Block, tint: THREE.Color) => {
        const m = (quads[n] ??= quad());
        c.addScaledVector(look, 0.02); // toward the camera, so it stays where it is on screen: clear of the card
        const x = c.dot(right) / u, y = (c.x * e[4] + c.y * e[5] + c.z * e[6]) / u, fx = (b.w & 1) / 2, fy = (b.h & 1) / 2; // where c is on the lattice, in pixels
        c.addScaledVector(right, (Math.round(x - fx) + fx - x) * u).addScaledVector(away, ((Math.round(y - fy) + fy - y) * u) / cos);
        m.material.color.copy(tint);
        m.position.copy(c); m.rotation.y = theta; m.scale.set(b.w * u, 1, (b.h * u) / cos);
        m.material.map = texts.get(b.key) ?? texts.set(b.key, pixelTexture(canvas(b.w, b.h, b.draw))).get(b.key)!;
        m.visible = true;
        n++;
      };
      tiles.forEach((o, i) => {
        const p = o.card.getWorldPosition(c).project(camera);
        if (Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return;
        for (const b of cardText(TILES[i], across / u, (down * cos) / u)) {
          c.setFromMatrixPosition(o.card.matrixWorld).addScaledVector(away, (0.5 - b.y) * down);
          lay(b, o.card.material.color);
        }
      });
    }
    for (let i = n; i < quads.length; i++) quads[i].visible = false;
  }

  function setOwner(i: number, st: { color: number; lv: number; m: boolean } | null) {
    const t = TILES[i], o = tiles[i];
    if (t.type === 'public') return;
    const key = st ? `${st.color}|${st.lv}` : ''; // mortgaging or redeeming changes neither
    if (st && key !== o.key) { o.pop = 0; squash(o); }
    o.key = key;
    o.bld.children.forEach((m) => (m as THREE.Mesh).geometry.dispose()); // the baked meshes own their geometry: free it
    o.bld.clear();
    o.tint.forEach((m) => m.color.set(st?.m ? 0x808080 : 0xffffff));
    const col = st?.m ? 0x555555 : st?.color ?? VACANT;
    o.pad!.material = padMats(col);
    if (!st) sign(o.bld);
    else if (t.type === 'special') level(o.bld, st.lv, st.m); // the landmark stands on its plot at every level: only the level is added
    else if (t.type === 'city') st.lv ? building(o.bld, st.lv, st.m ? 0x8c8c8c : new THREE.Color(t.color).lerp(new THREE.Color(0xffffff), 0.6).getHex(), col, st.m) : flag(o.bld, st.m ? 0x666666 : st.color); // an investment adds nothing: its props stand on the owner's plot, the colour says it all, a flag would only hide them
    bake(o.bld);
  }

  const place = (r: THREE.Group, i: number, hop: number) => { // the cursor on tile i, hop above its resting height: START's spans both its cells
    r.visible = i >= 0;
    if (i < 0) return;
    const p = i ? POS[i] : CENTRE, hw = (i ? S : 2 * S) / 2;
    r.position.set(p.x, tiles[i].g.position.y + TOP + BRACKET_Y + hop, p.z);
    r.children.forEach((b, k) => b.position.set(CORNERS[k][0] * hw, 0, (CORNERS[k][1] * S) / 2));
  };
  const walls = (i: number, lit: boolean) => tiles[i].side.color.set(TILES[i].color).multiplyScalar(lit ? 1.3 : 1); // the selected tile's walls are one band up the shading ramp (its bands are about 1.3x apart)
  let hov = -1, sel = -1;
  return {
    slabs: tiles.map((o) => o.slab), setOwner, // what the pointer picks: each tile's base, a plain box (START's spans both its cells)
    // The lettering of every card, once the camera has moved and before render(). `on`: in a game. It is there only while the camera is square to the tiles (its azimuth a whole
    // number of quarter turns): turned from them, lettering that stays upright would not sit on its card, and lettering that turns with them cannot be pixel exact.
    labels(on: boolean) {
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements, square = on && Math.cos(4 * Math.atan2(-e[2], e[0])) > 0.99984;
      const [across, down] = Math.abs(e[2]) > 0.5 ? [CARD.d, CARD.w] : [CARD.w, CARD.d]; // a card's width and depth on the screen: they swap when the camera looks along x
      codes(square && !lod.n, across, down); names(square && lod.n > 0, across, down);
    },
    hover(i: number) { if (hov >= 0 && hov !== sel) tiles[hov].g.userData.lift = 0; hov = i; if (i >= 0) tiles[i].g.userData.lift = Math.max(tiles[i].g.userData.lift, 0.3); },
    select(i: number) {
      if (sel >= 0) { tiles[sel].g.userData.lift = 0; walls(sel, false); }
      sel = i;
      if (i >= 0) { tiles[i].g.userData.lift = 0.6; walls(i, true); }
    },
    update(t: number, dt: number) {
      tiles.forEach((o) => { // each tile lifts as one piece (slab, card, props, building)
        o.g.position.y += (o.g.userData.lift - o.g.position.y) * Math.min(1, dt * 14);
        if (o.pop < 1) { o.pop = Math.min(1, o.pop + dt / 0.45); squash(o); }
      });
      // The cursors breathe: 0, 1, 2, 1 buffer pixels up the screen, a step every third of a second (px: one pixel up the screen, as a height)
      const px = (camera.top - camera.bottom) / (camera.zoom * renderer.domElement.height * Math.sin(controls.getPolarAngle()));
      const hop = [0, 1, 2, 1][Math.floor(t * 3) % 4] * px;
      place(hoverCursor, hov === sel ? -1 : hov, hop); place(selCursor, sel, hop);
    },
  };
}
