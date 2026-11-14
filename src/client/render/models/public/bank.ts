import { GOLD, type ModelDef, type Prop } from '../../builder';

export default {
  key: 'bank',
  scale: 1.2, // a little smaller than the default: the temple front would overflow the strip
  lamps: [{ at: [0, 0.5, 0.8], color: 0xffc878, power: 4, reach: 6.5 }], // a warm wash on the colonnade, from in front of the steps
  props: [ // temple front: steps, columns, stepped pediment
    [0xe9e0c9, 2.0, 0.14, 1.3, 0, 0, 0], [0xf4eedb, 1.8, 0.14, 1.1, 0, 0.14, 0], [0xd6ccb0, 1.6, 1.0, 0.2, 0, 0.28, -0.4],
    ...[-0.7, -0.35, 0, 0.35, 0.7].map((x): Prop => [0xf7f1de, 0.22, 1.0, 0.22, x, 0.28, 0.35]),
    [0xcfc3a3, 1.9, 0.22, 1.0, 0, 1.28, 0], [0xdcd2b4, 1.5, 0.16, 0.8, 0, 1.5, 0], [0xe8dfc4, 1.0, 0.16, 0.6, 0, 1.66, 0], [0xf4eedb, 0.5, 0.14, 0.4, 0, 1.82, 0],
    [GOLD, 0.34, 0.34, 0.06, 0, 1.34, 0.52], [0x8a6a14, 0.1, 0.2, 0.07, 0, 1.41, 0.53],
  ],
} satisfies ModelDef;
