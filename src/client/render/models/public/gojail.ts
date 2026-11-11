import { IRON, type ModelDef } from '../../builder';

export default {
  key: 'gojail',
  props: [ // police booth with a siren and a boom barrier
    [0x3b5dc9, 1.0, 1.0, 0.8, -0.4, 0, 0], [0xbfe0ff, 0.5, 0.3, 0.06, -0.4, 0.5, 0.41], [0xeeeeee, 1.2, 0.14, 1.0, -0.4, 1.0, 0],
    [0xff3b3b, 0.3, 0.3, 0.3, -0.6, 1.14, 0], [0x3b6bff, 0.3, 0.3, 0.3, -0.2, 1.14, 0],
    [IRON, 0.2, 0.85, 0.2, 0.45, 0, 0], [0xffffff, 0.5, 0.14, 0.14, 0.7, 0.75, 0], [0xd9423e, 0.14, 0.16, 0.16, 0.58, 0.74, 0], [0xd9423e, 0.14, 0.16, 0.16, 0.82, 0.74, 0],
  ],
} satisfies ModelDef;
