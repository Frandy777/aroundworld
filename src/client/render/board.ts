import * as THREE from 'three';
import { scene, renderer, camera, controls, lod, toon, lodMap, pixelTexture, texels, toScreen, DENSITY } from './scene';
import { TILES, type Tile } from '../../shared/data';
import { canvas, shade } from './art';
import { CARD_SIZE, cardText, drawCard, drawCode, drawGround, drawPad } from './labels';
import { CARD, CENTRE, LOT, MID, PAD, POS, S, SLAB, SZ, TOP, WIDE, home } from './layout';
import { bake, memo, sideTex } from './builder';
import { buildProps, building, flag, level, sign } from './models';

type Block = ReturnType<typeof cardText>[number];

const VACANT = 0xb9b2a0; // the plot of a tile nobody owns

// ---- Tile surfaces: the info card, the ground and the plot, one drawing per zoom level (see labels) ----
const cardTex = (t: Tile, L: number) => pixelTexture(canvas(...CARD_SIZE[L], (g) => drawCard(g, t, L)));
const groundTex = memo((type: string, kind: string, color: number, L: number) => pixelTexture(canvas(32 << L, 32 << L, (g) => drawGround(g, type, kind, color, L))));
// START's ground, one texture over both its cells (see createBoard), with its finish line along the bottom edge
const startTex = memo((color: number, L: number) => pixelTexture(canvas(texels(WIDE, L), texels(SZ, L), (g, w, h) => drawGround(g, 'public', 'start', color, L, w, h))));
// the plot, in whole texels of each level: top face carries the carpet, the walls are a darker tone of the same colour
const padMats = memo((color: number) => {
  const side = toon(shade(color, 0.6)), top = lodMap(toon(0xffffff), (L) => pixelTexture(canvas(texels(PAD.w, L), texels(PAD.d, L), (g, w, h) => drawPad(g, color, w, h, L))));
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
// START's slab, two cells wide: its long walls (the +z and -z faces, vertices 16-23) repeat their courses of stone over the extra length, so no stone is stretched
const START_GEO = twoGroups(new THREE.BoxGeometry(WIDE, SLAB, SZ)), START_UV = START_GEO.attributes.uv;
for (let i = 16; i < 24; i++) START_UV.setX(i, (START_UV.getX(i) * WIDE) / SZ);
// The tile cursor (hover, selection) is a bracket at each corner of the cell: an L of voxels, its corner at the origin and its two arms (30 texels long, 6 across and tall) along +x and +z.
// A line one pixel wide breaks into dashes and stairs on the half-size buffer and is cut by whatever stands before it; blocks are drawn like everything else, and the ink pass gives them their edges.
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]], ARM = 30 / DENSITY, BAR = 6 / DENSITY;
const BRACKET_Y = PAD.h + BAR / 2; // they hover just over the plot's top, so that the one at the plot's corner does not sink into it
const BRACKET = new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(0, 0).lineTo(ARM, 0).lineTo(ARM, BAR).lineTo(BAR, BAR).lineTo(BAR, ARM).lineTo(0, ARM), { depth: BAR, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, BAR, 0);

// ---- Board ----
export function createBoard() {
  const root = new THREE.Group();
  scene.add(root);
  const cursor = (color: number) => { // four brackets, each turned to its corner by a negative scale (arms pointing in)
    const g = new THREE.Group(), m = toon(color);
    CORNERS.forEach(([x, z]) => { const b = new THREE.Mesh(BRACKET, m); b.scale.set(-x, 1, -z); g.add(b); });
    g.visible = false; scene.add(g); return g;
  };
  const hoverCursor = cursor(0xffffff), selCursor = cursor(0xffe066);
  // START is two cells wide, its own and the wing (the loop's last cell): one slab over both, so the ground, the walls and the finish line run across the join.
  const tiles = TILES.map((t) => {
    const g = new THREE.Group(), wide = !t.i;
    g.position.set(POS[t.i].x, 0, POS[t.i].z);
    g.userData = { lift: 0 };
    const side = lodMap(toon(t.color), sideTex);
    const ground = lodMap(toon(0xffffff), (L) => (wide ? startTex(t.color, L) : groundTex(t.type, t.kind, t.color, L))); // lit: buildings and tokens cast their shadows on it
    const slab = new THREE.Mesh(wide ? START_GEO : slabGeo(SZ, SLAB, SZ), [side, ground]);
    slab.position.y = (TOP - 0.8) / 2;
    slab.receiveShadow = slab.castShadow = true;
    const card = new THREE.Mesh(CARD_GEO, lodMap(new THREE.MeshBasicMaterial(), (L) => cardTex(t, L))); // unlit: exact colours, no shadow smudges
    card.position.set(CARD.x, TOP + 0.03, CARD.z);
    if (wide) { slab.position.add(MID); card.position.add(home(0)).sub(POS[0]); } // START: the slab spans its own cell and the wing, the card stands in the wing and the props in its own cell
    const pad = t.type === 'public' ? null : new THREE.Mesh(slabGeo(PAD.w, PAD.h, PAD.d), padMats(VACANT)); // the plot: city tiles only
    if (pad) { pad.position.set(PAD.x, TOP + PAD.h / 2, PAD.z); pad.castShadow = pad.receiveShadow = true; }
    const props = new THREE.Group(), bld = new THREE.Group();
    props.position.set(LOT.x, TOP + (pad ? PAD.h : 0), LOT.z); bld.position.copy(props.position);
    buildProps(props, t);
    bake(props);
    g.add(slab, card, props, bld);
    if (pad) g.add(pad);
    root.add(g);
    if (pad) { sign(bld); bake(bld); }
    return { g, slab, card, props, side, tint: [ground, card.material], pad, bld, key: '', pop: 1 };
  });
  type Plot = (typeof tiles)[number];
  // A new owner or a new level: the building rises from the plot, squashed wide and flat first, with a little overshoot (ease out back)
  const squash = (o: Plot) => { const e = 1 + 2.70158 * (o.pop - 1) ** 3 + 1.70158 * (o.pop - 1) ** 2; o.bld.scale.set(1 + (1 - e) * 0.3, Math.max(e, 0.01), 1 + (1 - e) * 0.3); };

  // Far level: the cards' codes are stamped on a canvas laid over the 3D one (same size, same pixels), see drawCode
  const over = Object.assign(document.createElement('canvas'), { id: 'codes' }), ctx = over.getContext('2d')!, at = new THREE.Vector3();
  renderer.domElement.after(over);
  let shown = false;
  function codes(on: boolean, across: number, down: number) { // put every card's code over it, or take them off (the zoom has left the far level, or there is no lettering, see labels)
    if (!on && !shown) return;
    const { width: w, height: h } = renderer.domElement; // the overlay has the 3D canvas's own pixels
    if (over.width !== w || over.height !== h) { over.width = w; over.height = h; }
    ctx.clearRect(0, 0, w, h);
    shown = on;
    if (!shown) return;
    const k = (w * camera.zoom) / (camera.right - camera.left), ph = down * k * Math.cos(controls.getPolarAngle()); // pixels per world unit, and the card's height on screen
    tiles.forEach((o, i) => {
      const [x, y] = toScreen(o.card.getWorldPosition(at)).map((v) => (v * w) / innerWidth);
      if (x > -30 && x < w + 30 && y > -20 && y < h + 20) drawCode(ctx, TILES[i], x, y, ph, across * k, (o.card.material.color.getHex() & 255) / 255); // last: how bright the card looks (mortgaged = half)
    });
  }

  // Mid and near levels: the lettering (the name of each card) is laid over the scene as quads, flat on the card.
  // They are in the 3D scene, so a token standing in front of a card hides its lettering; they write no depth, so the ink pass never sees them.
  const FLAT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), BLANK = pixelTexture(canvas(1, 1, () => {})), texts = new Map<string, THREE.Texture>(), quads: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const quad = () => { const m = new THREE.Mesh(FLAT, new THREE.MeshBasicMaterial({ map: BLANK, transparent: true, depthWrite: false })); scene.add(m); return m; };
  const right = new THREE.Vector3(), away = new THREE.Vector3(), look = new THREE.Vector3(), c = new THREE.Vector3();
  function names(on: boolean, across: number, down: number) {
    let n = 0; // quads in use
    if (on) {
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements, u = (camera.top - camera.bottom) / (camera.zoom * renderer.domElement.height); // world units per pixel
      const cos = Math.hypot(e[4], e[6]), theta = Math.atan2(-e[2], e[0]); // a length along the ground looks this much shorter up the screen; the camera's azimuth
      right.set(e[0], 0, e[2]); away.set(e[4], 0, e[6]).divideScalar(cos); look.set(e[8], e[9], e[10]);
      // Block b is centred on c. Each quad is turned to the camera's azimuth, which squares it with the cards (see labels), so it shows as an upright rectangle, sized so that one of its texels is
      // one buffer pixel, and moved to the pixel lattice that render() puts the camera on (see snap): each texel then covers exactly one pixel, whatever the zoom or tilt.
      const lay = (b: Block, tint: THREE.Color) => {
        const m = (quads[n] ??= quad());
        c.addScaledVector(look, 0.02); // toward the camera, so it stays where it is on screen: clear of the card
        const x = c.dot(right) / u, y = (c.x * e[4] + c.y * e[5] + c.z * e[6]) / u, fx = (b.w & 1) / 2, fy = (b.h & 1) / 2; // where c is on the lattice, in pixels
        c.addScaledVector(right, (Math.round(x - fx) + fx - x) * u).addScaledVector(away, ((Math.round(y - fy) + fy - y) * u) / cos);
        m.material.color.copy(tint);
        m.position.copy(c); m.rotation.y = theta; m.scale.set(b.w * u, 1, (b.h * u) / cos);
        m.material.map = texts.get(b.key) ?? texts.set(b.key, pixelTexture(canvas(b.w, b.h, b.draw))).get(b.key)!;
        m.visible = true;
        n++;
      };
      tiles.forEach((o, i) => {
        const p = o.card.getWorldPosition(c).project(camera);
        if (Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return;
        for (const b of cardText(TILES[i], across / u, (down * cos) / u)) {
          c.setFromMatrixPosition(o.card.matrixWorld).addScaledVector(away, (0.5 - b.y) * down);
          lay(b, o.card.material.color);
        }
      });
    }
    for (let i = n; i < quads.length; i++) quads[i].visible = false;
  }

  function setOwner(i: number, st: { color: number; lv: number; m: boolean } | null) {
    const t = TILES[i], o = tiles[i];
    if (t.type === 'public') return;
    const key = st ? `${st.color}|${st.lv}` : ''; // mortgaging or redeeming changes neither
    if (st && key !== o.key) { o.pop = 0; squash(o); }
    o.key = key;
    o.bld.children.forEach((m) => (m as THREE.Mesh).geometry.dispose()); // the baked meshes own their geometry: free it
    o.bld.clear();
    o.tint.forEach((m) => m.color.set(st?.m ? 0x808080 : 0xffffff));
    const col = st?.m ? 0x555555 : st?.color ?? VACANT;
    o.pad!.material = padMats(col);
    if (!st) sign(o.bld);
    else if (t.type === 'special') level(o.bld, st.lv, st.m); // the landmark stands on its plot at every level: only the level is added
    else if (t.type === 'city') st.lv ? building(o.bld, st.lv, st.m ? 0x8c8c8c : new THREE.Color(t.color).lerp(new THREE.Color(0xffffff), 0.6).getHex(), col, st.m) : flag(o.bld, st.m ? 0x666666 : st.color); // an investment adds nothing: its props stand on the owner's plot, the colour says it all, a flag would only hide them
    bake(o.bld);
  }

  const place = (r: THREE.Group, i: number, hop: number) => { // the cursor on tile i, hop above its resting height: START's spans both its cells
    r.visible = i >= 0;
    if (i < 0) return;
    const p = i ? POS[i] : CENTRE, hw = (i ? S : 2 * S) / 2;
    r.position.set(p.x, tiles[i].g.position.y + TOP + BRACKET_Y + hop, p.z);
    r.children.forEach((b, k) => b.position.set(CORNERS[k][0] * hw, 0, (CORNERS[k][1] * S) / 2));
  };
  const walls = (i: number, lit: boolean) => tiles[i].side.color.set(TILES[i].color).multiplyScalar(lit ? 1.3 : 1); // the selected tile's walls are one band up the shading ramp (its bands are about 1.3x apart)
  let hov = -1, sel = -1;
  return {
    slabs: tiles.map((o) => o.slab), setOwner, // what the pointer picks: each tile's base, a plain box (START's spans both its cells)
    // The lettering of every card, once the camera has moved and before render(). `on`: in a game. It is there only while the camera is square to the tiles (its azimuth a whole
    // number of quarter turns): turned from them, lettering that stays upright would not sit on its card, and lettering that turns with them cannot be pixel exact.
    labels(on: boolean) {
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements, square = on && Math.cos(4 * Math.atan2(-e[2], e[0])) > 0.99984;
      const [across, down] = Math.abs(e[2]) > 0.5 ? [CARD.d, CARD.w] : [CARD.w, CARD.d]; // a card's width and depth on the screen: they swap when the camera looks along x
      codes(square && !lod.n, across, down); names(square && lod.n > 0, across, down);
    },
    hover(i: number) { if (hov >= 0 && hov !== sel) tiles[hov].g.userData.lift = 0; hov = i; if (i >= 0) tiles[i].g.userData.lift = Math.max(tiles[i].g.userData.lift, 0.3); },
    select(i: number) {
      if (sel >= 0) { tiles[sel].g.userData.lift = 0; walls(sel, false); }
      sel = i;
      if (i >= 0) { tiles[i].g.userData.lift = 0.6; walls(i, true); }
    },
    update(t: number, dt: number) {
      tiles.forEach((o) => { // each tile lifts as one piece (slab, card, props, building)
        o.g.position.y += (o.g.userData.lift - o.g.position.y) * Math.min(1, dt * 14);
        if (o.pop < 1) { o.pop = Math.min(1, o.pop + dt / 0.45); squash(o); }
      });
      // The cursors breathe: 0, 1, 2, 1 buffer pixels up the screen, a step every third of a second (px: one pixel up the screen, as a height)
      const px = (camera.top - camera.bottom) / (camera.zoom * renderer.domElement.height * Math.sin(controls.getPolarAngle()));
      const hop = [0, 1, 2, 1][Math.floor(t * 3) % 4] * px;
      place(hoverCursor, hov === sel ? -1 : hov, hop); place(selCursor, sel, hop);
    },
  };
}
