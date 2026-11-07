export const rnd = (n: number) => 1 + Math.floor(Math.random() * n); // 1..n
export const d6 = () => rnd(6);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const coin = () => Math.random() < 0.5;
export const stop = (timer?: number) => clearTimeout(timer ?? null); // clearTimeout for a timer that may never have been set
