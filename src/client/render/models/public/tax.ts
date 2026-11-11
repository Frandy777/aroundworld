import { box, final, floor, plaque, type ModelDef } from '../../builder';

export default {
  key: 'tax',
  props: [ // bureau with a stepped roof (storey props are authored in final units, see `final`)
    final((g) => {
      box(g, 2.2, 0.14, 1.7, 0xb9b2a0); floor(g, 4, 3, 'door', 0xe8dcb8, 0.14);
      box(g, 2.3, 0.16, 1.8, 0x8a3b3b, 0, 1.04); box(g, 1.8, 0.16, 1.4, 0x8a3b3b, 0, 1.2); box(g, 1.2, 0.16, 0.9, 0x8a3b3b, 0, 1.36);
      plaque(g, 'TAX', '#6e2d2d', '#ffd23f', 1.1, 0.4, 0, 1.52, 0);
    }),
  ],
} satisfies ModelDef;
