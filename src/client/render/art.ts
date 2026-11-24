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

export const svgParts = (rows: string[], pal: Pal = PAL) => {
  const d: Record<string, string> = {};
  tones(rows, pal).forEach((r, y) => {
    for (let x = 0, n: number; x < r.length; x += n) {
      for (n = 1; r[x + n] === r[x]; n++);
      if (r[x]) d[r[x]] = (d[r[x]] || '') + `M${x} ${y}h${n}v1h-${n}z`;
    }
  });
  return { w: rows[0].length, h: rows.length, paths: Object.entries(d) };
};
export const svg = (rows: string[], cls = '', pal: Pal = PAL, z = 1) => {
  const { w, h, paths } = svgParts(rows, pal);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 ${w} ${h}" width="${w * z}" height="${h * z}" shape-rendering="crispEdges">${paths.map(([f, p]) => `<path fill="${f}" d="${p}"/>`).join('')}</svg>`;
};
const uri = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
export const paint = (g: CanvasRenderingContext2D, rows: string[], x0: number, y0: number, pal: Pal = PAL) =>
  tones(rows, pal).forEach((r, y) => r.forEach((c, x) => { if (c) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); } }));
const ctx2d = () => {
  const store: Record<PropertyKey, unknown> = {};
  const px = new Proxy(store, {
    get: (o, p) => (o[p] ??= p === 'measureText' ? () => ({ width: 0 }) : p === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => px),
    set: (o, p, v) => ((o[p] = v), true),
  });
  return px as unknown as CanvasRenderingContext2D;
};
export const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const c = (typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: w, height: h })
    : { width: w, height: h, getContext: ctx2d }) as HTMLCanvasElement;
  draw(c.getContext('2d')!, w, h);
  return c;
};

export type Fill = (c: string, x: number, y: number, w: number, h: number) => void;
export const filler = (g: CanvasRenderingContext2D): Fill => (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

const TINY: Record<string, string> = {
  A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.', E: '###/#../##./#../###',
  F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#', I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.',
  K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###', M: '#...#/##.##/#.#.#/#...#/#...#', N: '#..#/##.#/#.##/#..#/#..#', O: '.#./#.#/#.#/#.#/.#.',
  P: '##./#.#/##./#../#..', Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
  U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#...#/#...#/#.#.#/##.##/#...#', X: '#.#/#.#/.#./#.#/#.#', Y: '#.#/#.#/.#./.#./.#.',
  Z: '###/..#/.#./#../###',
  0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '##./..#/.#./#../###', 3: '##./..#/.##/..#/##.', 4: '#.#/#.#/###/..#/..#',
  5: '###/#../##./..#/##.', 6: '.##/#../###/#.#/###', 7: '###/..#/.#./.#./.#.', 8: '###/#.#/###/#.#/###', 9: '###/#.#/###/..#/##.',
  $: '.#./.##/##./.#./.##/##.|.#.', ',': '#|#', '.': '#', "'": '#/#/././.', '-': '###/./.',
  '♠': '...#.../..###../.#####./#######/#######/#######/...#.../..###..', '♥': '.##.##./#######/#######/#######/#######/.#####./..###../...#...',
  '♦': '...#.../..###../.#####./#######/#######/.#####./..###../...#...', '★': '...#.../..###../#######/.#####./..###../.##.##./.#...#.',
  '⊕': '..###../.#.#.#./#..#..#/#######/#..#..#/.#.#.#./..###..', '🔒': '..###../..#.#../..#.#../#######/###.###/###.###/#######',
};
interface Glyph { px: [number, number][]; wide: number; adv: number }
const glyphs: Record<string, Glyph> = {};
const tiny = (ch: string): Glyph => {
  const [base, mark] = ch.normalize('NFD'), [top = '', low = ''] = (TINY[base] ?? '').split('|'), px: [number, number][] = [];
  top.split('/').reverse().forEach((r, j) => [...r].forEach((c, x) => c === '#' && px.push([x, -1 - j])));
  low.split('/').forEach((r, j) => [...r].forEach((c, x) => c === '#' && px.push([x, j])));
  const wide = Math.max(0, ...px.map(([x]) => x + 1));
  if (mark) px.push([2, -6]);
  return { px, wide, adv: wide ? wide + 1 : 2 };
};
const glyph = (ch: string) => (glyphs[ch] ??= tiny(ch));
export const inkWidth = (str: string) => [...str].reduce((x, ch, k, all) => x + glyph(ch)[k < all.length - 1 ? 'adv' : 'wide'], 0);
export const inkHeight = (str: string) => Math.max(...[...str].flatMap((ch) => glyph(ch).px.map(([, j]) => -j)));
export function ink(g: CanvasRenderingContext2D, str: string, x: number, y: number, s = 1) {
  for (const ch of str) { const o = glyph(ch); for (const [i, j] of o.px) g.fillRect(x + i * s, y + j * s, s, s); x += o.adv * s; }
}
const THIN: Record<string, string> = { M: '#.#/###/###/#.#/#.#', N: '###/#.#/#.#/#.#/#.#', W: '#.#/#.#/###/###/#.#' };
export function codePixels(code: string) {
  const px: [number, number][] = [], x0 = 6 - 2 * code.length;
  [...code].forEach((ch, k) => (THIN[ch] ?? TINY[ch]).split('/').forEach((r, y) => [...r].forEach((c, x) => c === '#' && px.push([x0 + 4 * k + x, y]))));
  return px;
}

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
  pixel: [
    '................', '................', '..ooooo..ooooo..', '..oYYYo..oLLLo..',
    '..oYYYo..oLLLo..', '..oYYYo..oLLLo..', '..ooooo..ooooo..', '................',
    '..ooooo..ooooo..', '..oRRRo..oNNNo..', '..oRRRo..oNNNo..', '..oRRRo..oNNNo..',
    '..ooooo..ooooo..', '................', '................', '................',
  ],
  full: [
    'ooooooo..ooooooo', 'oaaaaao..oaaaaao', 'oabccco..oaccbco', 'oacoooo..ooooaco',
    'oaco........oaco', 'oaco........oaco', 'oooo........oooo', '................',
    '................', 'oooo........oooo', 'oaao........oaao', 'oaco........oaco',
    'oacoooo..ooooaco', 'oabaaao..oaaabco', 'oacccco..oacccco', 'ooooooo..ooooooo',
  ],
  shrink: [
    '...oooo..oooo...', '...oaao..oaao...', '...oaco..oaco...', 'ooooaco..oacoooo',
    'oaaabco..oabaaao', 'oacccco..oacccco', 'ooooooo..ooooooo', '................',
    '................', 'ooooooo..ooooooo', 'oaaaaao..oaaaaao', 'oaccbco..oabccco',
    'ooooaco..oacoooo', '...oaco..oaco...', '...oaco..oaco...', '...oooo..oooo...',
  ],
  sound: [
    '................', '......oo........', '.....oao...oo...', '....oaao..oYgo..',
    '.ooooabo...oYo..', 'oaaabbbo.oo.oYo.', 'oabbbbbo.oYo.oYo', 'oabbbbbo..oYooYo',
    'oabbbbbo..oYooYo', 'obbbbcco.oYo.oYo', 'obbbbcco.oo.oYo.', '.oooobco...oYo..',
    '....occo..oYgo..', '.....oco...oo...', '......oo........', '................',
  ],
  mute: [
    '................', '......oo........', '.....oao........', '....oaao........',
    '.ooooabo.oo...oo', 'oaaabbbo.oro.oro', 'oabbbbbo..oRoRo.', 'oabbbbbo...oRo..',
    'oabbbbbo..oRoRo.', 'obbbbcco.oqo.oqo', 'obbbbcco.oo...oo', '.oooobco........',
    '....occo........', '.....oco........', '......oo........', '................',
  ],
};
const CHECK = [
  '.........oo.', '........owwo', '.......owwo.', '.oo...owwo..', 'owwo.owwo...', '.owwowwo....', '..owwwo.....', '...owo......', '....o.......',
];

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

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export const dieRows = (v: number, n = 16) => {
  const rows: string[][] = [...Array(n)].map((_, y) => [...Array(n)].map((_, x) => {
    const corner = (x === 1 || x === n - 2) && (y === 1 || y === n - 2);
    if (corner || x === 0 || x === n - 1 || y === 0 || y === n - 1) return (x < 2 || x > n - 3) && (y < 2 || y > n - 3) && !corner ? '.' : 'o';
    const m = Math.min(x, y) - 1, k = Math.min(n - 2 - x, n - 2 - y);
    return k === 0 ? 'b' : m === 0 ? 'w' : k === 1 ? 'a' : 'x';
  }));
  const p = Math.max(1, 2 * Math.round(n / 16)), a = Math.round(n * 0.19), at = [a, (n - p) / 2, n - a - p];
  (PIPS[v] || []).forEach((i) => {
    for (let dy = 0; dy < p; dy++) for (let dx = 0; dx < p; dx++) rows[at[(i / 3) | 0] + dy][at[i % 3] + dx] = v === 1 ? (dx + dy ? 'q' : 'R') : (dx + dy ? 'O' : 'e');
  });
  return rows.map((r) => r.join(''));
};

const BUST = [
  '.ohhhhSSSShhhho.', '.ohSwoSSSSwoSho.', '.ohSooSSSSooSho.', '.ohrSSSSSSSSrho.', '.ohSSSSqqSSSSho.', '..ohSSSSSSSSho..', '.oBBBBBttBBBBBo.', 'oABBBBBAAABBBBCo', 'oCCCCCCCCCCCCCCo',
];
const HATS = [
  ['................', '....oooooooo....', '...oAAAAAAAAo...', '..oAABBBBBBBBo..', '.oAABBBBBBBBBCo.', '.oABBBBBBBBBBCo.', 'ooCCCCCCCCCCCCoo'],
  ['.....oooooo.....', '....owwwwwao....', '....owwaabbo....', '...oAAAAAAAAo...', '..oAABBBBBBBBo..', '.oAABBBBBBBBBCo.', '.oCBCBCBCBCBCBo.'],
  ['....oo....oo....', '...oNNo..oNNo...', '...oNNNooNNmo...', '....oNNmmNmo....', '..ooommmmmmooo..', '.ohjjhhhhhhhhho.', '.ohhhhhhhhhhhho.'],
  ['.......oo.......', '..oo..oYYo..oo..', '..oYo.oYYo.oYo..', '..oYYooYYooYYo..', '..oyYYYYYYYYgo..', '.oggggRRggggggo.', '.oGGGGGGGGGGGGo.'],
];
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
export const lum = (c: number) => (((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114) / 255;
export const shade = (c: number, k: number, t = 0) => hex([16, 8, 0].reduce((a, s) => a | (Math.min(255, Math.round(((c >> s) & 255) * k + t)) << s), 0));

// Selective outline: the fill's own hue, darker and nudged toward cool, so no outline is a shared near-black. OUTLINE_GLSL mirrors outline() for the depth-edge pass in scene.ts.
const SELOUT = { valueScale: 0.38, saturationScale: 1.5, saturationFloor: 0.5, valueFloor: 0.17, coolPull: 0.1, coolHueDegrees: 235 };
export const outline = (color: string) => {
  const { valueScale, saturationScale, saturationFloor, valueFloor, coolPull, coolHueDegrees } = SELOUT;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const top = Math.max(r, g, b), span = top - Math.min(r, g, b);
  const hue = span <= top * 0.05 ? coolHueDegrees : 60 * (top === r ? ((g - b) / span + 6) % 6 : top === g ? (b - r) / span + 2 : (r - g) / span + 4);
  const saturation = Math.min(1, Math.max(saturationFloor, (span / top || 0) * saturationScale));
  const value = Math.max(top * valueScale, Math.min(top, valueFloor));
  const sextant = ((hue + (((coolHueDegrees - hue + 540) % 360) - 180) * coolPull + 360) % 360) / 60;
  const channel = (n: number) => { const k = (n + sextant) % 6; return Math.round(255 * value * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return '#' + [5, 3, 1].map((n) => channel(n).toString(16).padStart(2, '0')).join('');
};
export const outlineVar = (color: number) => ({ '--ol': outline(hex(color)) });
const glslFloat = (n: number) => n.toFixed(4);
export const OUTLINE_GLSL = `
  vec3 outlineOf(vec3 linear) {
    vec3 c = pow(clamp(linear, 0., 1.), vec3(1. / 2.2));
    float top = max(c.r, max(c.g, c.b)), spread = top - min(c.r, min(c.g, c.b)), hue = ${glslFloat(SELOUT.coolHueDegrees)};
    if (spread > top * 0.05) hue = 60. * (top == c.r ? mod((c.g - c.b) / spread + 6., 6.) : top == c.g ? (c.b - c.r) / spread + 2. : (c.r - c.g) / spread + 4.);
    float sat = clamp(spread / max(top, 1e-4) * ${glslFloat(SELOUT.saturationScale)}, ${glslFloat(SELOUT.saturationFloor)}, 1.), val = max(top * ${glslFloat(SELOUT.valueScale)}, min(top, ${glslFloat(SELOUT.valueFloor)}));
    vec3 k = mod(vec3(5., 3., 1.) + mod(hue + (mod(${glslFloat(SELOUT.coolHueDegrees)} - hue + 540., 360.) - 180.) * ${glslFloat(SELOUT.coolPull)} + 360., 360.) / 60., 6.);
    return pow(val * (1. - sat * clamp(min(k, 4. - k), 0., 1.)), vec3(2.2));
  }`;
// Sprite key 'o' is not a colour: it takes the outline of the dominant nearby fill (closer pixels weigh more, ties go to the darker). Use 'O' for solid dark fills.
const neighbourOutline = (rows: string[], pal: Pal, x: number, y: number) => {
  const hexValue = (key: string) => parseInt(pal[key].slice(1), 16);
  for (let reach = 1; reach <= 3; reach++) {
    const weight: Record<string, number> = {};
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const key = rows[y + dy]?.[x + dx];
      if (key && key !== 'o' && pal[key]) weight[key] = (weight[key] ?? 0) + 1 / (dx * dx + dy * dy);
    }
    const [best] = Object.keys(weight).sort((a, b) => weight[b] - weight[a] || lum(hexValue(a)) - lum(hexValue(b)));
    if (best) return outline(pal[best]);
  }
  return pal.O;
};
const tones = (rows: string[], pal: Pal) => rows.map((row, y) => [...row].map((key, x) => (key === 'o' ? neighbourOutline(rows, pal, x, y) : pal[key] ?? '')));
export const faceRows = (idx: number) => [...HATS[idx], ...BUST];
const HAIR = [0x3a2e48, 0xe8c066, 0x7a4a2a, 0xb4502a];
export const facePal = (c: number, idx = 0): Pal => ({ ...PAL, A: shade(c, 0.5, 128), B: hex(c), C: shade(c, 0.72), D: shade(c, 0.45, 8), h: shade(HAIR[idx], 1), i: shade(HAIR[idx], 0.6), j: shade(HAIR[idx], 1.3, 24) });

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

const F = (T: number, tl: string, br: string) => uri(svg(frame(T, [tl, br, br, tl])));
const rev = (s: string) => [...s].reverse().join('');
const BTN = (k: string, hi: string, lo: string) => ({ [k]: F(3, 'o' + hi, 'o' + lo), [k + 'Dn']: F(3, 'o' + rev(lo), 'o' + rev(hi)) });
const FRAMES = {
  win: F(4, 'obce', 'ocdO'), gold: F(4, 'oyYG', 'ogGH'), red: F(4, 'orRQ', 'oRqQ'), green: F(4, 'onNM', 'oNmM'),
  paper: F(4, 'oxtk', 'otkK'), neon: F(4, 'opPv', 'oPvO'), cyan: F(4, 'olLu', 'oLuU'), inset: F(3, 'oOe', 'ocb'), well: F(3, 'oOe', 'oed'),
  ...BTN('btn', 'bc', 'de'), ...BTN('btnGreen', 'nN', 'mM'), ...BTN('btnRed', 'rR', 'qQ'), ...BTN('btnGold', 'yY', 'GH'),
};

export const skin = (root: HTMLElement = document.documentElement) => {
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  for (const [k, v] of Object.entries(FRAMES)) set('--fr-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v);
  for (const [k, rows] of Object.entries({ check: CHECK, tri: TRI, spark: SPARK })) set('--spr-' + k, uri(svg(rows)));
  set('--cur-arrow', `${uri(svg(CURSORS.arrow, '', PAL, 2))} 0 0, default`);
  set('--cur-hand', `${uri(svg(CURSORS.hand, '', PAL, 2))} 10 0, pointer`);
};

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
  const touching = (x: number, y: number) => [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].find(([dx, dy]) => on(x + dx, y + dy));
  const near = (x: number, y: number) => on(x, y) || !!touching(x, y);
  const out = g.createImageData(W, H), put = (x: number, y: number, c: number[]) => out.data.set([...c, 255], (y * W + x) * 4);
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [B, S, ring] = [bands.map(rgb), shadow.map(rgb), bands.map((c) => rgb(outline(c)))];
  const band = (x: number, y: number) => (!on(x, y - 1) || !on(x - 1, y) ? 0 : !on(x, y + 1) ? B.length - 1 : Math.min(B.length - 1, Math.floor(((y - pad) / h) * B.length)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = touching(x, y);
    if (on(x, y)) put(x, y, B[band(x, y)]);
    else if (edge) put(x, y, ring[band(x + edge[0], y + edge[1])]);
    else for (let k = 1; k <= 4; k++) if (near(x - k, y - k)) { put(x, y, S[Math.min(S.length - 1, k - 1)]); break; }
  }
  g.clearRect(0, 0, W, H);
  g.putImageData(out, 0, 0);
  return cv;
};
