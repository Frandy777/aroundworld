import { GOLD, type ModelDef, type Prop } from '../../builder';

export default {
  key: 'exchange',
  scale: 1.15, // narrower than the default: the chart would overflow the strip
  props: [ // rising stock chart
    [0x1b4d44, 2.1, 0.12, 1.1, 0, 0, 0.05],
    ...[0.5, 0.85, 1.2, 1.6, 2.0].flatMap((h, i): Prop[] => [[i < 4 ? 0x4cc36b : GOLD, 0.3, h, 0.36, -0.8 + i * 0.4, 0.12, 0.05], [i < 4 ? 0xa6f0b8 : 0xfff6b0, 0.3, 0.07, 0.36, -0.8 + i * 0.4, 0.12 + h, 0.05]]),
  ],
} satisfies ModelDef;
