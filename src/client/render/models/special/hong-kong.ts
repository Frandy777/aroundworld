import * as THREE from 'three';
import { box, cyl, final, hip, lamplit, part, prism, prismMat, stone, GOLD, INK, type ModelDef } from '../../builder';
import { glow, switchOf } from '../../light';

const HW = 0.6, MOD = 1.1, RISE = 0.5, WARM = 0xffd9a0; // the prisms' half-width, storey module and roof rise; the warm light of a window
// What shines once the tower is bought, and only then (see `shine`): the glass of its four prisms, south, west, north, east (one module taller each), and the doors of its lobby. A beacon on each mast takes the colour of its owner:
// unlit like any lamp, but this one is the tower's own material, so that its colour can be set
const GLASS = [1, 2, 3, 4].map((n) => prismMat(HW, n * MOD, RISE, MOD, 4 * n)), DOORS = lamplit(0x1d2c4d, WARM, 0.9), beacon = glow(new THREE.MeshBasicMaterial({ color: INK }));
const shine = (c: number | null) => { [...GLASS.flat(), DOORS].forEach((m) => (switchOf(m).value = +(c !== null))); beacon.color.set(c ?? INK); }; // c: the owner's colour while the tower stands, null while it is for sale or mortgaged: its lights are out and its beacons dark
shine(null); // nobody owns it until the board says so

export default {
  key: 'Hong Kong',
  props: [ // Bank of China Tower: four glass prisms stepping up to twin masts on a granite podium, a rock garden with a red bridge over its pond, and Victoria Harbour with a red-sailed junk and a Star Ferry. By night, once the tower is bought, the prisms are outlined in LED white (see `prismMat`) and the lobby is lit; the lamps, pond and ferry are lit anyway
    final((g) => {
      const TX = -0.4, TZ = -0.35, BASE = 0.44, RED = 0xd9423e, WHITE = 0xf4f6fa, GREEN = 0x2f8f5a, WOOD = 0x6e3a12, TAR = 0x3a2008, PANE = 0xe8edf6, ROCK = 0x8a8f9c, SHRUB = 0x4f9d4f; // the tower's centre and base height; paints
      const AQUA = 0x6cc8ff, BULB = 0xfff6b0, LANTERN = 0xff3b3b, lit = (c: number, k: number, light = WARM) => lamplit(c, light, k);                                                 // the light of the water, the bulb of a lamp and a lantern (those two glow by day as well: see NEON); `lit` is a part that shines after dusk, k times its light
      const disc = (p: THREE.Group, r: number, t: number, c: number, x: number, y: number, z: number) => { cyl(p, r, t, c, x, y - t / 2, z).rotation.x = Math.PI / 2; };                                               // a cylinder facing the viewer, centred at height y
      const peak = (d: number) => BASE + 4 * MOD + (RISE * (HW - d)) / HW;                                                                                         // the tallest roof's height, d from the tower's centre line
      box(g, 2.4, 0.1, 1.9, 0x3a86e0); box(g, 2.4, 0.06, 1.42, 0xb9bdc8, 0, 0.1, -0.24); box(g, 2.4, 0.03, 0.05, 0xe6e9f0, 0, 0.16, 0.42);                   // the harbour, the plaza on it, its kerb
      box(g, 1.46, 0.14, 1.37, 0x8a92a3, -0.39, 0.16, -0.265); box(g, 1.34, 0.14, 1.27, 0xb3bac8, TX, 0.3, -0.315);                                         // the granite podium in two courses
      [[0, 1], [-Math.PI / 2, 2], [Math.PI, 3], [Math.PI / 2, 4]].forEach(([r, n]) => { part(g, prism(HW, n * MOD, RISE), 0, GLASS[n - 1], TX, BASE, TZ).rotation.y = r; }); // the four prisms, south, west, north, east: one module taller each
      box(g, 0.05, 1, 0.05, INK, TX + 0.1, peak(0.1) - 0.03, TZ); box(g, 0.05, 0.75, 0.05, INK, TX + 0.26, peak(0.26) - 0.03, TZ); box(g, 0.07, 0.07, 0.07, INK, TX + 0.1, peak(0.1) + 0.97, TZ, beacon); box(g, 0.055, 0.055, 0.055, INK, TX + 0.26, peak(0.26) + 0.72, TZ, beacon); // the twin masts on the tallest roof, a beacon on each (in the colour of the tower's owner, see `owner`)
      box(g, 0.46, 0.34, 0.03, PANE, TX, BASE, 0.265); box(g, 0.36, 0.28, 0.03, 0x1d2c4d, TX, BASE, 0.285, DOORS); box(g, 0.025, 0.28, 0.035, PANE, TX, BASE, 0.287); // the entrance: frame, dark glass doors (the lobby's light by night), the bar between them
      disc(g, 0.075, 0.03, RED, TX, 0.89, 0.265); disc(g, 0.052, 0.04, 0xffffff, TX, 0.89, 0.265); box(g, 0.036, 0.036, 0.05, RED, TX, 0.872, 0.265);          // the bank's coin over it, between the braces: red disc, white ring, red square hole
      for (const d of [-0.31, 0.31]) { box(g, 0.16, 0.1, 0.07, 0x9aa1b0, TX + d, BASE, 0.285); box(g, 0.13, 0.1, 0.05, SHRUB, TX + d, BASE + 0.1, 0.285); }   // a planter either side of the entrance
      for (const [x, y, z] of [[-0.88, 0.3, 0.37], [0.08, 0.3, 0.37], [0.5, 0.16, 0], [1.14, 0.16, 0]]) { box(g, 0.02, 0.2, 0.02, INK, x, y, z); box(g, 0.05, 0.05, 0.05, BULB, x, y + 0.2, z); } // lamp posts: two on the podium's front edge, two at the bridge's ends
      box(g, 0.6, 0.06, 0.44, 0xd8d2c0, 0.82, 0.16, -0.02); box(g, 0.5, 0.04, 0.34, 0x4da3ff, 0.82, 0.17, -0.02, lit(0x4da3ff, 0.8, AQUA));                   // the garden pond: stone coping, water (lit from below by night)
      [[0.26, 0.22, 0.2, 0.97, -0.34, ROCK], [0.2, 0.34, 0.16, 0.8, -0.38, 0x767b8a], [0.14, 0.16, 0.14, 0.62, -0.32, 0x9a9fac]].forEach(([w, h, d, x, z, c]) => box(g, w, h, d, c, x, 0.16, z)); // three rocks behind it
      box(g, 0.12, 0.12, 0.1, ROCK, 0.82, 0.5, -0.38); box(g, 0.06, 0.3, 0.02, 0xbfe6ff, 0.8, 0.2, -0.29, lit(0xbfe6ff, 0.5, AQUA));                         // a stone on the tallest rock, the waterfall down its front
      box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.68, 0.21, 0.04); box(g, 0.05, 0.02, 0.025, 0xff9a2e, 0.96, 0.21, 0.1);                                           // two goldfish
      box(g, 0.2, 0.04, 0.1, RED, 0.6, 0.22, -0.02); box(g, 0.22, 0.04, 0.1, RED, 1.04, 0.22, -0.02); box(g, 0.3, 0.04, 0.1, RED, 0.82, 0.26, -0.02); box(g, 0.62, 0.025, 0.02, 0xf4eedb, 0.82, 0.3, 0.03, lit(0xf4eedb, 0.8)); // the red bridge over it: two ramps, the arch, a white rail (lit)
      box(g, 0.06, 0.3, 0.06, WOOD, 1.05, 0.16, -0.72); [[0.34, 0x2f7a4a], [0.26, 0x3f9a5c], [0.18, 0x4fb06a]].forEach(([w, c], i) => box(g, w, 0.16, w, c, 1.05, 0.4 + i * 0.14, -0.72)); // a pine: trunk, three tiers of needles
      box(g, 0.18, 0.14, 0.16, SHRUB, 0.45, 0.16, 0.3); box(g, 0.18, 0.14, 0.16, SHRUB, 1.08, 0.16, 0.36);                                                   // two shrubs
      const jx = -0.8;                                                                                                                                       // the junk's centre
      box(g, 0.68, 0.03, 0.21, TAR, jx, 0.1, 0.74); box(g, 0.66, 0.1, 0.2, WOOD, jx, 0.13, 0.74);                                                            // the junk: a tarred waterline, the hull
      box(g, 0.16, 0.2, 0.2, WOOD, jx + 0.25, 0.13, 0.74); box(g, 0.18, 0.03, 0.22, 0x8a5a2b, jx + 0.25, 0.33, 0.74); box(g, 0.1, 0.16, 0.18, WOOD, jx - 0.35, 0.13, 0.74); // the raised stern and its roof, the upturned bow
      box(g, 0.05, 0.06, 0.05, LANTERN, jx + 0.25, 0.36, 0.74); box(g, 0.04, 0.05, 0.04, LANTERN, jx - 0.35, 0.29, 0.74);                                                             // a red lantern on the stern's roof and on the bow
      [[-0.22, 0.5], [-0.03, 0.62], [0.16, 0.4]].forEach(([dx, h]) => {                                                                                       // three masts, each with a battened sail
        box(g, 0.025, h + 0.08, 0.025, TAR, jx + dx, 0.23, 0.74); box(g, 0.14, h, 0.03, RED, jx + dx + 0.055, 0.25, 0.74);                                  // the mast, the sail
        for (const k of [1, 2]) box(g, 0.14, 0.018, 0.035, 0x8a1f1f, jx + dx + 0.055, 0.25 + (k * h) / 3, 0.74);                                             // two battens across it
      });
      box(g, 0.08, 0.04, 0.015, GOLD, jx + 0.01, 0.93, 0.74);                                                                                                // a pennant at the main masthead
      const fx = 0.8;                                                                                                                                        // the ferry's centre
      box(g, 0.64, 0.1, 0.2, WHITE, fx, 0.1, 0.74); box(g, 0.65, 0.035, 0.205, GREEN, fx, 0.1, 0.74); box(g, 0.08, 0.1, 0.14, WHITE, fx + 0.35, 0.1, 0.74);   // the Star Ferry: hull, its green band, the narrow bow
      box(g, 0.52, 0.09, 0.17, WHITE, fx - 0.02, 0.2, 0.74); box(g, 0.46, 0.035, 0.02, INK, fx - 0.02, 0.23, 0.835, lit(INK, 0.9));                           // the main deck and its windows (lit by night)
      box(g, 0.42, 0.08, 0.15, WHITE, fx - 0.05, 0.29, 0.74); box(g, 0.36, 0.03, 0.02, INK, fx - 0.05, 0.32, 0.82, lit(INK, 0.9));                           // the upper deck and its windows
      box(g, 0.46, 0.025, 0.18, GREEN, fx - 0.05, 0.37, 0.74); box(g, 0.07, 0.1, 0.07, GREEN, fx + 0.03, 0.395, 0.74);                                       // the green roof, the funnel
      [[-0.3, 0.9], [0.1, 0.65], [-0.05, 0.86], [0.3, 0.55]].forEach(([x, z]) => box(g, 0.14, 0.012, 0.025, 0x9fd6ff, x, 0.1, z));                           // ripples on the harbour
    }),
  ],
  levels: [ // the tower stands at every level; each upgrade adds a landmark of Hong Kong round it, on the apron and the back strip the harbour leaves free
    [ // Lv 1, the Golden Bauhinia Square on the waterfront, in the middle of the apron: a gilded flower of five petals on a pillar and a stepped plinth of red granite, on a paved square with a railing along the harbour and the national and the Hong Kong flag at its front corners (the flower is floodlit by night)
      final((g) => {
        const BX = 0, BZ = 1.37, FY = 0.93, PALE = 0xd6cdbd, RED = 0xa8473a, DARK = 0x8f382e, SHINE = 0xfff0a0, STEEL = 0x8d95a6, FLAG = 0xd9423e, lit = (c: number, k: number, light: number) => lamplit(c, light, k);  // the square's centre, the height of the flower's heart; paints: paving, the plinth's granite, the polished pillar, the flower's heart, the steel of railing and flagpoles, the flags' red
        const gold = lit(GOLD, 0.55, 0xffcf60), shine = lit(SHINE, 0.6, 0xffe9a0);                                                                                                    // the gilding, which the floodlights pick out after dusk; the heart's glow
        stone(g, 1.4, 0.14, 0.84, PALE, BX, 0, BZ);                                                                                                                                   // the square, flush with the harbour's edge, in the gap between the junk and the ferry
        stone(g, 0.64, 0.08, 0.6, RED, BX, 0.14, BZ); stone(g, 0.52, 0.08, 0.5, RED, BX, 0.22, BZ);                                                                                   // the plinth, in two steps
        box(g, 0.34, 0.46, 0.34, DARK, BX, 0.3, BZ); box(g, 0.2, 0.16, 0.02, GOLD, BX, 0.45, BZ + 0.17, gold); stone(g, 0.44, 0.05, 0.44, PALE, BX, 0.76, BZ);                        // the pillar, the gold plate on its face, its cap
        box(g, 0.1, 0.12, 0.1, GOLD, BX, 0.81, BZ, gold); box(g, 0.1, 0.14, 0.1, SHINE, BX, FY, BZ, shine);                                                                           // the stem, the heart of the flower
        const arm = (a: number, segs: [number, number, number, THREE.Material?][]) => {                                                                                               // a petal or a stamen: its segments (width, length, lean) rise from the heart along heading a, each leaning further out than the one below
          let n = new THREE.Group(), y = 0; n.position.set(BX, FY, BZ); n.rotation.y = a; g.add(n);
          for (const [w, h, t, m = gold] of segs) { const c = new THREE.Group(); c.position.y = y; c.rotation.x = t; n.add(c); box(c, w, h, Math.min(w, 0.04), GOLD, 0, 0, 0, m); n = c; y = h; }
        };
        for (let k = 0; k < 5; k++) {                                                                                                                                                 // five broad petals round it, the first at the back, and a stamen with a bright tip between each pair
          arm(Math.PI + (k * 2 * Math.PI) / 5, [[0.16, 0.2, 0.3], [0.26, 0.2, 0.35], [0.32, 0.14, 0.5], [0.22, 0.06, 0.3]]);
          arm(Math.PI + ((k + 0.5) * 2 * Math.PI) / 5, [[0.02, 0.3, 0.3], [0.045, 0.045, 0, shine]]);
        }
        box(g, 1.34, 0.025, 0.03, STEEL, BX, 0.3, 0.985); box(g, 1.34, 0.015, 0.02, STEEL, BX, 0.22, 0.985);                                                                          // the railing along the harbour, a hair inside its edge: a top rail and a lower one
        for (let i = 1; i < 8; i++) box(g, 0.025, 0.18, 0.025, STEEL, -0.67 + i * 0.1675, 0.14, 0.985);                                                                               // its posts
        for (const x of [-0.67, 0.67]) { box(g, 0.02, 0.26, 0.02, INK, x, 0.14, 0.985); box(g, 0.05, 0.05, 0.05, 0xfff6b0, x, 0.4, 0.985); }                                          // a lamp at each end of it
        for (const x of [-0.58, 0.58]) { box(g, 0.03, 1.26, 0.03, STEEL, x, 0.14, 1.72); box(g, 0.3, 0.18, 0.02, FLAG, x + 0.165, 1.2, 1.72); }                                       // a flagpole at each front corner of the square, with a red flag streaming to the right
        box(g, 0.06, 0.06, 0.025, GOLD, -0.52, 1.32, 1.725, gold); box(g, 0.025, 0.025, 0.025, GOLD, -0.45, 1.35, 1.725, gold); box(g, 0.025, 0.025, 0.025, GOLD, -0.45, 1.28, 1.725, gold);  // the Chinese flag's stars (gilded like the flower, so they shine by night)
        box(g, 0.08, 0.08, 0.025, 0xffffff, 0.74, 1.25, 1.725);                                                                                                                       // the Hong Kong flag's bauhinia
      }),
    ],
    [ // Lv 2, the Tian Tan Buddha behind the garden: a bronze Buddha on a lotus throne and a three-tiered round altar on a stone terrace, his right hand raised and a gold finial on his crown (floodlit by night, like the flower)
      final((g) => {
        const BX = 0.67, BZ = -1.03, PALE = 0xd6cdbd, ALTAR = 0xe6e1d2, BRONZE = 0xc59a43, SHADE = 0x8e6a2c, LIGHT = 0xdcb860, lit = (c: number, k: number, light: number) => lamplit(c, light, k); // the Buddha's centre line; paints: terrace, altar, the bronze in three tones
        const warm = (c: number) => lit(c, 0.35, 0xffb050), gold = lit(GOLD, 0.55, 0xffcf60);                                                                                         // the bronze's floodlight, warm; the gilding's (as the flower's)
        const B = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => box(g, w, h, d, c, BX + x, y, BZ + z, warm(c));                                       // a bronze part, x and z from his centre line
        const ring = (r: number, h: number, c: number, y: number) => { cyl(g, r, h, c, BX, y, BZ).material = warm(c); };                                                              // a round bronze part
        stone(g, 0.64, 0.18, 0.7, PALE, BX, 0, BZ);                                                                                                                                   // the terrace: a hair over the plaza, spilling over its back edge
        [0.3, 0.25, 0.2].forEach((r, i) => { cyl(g, r, 0.06, ALTAR, BX, 0.18 + i * 0.06, BZ); box(g, 0.14, 0.06, 0.06, ALTAR, BX, 0.18 + i * 0.06, BZ + r + 0.03); });                // the altar's three tiers, each with the step that climbs it
        ring(0.19, 0.05, SHADE, 0.36); ring(0.15, 0.04, LIGHT, 0.41);                                                                                                                 // the lotus throne
        B(0.44, 0.09, 0.3, BRONZE, 0, 0.45, 0); B(0.12, 0.06, 0.1, BRONZE, -0.2, 0.45, 0.14); B(0.12, 0.06, 0.1, BRONZE, 0.2, 0.45, 0.14);                                            // the crossed legs, a knee at each front corner
        B(0.28, 0.28, 0.2, BRONZE, 0, 0.54, 0); B(0.36, 0.1, 0.22, BRONZE, 0, 0.72, 0); B(0.05, 0.3, 0.02, SHADE, -0.09, 0.55, 0.101).rotation.z = -0.55;                              // the torso, the shoulders, the robe's edge across his chest
        B(0.07, 0.26, 0.08, BRONZE, 0.2, 0.5, 0.02); B(0.12, 0.04, 0.1, LIGHT, 0.1, 0.54, 0.12);                                                                                      // his left arm, the hand open on his lap
        B(0.07, 0.2, 0.08, BRONZE, -0.2, 0.55, 0.03); B(0.06, 0.16, 0.07, BRONZE, -0.25, 0.6, 0.1); B(0.09, 0.1, 0.03, LIGHT, -0.25, 0.74, 0.14);                                      // his right arm, the forearm raised and the palm turned out
        B(0.1, 0.05, 0.1, SHADE, 0, 0.82, 0); B(0.18, 0.18, 0.17, LIGHT, 0, 0.87, 0); B(0.03, 0.13, 0.04, LIGHT, -0.105, 0.89, 0); B(0.03, 0.13, 0.04, LIGHT, 0.105, 0.89, 0);        // the neck, the head, the long ears
        B(0.19, 0.05, 0.18, SHADE, 0, 1.02, 0); B(0.1, 0.06, 0.1, SHADE, 0, 1.07, 0); box(g, 0.04, 0.04, 0.04, GOLD, BX, 1.13, BZ, gold);                                              // the hair, the topknot, the finial
        for (const s of [-1, 1]) box(g, 0.04, 0.014, 0.01, INK, BX + s * 0.045, 0.96, BZ + 0.086); box(g, 0.02, 0.02, 0.01, GOLD, BX, 1.0, BZ + 0.086, gold); B(0.025, 0.05, 0.03, LIGHT, 0, 0.91, 0.095); // his eyes, the gold mark between them, his nose
      }),
      final((g) => {                                                                                                                                                                  // and in the apron's front-left corner the Tsim Sha Tsui Clock Tower: a brick shaft with white bands, a clock on each face and a green pyramid roof over an open belfry (the clocks are lit by night)
        const CX = -0.98, CZ = 1.62, PALE = 0xd6cdbd, BRICK = 0xa8473a, ROOF = 0x4aa58a, WHITE = 0xf4f6fa, lit = (c: number, k: number, light: number) => lamplit(c, light, k);       // the tower's centre; paints: stonework, brick, the roof's patina, the clock's face
        const gold = lit(GOLD, 0.55, 0xffcf60), face = lit(WHITE, 0.8, 0xfff2c0);                                                                                                     // the gilding (as the flower's), the clock's face
        stone(g, 0.28, 0.08, 0.28, PALE, CX, 0, CZ); stone(g, 0.2, 0.4, 0.2, BRICK, CX, 0.08, CZ);                                                                                    // the plinth, the shaft
        for (const y of [0.17, 0.27, 0.37]) stone(g, 0.22, 0.03, 0.22, PALE, CX, y, CZ);                                                                                              // three white bands round it
        stone(g, 0.25, 0.04, 0.25, PALE, CX, 0.48, CZ); stone(g, 0.2, 0.2, 0.2, BRICK, CX, 0.52, CZ);                                                                                 // the cornice, the clock stage
        for (let k = 0; k < 4; k++) {                                                                                                                                                 // a clock on each of its faces: a white disc, its hands at three o'clock
          const f = new THREE.Group(), d = cyl(f, 0.07, 0.02, WHITE, 0, -0.01, 0.1); f.position.set(CX, 0.62, CZ); f.rotation.y = (k * Math.PI) / 2; d.material = face; d.rotation.x = Math.PI / 2; g.add(f);
          box(f, 0.012, 0.05, 0.01, INK, 0, 0, 0.112); box(f, 0.04, 0.012, 0.01, INK, 0.02, -0.006, 0.112);
        }
        stone(g, 0.24, 0.03, 0.24, PALE, CX, 0.72, CZ); box(g, 0.14, 0.1, 0.14, INK, CX, 0.75, CZ);                                                                                   // the belfry's floor, its dark inside
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) stone(g, 0.035, 0.1, 0.035, PALE, CX + x * 0.075, 0.75, CZ + z * 0.075);                                           // a post at each corner of it
        hip(g, 0.28, 0.28, 0.24, 0.85, ROOF, CX, CZ); box(g, 0.02, 0.12, 0.02, INK, CX, 1.09, CZ); box(g, 0.04, 0.04, 0.04, GOLD, CX, 1.21, CZ, gold);                                // the roof, the finial and its gold ball
      }),
    ],
  ],
  owner: shine, // the board tells the tower who owns the lot
} satisfies ModelDef;
