import { box, final, floor, plaque, IRON, type ModelDef } from '../../builder';

export default {
  key: 'news',
  props: [ // two-storey office with a roof billboard, dish and mast
    final((g) => {
      box(g, 2.2, 0.14, 1.7, 0xb9b2a0); floor(g, 4, 3, 'door', 0xf0d890, 0.14); floor(g, 4, 3, 'win', 0xf0d890, 1.04); box(g, 2.2, 0.16, 1.7, IRON, 0, 1.94);
      plaque(g, 'NEWS', '#c9962a', '#fff', 1.3, 0.5, -0.45, 2.1, 0.3);
      box(g, 0.1, 0.4, 0.1, 0x888888, 0.7, 2.1, -0.25); box(g, 0.4, 0.08, 0.4, 0xcfcfcf, 0.7, 2.5, -0.25); box(g, 0.65, 0.08, 0.65, 0xcfcfcf, 0.7, 2.58, -0.25);
      box(g, 0.9, 0.08, 0.9, 0xe8e8e8, 0.7, 2.66, -0.25); box(g, 0.5, 0.06, 0.5, 0x666a7e, 0.7, 2.74, -0.25); box(g, 0.12, 0.3, 0.12, 0xd9423e, 0.7, 2.74, -0.25); // dish
      box(g, 0.1, 1.1, 0.1, 0x333333, -0.95, 2.1, -0.5); box(g, 0.18, 0.18, 0.18, 0xff3b3b, -0.95, 3.2, -0.5); // mast
    }),
  ],
} satisfies ModelDef;
