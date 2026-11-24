import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lodMap, pixelTexture, texels, toon, DENSITY } from './scene';
import { flat, nightlit } from './light';
import { canvas, filler, paint, hex, shade, ink, inkWidth, inkHeight, type Fill } from './art';
import { SZ, SLAB } from './layout';

export const memo = <A extends unknown[], R>(fn: (...a: A) => R) => { const c = new Map<string, R>(); return (...a: A): R => { const k = a.join('|'); if (!c.has(k)) c.set(k, fn(...a)); return c.get(k)!; }; };
const tex = (w: number, h: number, draw: (f: Fill, w: number, h: number, g: CanvasRenderingContext2D) => void, repeat?: number) => pixelTexture(canvas(w, h, (g, W, H) => draw(filler(g), W, H, g)), repeat);

export const sideTex = memo((L: number) => {
  const c = [3, 4, 8][L], rows = [2, 3, 3][L], wl = [1, 2, 5][L], jp = [8, 8, 16][L], top = L === 2 ? 2 : 1;
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
const STOREY: [number, number][] = [[3, 5], [5, 10], [11, 20]];
const WINDOW: ((f: Fill, x: number) => void)[] = [
  (f, x) => { f('#3f6fd0', x + 1, 1, 1, 3); f('#7db6ff', x + 1, 1, 1, 1); },
  (f, x) => { f('#1a2250', x + 1, 1, 3, 1); f('#7db6ff', x + 1, 2, 3, 2); f('#3f6fd0', x + 1, 4, 3, 3); f('#dce8ff', x + 1, 2, 1, 1); f('#aaa', x, 7, 5, 1); },
  (f, x) => { f('#1a2250', x + 2, 4, 7, 10); f('#7db6ff', x + 3, 5, 5, 3); f('#3f6fd0', x + 3, 8, 5, 5); f('#dce8ff', x + 3, 5, 1, 2); f('#f4f4f4', x + 1, 14, 9, 1); f('#aaa', x + 1, 15, 9, 1); },
];
const PANELS: ((f: Fill, x: number) => void)[] = [
  (f, x) => { f('#27479c', x, 0, 2, 3); f('#4f86e8', x, 0, 2, 1); },
  (f, x) => { for (const y of [0, 5]) { f('#27479c', x, y, 4, 4); f('#4f86e8', x, y, 4, 1); f('#cfe8ff', x + 1, y + 1, 1, 1); } },
  (f, x) => { for (const y of [1, 10]) { f('#27479c', x + 1, y, 9, 8); f('#4f86e8', x + 1, y, 9, 3); f('#cfe8ff', x + 2, y + 1, 2, 1); } },
];
const PANELS_LIT: [number, number, number, number][][] = [[[0, 0, 2, 3]], [[0, 0, 4, 4], [0, 5, 4, 4]], [[1, 1, 9, 8], [1, 10, 9, 8]]];
const DOOR: ((f: Fill, w: number, dw: number) => void)[] = [
  (f, w, dw) => { const x = (w - dw) / 2; f('#3a2008', x - 1, 2, dw + 2, 3); f('#8a5a2b', x, 3, dw, 2); },
  (f, w, dw) => { const x = (w - dw) / 2; f('#3a2008', x - 1, 3, dw + 2, 7); f('#7db6ff', x, 4, dw, 2); f('#8a5a2b', x, 6, dw, 3); f('#ffd23f', x + dw - 1, 7, 1, 1); f('#ffe9a0', (w >> 1) - 1, 1, 2, 1); f('#bdbdbd', x - 1, 9, dw + 2, 1); },
  (f, w, dw) => { const x = (w - dw) / 2; f('#3a2008', x - 1, 5, dw + 2, 15); f('#8a5a2b', x, 6, dw, 14); f('#a8743c', x, 6, dw, 1); f('#7db6ff', x + 1, 7, dw - 2, 4); f('#ffd23f', x + dw - 2, 14, 1, 1); f('#ffe9a0', (w >> 1) - 1, 3, 2, 1); f('#bdbdbd', x - 2, 19, dw + 4, 1); },
];
const LOBBY: ((f: Fill, w: number) => void)[] = [
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
    f('#c4c4c4', 0, h - 1, w, 1);
    for (let c = 0; c < cols; c++) {
      if (entrance && Math.abs(c * cw + cw / 2 - w / 2) < [2, 4, 8][L]) continue;
      (kind === 'glass' ? PANELS : WINDOW)[L](f, c * cw);
    }
    if (kind === 'door') DOOR[L](f, w, [1, 3, 7][L] + (cols % 2 ? 0 : 1));
    if (kind === 'lobby') LOBBY[L](f, w);
  });
});

export const rnd = (...k: number[]) => { let h = 0x811c9dc5; for (const v of k) { h = Math.imul(h ^ v, 0x01000193); h ^= h >>> 15; } return (h >>> 0) / 2 ** 32; };
const PLAIN: Record<string, string> = { door: 'win', lobby: 'flat', atrium: 'glass', foyer: 'ribbon', lounge: 'ribbon' };
const WHITE = [0xf4f6fb, 0xf4f6fb, 0xe6eefc, 0xfff3e0];
const LAMPS: Record<string, number[]> = {
  win: [0.7, 0xff9f3a, 0xffb457, 0xffca7d], flat: [0.55, 0xff9f3a, 0xffc063, 0xffdca4, 0x86b8ff], glass: [0.8, ...WHITE], atrium: [0.9, ...WHITE],
  foyer: [0.6, 0xcc7f2e, 0xcc9046, 0xcca264], lounge: [0.55, 0xcc7f2e, 0xcc9046, 0xcca264], ribbon: [0.45, 0xcc7f2e, 0xcc9046, 0xcca264], clad: [0.6, 0xcc9046, 0xcca264],
};
const WIDE: Record<string, { y: number[]; h: number[]; panes: (cols: number) => number }> = {
  lounge: { y: [1, 2, 3], h: [3, 6, 12], panes: (c) => Math.ceil(c / 1.5) }, ribbon: { y: [2, 3, 5], h: [2, 4, 8], panes: (c) => Math.max(1, Math.round(c / 2)) },
};
const GLAZING: Record<string, [number, number, number, number][]> = {
  win: [[1, 1, 1, 3], [1, 2, 3, 5], [3, 5, 5, 8]], flat: [[1, 1, 1, 3], [1, 1, 3, 6], [3, 3, 5, 10]],
};
const RIBBON: [number, number, number, number][] = [[1, 5, 1, 2], [2, 5, 1, 2], [4, 5, 1, 2]];
const HALL: ((f: Fill, w: number) => void)[] = [
  (f, w) => { const x = (w >> 1) - 2; f('#1a2250', x, 1, 4, 4); f('#7db6ff', x + 1, 2, 2, 2); },
  (f, w) => { const x = (w >> 1) - 4; f('#1a2250', x - 1, 1, 10, 2); f('#ffd23f', x + 1, 2, 6, 1); f('#2b3350', x - 1, 3, 10, 7); for (const d of [0, 5]) { f('#7db6ff', x + d, 4, 3, 2); f('#3f6fd0', x + d, 6, 3, 2); f('#4a5a7a', x + d, 8, 3, 1); } f('#bdbdbd', x - 1, 9, 10, 1); },
  (f, w) => {
    const x = (w >> 1) - 8; f('#1a2250', x - 2, 3, 20, 2); f('#ffd23f', x, 5, 16, 1); f('#2b3350', x - 2, 6, 20, 14);
    for (const d of [0, 9]) { f('#7db6ff', x + d, 7, 7, 4); f('#3f6fd0', x + d, 11, 7, 6); f('#dce8ff', x + d + 1, 8, 2, 1); f('#4a5a7a', x + d, 17, 7, 2); f('#ffd23f', x + (d ? 9 : 6), 10, 1, 3); }
    f('#bdbdbd', x - 3, 19, 22, 1);
  },
];
const HALL_LIT: ((w: number) => number[][])[] = [(w) => [[(w >> 1) - 1, 2, 2, 2]], (w) => [0, 5].map((d) => [(w >> 1) - 4 + d, 4, 3, 4]), (w) => [0, 9].map((d) => [(w >> 1) - 8 + d, 7, 7, 10])];
const LOBBY_LIT = HALL_LIT.map((leaves, L) => (w: number) => leaves(w).map(([x, y, bw]) => [x, y, bw, [2, 3, 7][L]]));
const lamp = (f: Fill, L: number, x: number, y: number, w: number, h: number, tone: number) => { const k = L === 2 ? 3 : 2; f(hex(tone), x, y, w, h); if (L && h > k) f(shade(tone, 0.8), x, y + k, w, h - k); };
const PORTAL: [number, number, number, number][] = [[3, 3, 1, 1], [3, 4, 4, 3], [3, 5, 12, 9]];
const portal = (f: Fill, L: number, night: boolean, x: number, w: number) => {
  const [top, gt, gh, lw] = PORTAL[L], leaves = [x + 1, x + w - 1 - lw], h = STOREY[L][1];
  if (night) return leaves.forEach((lx) => lamp(f, L, lx, gt, lw, gh, 0xffe9c0));
  f('#2b3350', x, top, w, h - top); f('#bdbdbd', x, h - 1, w, 1);
  for (const lx of leaves) { f('#3f6fd0', lx, gt, lw, gh); f('#7db6ff', lx, gt, lw, [1, 2, 4][L]); if (L) f('#dce8ff', lx + 1, gt, L, 1); }
};
const BLUE = ['#1a2250', '#3f6fd0', '#7db6ff', '#dce8ff'], AQUA = ['#2b3a5c', '#5cc0d8', '#a8ecf6', '#f2feff'];
const pane = (f: Fill, L: number, night: boolean, x: number, y: number, w: number, h: number, tone?: number, [frame, glass, sky, glint] = BLUE) => {
  if (night) return tone !== undefined && lamp(f, L, x, y, w, h, tone);
  if (L === 2) { f(frame, x - 1, y - 1, w + 2, h + 2); f('#f4f4f4', x - 2, y + h + 1, w + 4, 1); f('#aaa', x - 2, y + h + 2, w + 4, 1); }
  if (L === 1) { f(frame, x, y - 1, w, 1); f('#aaa', x - 1, y + h, w + 2, 1); }
  f(glass, x, y, w, h); f(sky, x, y, w, L === 2 ? 3 : L ? 2 : 1);
  if (L) f(glint, x, y, 1, L === 2 ? 2 : 1);
};
const villa = (f: Fill, L: number, night: boolean, x: number, y: number, w: number, h: number, tone: (c: number) => number | undefined) => {
  if (night) {
    const n = Math.max(1, Math.round(w / [w, 3, 5][L])), at = (c: number) => x + Math.round((c * w) / n);
    for (let c = 0; c < n; c++) { const t = tone(c); if (t !== undefined) lamp(f, L, at(c), y, at(c + 1) - at(c) - +(c < n - 1), h, t); }
    return;
  }
  pane(f, L, false, x, y, w, h, undefined, AQUA);
  if (L) for (const [a, n] of L === 2 ? [[3, 6], [8, 3]] : [[2, 3]]) for (let k = 0; k < n && a + k < w - 1 && k < h - 1; k++) f(AQUA[2], x + a + k, y + h - 2 - k, 1, 1);
};
const tonesOf = (kind: string) => LAMPS[kind === 'lobby' ? 'flat' : kind === 'door' ? 'win' : kind];
const litOf = (seed: number, i: number, tones: number[]) => (p: number, ...k: number[]) => (rnd(seed, i, ...k) < p ? tones[Math.floor(rnd(seed, i, ...k, 1) * tones.length)] : undefined);
const entry = (f: Fill, L: number, night: boolean, x0: number, n: number) => {
  const sub: Fill = (c, x, y, bw, bh) => f(c, x0 + x, y, bw, bh), sw = n * STOREY[L][0], dw = [1, 3, 7][L] + (n % 2 ? 0 : 1), x = (sw - dw) / 2;
  if (!night) DOOR[L](sub, sw, dw);
  else if (L) { lamp(sub, L, L === 2 ? x + 1 : x, L === 2 ? 7 : 4, L === 2 ? dw - 2 : dw, L === 2 ? 4 : 2, 0xffc070); sub('#ffe9a0', (sw >> 1) - 1, L === 2 ? 3 : 1, 2, 1); }
};
const city = memo((cols: number, rows: string, L: number, night: boolean, seed: number) => {
  const kinds = rows.split(' '), [cw, h] = STOREY[L];
  return tex(cols * cw, kinds.length * h, (g, w, H) => {
    if (night) g('#000', 0, 0, w, H);
    kinds.forEach((kind, i) => {
      const f: Fill = (c, x, y, bw, bh) => g(c, x, H - (i + 1) * h + y, bw, bh), [on, ...tones] = tonesOf(kind), lit = litOf(seed, i, tones);
      const base = () => { if (!night) { f('#fff', 0, 0, w, h); if (L === 2) f('#e2e2e2', 0, 18, w, 1); f('#c4c4c4', 0, h - 1, w, 1); } };
      if (kind === 'glass' || kind === 'atrium') {
        const [nf, ph, y0, gh] = RIBBON[L], door = (c: number) => kind === 'atrium' && Math.abs((c + 0.5) * cw - w / 2) < cw;
        if (!night) f('#dde6f5', 0, 0, w, h);
        for (let fl = 0; fl < nf; fl++) {
          const y = fl * ph + y0, p = Math.min(1, on * (0.55 + 0.9 * rnd(seed, i, fl, 7)));
          if (!night) { if (L === 2) f('#9db0d4', 0, y - 1, w, 1); f('#3f6fd0', 0, y, w, gh); f('#7db6ff', 0, y, w, 1); }
          else for (let c = 0; c < cols; c++) {
            if (door(c) && fl) continue;
            const t = door(c) ? 0xffe9c0 : lit(p, fl, c);
            if (t !== undefined) { f(hex(t), c * cw, y, cw, 1); f(shade(t, 0.8), c * cw, y + 1, cw, gh - 1); }
          }
        }
        if (kind === 'atrium') portal(f, L, night, (cols / 2 - 1) * cw, 2 * cw);
      } else if (kind === 'clad') {
        base();
        if (!night) for (let x = 0, b = [2, 3, 4][L]; x < w; x += b) f(x % (2 * b) ? '#fff' : '#d6d6d6', x, 0, 1, h - (L === 2 ? 2 : 1));
        for (let j = 0, n = Math.max(1, Math.round(cols / 2)), sw = [1, 2, 4][L]; j < n; j++) villa(f, L, night, Math.round(((j + 0.5) * w) / n - sw / 2), WIDE.lounge.y[L], sw, WIDE.lounge.h[L], (c) => lit(on, j, c));
      } else if (kind === 'foyer' || kind in WIDE) {
        base();
        const { y, h: gh, panes } = WIDE[kind === 'foyer' ? 'lounge' : kind], gw = kind === 'foyer' ? cols - 1 : cols, m = [1, 1, 2][L], gap = [1, 1, 2][L], span = gw * cw - 2 * m + gap, n = panes(gw);
        for (let j = 0; j < n; j++) {
          const a = m + Math.round((j * span) / n), b = m + Math.round(((j + 1) * span) / n) - gap;
          villa(f, L, night, a, y[L], b - a, gh[L], (c) => lit(on, j, c));
        }
        if (kind === 'foyer') entry(f, L, night, gw * cw, 1);
      } else {
        base();
        if (kind === 'door') entry(f, L, night, 0, cols);
        else {
          const [gx, gy, gw, gh] = GLAZING[kind === 'win' ? 'win' : 'flat'][L];
          for (let c = 0; c < cols; c++) if (kind !== 'lobby' || Math.abs(c * cw + cw / 2 - w / 2) >= [2, 4, 8][L]) pane(f, L, night, c * cw + gx, gy, gw, gh, lit(on, c));
          if (kind === 'lobby') { if (!night) HALL[L](f, w); else HALL_LIT[L](w).forEach(([x, y, bw, bh]) => lamp(f, L, x, y, bw, bh, 0xffe2ac)); }
        }
      }
    });
  });
});
const KINDS = ['win', 'door', 'lobby', 'glass'];
const facadeLit = memo((cols: number, kind: string, L: number) => {
  const [cw, h] = STOREY[L], [on, ...tones] = tonesOf(kind), lit = litOf(7, cols * KINDS.length + KINDS.indexOf(kind), tones), panes = kind === 'glass' ? PANELS_LIT[L] : [GLAZING.win[L]];
  return tex(cols * cw, h, (f, w) => {
    f('#000', 0, 0, w, h);
    for (let c = 0; c < cols; c++) {
      if ((kind === 'door' || kind === 'lobby') && Math.abs(c * cw + cw / 2 - w / 2) < [2, 4, 8][L]) continue;
      panes.forEach(([x, y, bw, bh], j) => pane(f, L, true, c * cw + x, y, bw, bh, lit(on, c, j)));
    }
    if (kind === 'door') entry(f, L, true, 0, cols);
    if (kind === 'lobby') LOBBY_LIT[L](w).forEach(([x, y, bw, bh]) => lamp(f, L, x, y, bw, bh, 0xffe2ac));
  });
});
const ROOF = 8;
const roofTex = memo((L: number) => tex(ROOF >> (2 - L), ROOF >> (2 - L), (f, n) => {
  const c = L === 2 ? 4 : 2;
  f('#fff', 0, 0, n, n);
  for (let y = 0; y < n; y += c) {
    if (L === 2) f('#d4d4d4', 0, y + 2, n, 1);
    f('#a8a8a8', 0, y + c - 1, n, 1);
    if (L) f('#bdbdbd', y % (2 * c) ? c : 0, y, 1, c - 1);
  }
}, 1));
const plate = memo((bg: string, fg: string, W: number, H: number, text: string, s: number, L: number) => {
  const k = 2 ** (2 - L), sl = s / k;
  return tex(Math.round(W / k), Math.round(H / k), (f, w, h, g) => {
    f(bg, 0, 0, w, h);
    if (H > 8) for (const [x, y, bw, bh] of [[0, 0, w, 1], [0, h - 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]]) f(fg, x, y, bw, bh);
    const tw = inkWidth(text) * sl, th = inkHeight(text) * sl;
    if (sl >= 1 && tw + 2 <= w && th + (H > 8 ? 2 : 0) <= h) { g.fillStyle = fg; ink(g, text, (w - tw) >> 1, ((h - th) >> 1) + th, sl); }
  });
});
const plateMat = memo((bg: string, fg: string, W: number, H: number, text: string, s: number, neon: boolean) => {
  const make = (L: number) => plate(bg, fg, W, H, text, s, L);
  return neon ? lodMap(new THREE.MeshBasicMaterial(), make) : flat(lodMap(toon(0xffffff), make));
});

export const GOLD = 0xffd23f, IRON = 0x555a6e, INK = 0x23263a, LAVA = 0xff7a1a;
const geo = memo((w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d));
const cylGeo = memo((r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 10));
const roofGeo = memo((w: number, d: number, h: number) => {
  const g = new THREE.ConeGeometry(w * Math.SQRT1_2, h, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, d / w).toNonIndexed(), p = g.attributes.position;
  g.computeVertexNormals();
  const [a, b, c, u, v] = [...Array(5)].map(() => new THREE.Vector3()), uv: number[] = [], k = DENSITY / ROOF;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1).sub(a); c.fromBufferAttribute(p, i + 2).sub(a);
    u.copy(b).normalize(); v.copy(c).addScaledVector(u, -c.dot(u)).normalize();
    uv.push(0, 0, b.dot(u) * k, 0, c.dot(u) * k, c.dot(v) * k);
  }
  return g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
});
const gableGeo = memo((w: number, d: number, h: number, turn: boolean) => {
  const [a, b, c, k] = [w / 2, d / 2, h / 2, DENSITY / ROOF], s = Math.hypot(b, h) * k, pos: number[] = [], uv: number[] = [];
  const quad = (p: number[][]) => { for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); uv.push(...[[0, 0], [w * k, 0], [w * k, s], [0, s]][i]); } };
  quad([[-a, -c, b], [a, -c, b], [a, c, 0], [-a, c, 0]]); quad([[a, -c, -b], [-a, -c, -b], [-a, c, 0], [a, c, 0]]);
  for (const p of [[a, -c, b], [a, -c, -b], [a, c, 0], [-a, -c, -b], [-a, -c, b], [-a, c, 0]]) { pos.push(...p); uv.push(0, 0); }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.addGroup(0, 12, 0); g.addGroup(12, 6, 1);
  if (turn) g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
});
const NEON = new Set([0xff5de0, 0x5dfff0, 0xff3b3b, 0x3b6bff, 0xfff6b0, LAVA]);
export const mat = memo((c: THREE.ColorRepresentation) => (NEON.has(c as number) ? new THREE.MeshBasicMaterial({ color: c }) : toon(c)));
export const emissive = memo((c: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color: c }));
export const glass = memo((c: THREE.ColorRepresentation, night?: number, k: number = 1) => { const m = toon(c); return night === undefined ? m : nightlit(m, night, k); });
export const lamplit = memo((c: number, night: number, k: number) => nightlit(toon(c), night, k));
const wallMat = memo((cols: number, kind: string, c: number) => lodMap(lodMap(toon(c, { emissive: 0xffffff }), (L) => facade(cols, kind, L)), (L) => facadeLit(cols, kind, L), 'emissiveMap'));
const cityMat = memo((cols: number, rows: string, c: number, seed: number, lamps: boolean) => {
  const m = lodMap(toon(c, lamps ? { emissive: 0xffffff } : {}), (L) => city(cols, rows, L, false, seed));
  return lamps ? lodMap(m, (L) => city(cols, rows, L, true, seed), 'emissiveMap') : m;
});
const roofMat = memo((c: number) => lodMap(toon(c), roofTex));
export const prism = memo((a: number, h: number, r: number) => {
  const pos: number[] = [], uv: number[] = [], g = new THREE.BufferGeometry();
  const faces: [number, number[][]][] = [[0, [[-a, 0, a], [a, 0, a], [a, h, a], [-a, h, a]]], [1, [[0, 0, 0], [-a, 0, a], [-a, h, a], [0, h + r, 0]]], [1, [[a, 0, a], [0, 0, 0], [0, h + r, 0], [a, h, a]]], [2, [[-a, h, a], [a, h, a], [0, h + r, 0]]]];
  for (const [k, pts] of faces) {
    const start = pos.length / 3, [p0, p1] = pts, dx = p1[0] - p0[0], dz = p1[2] - p0[2], len = dx * dx + dz * dz;
    for (let i = 1; i < pts.length - 1; i++) for (const p of [p0, pts[i], pts[i + 1]]) {
      pos.push(...p);
      uv.push(...(k < 2 ? [((p[0] - p0[0]) * dx + (p[2] - p0[2]) * dz) / len, p[1] / (k ? h + r : h)] : [(p[0] + a) / (2 * a), (a - p[2]) / a]));
    }
    g.addGroup(start, pos.length / 3 - start, k);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)).computeVertexNormals();
  return g;
});
export const OFFICE = [0xffc46a, 0xffd48a, 0xffe2b4, 0xf4f6fb];
const GLASS = ['#9bb9e6', '#7799d3', '#5f83bd', '#4a6ba3'];
const curtain = memo((w: number, H: number, m: number, seed: number, L: number, night: boolean) => {
  const W = texels(w, L), T = texels(H, L), M = (m * DENSITY) / 2 ** (2 - L), n = Math.floor(H / m + 1e-6), F = [2, 4, 4][L], P = M / F, row = (k: number) => Math.round(k * M);
  return tex(W, T, (f) => {
    const at = (c: string, x: number, y: number, bw = 1, bh = 1) => f(c, x, T - y - bh, bw, bh);
    const brace = (c: string, dy = 0) => {
      for (let k = 0; k < n; k++) for (let y0 = row(k), h = row(k + 1) - y0, N = Math.max(W, h), i = 0; i < N; i++) { const t = i / (N - 1), x = Math.round(t * (W - 1)), y = y0 + Math.round(t * (h - 1)) + dy; at(c, x, y, 1, 1); at(c, W - 1 - x, y, 1, 1); }
    };
    f(night ? '#000' : GLASS[1], 0, 0, W, T);
    if (night) for (let j = 0; (j + 0.5) * P < T; j++) {
      const p = Math.min(1, (!L || (j % F && j % F < F - 1) ? 0.9 : 0.4) * (0.4 + rnd(seed, j, 7))), y = Math.round((j + 0.5) * P) - (L === 2 ? 1 : 0);
      for (let x = 1, len = 1; x < W - 1; x += len + 1) {
        len = Math.min(1 + Math.floor(rnd(seed, j, x) * [2, 4, 7][L]), W - 1 - x);
        const t = OFFICE[Math.floor(rnd(seed, j, x, 2) * OFFICE.length)];
        if (rnd(seed, j, x, 1) < p) { at(hex(t), x, y + (L === 2 ? 1 : 0), len); if (L === 2) at(shade(t, 0.8), x, y, len); }
      }
    } else {
      for (let k = 0; k < n; k++) for (let y0 = row(k), h = row(k + 1) - y0, y = 0; y < h; y++) {
        const t = (y + 0.5) / h, x = Math.round(t * W), lo = Math.min(x, W - x), hi = Math.max(x, W - x);
        at(GLASS[t < 0.5 ? 2 : 0], lo, y0 + y, hi - lo, 1);
      }
      if (L === 2) { for (let j = 1; j * P < T - 1; j++) if (j % F) at('#7a9ad2', 1, Math.round(j * P), W - 2, 1); brace(GLASS[3], -1); }
    }
    brace('#ffffff');
    for (let k = 0; k <= n; k++) at(night ? '#ffffff' : '#e9f0fb', 0, Math.min(T - 1, row(k)), W);
    if (L) for (const x of [0, W - 1]) at(night ? '#ffffff' : '#e6eefb', x, 0, 1, T);
  });
});
const skylight = memo((w: number, s: number, L: number, night: boolean) => tex(texels(w, L), texels(s, L), (f, W, S) => {
  const p = [1, 2, 4][L], mid = (W - 1) / 2;
  f(night ? '#000' : '#e4eeff', 0, 0, W, S);
  if (!night && L) for (let k = 0; k < Math.max(W, S); k += p) { f('#b9cdee', k, 0, 1, S); f('#b9cdee', 0, k, W, 1); }
  for (let y = 0; y < S; y++) { const d = Math.round((mid * y) / (S - 1)); for (const x of [Math.round(mid) - d + 1, Math.round(mid) + d - 1]) f('#ffffff', Math.max(0, Math.min(W - 1, x)), y, 1, 1); }
  f('#ffffff', 0, S - 1, W, 1);
}));
const glazed = (make: (L: number, night: boolean) => THREE.Texture) => lodMap(lodMap(toon(0xffffff, { emissive: 0xffffff }), (L) => make(L, false)), (L) => make(L, true), 'emissiveMap');
const roof = memo((a: number, r: number) => glazed((L, night) => skylight(2 * a, Math.hypot(a, r), L, night)));
export const prismMat = memo((a: number, h: number, r: number, m: number, seed: number) => [glazed((L, night) => curtain(2 * a, h, m, seed, L, night)), glazed((L, night) => curtain(a * Math.SQRT2, h + r, m, seed + 1, L, night)), roof(a, r)]);
export const part = (g: THREE.Group, geometry: THREE.BufferGeometry, h: number, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
};
let K = 1;
export const PK = 1.25;
export const box = (g: THREE.Group, w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, m: THREE.Material | THREE.Material[] = mat(color)) => part(g, geo(w * K, h * K, d * K), h * K, m, x * K, y * K, z * K);
export const cyl = (g: THREE.Group, r: number, h: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, m: THREE.Material = mat(color)) => part(g, cylGeo(r * K, h * K), h * K, m, x * K, y * K, z * K);
export const hip = (g: THREE.Group, w: number, d: number, h: number, y: number, color: number, x = 0, z = 0) => part(g, roofGeo(w * K, d * K, h * K), h * K, roofMat(color), x * K, y * K, z * K);
export const gable = (g: THREE.Group, w: number, d: number, h: number, y: number, color: number, wall: number, x = 0, z = 0, turn = false) => part(g, gableGeo(w * K, d * K, h * K, turn), h * K, [roofMat(color), mat(wall)], x * K, y * K, z * K);
export const plaque = (g: THREE.Group, text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, lit: 'sign' | 'neon' = 'sign', back?: THREE.ColorRepresentation, s = 1) => {
  const side = mat(bg), W = Math.max(texels(w * K), inkWidth(text) * s + 2), H = texels(h * K);
  return part(g, geo(W / DENSITY, H / DENSITY, 0.12 * K), H / DENSITY, [side, side, side, side, plateMat(bg, fg, W, H, text, s, lit === 'neon'), back === undefined ? side : mat(back)], x * K, y * K, z * K);
};
export const floor = (g: THREE.Group, cols: number, dcols: number, kind: string, color: number, y: number, x = 0, z = 0) => {
  const alt = kind === 'glass' ? kind : 'win', side = wallMat(dcols, alt, color), plain = mat(color);
  return part(g, geo(cols / 2, 0.9, dcols / 2), 0.9, [side, side, plain, plain, wallMat(cols, kind, color), wallMat(cols, alt, color)], x, y, z);
};
export const block = (g: THREE.Group, cols: number, dcols: number, rows: string, color: number, y = 0, x = 0, z = 0, lamps = true, seed = 0) => {
  const bare = rows.split(' ').map((k) => PLAIN[k] ?? k).join(' '), h = rows.split(' ').length * 0.9, side = cityMat(dcols, bare, color, seed + 2, lamps), plain = mat(color);
  return part(g, geo(cols / 2, h, dcols / 2), h, [side, side, plain, plain, cityMat(cols, rows, color, seed, lamps), cityMat(cols, bare, color, seed + 1, lamps)], x, y, z);
};
export const final = (fn: (g: THREE.Group) => void) => (g: THREE.Group) => { const k = K; K = 1; fn(g); K = k; };
export type Prop = [color: number, w: number, h: number, d: number, x: number, y: number, z: number] | ((g: THREE.Group) => void);
export interface ModelDef { key: string; props: Prop[]; scale?: number; levels?: Prop[][]; owner?: (color: number | null) => void }
export const drawProps = (g: THREE.Group, props: Prop[], k = PK) => {
  K = k;
  for (const r of props) typeof r === 'function' ? r(g) : box(g, r[1], r[2], r[3], r[0], r[4], r[5], r[6]);
  K = 1;
};
const STONE = 16;
const brick = memo((w: number, h: number, d: number) => {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, k = DENSITY / STONE;
  [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]].forEach(([u, v], f) => { for (let i = 4 * f; i < 4 * f + 4; i++) uv.setXY(i, uv.getX(i) * u * k, uv.getY(i) * v * k); });
  return g;
});
const stoneTex = memo((L: number) => tex(STONE >> (2 - L), STONE >> (2 - L), (f, n) => {
  const c = [4, 2, 4][L], b = [4, 4, 8][L];
  f('#fff', 0, 0, n, n);
  for (let r = 0; r * c < n; r++) { f('#bdbdbd', 0, r * c + c - 1, n, 1); for (let x = (r & 1) * (b >> 1); x < n; x += b) f('#d4d4d4', x, r * c, 1, c - 1); }
}, 1));
const stoneMat = memo((c: number) => lodMap(toon(c), stoneTex));
export const stone = (g: THREE.Group, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) => part(g, brick(w, h, d), h, stoneMat(color), x, y, z);
export const sprite = memo((rows: string[]) => pixelTexture(canvas(rows[0].length, rows.length, (g) => paint(g, rows, 0, 0))));
export const decal = (g: THREE.Group, rows: string[], x: number, y: number, z: number, lamps?: string[]) => {
  const [w, h] = [rows[0].length / DENSITY, rows.length / DENSITY], m = part(g, new THREE.PlaneGeometry(w, h), h, toon(0xffffff, { map: sprite(rows), alphaTest: 0.5, ...(lamps && { emissive: 0xffffff, emissiveMap: sprite(lamps) }) }), x, y, z);
  m.castShadow = false;
  return m;
};
export const lampsOf = (rows: string[], lit: string, tone = 'Y') => rows.map((r) => r.replace(/./g, (c) => (lit.includes(c) ? tone : '.')));
const IDENT = new THREE.Matrix4();
export function bake(root: THREE.Group) {
  const kept: [THREE.Object3D, THREE.Matrix4][] = [];
  const hold = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      if (c.userData.tick || c.name) {
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
export const freeBaked = (root: THREE.Object3D) => root.traverse((o) => {
  const m = o as THREE.Mesh;
  if (m.isMesh && m.geometry.userData.own) m.geometry.dispose();
});
