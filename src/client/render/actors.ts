import * as THREE from 'three';
import { scene, toon, lodMap, pixelTexture, texels, tween, easeInOut, dirtyShadow, DENSITY } from './scene';
import { LOT, POS } from './layout';
import { PAL, dieRows, paint, canvas, facePal, FACE, TORSO } from './art';
import { TILES } from '../../shared/data';

// ---- Chibi player tokens ----
// Tokens stand on their tile, each on a disc base in its player's colour (readable from far away, so every player is marked,
// not only the active one). Slots are in tile space (around the tile's centre): the yard in front of the info card, 2 x 2. A token takes the first free slot of the tile it
// arrives on and keeps it until it leaves, so the front row fills first and a lone token never stands up over the card; `ry` is its facing, south unless it is
// hopping. Every token also wears a pin above its head in its colour (so a player hidden behind another is still told apart); the active
// token's is gold, bigger and bounces.
const U = 1 / DENSITY;                                              // one texel of the world's grid: a token is built in them, so its parts line up with the ground, walls and signs
const BASE = 0.2;                                                   // height of the disc base
const NECK = 22, TILT = 0.35;                                       // where the head sits on the body (texels) and how far it tilts back (rad)
const SLOT: [number, number][] = [[-2.3, 2.35], [-1.0, 2.35], [-1.65, 0.75], [-0.35, 0.75]]; // rows far enough apart not to stack up on screen, the back one staggered so its tokens show between the front ones
const CAGE = ([[-0.6, -0.45], [0.6, -0.45], [-0.6, 0.45], [0.6, 0.45]] as [number, number][]).map(([x, z]): [number, number] => [LOT.x + x, LOT.z + z]); // inside the jail prop (no base there: the cage is it)
const MARK_Y = 3.3, PIN_Y = 3.2;                                    // pin heights: active (bounces) / the others, both clear of the tallest hat
const JAIL = TILES.findIndex((t) => t.kind === 'jail');
export interface Token {
  idx: number; color: number; g: THREE.Group; base: THREE.Group; marker: THREE.Mesh<THREE.ConeGeometry, THREE.MeshToonMaterial>;
  tile: number; slot: number; active: boolean; jailed: boolean; busy: boolean; ry: number; squash: number;
}
export const tokens: Token[] = [];

const slot = (tok: Token, i: number) => { // first slot of tile i that no other token on it holds (removed tokens are out of the scene)
  const used = tokens.filter((t) => t && t !== tok && t.tile === i && t.g.parent).map((t) => t.slot);
  return [0, 1, 2, 3].find((s) => !used.includes(s))!;
};
const spot = (tok: Token, i: number) => {
  const [x, z] = (tok.jailed && i === JAIL ? CAGE : SLOT)[tok.slot];
  return new THREE.Vector3(x, 0, z).add(POS[i]);
};
const place = (tok: Token, i: number) => { tok.tile = i; tok.slot = slot(tok, i); tok.g.position.copy(spot(tok, i)); dirtyShadow(); }; // a token that appears, or is moved with no tween (out of the cage)

// A part is [w, h, d, x, y, z, colour] in texels: x and z its centre, y its bottom, up from the soles; one with x != 0 comes as a mirrored pair. The colour is a palette
// key (A-D the player's ramp, h the hair) or F / T for the face and hoodie sprites. Two heads tall: the head is as tall as everything under it.
type Part = [w: number, h: number, d: number, x: number, y: number, z: number, key: string];
const BODY: Part[] = [
  [5, 1, 8, 3.5, 0, 1.5, 'D'], [5, 2, 8, 3.5, 1, 1.5, 'x'], [4, 5, 6, 3, 3, 1.5, 'e'],                                                 // sneakers, legs
  [12, 12, 9, 0, 8, 0, 'T'], [3, 8, 3, 7.5, 9, 0.5, 'B'], [3, 3, 3, 7.5, 6, 0.5, 's'], [6, 2, 6, 0, 20, 0, 's'],                        // hoodie, sleeves, hands, neck
];
const HEAD: Part[] = [[22, 16, 18, 0, 22, 0, 'F']];                                                                                                // face
const HATS: Part[][] = [
  [[24, 2, 20, 0, 38, 0, 'B'], [18, 2, 14, 0, 40, 0, 'B'], [10, 1, 6, 0, 42, 0, 'B'], [2, 1, 2, 0, 43, 0, 'D'], [16, 1, 6, 0, 38, 11, 'C']], // cap: the bill stays above the eyes
  [[24, 3, 20, 0, 38, 0, 'A'], [20, 2, 16, 0, 41, 0, 'B'], [14, 2, 10, 0, 43, 0, 'B'], [6, 4, 6, 0, 45, 0, 'w']],                       // beanie
  [[2, 5, 2, 0, 40, 0, 'm'], [2, 2, 2, 0, 45, 0, 'n'], [4, 2, 3, 3, 43, 0, 'N'], [3, 2, 3, 5.5, 45, 0, 'N'], [2, 2, 3, 7, 47, 0, 'n']],  // sprout: two stepped leaves
  [[20, 3, 16, 0, 38, 0, 'Y'], [14, 1, 10, 0, 41, 0, 'q'], [2, 3, 2, 8, 41, 7, 'Y'], [2, 3, 2, 8, 41, -7, 'Y'], [2, 4, 2, 0, 41, 7, 'Y'], [2, 4, 2, 0, 41, -7, 'Y'],
    [2, 2, 1, 0, 39, 8.5, 'R'], [2, 2, 1, 6, 39, 8.5, 'L']],                                                                          // crown
];
const looks: ((k: string) => THREE.Material | THREE.Material[])[] = [];
const look = (idx: number, color: number) => { // a player's materials, shared by all their tokens (a restart builds no new textures)
  if (looks[idx]) return looks[idx];
  const pal = facePal(color, idx), flat: Record<string, THREE.Material | THREE.Material[]> = {}, mat = (k: string) => (flat[k] ||= toon(pal[k]));
  const sprite = (rows: string[][]) => lodMap(toon(0xffffff), (L: number) => pixelTexture(canvas(rows[L][0].length, rows[L].length, (g) => paint(g, rows[L], 0, 0, pal))));
  const [h, S, B] = [...'hSB'].map(mat) as THREE.Material[];
  flat.F = [h, h, h, S, sprite(FACE), h]; // +x -x +y -y +z -z
  flat.T = [B, B, B, B, sprite(TORSO), B];
  return (looks[idx] = mat);
};

export function addToken(idx: number, color: number, tile: number) {
  const g = new THREE.Group(), mat = look(idx, color);
  const dark = new THREE.Color(color).multiplyScalar(0.7).getHex();
  const base = new THREE.Group(); g.add(base); // the disc: a darker rim and a lit top, in the player's colour
  for (const [r, h, c, y] of [[0.62, 0.12, dark, 0], [0.52, 0.08, color, 0.12]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), toon(c)); m.position.y = y + h / 2; base.add(m);
  }
  const body = new THREE.Group(), head = new THREE.Group(); // the head tilts back so the camera, which looks down on it, sees more face and less top
  body.position.y = BASE; head.position.y = NECK * U; head.rotation.x = -TILT; body.add(head); g.add(body);
  const parts: [THREE.Group, number, Part[]][] = [[body, 0, BODY], [head, NECK, [...HEAD, ...HATS[idx]]]];
  for (const [parent, y0, list] of parts) {
    for (const [w, h, d, x, y, z, k] of list) {
      for (const px of x ? [-x, x] : [0]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w * U, h * U, d * U), mat(k));
        m.position.set(px * U, (y - y0 + h / 2) * U, z * U); m.castShadow = true; parent.add(m);
      }
    }
  }
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), toon(color));
  marker.rotation.set(Math.PI, Math.PI / 4, 0);
  g.add(marker);
  scene.add(g);
  const tok: Token = (tokens[idx] = { idx, color, g, base, marker, tile, slot: 0, active: false, jailed: false, busy: false, ry: 0, squash: 0 });
  pin(tok); place(tok, tile);
  return tok;
}
const pin = (t: Token) => { t.marker.material.color.set(t.active ? 0xffe066 : t.color); t.marker.scale.setScalar(t.active ? 0.85 : 0.55); };

export async function hop(tok: Token, to: number, dur = 0.22) {
  const a = tok.g.position.clone();
  tok.tile = to; tok.slot = slot(tok, to); tok.busy = true;
  const b = spot(tok, to), dir = Math.atan2(b.x - a.x, b.z - a.z);
  tok.g.rotation.y = dir;
  await tween(dur, (k) => { // stretched in the air, squashed when it lands
    const s = Math.sin(k * Math.PI);
    tok.g.position.lerpVectors(a, b, k); tok.g.position.y += s * 1.4;
    tok.g.scale.set(1 - 0.1 * s, 1 + 0.2 * s, 1 - 0.1 * s);
  }, easeInOut);
  tok.ry = dir; tok.squash = 1; tok.busy = false; // it looked where it was going; on landing it turns to face south again
}

// Event moves ("teleports") do not pass tiles: shrink, relocate, grow.
export async function jump(tok: Token, to: number) {
  tok.busy = true;
  await tween(0.25, (k) => tok.g.scale.setScalar(1 - k));
  place(tok, to);
  await tween(0.25, (k) => tok.g.scale.setScalar(k));
  tok.busy = false;
}

export const placeAt = place;
export const clearTokens = () => { tokens.forEach((t) => t && scene.remove(t.g)); tokens.length = 0; };
export const setActive = (idx: number) => tokens.forEach((t) => { t.active = t.idx === idx; pin(t); });
export const removeToken = async (tok: Token) => { tok.busy = true; await tween(0.4, (k) => tok.g.scale.setScalar(1 - k)); scene.remove(tok.g); };

// ---- 3D dice ----
const FACES = [3, 4, 1, 6, 2, 5]; // +x -x +y -y +z -z (opposite faces sum to 7)
const UP: Record<number, [number, number, number]> = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0] };
// every face is the HUD's die sprite redrawn on each level's grid (one texel per ground texel; the sizes keep the pips centred: n - pip is even)
const DIE = 1.2, DIE_N = [7, 12, texels(DIE)];
const pipMat = (v: number) => lodMap(toon(0xffffff), (L: number) => pixelTexture(canvas(DIE_N[L], DIE_N[L], (g, n) => { g.fillStyle = PAL.o; g.fillRect(0, 0, n, n); paint(g, dieRows(v, n), 0, 0); })));
const dice = [0, 1].map(() => {
  const d = new THREE.Mesh(new THREE.BoxGeometry(DIE, DIE, DIE), FACES.map(pipMat));
  d.castShadow = true; d.visible = false;
  return d;
});
export const initActors = () => scene.add(...dice);

export function rollDice(at: THREE.Vector3, values: number[]) {
  return Promise.all(dice.map((d, k) => {
    const target = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...UP[values[k]])));
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const spin = 10 + Math.random() * 6, q = new THREE.Quaternion();
    const land = new THREE.Vector3(k ? -0.35 : -1.65, 0, -0.25); // left yard, behind the tokens, at the foot of the info card
    const x1 = at.x + land.x, z1 = at.z + land.z, x0 = x1 + (k ? 5 : -5), z0 = z1 + 4;
    d.visible = true; d.scale.setScalar(1);
    return tween(1.3, (t) => {
      d.position.set(x0 + (x1 - x0) * t, at.y + 0.6 + 7 * (1 - t) * Math.abs(Math.cos(t * Math.PI * 2.5)), z0 + (z1 - z0) * t);
      d.quaternion.copy(target).multiply(q.setFromAxisAngle(axis, spin * (1 - t) * (1 - t)));
    });
  }));
}
export const clearDice = () => dice.forEach((d) => (d.visible = false));
export const hideDice = () => tween(0.25, (k) => dice.forEach((d) => { d.scale.setScalar(1 - k); d.visible = k < 1; }));

export function updateActors(t: number, dt: number) {
  for (const tok of tokens) {
    if (!tok || tok.busy) continue;
    const act = tok.active;
    tok.base.visible = !(tok.jailed && tok.tile === JAIL);
    tok.g.position.copy(spot(tok, tok.tile)).y += Math.abs(Math.sin(t * (act ? 4 : 2) + tok.idx)) * (act ? 0.35 : 0.08);
    tok.ry -= Math.atan2(Math.sin(tok.ry), Math.cos(tok.ry)) * (1 - Math.exp(-dt * 14)); // eased back to facing south, so a landing is a quick spin, not a snap
    tok.g.rotation.y = tok.ry;
    tok.squash *= Math.exp(-dt * 10);
    tok.g.scale.set(1 + 0.18 * tok.squash, 1 - 0.28 * tok.squash, 1 + 0.18 * tok.squash);
    tok.marker.position.y = act ? MARK_Y + Math.sin(t * 5) * 0.15 : PIN_Y;
    if (tok.squash > 0.01 || Math.abs(tok.ry) > 0.01) dirtyShadow(); // still landing (the bob is not a reason, see dirtyShadow)
  }
}
