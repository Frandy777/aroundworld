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

const VACANT = 0xb9b2a0; // the plot of a tile nobody owns
export interface CityLamp { tile: number; g: THREE.Group; lv: number }
export const cityLamps: CityLamp[] = []; // one entry per ordinary city tile, read by hd2d.ts to light standing, unmortgaged buildings
const tileGroups: THREE.Group[] = [];
export const lotVisible = (i: number) => tileGroups[i]?.visible ?? true;
export const lotLit = (i: number): boolean => tileGroups[i]?.userData.lit ?? false; // the lot is bought and standing (not for sale, not mortgaged): its landmark's lights may be on

// The lamp inside every tile (see `backlit`), burning from dusk: how much of it comes up through the floor (the least), through the plot (enough to read its colour at a glance) and through the lettering
// (nearly all of it, so a white code stands out of its card as a dark one does). In the restrained look the card is unlit, as bright by night as by day, so it is dimmed (see `flat`) to the share of its colours that the lamp lets through:
// the card of a white code well down, for the white to stand out of it as a dark code does of a light card, and the card of a dark code hardly at all, since the dark code has to stand out of it.
// HD-2D lights the card like the ground, so it only needs a faint lamp through it to stay readable in the dark (`cardHd`), and it lights a plot from below only while its lot stands (`plotHd`): a lamp that shines through a lot for
// sale or a mortgaged one, with no shadow, would wash out the foot of whatever stands on it.
const THROUGH = { floor: 0.1, plot: 0.5, plotHd: 0.18, ink: 0.9, card: { white: 0.3, dark: 0.85 }, cardHd: 0.12 };

// ---- Tile surfaces: the info card, the ground and the plot, one drawing per zoom level (see labels) ----
const cardTex = (t: Tile, L: number) => pixelTexture(canvas(...CARD_SIZE[L], (g) => drawCard(g, t, L)));
const groundTex = memo((type: string, kind: string, color: number, L: number) => pixelTexture(canvas(32 << L, 32 << L, (g) => drawGround(g, type, kind, color, L))));
// the plot, in whole texels of each level: top face carries the carpet, the walls are a darker tone of the same colour
const padMats = memo((color: number) => {
  const side = backlit(toon(shade(color, 0.6)), THROUGH.plot), top = glassy(lodMap(backlit(toon(0xffffff), THROUGH.plot), (L) => pixelTexture(canvas(texels(PAD.w, L), texels(PAD.d, L), (g, w, h) => drawPad(g, color, w, h, L)))), 0); // an owner's blue is paint, not glass
  return [side, top];
});

// ---- Tile geometry ----
// The tile's slab and the plot are boxes of two materials, the walls with the bottom and the top: their faces are put in that order and cut into two groups, so each costs two draws, not six.
const twoGroups = (g: THREE.BoxGeometry) => {
  const i = g.index!.array;
  g.setIndex([0, 1, 3, 4, 5, 2].flatMap((f) => [...i.slice(6 * f, 6 * f + 6)])); // the faces are +x -x +y -y +z -z, six indices each: the top (+y) goes last
  g.clearGroups(); g.addGroup(0, 30, 0); g.addGroup(30, 6, 1);
  return g;
};
const slabGeo = memo((w: number, h: number, d: number) => twoGroups(new THREE.BoxGeometry(w, h, d)));
const CARD_GEO = new THREE.PlaneGeometry(CARD.w, CARD.d).rotateX(-Math.PI / 2);
// A card's code is carved on it as raised letters: a unit voxel for each font pixel of an 11 x 5 grid centred on the middle of the card, standing on its face (see `labels` for the size).
const codeGeo = memo((code: string) => mergeGeometries(codePixels(code).map(([x, y]) => new THREE.BoxGeometry().translate(x - 5, 0.5, y - 2))));
const inkMat = memo((fg: number, dim: boolean) => backlit(toon(dim ? new THREE.Color(fg).multiply(new THREE.Color(0x808080)) : fg), THROUGH.ink)); // dim: a mortgaged card is greyed, and its letters with it
// The tile cursor (hover, selection) is a bracket at each corner of the cell: an L of voxels, its corner at the origin and its two arms (30 texels long, 6 across and tall) along +x and +z.
// A line one pixel wide breaks into dashes and stairs on the half-size buffer and is cut by whatever stands before it; blocks are drawn like everything else, and the ink pass gives them their edges.
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]], ARM = 30 / DENSITY, BAR = 6 / DENSITY;
const BRACKET_Y = PAD.h + BAR / 2; // they hover just over the plot's top, so that the one at the plot's corner does not sink into it
const BRACKET = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(0, 0).lineTo(ARM, 0).lineTo(ARM, BAR).lineTo(BAR, BAR).lineTo(BAR, ARM).lineTo(0, ARM), { depth: BAR, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, BAR, 0);

// ---- Board ----
export function createBoard() {
  cityLamps.length = tileGroups.length = 0;
  const root = new THREE.Group();
  scene.add(root);
  const cursor = (color: number) => { // four brackets, each turned to its corner about the vertical (arms pointing in): a negative scale would turn its faces inside out
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
    const ground = glassy(lodMap(backlit(toon(0xffffff), THROUGH.floor), (L) => groundTex(t.type, t.kind, t.color, L)), 0); // lit: buildings and tokens cast their shadows on it; a region's blue is paving, not glass
    const slab = new THREE.Mesh(slabGeo(SZ, SLAB, SZ), [side, ground]);
    slab.position.y = (TOP - 0.8) / 2;
    slab.receiveShadow = slab.castShadow = true;
    const [code, fg] = codeOf(t), letters = new THREE.Mesh(codeGeo(code), inkMat(fg, false));
    const card = new THREE.Mesh(CARD_GEO, flat(backlit(glassy(lodMap(toon(0xffffff, {}, PAINT), (L) => cardTex(t, L)), 0), THROUGH.cardHd), fg === 0xffffff ? THROUGH.card.white : THROUGH.card.dark)); // HD-2D lights it (soft shadows by day, the lamps' tint by night); the restrained look draws it unlit as before: exact colours, no shadow smudges. A region's blue is paint, not glass
    card.receiveShadow = true;
    card.position.set(CARD.x, TOP + 0.03, CARD.z);
    letters.position.copy(card.position);
    const pad = t.type === 'public' ? null : new THREE.Mesh(slabGeo(PAD.w, PAD.h, PAD.d), padMats(VACANT)); // the plot: city tiles only
    if (pad) { pad.position.set(PAD.x, TOP + PAD.h / 2, PAD.z); pad.castShadow = pad.receiveShadow = true; }
    const props = new THREE.Group(), bld = new THREE.Group();
    props.position.set(LOT.x, TOP + (pad ? PAD.h : 0), LOT.z); bld.position.copy(props.position);
    buildProps(props, t);
    bake(props); // the named missile is kept out of the batch in place (see bake): bake it on its own so a strike can hide it
    const rocket = props.getObjectByName(MISSILE_NAME) as THREE.Group | undefined;
    if (rocket) bake(rocket);
    g.add(slab, card, letters, props, bld);
    if (pad) g.add(pad);
    root.add(g);
    if (pad) { sign(bld); bake(bld); }
    tileGroups[t.i] = g;
    const lamp = t.type === 'city' ? (cityLamps.push({ tile: t.i, g, lv: 0 }), cityLamps[cityLamps.length - 1]) : null;
    return { g, slab, card, letters, props, rocket, side, tint: [ground, card.material], pad, bld, lamp, key: '', pop: 1, redo: () => {} };
  });
  // the parts that move (a model's nodes with a `tick`, kept by bake at any depth, in its props or in what its upgrades build): driven by the clock every frame, listed per tile so a rebuild swaps in its new nodes
  const liveOf = (g: THREE.Group) => { const l: THREE.Object3D[] = []; g.traverse((c) => c.userData.tick && l.push(c)); return l; };
  const live = tiles.map((o) => liveOf(o.g));
  type Plot = (typeof tiles)[number];
  // A new owner or a new level: the building rises from the plot, squashed wide and flat first, with a little overshoot (ease out back)
  const squash = (o: Plot) => { const e = 1 + 2.70158 * (o.pop - 1) ** 3 + 1.70158 * (o.pop - 1) ** 2; o.bld.scale.set(1 + (1 - e) * 0.3, Math.max(e, 0.01), 1 + (1 - e) * 0.3); };

  function setOwner(i: number, st: { color: number; lv: number; m: boolean } | null, opts?: { sign?: boolean }) {
    const t = TILES[i], o = tiles[i];
    if (t.type === 'public') return;
    o.redo = () => setOwner(i, st, opts); // the lot as it was last set, to be drawn again (see rebuild)
    const key = st ? `${st.color}|${st.lv}` : ''; // mortgaging or redeeming changes neither
    if (st && key !== o.key) { o.pop = 0; squash(o); }
    o.key = key;
    freeBaked(o.bld); // the baked meshes own their geometry: free it
    o.bld.clear();
    o.tint.forEach((m) => m.color.set(st?.m ? 0x808080 : 0xffffff));
    o.letters.material = inkMat(codeOf(t)[1], !!st?.m);
    const col = st?.m ? 0x555555 : st?.color ?? VACANT;
    o.pad!.material = padMats(col);
    const lit = st && !st.m ? st.color : null; // a standing lot (bought, not mortgaged) has its lights on, its owner's colour in them: for sale or mortgaged they are out
    o.g.userData.lit = lit !== null; modelOwner(t, lit);
    padMats(col).forEach((m) => (backlitOf(m).value = lit !== null ? THROUGH.plotHd : 0)); // HD-2D: the plot is lit from below while the lot stands, and not at all for sale or mortgaged (see `backlitOf`)
    if (!st) { if (opts?.sign !== false) sign(o.bld); }
    else if (t.type === 'special') buildLevels(o.bld, t, st.lv, st.m); // the landmark stands on its plot at every level: only the level is added, by what its model builds for the upgrades or else a small sign
    else if (t.type === 'city') st.lv ? building(o.bld, st.lv, st.m ? 0x8c8c8c : new THREE.Color(t.color).lerp(new THREE.Color(0xffffff), 0.6).getHex(), col, st.m) : flag(o.bld, st.m ? 0x666666 : st.color); // an investment adds nothing: its props stand on the owner's plot, the colour says it all, a flag would only hide them
    if (o.lamp) o.lamp.lv = st && !st.m ? st.lv : 0;
    bake(o.bld); live[i] = liveOf(o.g);
    dirtyShadow();
  }

  // Rebuilds a tile's props in place (its model file hot-updated, or a dev poke at it): the building side is drawn again from the ownership it last had, since a special city's upgrades are in its model file too.
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

  // One tile on its own: the rest of the board is hidden and the plot's footprint is outlined over it, the bound a model must keep to.
  let bounds: THREE.Object3D | null = null;
  const isolate = (i: number | null) => {
    tiles.forEach((o, k) => (o.g.visible = i === null || k === i));
    if (i === null) { bounds?.removeFromParent(); bounds = null; }
    else {
      bounds ??= new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(PAD.w, 0.02, PAD.d)), new THREE.LineBasicMaterial({ color: 0xff3b3b }));
      bounds.position.set(PAD.x, TOP + PAD.h + 0.02, PAD.z); // the plot's top face, raised a hair so it does not z-fight
      tiles[i].g.add(bounds);
    }
    dirtyShadow();
  };

  const place = (r: THREE.Group, i: number, hop: number) => { // the cursor on tile i, hop above its resting height
    r.visible = i >= 0;
    if (i < 0) return;
    r.position.set(POS[i].x, tiles[i].g.position.y + TOP + BRACKET_Y + hop, POS[i].z);
    r.children.forEach((b, k) => b.position.set((CORNERS[k][0] * S) / 2, 0, (CORNERS[k][1] * S) / 2));
  };
  const walls = (i: number, lit: boolean) => tiles[i].side.color.set(TILES[i].color).multiplyScalar(lit ? 1.3 : 1); // the selected tile's walls are one band up the shading ramp (its bands are about 1.3x apart)
  let hov = -1, sel = -1;
  return {
    slabs: tiles.map((o) => o.slab), setOwner, rebuild, isolate, // what the pointer picks: each tile's base, a plain box
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
    // The carved codes, once the camera has moved and before render(). Their size is the view's at the 'fit' zoom: a font pixel is a buffer pixel (or the widest that 3 letters fit on a card), and a row is
    // stretched by 1 / sin(ELEV), since the card lies back by that much: the rows come out a pixel high at the default tilt. A stroke is one pixel wide, so it needs a pixel to itself: where the zoom has gone
    // out past that a column falls between two pixel centres and is lost, and the code is not drawn. The relief is a 25th of a font pixel while the view is far, since more and the ink pass takes the
    // one-pixel strokes for creases and lights and shades them; once the zoom has its closer levels the letters rise by half a font pixel.
    // Card and code sit on the pixel lattice that render() puts the camera on (see snap), the code's edges between pixel centres: left to chance, an edge on a centre is taken for the pixel on either side by
    // a hair of relief. The code is 11 columns and 5 rows, so it is centred on a pixel, and so is the card, sized to an odd number of pixels (at most one off its true size): any other card would have
    // its middle on a pixel's edge, and the code, which can only be moved a whole pixel, would sit half a pixel to one side.
    // HD-2D has no such lattice: its lens turns to any side and tilt, where a card stretched to the pixels of one view and a code shifted by its parallax would slide off the card. There the card stays where it lies and the code is centred on it,
    // a font pixel square (the same size) and a thin relief of 0.06, so it is in the middle of its card from every side and never overhangs its frame.
    labels() {
      const u = Math.min(pxUnit(fitZoom), CARD.w / 11), p = pxUnit(), h = lod.n ? u / 2 : u / 25, s = Math.sin(ELEV), c = Math.cos(ELEV);
      const odd = (n: number) => 2 * Math.round((n - 1) / 2) + 1, w = odd(CARD.w / p), d = odd((CARD.d * s) / p); // the card's size in pixels, across and up the screen
      tiles.forEach((o) => {
        if (hd.on) {
          o.card.scale.set(1, 1, 1);
          o.card.position.set(CARD.x, TOP + 0.015, CARD.z);
          o.letters.visible = p <= 1.01 * u;
          o.letters.scale.set(u, 0.06, u);
          o.letters.position.copy(o.card.position);
          return;
        }
        const { x, y, z } = o.g.position, g = (y + TOP + 0.03) * c; // g: how high the card's plane is on the screen
        const mx = (Math.floor((x + CARD.x) / p) + 0.5) * p, my = (Math.floor((g - (z + CARD.z) * s) / p) + 0.5) * p; // its middle moved to the middle of the pixel it is in, across and up the screen
        o.card.scale.set((w * p) / CARD.w, 1, (d * p) / (s * CARD.d));
        o.card.position.set(mx - x, TOP + 0.03, (g - my) / s - z);
        o.letters.visible = p <= 1.01 * u;
        o.letters.scale.set(u, h, u / s);
        o.letters.position.set(mx - x, TOP + 0.03, (g + h * c - my) / s - z); // the tops of the letters are h higher, which is h * c up the screen
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
      tiles.forEach((o) => { // each tile lifts as one piece (slab, card, props, building)
        const rise = o.g.userData.lift - o.g.position.y, popping = o.pop < 1;
        o.g.position.y += rise * Math.min(1, dt * 14);
        if (popping) { o.pop = Math.min(1, o.pop + dt / 0.45); squash(o); }
        if (popping || Math.abs(rise) > 1e-3) dirtyShadow(); // until it has settled (an exponential never quite arrives: 1e-3 is a fiftieth of a shadow texel)
      });
      // The cursors breathe: 0, 1, 2, 1 art pixels up the screen, a step every third of a second (px: one pixel up the screen, as a height)
      const px = (camera.top - camera.bottom) / (camera.zoom * artH() * Math.sin(controls.getPolarAngle()));
      const hop = [0, 1, 2, 1][Math.floor(t * 3) % 4] * px;
      place(hoverCursor, hov === sel ? -1 : hov, hop); place(selCursor, sel, hop);
    },
  };
}
