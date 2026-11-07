import { PAL } from './art';

// Country flags for the tile headers: 23 x 15 art pixels inside a 1px ink outline, in the shared palette with the game's red (R) and a black (B).
export const FLAG_PAL = { ...PAL, R: '#e43b44', B: '#2a2f48' };
const [W, H] = [23, 15];

// A flag is a list of ops painted in order onto a grid of palette letters. paint(f) asks f(x, y) at the centre of every pixel for a letter (or nothing).
type Op = (g: string[][]) => void;
const paint = (f: (x: number, y: number) => string | false | undefined): Op => (g) => g.forEach((r, y) => r.forEach((_, x) => (r[x] = f(x + 0.5, y + 0.5) || r[x])));
const fill = (c: string) => paint(() => c);
const rect = (c: string, x: number, y: number, w: number, h: number) => paint((px, py) => px > x && px < x + w && py > y && py < y + h && c);
const dots = (c: string, ...p: [number, number][]) => paint((x, y) => p.some(([i, j]) => i === Math.floor(x) && j === Math.floor(y)) && c);
const disc = (c: string, cx: number, cy: number, r: number) => paint((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && c);
const crescent = (c: string, cx: number, cy: number, r: number, d: number, a = 0) => paint((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx - d * Math.cos(a)) ** 2 + (y - cy - d * Math.sin(a)) ** 2 > (r - 0.4) ** 2 && c); // opens towards angle a (0: right)
const art = (rows: string[], x: number, y: number, ink = 'w') => paint((px, py) => { const c = rows[Math.floor(py) - y]?.[Math.floor(px) - x]; return c && c !== '.' && (c === '#' ? ink : c); }); // string art, '#' takes the ink
const arts = (rows: string[], ink: string, ...at: [number, number][]): Op => (g) => at.forEach(([x, y]) => art(rows, x, y, ink)(g)); // the same sprite in several places
const bands = (cs: string, ws: number[] = [...cs].map(() => 1), vert = false) => { // stripes in proportion to the weights
  const n = vert ? W : H, sum = ws.reduce((a, b) => a + b);
  return paint((x, y) => { let t = ((vert ? x : y) / n) * sum, k = 0; while (t > ws[k]) t -= ws[k++]; return cs[k]; });
};
const tri = (c: string, a: number) => paint((x, y) => x < a * (1 - Math.abs(y - H / 2) / (H / 2)) && c); // a triangle on the hoist, its tip a px in
const jack = (x0: number, y0: number, w: number, h: number, [cr, ce, sw, sr]: number[]) => paint((px, py) => { // Union Jack in a w x h box, by half widths: red cross, its white edge, white saltire, the red thread in it (counterchanged: off centre, the other way in each arm)
  const u = px - x0, v = py - y0;
  if (u < 0 || v < 0 || u >= w || v >= h) return;
  const n = Math.hypot(w, h), a = (u * h - v * w) / n, b = (u * h + v * w - w * h) / n, s = u < w / 2 ? -0.5 : 0.5; // a, b: signed distances to the two diagonals
  const dx = Math.abs(u - w / 2), dy = Math.abs(v - h / 2);
  return dx < cr || dy < cr ? 'R' : dx < ce || dy < ce ? 'w' : Math.abs(a - s) < sr || Math.abs(b + s) < sr ? 'R' : Math.abs(a) < sw || Math.abs(b) < sw ? 'w' : 'U';
});
const trigram = (bars: number[], fx = 0, fy = 0) => dots('B', ...bars.flatMap((solid, k) => ([[2, 0], [1, 1], [0, 2]] as [number, number][]).filter((_, n) => solid || n !== 1).map(([i, j]): [number, number] => [fx ? W - 2 - 2 * k - i : 1 + 2 * k + i, fy ? H - 2 - k - j : 1 + k + j]))); // three diagonal strokes, solid or broken, stepping (2, 1) apart from the top left corner; fx, fy mirror them into the other corners

const SMALL = [0.5, 1.5, 0.75, 0], BIG = [1.5, 2.5, 1.5, 0.5]; // jack proportions: in the canton of a blue ensign, and over a whole flag
const STAR = ['..#..', '..#..', '#####', '.###.', '.#.#.'];
const STAR3 = ['.#.', '###', '#.#'];
const STAR7 = ['...#...', '...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.'];
const STAR9 = ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..#####..', '.###.###.', '.##...##.'];
const PLUS = ['.#.', '###', '.#.'];
const SUN = ['#.#.#', '.###.', '#####', '.###.', '#.#.#'];
const LEAF = ['....#....', '...###...', '.#.###.#.', '.##.#.##.', '#########', '.#######.', '..#####..', '...###...', '....#....', '....#....'];
const DAVID = ['....#....', '...#.#...', '#########', '.##...##.', '.#.....#.', '.##...##.', '#########', '...#.#...', '....#....'];
const ARMS = ['..g.g.g..', '..GgGgG..', 'x.HHHHH.x', 'x.HRYwH.x', 'R.HwPRH.R', 'x..HRH..x', 'x...H...x'];
const EAGLE_MX = ['..kk...', '.kKkk..', 'kkkkkk.', '.kkkk..', 'm.NN.m.', '.mNNm..', '..mm...'];
const EAGLE_EG = ['..Y..', 'YYYYY', 'YYgYY', '.YYY.', '.Y.Y.'];
const EMBLEM_IR = ['.R.R.', 'R.R.R', 'RRRRR', '.RRR.', '..R..'];
const SOL = ['Y.Y.Y', '.YYY.', 'YYgYY', '.YYY.', 'Y.Y.Y'];
const CHAKRA = ['.###.', '#...#', '#.#.#', '#...#', '.###.'];
const FLOWER = ['..#####..', '.R##R##R.', '##R###R##', '#R#####R#', '#########', 'RR#####RR', '##R###R##', '.###R###.', '..##R##..']; // a white disc notched into five petals, a red dot on each
const GLOBE = ['.uwuuu.', 'uuuuwuu', 'uwuuuww', 'uuwwwuu', 'wwuuuuu', 'uuuwuuu', '.uuuwu.']; // the blue disc with the white band and a few stars

const FLAGS: Record<string, Op[]> = {
  // Oceania
  nz: [fill('U'), jack(0, 0, 11, 7, SMALL), arts(['.w.', 'wRw', '.w.'], 'w', [16, 2], [13, 6], [19, 5], [16, 11])],
  au: [fill('U'), jack(0, 0, 11, 7, SMALL), art(STAR, 3, 9), arts(PLUS, 'w', [16, 2], [13, 6], [19, 5], [16, 11]), dots('w', [19, 9])],
  // Southeast Asia
  id: [bands('Rw')],
  sg: [bands('Rw'), crescent('w', 5.5, 4, 3.2, 1.5), dots('w', [11, 1], [13, 3], [13, 6], [9, 6], [9, 3])],
  my: [bands('RwRwRwRwRwRwRw'), rect('U', 0, 0, 11, 9), crescent('Y', 4.5, 4.5, 3.2, 1.4), art(PLUS, 7, 3, 'Y')],
  th: [bands('RwUwR', [3, 2, 5, 2, 3])],
  vn: [fill('R'), art(STAR9, 7, 3, 'Y')],
  // China
  hk: [fill('R'), art(FLOWER, 7, 3)],
  cn: [fill('R'), art(STAR7, 1, 1, 'Y'), dots('Y', [8, 2], [9, 3], [9, 6], [8, 7])],
  tw: [fill('R'), rect('U', 0, 0, 11, 7), art(SUN, 3, 1)],
  // Japan & Korea
  jp: [disc('R', 11.5, 7.5, 4.5)],
  kr: [paint((x, y) => { // the taegeuk, tilted 33.7 degrees: red above its S-curve, blue below
    const [dx, dy] = [x - 11.5, y - 7.5], u = dx * 0.832 + dy * 0.555, v = dy * 0.832 - dx * 0.555, q = 2.2; // (u, v): along and across the curve, q: radius of its two bulges
    return u * u + v * v <= 20.25 && ((u + q) ** 2 + v * v <= q * q || ((u - q) ** 2 + v * v > q * q && v < 0) ? 'R' : 'u');
  }), trigram([1, 1, 1]), trigram([0, 1, 0], 1), trigram([1, 0, 1], 0, 1), trigram([0, 0, 0], 1, 1)],
  kp: [bands('uwRwu', [3, 1, 7, 1, 3]), disc('w', 7.5, 7.5, 3.5), art(STAR, 5, 5, 'R')],
  // Russia
  ru: [bands('wuR')],
  // Eastern Europe
  pl: [bands('wR')],
  cz: [bands('wR'), tri('U', 11.5)],
  at: [bands('RwR')],
  hu: [bands('Rwm')],
  // Western Europe
  de: [bands('BRY')],
  ch: [fill('R'), rect('w', 10, 3, 3, 9), rect('w', 7, 6, 9, 3)],
  fr: [bands('uwR', undefined, true)],
  es: [bands('RYR', [4, 7, 4]), art(ARMS, 4, 4)],
  gb: [jack(0, 0, W, H, BIG)],
  // North Atlantic
  dk: [fill('R'), rect('w', 7, 0, 3, 15), rect('w', 0, 6, 23, 3)],
  no: [fill('R'), rect('w', 6, 0, 4, 15), rect('w', 0, 6, 23, 3), rect('U', 7, 0, 2, 15), rect('U', 0, 7, 23, 1)],
  ca: [bands('RwR', [6, 11, 6], true), art(LEAF, 7, 2, 'R')],
  // United States
  us: [bands('RwRwRwRwRwRwR'), rect('U', 0, 0, 9, 8), dots('w', ...[1, 5].flatMap((y) => [1, 3, 5, 7].map((x): [number, number] => [x, y])), ...[2, 4, 6].map((x): [number, number] => [x, 3]))],
  // Central America
  mx: [bands('mwR', undefined, true), art(EAGLE_MX, 8, 4)],
  cu: [bands('UwUwU'), tri('R', 13), art(STAR7, 1, 4)],
  cr: [bands('UwRwU', [3, 2, 5, 2, 3])],
  // South America
  co: [bands('YuR', [7, 4, 4])],
  ar: [bands('LwL'), art(SOL, 9, 5)],
  br: [fill('m'), paint((x, y) => Math.abs(x - 11.5) / 9.5 + Math.abs(y - 7.5) / 5.7 <= 1 && 'Y'), art(GLOBE, 8, 4)],
  // Africa
  za: [bands('RU'), paint((x, y) => { // the green Y (white edge outside, yellow inside) round the black triangle
    const ym = Math.min(y, H - y), t = ym - 0.92 * x;
    if (x >= 8.8) return ym > 6 ? 'm' : ym > 5 && 'w';
    return Math.abs(t) < 1.9 ? 'm' : t > -3.3 && t <= -1.9 ? 'w' : t >= 1.9 && t < 3.3 ? 'Y' : t >= 3.3 && 'B';
  })],
  tn: [fill('R'), disc('w', 11.5, 7.5, 4.5), crescent('R', 10.8, 7.5, 3, 1.6), art(STAR3, 12, 6, 'R')],
  dj: [bands('Lm'), tri('w', 12), art(STAR7, 1, 4, 'R')],
  eg: [bands('RwB'), art(EAGLE_EG, 9, 5)],
  // Middle East
  il: [fill('w'), rect('u', 0, 1, 23, 2), rect('u', 0, 12, 23, 2), art(DAVID, 7, 3, 'u')],
  ae: [bands('mwB'), rect('R', 0, 0, 6, 15)],
  ir: [bands('mwR'), art(EMBLEM_IR, 9, 5), paint((x, y) => (Math.floor(y) === 4 || Math.floor(y) === 10) && Math.floor(x) % 2 === 1 && x < 22 && 'w')],
  // Central Asia
  pk: [fill('m'), rect('w', 0, 0, 6, 15), crescent('w', 14, 7.5, 4, 1.8, -0.6), art(STAR, 15, 3)],
  in: [bands('gwm'), art(CHAKRA, 9, 5, 'U')],
};

export const flagRows = (code: string) => {
  const g = [...Array(H)].map(() => Array(W).fill('w'));
  FLAGS[code].forEach((op) => op(g));
  const edge = 'o'.repeat(W);
  return ['.' + edge + '.', ...g.map((r) => 'o' + r.join('') + 'o'), '.' + edge + '.'];
};
