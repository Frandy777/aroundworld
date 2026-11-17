import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, artH, camera, controls, lod, toon, lodMap, pixelTexture, texels, dirtyShadow, pxUnit, fitZoom, ELEV, DENSITY } from './scene';
import { PAINT, backlit, backlitOf, flat, glassy, hd } from './light';
import { TILES, type Tile } from '../../shared/data';
import { canvas, codePixels, shade } from './art';
import { CARD_SIZE, codeOf, drawCard, drawGround, drawPad } from './labels';
import { CARD, LOT, PAD, POS, S, SLAB, SZ, TOP } from './layout';
import { bake, freeBaked, memo, sideTex } from './builder';
import { buildLevels, buildProps, building, flag, modelKey, modelOwner, setModelHandler, sign } from './models';
import { MISSILE_NAME } from './models/missile';

const VACANT = 0xb9b2a0;
export interface CityLamp { tile: number; g: THREE.Group; level: number }
export const cityLamps: CityLamp[] = [];
const tileGroups: THREE.Group[] = [];
export const lotVisible = (i: number) => tileGroups[i]?.visible ?? true;
export const lotLit = (i: number): boolean => tileGroups[i]?.userData.lit ?? false;

const THROUGH = { floor: 0.1, plot: 0.5, plotHd: 0.18, ink: 0.9, card: { white: 0.3, dark: 0.85 }, cardHd: 0.12 };

const cardTex = (t: Tile, L: number, hd: boolean) => pixelTexture(canvas(...CARD_SIZE[L], (g) => drawCard(g, t, L, hd)));
const groundTex = memo((type: string, kind: string, color: number, L: number, hd: boolean) => pixelTexture(canvas(32 << L, 32 << L, (g) => drawGround(g, type, kind, color, L, hd))));
const padMats = memo((color: number) => {
  const side = backlit(toon(shade(color, 0.6)), THROUGH.plot), top = glassy(lodMap(backlit(toon(0xffffff), THROUGH.plot), (L, hd) => pixelTexture(canvas(texels(PAD.w, L), texels(PAD.d, L), (g, w, h) => drawPad(g, color, w, h, L, hd)))), 0);
  return [side, top];
});

const twoGroups = (g: THREE.BoxGeometry) => {
  const i = g.index!.array;
  g.setIndex([0, 1, 3, 4, 5, 2].flatMap((f) => [...i.slice(6 * f, 6 * f + 6)]));
  g.clearGroups(); g.addGroup(0, 30, 0); g.addGroup(30, 6, 1);
  return g;
};
const slabGeo = memo((w: number, h: number, d: number) => twoGroups(new THREE.BoxGeometry(w, h, d)));
const CARD_GEO = new THREE.PlaneGeometry(CARD.w, CARD.d).rotateX(-Math.PI / 2);
const codeGeo = memo((code: string) => mergeGeometries(codePixels(code).map(([x, y]) => new THREE.BoxGeometry().translate(x - 5, 0.5, y - 2))));
const inkMat = memo((fg: number, dim: boolean) => backlit(toon(dim ? new THREE.Color(fg).multiply(new THREE.Color(0x808080)) : fg), THROUGH.ink));
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]], ARM = 30 / DENSITY, BAR = 6 / DENSITY;
const BRACKET_Y = PAD.h + BAR / 2;
const BRACKET = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(0, 0).lineTo(ARM, 0).lineTo(ARM, BAR).lineTo(BAR, BAR).lineTo(BAR, ARM).lineTo(0, ARM), { depth: BAR, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, BAR, 0);

export function createBoard() {
  cityLamps.length = tileGroups.length = 0;
  const root = new THREE.Group();
  scene.add(root);
  const cursor = (color: number) => {
    const g = new THREE.Group(), m = toon(color);
    CORNERS.forEach((_, k) => { const b = new THREE.Mesh(BRACKET, m); b.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][k]; g.add(b); });
    g.visible = false; scene.add(g); return g;
  };
  const hoverCursor = cursor(0xffffff), selCursor = cursor(0xffe066);
  const tiles = TILES.map((t) => {
    const g = new THREE.Group();
    g.position.set(POS[t.i].x, 0, POS[t.i].z);
    g.userData = { lift: 0, lit: false };
    const side = lodMap(toon(t.color), sideTex);
    const ground = glassy(lodMap(backlit(toon(0xffffff), THROUGH.floor), (L, hd) => groundTex(t.type, t.kind, t.color, L, hd)), 0);
    const slab = new THREE.Mesh(slabGeo(SZ, SLAB, SZ), [side, ground]);
    slab.position.y = (TOP - 0.8) / 2;
    slab.receiveShadow = slab.castShadow = true;
    const [code, fg] = codeOf(t), letters = new THREE.Mesh(codeGeo(code), inkMat(fg, false));
    const card = new THREE.Mesh(CARD_GEO, flat(backlit(glassy(lodMap(toon(0xffffff, {}, PAINT), (L, hd) => cardTex(t, L, hd)), 0), THROUGH.cardHd), fg === 0xffffff ? THROUGH.card.white : THROUGH.card.dark));
    card.receiveShadow = true;
    card.position.set(CARD.x, TOP + 0.03, CARD.z);
    letters.position.copy(card.position);
    const pad = t.type === 'public' ? null : new THREE.Mesh(slabGeo(PAD.w, PAD.h, PAD.d), padMats(VACANT));
    if (pad) { pad.position.set(PAD.x, TOP + PAD.h / 2, PAD.z); pad.castShadow = pad.receiveShadow = true; }
    const props = new THREE.Group(), bld = new THREE.Group();
    props.position.set(LOT.x, TOP + (pad ? PAD.h : 0), LOT.z); bld.position.copy(props.position);
    buildProps(props, t);
    bake(props);
    const rocket = props.getObjectByName(MISSILE_NAME) as THREE.Group | undefined;
    if (rocket) bake(rocket);
    g.add(slab, card, letters, props, bld);
    if (pad) g.add(pad);
    root.add(g);
    if (pad) { sign(bld); bake(bld); }
    tileGroups[t.i] = g;
    const lamp = t.type === 'city' ? (cityLamps.push({ tile: t.i, g, level: 0 }), cityLamps[cityLamps.length - 1]) : null;
    return { g, slab, card, letters, props, rocket, side, tint: [ground, card.material], pad, bld, lamp, key: '', pop: 1, redo: () => {} };
  });
  const liveOf = (g: THREE.Group) => { const l: THREE.Object3D[] = []; g.traverse((c) => c.userData.tick && l.push(c)); return l; };
  const live = tiles.map((o) => liveOf(o.g));
  type Plot = (typeof tiles)[number];
  const squash = (o: Plot) => { const e = 1 + 2.70158 * (o.pop - 1) ** 3 + 1.70158 * (o.pop - 1) ** 2; o.bld.scale.set(1 + (1 - e) * 0.3, Math.max(e, 0.01), 1 + (1 - e) * 0.3); };

  function setOwner(i: number, st: { color: number; level: number; mortgaged: boolean } | null, opts?: { sign?: boolean }) {
    const t = TILES[i], o = tiles[i];
    if (t.type === 'public') return;
    o.redo = () => setOwner(i, st, opts);
    const key = st ? `${st.color}|${st.level}` : '';
    if (st && key !== o.key) { o.pop = 0; squash(o); }
    o.key = key;
    freeBaked(o.bld);
    o.bld.clear();
    o.tint.forEach((m) => m.color.set(st?.mortgaged ? 0x808080 : 0xffffff));
    o.letters.material = inkMat(codeOf(t)[1], !!st?.mortgaged);
    const col = st?.mortgaged ? 0x555555 : st?.color ?? VACANT;
    o.pad!.material = padMats(col);
    const lit = st && !st.mortgaged ? st.color : null;
    o.g.userData.lit = lit !== null; modelOwner(t, lit);
    padMats(col).forEach((m) => (backlitOf(m).value = lit !== null ? THROUGH.plotHd : 0));
    if (!st) { if (opts?.sign !== false) sign(o.bld); }
    else if (t.type === 'special') buildLevels(o.bld, t, st.level, st.mortgaged);
    else if (t.type === 'city') st.level ? building(o.bld, st.level, st.mortgaged ? 0x8c8c8c : new THREE.Color(t.color).lerp(new THREE.Color(0xffffff), 0.6).getHex(), col, st.mortgaged) : flag(o.bld, st.mortgaged ? 0x666666 : st.color);
    if (o.lamp) o.lamp.level = st && !st.mortgaged ? st.level : 0;
    bake(o.bld); live[i] = liveOf(o.g);
    dirtyShadow();
  }

  const rebuild = (i: number) => {
    const o = tiles[i];
    freeBaked(o.props);
    o.props.clear();
    buildProps(o.props, TILES[i]);
    bake(o.props);
    const rocket = o.props.getObjectByName(MISSILE_NAME) as THREE.Group | undefined;
    if (rocket) bake(rocket);
    o.rocket = rocket;
    live[i] = liveOf(o.g);
    o.redo();
    dirtyShadow();
  };
  setModelHandler((keys) => tiles.forEach((_, i) => keys.includes(modelKey(TILES[i]) ?? '') && rebuild(i)));

  let bounds: THREE.Object3D | null = null;
  const isolate = (i: number | null) => {
    tiles.forEach((o, k) => (o.g.visible = i === null || k === i));
    if (i === null) { bounds?.removeFromParent(); bounds = null; }
    else {
      bounds ??= new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(PAD.w, 0.02, PAD.d)), new THREE.LineBasicMaterial({ color: 0xff3b3b }));
      bounds.position.set(PAD.x, TOP + PAD.h + 0.02, PAD.z);
      tiles[i].g.add(bounds);
    }
    dirtyShadow();
  };

  const place = (r: THREE.Group, i: number, hop: number) => {
    r.visible = i >= 0;
    if (i < 0) return;
    r.position.set(POS[i].x, tiles[i].g.position.y + TOP + BRACKET_Y + hop, POS[i].z);
    r.children.forEach((b, k) => b.position.set((CORNERS[k][0] * S) / 2, 0, (CORNERS[k][1] * S) / 2));
  };
  const walls = (i: number, lit: boolean) => tiles[i].side.color.set(TILES[i].color).multiplyScalar(lit ? 1.3 : 1);
  let hov = -1, sel = -1;
  return {
    slabs: tiles.map((o) => o.slab), setOwner, rebuild, isolate,
    launcher(i: number, visible: boolean) {
      const rocket = tiles[i].rocket;
      if (!rocket) return undefined;
      rocket.updateWorldMatrix(true, false);
      const point = rocket.getWorldPosition(new THREE.Vector3());
      rocket.visible = visible; dirtyShadow();
      return point;
    },
    impact(i: number) {
      const g = tiles[i].g; g.updateWorldMatrix(true, false);
      return g.localToWorld(new THREE.Vector3(LOT.x, TOP + PAD.h + 0.35, LOT.z));
    },
    labels() {
      const u = Math.min(pxUnit(fitZoom), CARD.w / 11), p = pxUnit(), h = lod.n ? u / 2 : u / 25, s = Math.sin(ELEV), c = Math.cos(ELEV);
      const odd = (n: number) => 2 * Math.round((n - 1) / 2) + 1, w = odd(CARD.w / p), d = odd((CARD.d * s) / p);
      tiles.forEach((o) => {
        if (hd.on) {
          o.card.scale.set(1, 1, 1);
          o.card.position.set(CARD.x, TOP + 0.015, CARD.z);
          o.letters.visible = p <= 1.01 * u;
          o.letters.scale.set(u, 0.06, u);
          o.letters.position.copy(o.card.position);
          return;
        }
        const { x, y, z } = o.g.position, g = (y + TOP + 0.03) * c;
        const mx = (Math.floor((x + CARD.x) / p) + 0.5) * p, my = (Math.floor((g - (z + CARD.z) * s) / p) + 0.5) * p;
        o.card.scale.set((w * p) / CARD.w, 1, (d * p) / (s * CARD.d));
        o.card.position.set(mx - x, TOP + 0.03, (g - my) / s - z);
        o.letters.visible = p <= 1.01 * u;
        o.letters.scale.set(u, h, u / s);
        o.letters.position.set(mx - x, TOP + 0.03, (g + h * c - my) / s - z);
      });
    },
    hover(i: number) { if (hov >= 0 && hov !== sel) tiles[hov].g.userData.lift = 0; hov = i; if (i >= 0) tiles[i].g.userData.lift = Math.max(tiles[i].g.userData.lift, 0.3); },
    select(i: number) {
      if (sel >= 0) { tiles[sel].g.userData.lift = 0; walls(sel, false); }
      sel = i;
      if (i >= 0) { tiles[i].g.userData.lift = 0.6; walls(i, true); }
    },
    update(t: number, dt: number) {
      live.forEach((l) => l.forEach((m) => m.userData.tick(t)));
      tiles.forEach((o) => {
        const rise = o.g.userData.lift - o.g.position.y, popping = o.pop < 1;
        o.g.position.y += rise * Math.min(1, dt * 14);
        if (popping) { o.pop = Math.min(1, o.pop + dt / 0.45); squash(o); }
        if (popping || Math.abs(rise) > 1e-3) dirtyShadow();
      });
      const px = (camera.top - camera.bottom) / (camera.zoom * artH() * Math.sin(controls.getPolarAngle()));
      const hop = [0, 1, 2, 1][Math.floor(t * 3) % 4] * px;
      place(hoverCursor, hov === sel ? -1 : hov, hop); place(selCursor, sel, hop);
    },
  };
}
