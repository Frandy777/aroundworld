// The board behind the title and the lobby is already lived in. tile index: [player, level, mortgaged?]
export const SEED: Record<number, [number, number, number?]> = {
  1: [0, 3], 2: [0, 2], 3: [0, 1], 4: [1, 1], 5: [1, 2], 7: [1, 0], 9: [2, 1], 11: [2, 3],
  13: [0, 2], 14: [3, 1], 16: [3, 2], 18: [3, 0], 19: [2, 0], 21: [1, 3], 22: [1, 2, 1], 23: [1, 1],
  30: [0, 2], 37: [2, 2], 40: [2, 1], 44: [0, 3], 46: [0, 0], 54: [3, 3], 55: [3, 2], 56: [1, 0],
  64: [2, 1], 72: [3, 1], 82: [0, 0], 83: [0, 2],
};
export const SEED_AT = [0, 23, 46, 69]; // where the four tokens stand
