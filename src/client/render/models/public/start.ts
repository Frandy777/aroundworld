import { plaque, GOLD, type ModelDef } from '../../builder';

export default {
  key: 'start',
  props: [ // finish gate with a gold ingot
    [0xe8e8e8, 0.24, 2.3, 0.24, -0.8, 0, 0], [0xe8e8e8, 0.24, 2.3, 0.24, 0.8, 0, 0], [GOLD, 0.36, 0.16, 0.36, -0.8, 2.3, 0], [GOLD, 0.36, 0.16, 0.36, 0.8, 2.3, 0],
    (g) => plaque(g, 'START', '#38b764', '#fff', 1.4, 0.55, 0, 1.55, 0),
    [0xb36a14, 0.9, 0.12, 0.7, 0, 0, 0.1], [GOLD, 0.7, 0.5, 0.5, 0, 0.12, 0.1], [0xfff6b0, 0.7, 0.08, 0.5, 0, 0.62, 0.1],
  ],
} satisfies ModelDef;
