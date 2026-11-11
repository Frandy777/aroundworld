import { plaque, IRON, INK, type ModelDef, type Prop } from '../../builder';

const bars = (xs: number[], h: number, y: number, z: number, c = INK) => xs.map((x): Prop => [c, 0.08, h, 0.08, x, y, z]);

export default {
  key: 'jail',
  scale: 1.45, // a bigger cage: it can hold four prisoners
  props: [ // barred cage around the prisoners' slots
    [IRON, 1.8, 0.14, 1.3, 0, 0, 0],
    ...bars([-0.64, -0.32, 0, 0.32, 0.64], 1.4, 0.14, 0.62), ...bars([-0.64, -0.32, 0, 0.32, 0.64], 1.4, 0.14, -0.58),
    ...[-0.3, 0.05, 0.4].flatMap((z) => [-0.84, 0.84].map((x): Prop => [INK, 0.08, 1.4, 0.08, x, 0.14, z])),
    ...[[-0.84, -0.58], [0.84, -0.58], [-0.84, 0.62], [0.84, 0.62]].map(([x, z]): Prop => [IRON, 0.18, 1.7, 0.18, x, 0, z]),
    [IRON, 1.8, 0.12, 0.14, 0, 1.54, 0.62], [IRON, 1.8, 0.12, 0.14, 0, 1.54, -0.58], [IRON, 0.14, 0.12, 1.2, -0.84, 1.54, 0.02], [IRON, 0.14, 0.12, 1.2, 0.84, 1.54, 0.02],
    (g) => plaque(g, 'JAIL', '#23263a', '#ffd23f', 1.0, 0.4, 0, 1.66, -0.58), // on the back wall: it must not hide the prisoners
  ],
} satisfies ModelDef;
