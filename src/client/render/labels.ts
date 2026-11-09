import { PAL, hex, lum, shade } from './art';
import type { Tile } from '../../shared/data';

type Ctx = CanvasRenderingContext2D;
type Fill = (c: string, x: number, y: number, w: number, h: number) => void;
type Scale = (n: number, min?: number) => number; // a near-level length on this level's grid

// ---- Tile textures, drawn once per zoom level (see scene.js): an info CARD, the GROUND it lies on and the owner's PAD ----
// Each level is its own design on its own pixel grid, not the near art shrunk: text, stripe periods, joints and inlays are redrawn to fit.
// card:   name band in the region colour, bevel and edge. Unlit, so it keeps its exact colours. No lettering in the textures: the card's code is
//         carved on it in the 3D scene (see codeOf and board.ts).
//           near  64x48  (ground's pixel size over the 2.9 x 2.175 card)
//           mid   32x24
//           far   16x12  a bare colour block
// ground: the paving of the whole tile, 128 / 64 / 32 texels across. Lit, so the 3D building / props stand on it and cast their shadows over it.
export const CARD_SIZE: [number, number][] = [[16, 12], [32, 24], [64, 48]]; // card size per level

// A code for every tile (the IATA city code for cities, invented for the rest), carved on its card
const CODE: Record<string, string> = {
  START: 'GO', Casino: 'CAS', Nightclub: 'CLB', HKEX: 'HKX', 'News Agency': 'NWS', Jail: 'JAL', 'Tax Bureau': 'TAX', Bank: 'BNK', LSE: 'LSE', 'Go To Jail': 'GTJ', NASDAQ: 'NAS',
  Wellington: 'WLG', Canberra: 'CBR', Sydney: 'SYD', Jakarta: 'JKT', Singapore: 'SIN', 'Strait of Malacca': 'MAL', 'Kuala Lumpur': 'KUL', Bangkok: 'BKK', Hanoi: 'HAN',
  'Hong Kong': 'HKG', Shenzhen: 'SZX', CSCEC: 'CSC', Taipei: 'TPE', Shanghai: 'SHA', 'China Railway': 'CRH', Beijing: 'BJS', Tokyo: 'TYO', Osaka: 'OSA', Seoul: 'SEL',
  'West Sea Base': 'WSB', Pyongyang: 'FNJ', Vladivostok: 'VVO', Yekaterinburg: 'SVX', Moscow: 'MOW', 'Saint Petersburg': 'LED', Warsaw: 'WAW', Prague: 'PRG', Vienna: 'VIE',
  Budapest: 'BUD', Berlin: 'BER', Zurich: 'ZRH', VINCI: 'VIN', Paris: 'PAR', Madrid: 'MAD', BBC: 'BBC', London: 'LON', Maersk: 'MSK', Copenhagen: 'CPH', Oslo: 'OSL',
  'Bering Strait': 'BRG', Ottawa: 'YOW', 'New York': 'NYC', Washington: 'WAS', 'United Airlines': 'UAL', Chicago: 'CHI', "Devil's Island": 'DEV', 'San Francisco': 'SFO',
  'Las Vegas': 'LAS', 'White Sands Base': 'WHS', 'Area 51': 'UFO', 'Mexico City': 'MEX', Havana: 'HAV', 'San José': 'SJO', 'Panama Canal': 'PAN', Bogotá: 'BOG', 'Venezuela Oil': 'VEN',
  'Buenos Aires': 'BUE', Rio: 'RIO', Brasília: 'BSB', Pretoria: 'PRY', Tunis: 'TUN', Djibouti: 'JIB', Cairo: 'CAI', Jerusalem: 'JRS', 'Damascus Base': 'DAM', 'Abu Dhabi': 'AUH',
  'Saudi Aramco': 'ARA', Dubai: 'DXB', 'Strait of Hormuz': 'HRZ', Tehran: 'THR', Islamabad: 'ISB', 'New Delhi': 'DEL', Mumbai: 'BOM',
};
const ACCENT: Record<string, number> = { transport: 0x4da3ff, build: 0xf0a020, military: 0x6a8a4a, choke: 0xe0524e, oil: 0x4a4f6e, bbc: 0xd9423e, devil: 0x2fa84f }; // investment band colour per kind
const GOLD = ['#fff6b0', '#ffd23f', '#b36a14'];
const tone = (t: Tile): [number, boolean] => { const col = t.type === 'invest' ? ACCENT[t.kind] : t.color; return [col, t.type !== 'public' && lum(col) > 0.55]; }; // a card's band colour, and whether it takes dark ink (light bands) or white (dark ones)
export const codeOf = (t: Tile): [string, number] => [CODE[t.name], tone(t)[1] ? 0x0b0e24 : 0xffffff]; // a card's code and the ink it is carved in: dark on a light band, white on a dark one
const filler = (g: Ctx) => (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const edge = (fill: Fill, w: number, h: number, bevel = true, ring = PAL.o) => { // bevel + ink edge
  if (bevel) {
    fill('rgba(255,255,255,.45)', 1, 1, w - 2, 1); fill('rgba(255,255,255,.45)', 1, 1, 1, h - 2);
    fill('rgba(0,0,0,.25)', 1, h - 2, w - 2, 1); fill('rgba(0,0,0,.25)', w - 2, 1, 1, h - 2);
  }
  for (const [x, y, bw, bh] of [[0, 0, w, 1], [0, h - 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]]) fill(ring, x, y, bw, bh);
};

// Signature floor of each public tile, painted over its ground: f(colour, x, y, w, h, s) fills texels. s(n, min) is a near-level length n on this level's grid.
const FLOOR: Record<string, (f: Fill, c: number, x: number, y: number, w: number, h: number, s: Scale) => void> = {
  start: (f, _c, x, y, w, h, s) => { // finish-line checker along the bottom edge, centred on it
    const q = s(4), n = Math.floor(w / q), o = (w - n * q) >> 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) f((i + j) & 1 ? PAL.o : '#fff', x + o + i * q, y + h - (2 - j) * q, q, q);
  },
  jail: (f, c, x, y, w, h, s) => { const p = s(6, 3); for (let i = Math.round(p / 2); i < w; i += p) { f(shade(c, 0.5), x + i, y, s(2), h); f(shade(c, 1.25), x + i - 1, y, 1, h); } },    // cell bars
  gojail: (f, _c, x, y, w, h, s) => { const r = s(6, 2), p = s(8, 2); for (let j = 0; j < r; j++) for (let i = -j; i < w; i += p) f('#fff', x + i, y + h - r + j, s(4), 1); },       // hazard stripes
  exchange: (f, c, x, y, w, h, s) => { const p = s(8, 3); for (let i = 0; i < w; i += p) f(shade(c, 1.3), x + i, y, 1, h); for (let j = 0; j < h; j += p) f(shade(c, 1.3), x, y + j, w, 1); }, // chart grid
  tax: (f, c, x, y, w, h, s) => { for (let j = s(3); j < h; j += s(5, 3)) f(shade(c, 1.3), x, y + j, w, 1); f(shade(c, 0.6), x + s(6), y, 1, h); },                                  // ledger paper
  casino: (f, c, x, y, w, h, s) => { const q = s(8, 2); for (let i = 0; i < w / q; i++) for (let j = 0; j < h / q; j++) f((i + j) & 1 ? shade(c, 0.7) : shade(c, 1.15), x + i * q, y + j * q, q, q); }, // felt checker
  club: (f, c, x, y, w, h, s) => { const q = s(8, 2); for (let i = 0; i < w / q; i++) for (let j = 0; j < h / q; j++) f((i + j) & 1 ? shade(c, 0.65) : shade(c, 1.3), x + i * q, y + j * q, q, q); },  // dance floor
  bank: (f, c, x, y, w, h, s) => { const p = s(14, 4); for (let i = 0; i < w; i += p) for (let j = 0; j < h; j += p) { f(shade(c, 1.35), x + i, y + j, p - 1, p - 1); f(shade(c, 1.55), x + i, y + j, p - 1, 1); } }, // marble tiles
  news: (f, c, x, y, w, h, s) => { for (let j = s(2), k = 0; j < h; j += s(4, 2), k++) f(shade(c, 0.6), x + s(4), y + j, w - 2 * s(4) - (k & 1) * s(7), s(2)); },                    // columns of print
  area51: (f, c, x, y, w, h, s) => { // landing rings round the middle of the tile
    const lit = shade(c, 1.4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const r = Math.hypot(i + 0.5 - w / 2, j + 0.5 - h / 2);
      if ([18, 36, 54].some((n) => Math.abs(r - s(n)) < 0.75)) f(lit, x + i, y + j, 1, 1);
    }
  },
};

export function drawCard(g: Ctx, t: Tile, L: number) {
  const [W, H] = CARD_SIZE[L], fill = filler(g);
  const pub = t.type === 'public', sp = t.type === 'special', col = tone(t)[0];
  const [hi, base, lo] = [shade(col, 1.3, 14), hex(col), shade(col, 0.62)];

  // name band over the whole card (near: 3-tone banding + dither, like a 16-bit title bar)
  fill(pub ? shade(col, 0.72) : base, 0, 0, W, H);
  if (L === 2) {
    fill(pub ? shade(col, 0.9) : hi, 0, 0, W, 2); fill(pub ? shade(col, 0.5) : lo, 0, H - 2, W, 2);
    for (let y = 13; y < H - 2; y++) for (let x = y & 1; x < W; x += 2) fill('rgba(255,255,255,.08)', x, y, 1, 1);
  } else {
    fill(pub ? shade(col, 0.9) : hi, 0, 1, W, 1); fill(pub ? shade(col, 0.5) : lo, 0, H - 2, W, 1);
  }

  if (sp && L) { // gold frame, 2 texels thick near and 1 on the small grids; far has no room inside and gilds the outline instead
    const th = L === 2 ? 2 : 1;
    for (const [x, y, w, h] of [[1, 1, W - 2, th], [1, H - 1 - th, W - 2, th], [1, 1, th, H - 2], [W - 1 - th, 1, th, H - 2]]) fill(GOLD[1], x, y, w, h);
    fill(GOLD[0], 1, 1, W - 2, 1); fill(GOLD[2], 1, H - 2, W - 2, 1);
  }
  edge(fill, W, H, L > 0, sp && !L ? GOLD[1] : PAL.o);
}

// Pad: the carpet under a building, in the owner's colour (grey when vacant or mortgaged). Bevel, lit top-left band and (near) the card's dither, so it reads as a solid colour block at any zoom.
export function drawPad(g: Ctx, color: number, w: number, h: number, L: number) {
  const fill = filler(g), lit = shade(color, 1.35, 30), m = Math.max(1, Math.round(3 / 2 ** (2 - L)));
  fill(shade(color, 0.7), 0, 0, w, h);
  fill(hex(color), m, m, w - 2 * m, h - 2 * m);
  fill(lit, m, m, w - 2 * m, 1); fill(lit, m, m, 1, h - 2 * m);
  if (L === 2) for (let y = 5; y < h - 5; y++) for (let x = 5 + (y & 1); x < w - 5; x += 2) fill('rgba(255,255,255,.08)', x, y, 1, 1);
  edge(fill, w, h, L > 0);
}

// Ground: city tiles are paved with 4 x 4 square slabs in a soft tint of the region colour, joined by hairlines. Flat and quiet on purpose: nothing like
// the side walls' courses, so it reads as floor, and nothing for the eye to read, so the cards and buildings stand out.
// A hatched yard for investments, the signature floor for public tiles. Special cities get a gold inlay just inside the tile edge.
export function drawGround(g: Ctx, type: string, kind: string, color: number, L: number) {
  const G = 32 << L, fill = filler(g), s = (n: number, min = 1) => Math.max(min, Math.round((n * G) / 128));
  if (type === 'public') { const m = s(4); fill(hex(color), 0, 0, G, G); FLOOR[kind]?.(fill, color, m, m, G - 2 * m, G - 2 * m, s); }
  else if (type === 'invest') { fill('#c3cbe0', 0, 0, G, G); for (let i = -G; i < G; i += s(12, 3)) for (let j = 0; j < G; j++) fill('#b3bdd6', i + j, j, s(4), 1); }
  else {
    const tint = (t: number) => shade(color, 0.38, t), S = G / 4, joint = tint(112);
    fill(tint(130), 0, 0, G, G);
    for (let i = S; i < G; i += S) { fill(joint, i, 1, 1, G - 2); fill(joint, 1, i, G - 2, 1); }
    if (type === 'special') {
      const m = s(7), th = s(3);
      for (const [x, y, w, h] of [[m, m, G - 2 * m, th], [m, G - m - th, G - 2 * m, th], [m, m, th, G - 2 * m], [G - m - th, m, th, G - 2 * m]]) fill(GOLD[1], x, y, w, h);
      fill(GOLD[0], m, m, G - 2 * m, 1); fill(GOLD[2], m, G - m - 1, G - 2 * m, 1);
    }
  }
  edge(fill, G, G, L > 0);
}
