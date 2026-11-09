// Pixel-art kit: one shared palette + string-art sprites -> SVG / canvas / CSS data URIs.
// Every colour comes in a 4-5 step ramp (light -> dark, shadows lean cold) like a 16-bit palette.
export type Pal = Record<string, string>;
export const PAL: Pal = {
  o: '#0b0e24', O: '#161c4a',
  w: '#ffffff', x: '#f6f0dc', a: '#dce4ff', b: '#a9b8f0', c: '#6c7fd0', d: '#4152a8', e: '#2a3678',
  y: '#fff6b0', Y: '#ffd23f', g: '#f0a020', G: '#b36a14', H: '#6e3a12',
  r: '#ff9aa4', R: '#f0485f', q: '#b02a4e', Q: '#6e1c44',
  n: '#b8f4a4', N: '#55d27a', m: '#25985a', M: '#146040',
  l: '#a6e0ff', L: '#4da3ff', u: '#2b68d4', U: '#1a3f8f',
  s: '#ffe4c8', S: '#f5b88c', t: '#cf8458', k: '#8a5230', K: '#4f2d1c',
  p: '#e0b0ff', P: '#9a62e0', v: '#5e3aa8',
};

// rows of palette chars ('.' = clear) -> SVG markup (run-length merged, crisp edges)
export const svgParts = (rows: string[], pal: Pal = PAL) => { // a sprite as one path per colour: [fill, d][]
  const d: Record<string, string> = {};
  rows.forEach((r, y) => {
    for (let x = 0, n: number; x < r.length; x += n) {
      for (n = 1; r[x + n] === r[x]; n++);
      if (r[x] !== '.') d[r[x]] = (d[r[x]] || '') + `M${x} ${y}h${n}v1h-${n}z`;
    }
  });
  return { w: rows[0].length, h: rows.length, paths: Object.entries(d).map(([c, p]): [string, string] => [pal[c], p]) };
};
export const svg = (rows: string[], cls = '', pal: Pal = PAL, z = 1) => {
  const { w, h, paths } = svgParts(rows, pal);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 ${w} ${h}" width="${w * z}" height="${h * z}" shape-rendering="crispEdges">${paths.map(([f, p]) => `<path fill="${f}" d="${p}"/>`).join('')}</svg>`;
};
const uri = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
// the same sprites onto a 2D canvas (tile labels, dice, token sprites)
export const paint = (g: CanvasRenderingContext2D, rows: string[], x0: number, y0: number, pal: Pal = PAL) =>
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') { g.fillStyle = pal[c]; g.fillRect(x0 + x, y0 + y, 1, 1); } }));
// a w x h canvas, drawn by draw(ctx, w, h) (3D textures)
export const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  draw(c.getContext('2d')!, w, h);
  return c;
};

// ---- Hard-edged text for the 3D textures. The Jersey fonts are pixel fonts: every outline is a staircase on a fixed grid (Jersey 10 has 56/3 grid steps
// per em, Jersey 15 has 27), so drawn at the size where one step is one texel (n = cap height / 5: Jersey 10 is n = 2, Jersey 15 is n = 3) every edge
// lands on a texel, and a threshold is all it takes to drop the grey anti-aliasing of plain fillText, which looks soft next to the pixel-sharp ground.
// At n = 1 a letter has only 5 texels to live on and no font stays legible there (5 and 6, 8 and 9 merge), so a hand-drawn 3x5 set takes over. ----
const TINY: Record<string, string> = { // '#' = ink; rows from the top down to the baseline, then an optional '|' and the rows hanging below it
  A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.', E: '###/#../##./#../###',
  F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#', I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.',
  K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###', M: '#...#/##.##/#.#.#/#...#/#...#', N: '#..#/##.#/#.##/#..#/#..#', O: '.#./#.#/#.#/#.#/.#.',
  P: '##./#.#/##./#../#..', Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
  U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#...#/#...#/#.#.#/##.##/#...#', X: '#.#/#.#/.#./#.#/#.#', Y: '#.#/#.#/.#./.#./.#.',
  Z: '###/..#/.#./#../###',
  0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '##./..#/.#./#../###', 3: '##./..#/.##/..#/##.', 4: '#.#/#.#/###/..#/..#',
  5: '###/#../##./..#/##.', 6: '.##/#../###/#.#/###', 7: '###/..#/.#./.#./.#.', 8: '###/#.#/###/#.#/###', 9: '###/#.#/###/..#/##.',
  $: '.#./.##/##./.#./.##/##.|.#.', ',': '#|#', '.': '#', "'": '#/#/././.', '-': '###/./.',
  // pictograms, for the signs that would have too many letters: taller than a letter, since a sign stands upright and the view squashes it to about 0.6 of its height
  '♠': '...#.../..###../.#####./#######/#######/#######/...#.../..###..', '♥': '.##.##./#######/#######/#######/#######/.#####./..###../...#...',
  '♦': '...#.../..###../.#####./#######/#######/.#####./..###../...#...', '★': '...#.../..###../#######/.#####./..###../.##.##./.#...#.',
  '⊕': '..###../.#.#.#./#..#..#/#######/#..#..#/.#.#.#./..###..', '🔒': '..###../..#.#../..#.#../#######/###.###/###.###/#######',
};
const FONT: Record<number, [string, number]> = { 2: ['Jersey 10', 56 / 3], 3: ['Jersey 15', 27] }; // n -> [family, px size at which one grid step is one texel]
interface Glyph { px: [number, number][]; wide: number; adv: number }
const glyphs: Record<string, Glyph> = {};
const tiny = (ch: string): Glyph => { // an accent (Á, É, Í) is one texel above the capital's right corner
  const [base, mark] = ch.normalize('NFD'), [top = '', low = ''] = (TINY[base] ?? '').split('|'), px: [number, number][] = [];
  top.split('/').reverse().forEach((r, j) => [...r].forEach((c, x) => c === '#' && px.push([x, -1 - j])));
  low.split('/').forEach((r, j) => [...r].forEach((c, x) => c === '#' && px.push([x, j])));
  const wide = Math.max(0, ...px.map(([x]) => x + 1));
  if (mark) px.push([2, -6]);
  return { px, wide, adv: wide ? wide + 1 : 2 };
};
const scaled = (ch: string, n: number): Glyph => { // the character is rasterised alone, shifted so its left ink edge sits on texel 0
  const [family, size] = FONT[n], w = 7 * n, h = 11 * n, px: [number, number][] = []; let adv = 0, wide = 0; // baseline 8n rows down: room for accents and $ ,
  const a = canvas(w, h, (g) => {
    g.font = `${size}px "${family}"`;
    const m = g.measureText(ch); g.fillText(ch, Math.round(m.actualBoundingBoxLeft), 8 * n); adv = m.width;
  }).getContext('2d')!.getImageData(0, 0, w, h).data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (a[(j * w + i) * 4 + 3] > 127) { px.push([i, j - 8 * n]); wide = Math.max(wide, i + 1); }
  return { px, wide, adv: Math.max(Math.round(adv), wide + 1) };
};
const glyph = (ch: string, n: number) => (glyphs[ch + n] ??= n > 1 ? scaled(ch, n) : tiny(ch)); // -> { px: texels [x, y] (y counts down from the baseline), wide: ink width, adv: advance }
export const inkWidth = (str: string, n: number) => [...str].reduce((x, ch, k, all) => x + glyph(ch, n)[k < all.length - 1 ? 'adv' : 'wide'], 0);
export const inkHeight = (str: string, n: number) => Math.max(...[...str].flatMap((ch) => glyph(ch, n).px.map(([, j]) => -j))); // the rows above the baseline
export function ink(g: CanvasRenderingContext2D, str: string, n: number, x: number, y: number, s = 1) { // (x, y) is the left end of the baseline, painted in g's fill colour; s: texels to an ink pixel
  for (const ch of str) { const o = glyph(ch, n); for (const [i, j] of o.px) g.fillRect(x + i * s, y + j * s, s, s); x += o.adv * s; }
}

// ---- 9-slice frames: thickness T, round corners; tones = [top, right, bottom, left], each outer -> inner ----
const frame = (T: number, [top, right, bottom, left]: [string, string, string, string]) => {
  const N = 2 * T + 2, R = T + 0.1;
  return [...Array(N)].map((_, y) => [...Array(N)].map((_, x) => {
    const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
    const h = x < N / 2 ? left : right, v = y < N / 2 ? top : bottom;
    if (cx >= T && cy >= T) return '.';
    if (cx >= T) return v[cy];
    if (cy >= T) return h[cx];
    const k = Math.floor(R - Math.hypot(R - cx - 0.5, R - cy - 0.5));
    return k < 0 ? '.' : (cx < cy ? h : v)[Math.min(k, T - 1)];
  }).join(''));
};

// ---- 16x16 icons ----
export const ICONS: Record<string, string[]> = {
  coin: [
    '.....oooooo.....', '...oowyyyyYoo...', '..oyyyYYYYYYgo..', '.oyyYGyYYYGYggo.',
    '.oyYGyGGGGYGggo.', 'oyYGyYYGGYYgGggo', 'oyGyyYYGGYYYgGgo', 'oyGyYYYGGYYggGgo',
    'oYGYYYYGGYYggGgo', 'oYGYYYYGGYgggGgo', 'oYYGYYYGGYgggGgo', '.oYgGYGGGGgGgGo.',
    '.oYgGGYYggGGgGo.', '..oggggggggGGo..', '...ooggggGGoo...', '.....oooooo.....',
  ],
  city: [
    '.......oo.......', '......orRo......', '.....orRRRo.....', '....orrRRRRo....',
    '...orrRRRRRRo...', '..orrRRRRRRRRo..', '.orrRRRRRRRRRRo.', 'orrRRRRRRRRRRqqo',
    'oooooooooooooooo', '..obbbbbbbbbbo..', '..oxllxxxxllxo..', '..oxLLxxxxLLxo..',
    '..oxxxkkkkxxbo..', '..oxxxkKKkxxbo..', '..oxxxkKYkxxbo..', '..oooooooooooo..',
  ],
  brief: [
    '................', '....oooooooo....', '....oggggggo....', '....ogoooogo....',
    '....ogo..ogo....', '.oooooooooooooo.', '.otttttttttttto.', '.otkkkkkkkkkkko.',
    '.otkkkkYYkkkkko.', '.oKKKKKggKKKKKo.', '.otkkkkYYkkkkko.', '.otkkkkYYkkkkko.',
    '.otkkkkkkkkkkko.', '.oKKKKKKKKKKKKo.', '.oooooooooooooo.', '................',
  ],
  lock: [
    '................', '...oooooooooo...', '...obbbbbbbbo...', '...obboooobbo...',
    '...obbo..obbo...', '...obbo..obbo...', '.oooooooooooooo.', '.oyyyyyyyyyyyyo.',
    '.oYYYYYooYYYYgo.', '.oYYYYooooYYYgo.', '.oYYYYYooYYYYgo.', '.oYYYYYooYYYYgo.',
    '.oYYYYYYYYYYYgo.', '.ogggggggggggGo.', '.oooooooooooooo.', '................',
  ],
  left: [
    '................', '........o.......', '.......oo.......', '......oao.......',
    '.....oabo.......', '....oabbboooooo.', '...oabbbbbbbbbo.', '..oabbbbbbbbbco.',
    '..obbbbbbbbbcco.', '...obbbbbbbccco.', '....obbbboooooo.', '.....obbo.......',
    '......obo.......', '.......oo.......', '........o.......', '................',
  ],
  right: [
    '................', '.......o........', '.......oo.......', '.......obo......',
    '.......obbo.....', '.oooooobbbbo....', '.oaaabbbbbbbo...', '.oaabbbbbbbbbo..',
    '.oabbbbbbbbbco..', '.obbbbbbbbbco...', '.oooooobbbco....', '.......obco.....',
    '.......oco......', '.......oo.......', '.......o........', '................',
  ],
  plus: [
    '................', '................', '......oooo......', '......oaao......',
    '......oaao......', '......oabo......', '..ooooabbboooo..', '..oaaabbbbbcco..',
    '..oaabbbbbccco..', '..oooobbbcoooo..', '......obco......', '......occo......',
    '......occo......', '......oooo......', '................', '................',
  ],
  minus: [
    '................', '................', '................', '................',
    '................', '................', '..oooooooooooo..', '..oaaabbbbbcco..',
    '..oaabbbbbccco..', '..oooooooooooo..', '................', '................',
    '................', '................', '................', '................',
  ],
  focus: [
    '......oooo......', '......oyyo......', '......oyyo......', '.....oyyyYo.....',
    '....oyooooYo....', '...oyo....oYo...', 'oooyo......oYooo', 'oyyyo..oo..ogggo',
    'oyyyo..oo..ogggo', 'oooYo......ogooo', '...oYo....ogo...', '....oYoooogo....',
    '.....oYgggo.....', '......oggo......', '......oggo......', '......oooo......',
  ],
  globe: [
    '.....oooooo.....', '...oollllLLoo...', '..olllllLLLLLo..', '.ollnnnLnnNLLLo.',
    '.olnnnnnnNNLLLo.', 'ollnnnnnNNNLLLuo', 'ollnnnnNLLLLLuuo', 'ollLnnNLLLLLuuuo',
    'olLnLLLNNNNuuuuo', 'oLnnNLLNNNNmuuuo', 'oLLNLLLLNNmmuuuo', '.oLLLLLLNmmuuuo.',
    '.oLLLLLuumuuuuo.', '..oLLLuuuuuuuo..', '...oouuuuuuoo...', '.....oooooo.....',
  ],
  home: [
    '................', '.......oo.......', '......oabo......', '.....oaabbo.....',
    '....oaabbcco....', '...oaabbcccco...', '..oaabbbccccco..', '..oooooooooooo..',
    '....obbbbbbo....', '....obxbbxbo....', '....obbkkbbo....', '....obbkKbbo....',
    '....obbkKbbo....', '....obbkKbbo....', '..oooooooooooo..', '................',
  ],
  help: [
    '.....oooooo.....', '...oolllllloo...', '..olllLLLLlllo..', '.ollLLLLLLLLuuo.',
    '.olLLLwwwwLLLuo.', 'ollLLwwLLwwLLuuo', 'olLLLLLLwwLLLuuo', 'olLLLLLwwLLLuuuo',
    'olLLLLLwwLLuuuuo', 'olLLLLLLLLuuuuuo', 'ollLLLLwwuuuuuuo', '.olLLLLLuuuuuuo.',
    '.oluLLLuuuuuuuo.', '..ouuuuuuuuuuo..', '...oouuuuuuoo...', '.....oooooo.....',
  ],
  menu: [
    '................', '.oooooooooooooo.', '.oaaaaaaaaaaaao.', '.obbbbbbbbbbbbo.',
    '.oooooooooooooo.', '................', '.oooooooooooooo.', '.oaaaaaaaaaaaao.',
    '.obbbbbbbbbbbbo.', '.oooooooooooooo.', '................', '.oooooooooooooo.',
    '.oaaaaaaaaaaaao.', '.obbbbbbbbbbbbo.', '.oooooooooooooo.', '................',
  ],
  crown: [
    '................', '................', '.oo....oo....oo.', '.oYo..oYYo..oYo.',
    '.oYYo.oYYo.oYYo.', '.oYYYooYYooYYYo.', '.oyYYYYYYYYYYgo.', '.oyYYYYYYYYYYgo.',
    '.oyYYYYRRYYYYgo.', '.oYYYYYRRYYYYgo.', '.oggggggggggggo.', '.oGGGGGGGGGGGGo.',
    '.oooooooooooooo.', '................', '................', '................',
  ],
  star: [
    '.......oo.......', '......oyyo......', '......oyYo......', '.....oyyYYo.....',
    'ooooooyyYYoooooo', 'oyyyyyyYYYYYYYYo', '.oyyyyyYYYYYYYo.', '..oyyyyYYYYYYo..',
    '...oyyyYYYYYo...', '...oyyYYYYYYo...', '..oyyYYYYYYYYo..', '..oyYYYYYYYYYo..',
    '.oyYYYYoooYYYYo.', '.oyYYYo...oYYYo.', '.oYYoo.....ooYo.', '..ooo.......ooo.',
  ],
};
const CHECK = [
  '.........oo.', '........owwo', '.......owwo.', '.oo...owwo..', 'owwo.owwo...', '.owwowwo....', '..owwwo.....', '...owo......', '....o.......',
];

// ---- cursors (shown at 2x), menu pointer, sparkle ----
const CURSORS: Record<string, string[]> = {
  arrow: [
    'o...........', 'oo..........', 'owo.........', 'owwo........', 'owwwo.......', 'owwwwo......', 'owwwwwo.....', 'owwwwwwo....',
    'owwwwwwwo...', 'owwwwwooooo.', 'owwowwo.....', 'owo.owwo....', 'oo..owwo....', 'o....owwo...', '.....owwo...', '......oo....',
  ],
  hand: [
    '......oo........', '.....owwo.......', '.....owwo.......', '.....owwo.......', '.....owwooo.....', '.....owwowwooo..', '.oo..owwowwowwo.', 'owwo.owwwwwwwwwo',
    'owwwowwwwwwwwwwo', '.owwwwwwwwwwwwwo', '..owwwwwwwwwwwo.', '..oaaaaaaaaaaao.', '...oaaaaaaaaao..', '...obbbbbbbbbo..', '....obbbbbbbo...', '....ooooooooo...',
  ],
};
const TRI = ['oo......', 'oyoo....', 'oyyYoo..', 'oyyYYYoo', 'oyYYYggo', 'oYYYggoo', 'oYggoo..', 'oGoo....', 'oo......'];
const SPARK = ['...y...', '...y...', '..yyy..', 'yyywyyy', '..yyy..', '...y...', '...y...'];

// ---- n x n dice (16 for the HUD, a world-density face for the 3D dice): rounded body lit from the top-left, square pips on a 3x3 grid ----
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export const dieRows = (v: number, n = 16) => {
  const rows: string[][] = [...Array(n)].map((_, y) => [...Array(n)].map((_, x) => {
    const corner = (x === 1 || x === n - 2) && (y === 1 || y === n - 2);
    if (corner || x === 0 || x === n - 1 || y === 0 || y === n - 1) return (x < 2 || x > n - 3) && (y < 2 || y > n - 3) && !corner ? '.' : 'o';
    const m = Math.min(x, y) - 1, k = Math.min(n - 2 - x, n - 2 - y);
    return k === 0 ? 'b' : m === 0 ? 'w' : k === 1 ? 'a' : 'x';
  }));
  const p = Math.max(1, 2 * Math.round(n / 16)), a = Math.round(n * 0.19), at = [a, (n - p) / 2, n - a - p]; // pip size and the three pip positions (n - p must be even)
  (PIPS[v] || []).forEach((i) => {
    for (let dy = 0; dy < p; dy++) for (let dx = 0; dx < p; dx++) rows[at[(i / 3) | 0] + dy][at[i % 3] + dx] = v === 1 ? (dx + dy ? 'q' : 'R') : (dx + dy ? 'o' : 'e');
  });
  return rows.map((r) => r.join(''));
};

// ---- player portraits: shared bust + one hat per player (matches the 3D token hats) ----
// A B C D = the player's colour ramp (light -> deep), h i j = the hair ramp
const BUST = [
  '.ohhhhSSSShhhho.', '.ohSwoSSSSwoSho.', '.ohSooSSSSooSho.', '.ohrSSSSSSSSrho.', '.ohSSSSqqSSSSho.', '..ohSSSSSSSSho..', '.oBBBBBttBBBBBo.', 'oABBBBBAAABBBBCo', 'oCCCCCCCCCCCCCCo',
];
const HATS = [
  ['................', '....oooooooo....', '...oAAAAAAAAo...', '..oAABBBBBBBBo..', '.oAABBBBBBBBBCo.', '.oABBBBBBBBBBCo.', 'ooCCCCCCCCCCCCoo'], // cap
  ['.....oooooo.....', '....owwwwwao....', '....owwaabbo....', '...oAAAAAAAAo...', '..oAABBBBBBBBo..', '.oAABBBBBBBBBCo.', '.oCBCBCBCBCBCBo.'], // beanie
  ['....oo....oo....', '...oNNo..oNNo...', '...oNNNooNNmo...', '....oNNmmNmo....', '..ooommmmmmooo..', '.ohjjhhhhhhhhho.', '.ohhhhhhhhhhhho.'], // sprout
  ['.......oo.......', '..oo..oYYo..oo..', '..oYo.oYYo.oYo..', '..oYYooYYooYYo..', '..oyYYYYYYYYgo..', '.oggggRRggggggo.', '.oGGGGGGGGGGGGo.'], // crown
];
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
export const lum = (c: number) => (((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114) / 255;
export const shade = (c: number, k: number, t = 0) => hex([16, 8, 0].reduce((a, s) => a | (Math.min(255, Math.round(((c >> s) & 255) * k + t)) << s), 0));
export const faceRows = (idx: number) => [...HATS[idx], ...BUST];
const HAIR = [0x3a2e48, 0xe8c066, 0x7a4a2a, 0xb4502a]; // black, blond, brown, auburn
export const facePal = (c: number, idx = 0): Pal => ({ ...PAL, A: shade(c, 0.5, 128), B: hex(c), C: shade(c, 0.72), D: shade(c, 0.45, 8), h: shade(HAIR[idx], 1), i: shade(HAIR[idx], 0.6), j: shade(HAIR[idx], 1.3, 24) });

// ---- the 3D chibi token's face and hoodie front (actors.js): one drawing per zoom level [far, mid, near], each on its level's texel grid; h i j = the hair ramp ----
export const FACE = [
  ['hhhhhh', 'hSSSSh', 'SoSSoS', 'SrSSrS'],
  ['hhhhhhhhhhh', 'hhhhhhhhhhh', 'hhhSSSSShhh', 'hsssssssssh', 'hswossswosh', 'hsoosssoosh', 'hrsssqsssrh', 'hrSSSSSSSrh'],
  [
    'hhhhhhhhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhhhhhhhh',
    'hhhhhhhhhSSSShhhhhhhhh', 'hhhhhSSSSssssSSSShhhhh', 'hhSSSssssssssssssSSShh', 'hhsssoossssssssoossshh',
    'hhssoooossssssoooosshh', 'hhssowwossssssowwosshh', 'hhssowwossssssowwosshh', 'hhssoccossssssoccosshh',
    'hhsssoossssssssoossshh', 'hhrrrssssossossssrrrhh', 'hhrrrsssssoosssssrrrhh', 'hhSSSSSSSSSSSSSSSSSShh',
  ],
];
export const TORSO = [
  ['BBB', 'BCB', 'DDD'],
  ['BBBBBB', 'BBBBBB', 'BBBBBB', 'BAAAAB', 'BCCCCB', 'DDDDDD'],
  [
    'BBBBBBBBBBBB', 'BBBBBBBBBBBB', 'BBBBBBBBBBBB', 'BBBBBBBBBBBB', 'BBBBBBBBBBBB', 'BBBBBBBBBBBB',
    'BBAAAAAAAABB', 'BBCBBBBBBCBB', 'BBCBBBBBBCBB', 'BBCCCCCCCCBB', 'BBBBBBBBBBBB', 'DDDDDDDDDDDD',
  ],
];

// ---- 9-slice frame presets as CSS url()s: windows (T=4), buttons (T=3) up/down, sunken inputs ----
const F = (T: number, tl: string, br: string) => uri(svg(frame(T, [tl, br, br, tl])));
const rev = (s: string) => [...s].reverse().join('');
const BTN = (k: string, hi: string, lo: string) => ({ [k]: F(3, 'o' + hi, 'o' + lo), [k + 'Dn']: F(3, 'o' + rev(lo), 'o' + rev(hi)) }); // raised / pressed
const FRAMES = {
  win: F(4, 'obce', 'ocdO'), gold: F(4, 'oyYG', 'ogGH'), red: F(4, 'orRQ', 'oRqQ'), green: F(4, 'onNM', 'oNmM'),
  paper: F(4, 'oxtk', 'otkK'), neon: F(4, 'opPv', 'oPvO'), cyan: F(4, 'olLu', 'oLuU'), inset: F(3, 'oOe', 'ocb'), well: F(3, 'oOe', 'oed'),
  ...BTN('btn', 'bc', 'de'), ...BTN('btnGreen', 'nN', 'mM'), ...BTN('btnRed', 'rR', 'qQ'), ...BTN('btnGold', 'yY', 'GH'),
};

// Publish frames, sprites and cursors as CSS custom properties (--fr-*, --spr-*, --cur-*) for the stylesheets.
export const skin = (root: HTMLElement = document.documentElement) => {
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  for (const [k, v] of Object.entries(FRAMES)) set('--fr-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v);
  for (const [k, rows] of Object.entries({ check: CHECK, tri: TRI, spark: SPARK })) set('--spr-' + k, uri(svg(rows)));
  set('--cur-arrow', `${uri(svg(CURSORS.arrow, '', PAL, 2))} 0 0, default`);
  set('--cur-hand', `${uri(svg(CURSORS.hand, '', PAL, 2))} 10 0, pointer`);
};

// ---- Pixel logo: rasterise text at 1x, then shade it by hand: banded fill, bevel, outline, extrusion ----
export const logo = (text: string, bands: string[], shadow: string[], font: string) => {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const m = probe.measureText(text), up = Math.ceil(m.actualBoundingBoxAscent), h = up + Math.ceil(m.actualBoundingBoxDescent), pad = 6;
  const W = Math.ceil(m.width) + pad * 2, H = h + pad * 2;
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = cv.getContext('2d', { willReadFrequently: true })!;
  g.font = font;
  g.fillText(text, pad, pad + up);
  const a = g.getImageData(0, 0, W, H).data;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && a[(y * W + x) * 4 + 3] > 127;
  const near = (x: number, y: number) => on(x, y) || on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y + 1) || on(x - 1, y + 1) || on(x + 1, y - 1);
  const out = g.createImageData(W, H), put = (x: number, y: number, c: number[]) => out.data.set([...c, 255], (y * W + x) * 4);
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [B, S, ink] = [bands.map(rgb), shadow.map(rgb), rgb(PAL.o)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (on(x, y)) put(x, y, !on(x, y - 1) || !on(x - 1, y) ? B[0] : !on(x, y + 1) ? B[B.length - 1] : B[Math.min(B.length - 1, Math.floor(((y - pad) / h) * B.length))]);
    else if (near(x, y)) put(x, y, ink);
    else for (let k = 1; k <= 4; k++) if (near(x - k, y - k)) { put(x, y, S[Math.min(S.length - 1, k - 1)]); break; }
  }
  g.clearRect(0, 0, W, H);
  g.putImageData(out, 0, 0);
  return cv;
};
