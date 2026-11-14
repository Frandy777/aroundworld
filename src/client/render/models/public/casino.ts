import { plaque, GOLD, INK, type ModelDef } from '../../builder';

export default {
  key: 'casino',
  lamps: [{ at: [0, 1, 0.8], color: 0xff5de0, power: 12, reach: 7 }], // the marquee's glow
  props: [ // marquee, neon pillars and rooftop dice
    [0x7a1d4b, 1.7, 1.2, 1.1, 0, 0, 0], [0x5a1838, 1.9, 0.14, 1.3, 0, 1.2, 0], [GOLD, 1.9, 0.1, 0.1, 0, 1.2, 0.6], [GOLD, 0.1, 0.1, 1.3, -0.9, 1.2, 0], [GOLD, 0.1, 0.1, 1.3, 0.9, 1.2, 0],
    (g) => plaque(g, '♠ ♥ ♦', '#b02a6b', '#ffd23f', 1.5, 0.45, 0, 0.66, 0.56, 'neon'),
    [GOLD, 0.4, 0.55, 0.06, 0, 0, 0.56], [0xd9423e, 0.5, 0.04, 0.3, 0, 0, 0.6], [0xff5de0, 0.14, 1.2, 0.14, -0.82, 0, 0.55], [0x5dfff0, 0.14, 1.2, 0.14, 0.82, 0, 0.55],
    [0xffffff, 0.5, 0.5, 0.5, -0.4, 1.34, 0], [INK, 0.1, 0.1, 0.05, -0.55, 1.7, 0.26], [INK, 0.1, 0.1, 0.05, -0.4, 1.58, 0.26], [INK, 0.1, 0.1, 0.05, -0.25, 1.46, 0.26],
    [0xffffff, 0.4, 0.4, 0.4, 0.45, 1.34, 0.1], [0xd9423e, 0.14, 0.14, 0.05, 0.45, 1.47, 0.31],
  ],
} satisfies ModelDef;
