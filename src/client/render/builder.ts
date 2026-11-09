import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lodMap, pixelTexture, texels, toon, DENSITY } from './scene';
import { canvas, paint, ink, inkWidth, inkHeight } from './art';
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
const NEON = new Set([0xff5de0, 0x5dfff0, 0xff3b3b, 0x3b6bff, 0xfff6b0, LAVA]); // neon, lamps, flames and lava are unlit: they glow in the shade as in the sun
export const mat = memo((c: THREE.ColorRepresentation) => (NEON.has(c as number) ? new THREE.MeshBasicMaterial({ color: c }) : toon(c)));
const wallMat = memo((cols: number, kind: string, c: number) => lodMap(toon(c), (L) => facade(cols, kind, L)));
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
// K = how much bigger than authored the thing being built is: props are drawn at PK (see models; their authored numbers stay at the old size), buildings at 1.
// Textured parts keep one texel per world texel at any K: roofs and signs size their texture from the final geometry, storeys (floor) are whole
// modules and never stretch, so a bigger facade simply gets more windows.
let K = 1;
export const box = (g: THREE.Group, w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, m: THREE.Material | THREE.Material[] = mat(color)) => part(g, geo(w * K, h * K, d * K), h * K, m, x * K, y * K, z * K);
export const cyl = (g: THREE.Group, r: number, h: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) => part(g, cylGeo(r * K, h * K), h * K, mat(color), x * K, y * K, z * K);
export const hip = (g: THREE.Group, w: number, d: number, h: number, y: number, color: number, x = 0, z = 0) => part(g, roofGeo(w * K, d * K, h * K), h * K, roofMat(color), x * K, y * K, z * K);
export const plaque = (g: THREE.Group, text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, s = 1) => { // sized in whole texels; s: texels to a pixel of its text (see plate)
  const side = mat(bg), W = Math.max(texels(w * K), inkWidth(text) * s + 2), H = texels(h * K);
  return part(g, geo(W / DENSITY, H / DENSITY, 0.12 * K), H / DENSITY, [side, side, side, side, plateMat(bg, fg, W, H, text, s), side], x * K, y * K, z * K);
};
export const floor = (g: THREE.Group, cols: number, dcols: number, kind: string, color: number, y: number, x = 0, z = 0) => { // one storey, `cols` x `dcols` half-units, in final units; the entrance faces the viewer
  const alt = kind === 'glass' ? kind : 'win', side = wallMat(dcols, alt, color), plain = mat(color);
  return part(g, geo(cols / 2, 0.9, dcols / 2), 0.9, [side, side, plain, plain, wallMat(cols, kind, color), wallMat(cols, alt, color)], x, y, z);
};
export const final = (fn: (g: THREE.Group) => void) => (g: THREE.Group) => { const k = K; K = 1; fn(g); K = k; }; // props made of storeys are authored in final units
// A static prop: a box [color, w, h, d, x, y, z] (y from the tile top, z from the lot centre), or a function drawing into the group
export type Prop = [color: number, w: number, h: number, d: number, x: number, y: number, z: number] | ((g: THREE.Group) => void);
export const drawProps = (g: THREE.Group, props: Prop[], k: number) => { // props are drawn k times bigger than authored (see K)
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
// The geometries from memo are shared, so they are copied, never changed; the merged ones belong to root alone (see setOwner, which frees them).
export function bake(root: THREE.Group) {
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
