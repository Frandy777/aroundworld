import * as THREE from 'three';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { tokens } from './actors';
import { cityLamps, lotLit, lotVisible } from './board';
import { LOT, PAD, POS } from './layout';
import { fixedLamps } from './lamps';
import { LAMP, U, lamps, spot } from './light';
import { defOf } from './models';
import { AIR, AIR_GLSL, controls, free, hdCam, LAYER_FX, LENS, renderer, scene, sun, zoomed } from './scene';
import { sky } from './sky';
import { SEA_Y } from './world';

// ---- Local lights: the warm pools of Octopath's streets. Four lamps are the tokens' lanterns, one is borrowed by missiles (strike.ts), the fixed slots stand at the glowing
// landmarks — each declared by its own tile model and resolved over its lot (see ModelDef.lamps and lamps.ts, which also keeps the three lights off the board) — and each ordinary
// city holds a key+fill pair when built. A slot is one point light, so where it stands, its colour and its reach are set once here and the frame loop only dims it. ----
const FIXED = fixedLamps(defOf).map((l, slot) => ({ ...l, slot: LAMP.fixed + slot }));
if (FIXED.length > LAMP.city - LAMP.fixed) throw new Error(`fixed lamps overflow the ${LAMP.city - LAMP.fixed} free slots (${FIXED.length} declared)`); // a lamp past the fixed range would sit on a city's slot
for (const l of FIXED) { const lamp = lamps[l.slot]; lamp.position.copy(l.at); lamp.color.setHex(l.color); lamp.distance = l.reach; }
const BEACON = FIXED.find((l) => l.pulse === 'beacon')!; // the lighthouse: its beam is drawn with the shafts (volPass)

const WARM = new THREE.Color(0xffd9a0);
// Each ordinary city level gets a porch/apron key lamp (+z front, inset from the tile's sea cliff like START's ingot so water reflections stay soft)
// and a courtyard fill over the tile's middle (-x side wall and card yard): [kx, ky, kz, fx, fy, fz, colour, keyPower, fillPower, reach]
const CITY_LIT: [number, number, number, number, number, number, number, number, number, number][] = [
  [0.2, 0.7, 1.52, -1.45, 0.75, -0.3, 0xffab42, 3.2, 1.8, 5.8],  // Lv 1 cottage
  [0.22, 0.88, 1.55, -1.48, 0.95, -0.3, 0xffb44c, 1.8, 1.0, 6.2], // Lv 2 villa: weaker, so that the owner's colour is not washed out
  [0.15, 1.18, 1.52, -1.48, 1.3, -0.35, 0xeef2ff, 3.4, 2.0, 7.0], // Lv 3 tower: white like its windows, so that the owner's light band keeps its colour
];
const haloScale = new Float32Array(lamps.length).fill(1);
// Every frame: artificial light follows the hour, the tokens carry lanterns in their own colour warmed toward amber (the active one burns brighter),
// standing city buildings cast warm wrap-around pools, the lava, flares and lighthouse flicker, and a spot follows the active token.
function lights(t: number) {
  const act = tokens.find((k) => k?.active), k = sky.lampK;
  const flk = 1 + 0.12 * Math.sin(t * 7) * Math.sin(t * 3.1), bcn = 0.92 + 0.08 * Math.sin(t * 2.2); // the flares' flicker and the lighthouse's slow sweep
  for (const l of FIXED) {
    const lamp = lamps[l.slot];
    lamp.intensity = l.tile !== undefined && !lotVisible(l.tile) ? 0 : l.power * k;
    if (l.pulse === 'flare') lamp.intensity *= flk;
    else if (l.pulse === 'beacon') lamp.intensity *= bcn;
    if (l.owned) lamp.intensity *= +lotLit(l.tile!); // an owned lamp is out while its lot is for sale or mortgaged
  }
  const lh = lamps[BEACON.slot];
  BM.value.set(BEACON.at.x, BEACON.at.y, BEACON.at.z, (t * 0.8) % (2 * Math.PI)); // the beam turns 0.8 rad/s about the lantern (a turn in 7.9 s: the angle is kept small, a float is coarse far from zero), and shines with it: none by day, when the lamps are only a hint of their night
  BMC.value.set(lh.color.r, lh.color.g, lh.color.b).multiplyScalar(lh.intensity * BEAM_K * THREE.MathUtils.smoothstep(k, 0.3, 1));
  for (let i = 0; i < 4; i++) {
    const token = tokens[i], l = lamps[i];
    l.intensity = token && lotVisible(token.tile) ? (token.active ? 8 : 3.5) * k : 0;
    if (!token) continue;
    l.position.copy(token.g.position); l.position.y += 2.6; l.position.z += 0.6;
    l.color.set(token.color).lerp(WARM, 0.55); l.distance = 7;
  }
  for (let i = 0; i < cityLamps.length; i++) {
    const c = cityLamps[i], key = lamps[LAMP.city + i * 2], fill = lamps[LAMP.city + i * 2 + 1];
    if (!c || !c.lv || !c.g.visible) { key.intensity = fill.intensity = 0; continue; }
    const [kx, ky, kz, fx, fy, fz, col, kp, fp, reach] = CITY_LIT[c.lv - 1], p = POS[c.tile], y0 = p.y + c.g.position.y + PAD.h;
    key.position.set(p.x + LOT.x + kx, y0 + ky, p.z + LOT.z + kz);
    fill.position.set(p.x + LOT.x + fx, y0 + fy, p.z + LOT.z + fz);
    key.color.setHex(col); fill.color.setHex(col);
    key.intensity = kp * k; fill.intensity = fp * k;
    key.distance = reach; fill.distance = reach * 0.9;
    haloScale[LAMP.city + i * 2] = 0.75; haloScale[LAMP.city + i * 2 + 1] = 0.35; // keep air haze subtle around dense rows of houses
  }
  spot.intensity = act && lotVisible(act.tile) ? 70 * k : 0;
  if (act) {
    spot.position.copy(act.g.position).add(new THREE.Vector3(-3, 11, 4));
    spot.target.position.copy(act.g.position);
    spot.distance = 24;
  }
}

// ---- The passes. The opaque scene (layer 0) is drawn once, in HDR, to a colour and a depth texture; everything after works on those two, at the buffer's full size. It is not multisampled: a multisampled depth resolves to a single
// sample a pixel (not every mobile and Safari WebGL2 driver does that well), and beside a colour averaged from four, an edge pixel can be fogged and blurred as the wrong side of its silhouette, a 1px fringe: SMAA closes the
// edges at the end instead. The passes:
//  1. the normals of what is in view, read off the depth;
//  2. ambient occlusion (GTAO) from the depth and the normals, blurred along depth and normal edges (a separable 9 x 9 bilateral);
//  3. light shafts, marched through the sun's shadow map in the haze, plus a halo round every lamp (not over what stands in front of it), the spot's cone (cut by its own shadow map) and the lighthouse's beam; blurred likewise;
//  4. the composite of the opaque scene: the occlusion and the micro-creases on the lit scene, the sky and the haze by distance (a layer of fog hugging the sea, and the sea itself out to the horizon), the shafts on top;
//  5. the translucent layer (LAYER_FX: smoke, flames, flashes, a beam) over it, against the scene's depth, each fragment fogged by its own distance; where one is seen, its depth joins the scene's;
//  6. depth of field: a tilted plane of focus, a signed circle of confusion, the near field's blur spilled over what is sharp (a tile max), a gather of HDR bokeh, and a 3 x 3 tent over what it blurred, for its grain;
//  7. bloom: a threshold, then a pyramid of four dual-filter blurs;
//  8. the end: bloom added, AgX tone map, vignette, a dither against banding and the sRGB encoding, to an 8-bit target; SMAA 1x on that, to the canvas, along the geometry's edges and not the texels'. ----
type RT = THREE.WebGLRenderTarget;
const VERT = 'varying vec2 v; void main() { v = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
const HEAD = '#include <common>\n#include <packing>\nvarying vec2 v;\n';
const u = <T>(value: T): THREE.IUniform<T> => ({ value });
const fx = (frag: string, uniforms: Record<string, THREE.IUniform>, add = false) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: HEAD + frag, uniforms, depthTest: false, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NoBlending });
const BAYER = /* glsl */`
const int B4[16] = int[16]( 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 );
float bayer( vec2 p ) { ivec2 q = ivec2( mod( p, 4.0 ) ); return ( float( B4[ q.y * 4 + q.x ] ) + 0.5 ) / 16.0; }
`;

// The depth as a view-space position: the ray through a pixel is its ndc, taken off the shift of the lens (its view offset, see scene.ts), over the focal lengths (uQ = 1 / P00, 1 / P11, P20, P21)
const DEPTH = /* glsl */`
uniform vec2 uNF; uniform vec4 uQ;
float vz( float d ) { return perspectiveDepthToViewZ( d, uNF.x, uNF.y ); }
vec3 vpos( vec2 uv, float d ) { float z = vz( d ); return vec3( ( uv * 2.0 - 1.0 + uQ.zw ) * uQ.xy * - z, z ); }
`;

// What the passes share, and the knobs (exported: a tweak from the console shows at once)
const D = u<THREE.Texture | null>(null), NF = u(new THREE.Vector2()), Q = u(new THREE.Vector4()), PX = u(new THREE.Vector2()), IVP = u(new THREE.Matrix4()), VP = u(new THREE.Matrix4()), EYE = u(new THREE.Vector3()); // PX: a pixel of the buffer
// The air (scene.ts), which the translucent layer looks through as well: the fog layer, the way to the light that casts the shadows (the moon by night), and the sun's share of the horizon's glow
const { aFog: FOG, aLit: LIT, aGlow: GLOW } = AIR;
// The sky of the hour (sky.ts): the light's colour times its strength, and the sky's zenith (its horizon is the haze's colour)
const SUNC = u(new THREE.Vector3()), ZEN = u(sky.zenith);
export const K = {
  ao: u(0.9), aoR: u(2.2), // occlusion: how much of it shows, the radius it looks for occluders in (world units)
  crease: u(1), // micro-creases: 1 is up to 15% darker in a concave seam and 8% lighter on a convex edge
  haze: u(0.0025), shaft: u(0.6), // fog density at the sea and the strength of the light shafts
  band: u(0.2), blur: u(7), // tilt-shift: half the thickness of the sharp slab across the plane of focus (as a share of the screen's height) and the widest blur (CSS pixels)
  thr: u(1.15), bloom: u(0.32), // bloom: where it starts, how much is added
  exp: u(0.8), sat: u(1.15), vig: u(0.4), // exposure, saturation, vignette
};

// The normals of what is in view, read off the depth beside each pixel, on each axis the side that is nearer, so as not to straddle an edge
const nrmTex = u<THREE.Texture | null>(null);
const nrmPass = fx(/* glsl */`
uniform sampler2D tD; uniform vec2 uPx;
${DEPTH}
vec3 at( vec2 uv ) { return vpos( uv, texture2D( tD, uv ).x ); }
void main() {
	if ( texture2D( tD, v ).x >= 1.0 ) { gl_FragColor = vec4( 0.5, 0.5, 1.0, 1.0 ); return; }
	vec3 p = at( v ), l = at( v - vec2( uPx.x, 0.0 ) ), r = at( v + vec2( uPx.x, 0.0 ) ), dn = at( v - vec2( 0.0, uPx.y ) ), up = at( v + vec2( 0.0, uPx.y ) );
	vec3 dx = abs( r.z - p.z ) < abs( p.z - l.z ) ? r - p : p - l, dy = abs( up.z - p.z ) < abs( p.z - dn.z ) ? up - p : p - dn;
	gl_FragColor = vec4( normalize( cross( dx, dy ) ) * 0.5 + 0.5, 1.0 );
}`, { tD: D, uPx: PX, uNF: NF, uQ: Q });

// Ambient occlusion (GTAO), at the buffer's full size: six slices through the pixel along the view, each marched eight steps either way for its highest horizon, the whole of it integrated against the normal
const aoF = u(1);
const aoPass = fx(/* glsl */`
uniform sampler2D tD, tN; uniform vec2 uPx; uniform float uR, uF;
${BAYER}
${DEPTH}
vec3 at( vec2 uv ) { return vpos( uv, texture2D( tD, uv ).x ); }
void main() {
	if ( texture2D( tD, v ).x >= 1.0 ) { gl_FragColor = vec4( 1.0 ); return; }
	vec3 p = at( v ), n = normalize( texture2D( tN, v ).xyz * 2.0 - 1.0 ), w = normalize( - p );
	float rad = min( uR * uF / - p.z, 160.0 ), jit = bayer( gl_FragCoord.xy ), vis = 0.0;
	for ( int s = 0; s < 6; s ++ ) {
		float phi = ( float( s ) + jit ) * PI / 6.0;
		vec2 om = vec2( cos( phi ), sin( phi ) );
		vec3 dir = vec3( om, 0.0 ), ax = normalize( cross( dir, w ) ), pn = n - ax * dot( n, ax ), od = dir - w * dot( dir, w );
		float pl = length( pn ), cn = clamp( dot( pn, w ) / max( pl, 1e-4 ), 0.0, 1.0 ), a = sign( dot( od, pn ) ) * acos( cn );
		float lo0 = cos( a + PI_HALF ), lo1 = cos( a - PI_HALF ), c0 = lo0, c1 = lo1;
		for ( int j = 0; j < 8; j ++ ) {
			float t = ( float( j ) + fract( jit * 5.37 + float( s ) * 0.31 ) ) / 8.0;
			vec2 o = om * max( t * t * rad, float( j ) + 1.0 ) * uPx;
			vec3 d0 = at( v + o ) - p, d1 = at( v - o ) - p;
			float l0 = max( length( d0 ), 1e-4 ), l1 = max( length( d1 ), 1e-4 );
			c0 = max( c0, mix( lo0, dot( d0, w ) / l0, clamp( 2.0 - l0 / uR, 0.0, 1.0 ) ) );
			c1 = max( c1, mix( lo1, dot( d1, w ) / l1, clamp( 2.0 - l1 / uR, 0.0, 1.0 ) ) );
		}
		float ha = a + clamp( - acos( clamp( c1, - 1.0, 1.0 ) ) - a, - PI_HALF, PI_HALF ), hb = a + clamp( acos( clamp( c0, - 1.0, 1.0 ) ) - a, - PI_HALF, PI_HALF ), sa = sin( a );
		vis += pl * ( ( cn + 2.0 * ha * sa - cos( 2.0 * ha - a ) ) + ( cn + 2.0 * hb * sa - cos( 2.0 * hb - a ) ) ) * 0.25;
	}
	gl_FragColor = vec4( vec3( clamp( pow( vis / 6.0, 1.5 ), 0.03, 1.0 ) ), 1.0 );
}`, { tD: D, tN: nrmTex, uPx: PX, uNF: NF, uQ: Q, uR: K.aoR, uF: aoF });

// A separable bilateral blur of nine taps (a gaussian, along x and then along y) that does not cross an edge: a tap weighs less the further its depth is from the pixel's (and, for the occlusion, the more its normal turns
// from the pixel's), so it takes the dither of the occlusion and of the shafts out and leaves their edges where the geometry's are
const dir = u(new THREE.Vector2());
const blur = (src: THREE.IUniform, normals: boolean) => fx(/* glsl */`
uniform sampler2D tS, tD, tN; uniform vec2 uDir, uNF;
const float W[ 5 ] = float[ 5 ]( 1.0, 0.882, 0.607, 0.325, 0.135 );
float lz( vec2 uv ) { return - perspectiveDepthToViewZ( texture2D( tD, uv ).x, uNF.x, uNF.y ); }
void main() {
	float z0 = lz( v ), ws = 1.0; vec4 sum = texture2D( tS, v );${normals ? ' vec3 n0 = texture2D( tN, v ).xyz * 2.0 - 1.0;' : ''}
	for ( int i = 1; i < 5; i ++ ) for ( int k = 0; k < 2; k ++ ) {
		vec2 uv = v + uDir * ( k == 0 ? float( i ) : - float( i ) );
		float w = W[ i ] * exp( - abs( lz( uv ) - z0 ) / z0 * 80.0 )${normals ? ' * pow( saturate( dot( texture2D( tN, uv ).xyz * 2.0 - 1.0, n0 ) ), 16.0 )' : ''};
		sum += texture2D( tS, uv ) * w; ws += w;
	}
	gl_FragColor = sum / ws;
}`, { tS: src, tD: D, tN: nrmTex, uDir: dir, uNF: NF });
const aoSrc = u<THREE.Texture | null>(null), volSrc = u<THREE.Texture | null>(null), aoBlur = blur(aoSrc, true), volBlur = blur(volSrc, false);

// The shafts: for each of 64 steps along the view ray through the haze layer (jittered, so the blur can average the steps away), the sunlight that reaches it (the sun's shadow map
// says whether a building is in the way) scatters toward the eye, most of all toward the sun; the spot adds its cone, cut by its own shadow map where a token or a building is in the way, and the lighthouse its beam, two
// cones back to back that turn about it. A lamp's halo is the closed form of its 1/r^2 falloff along the ray, each part of it counted only where the depth buffer shows nothing between the air and the lamp: a lamp behind a wall does not glow over it.
const nLamp = lamps.length;
const L = u(Array.from({ length: nLamp }, () => new THREE.Vector4())), LC = u(Array.from({ length: nLamp }, () => new THREE.Vector3()));
const SP = u(new THREE.Vector4()), SPD = u(new THREE.Vector3()), SPC = u(new THREE.Vector3()), SHM = u(new THREE.Matrix4()), SHT = u<THREE.Texture | null>(null);
const SPM = u(new THREE.Matrix4()), SPSH = u<THREE.Texture | null>(null), SPS = u(new THREE.Vector2()), BM = u(new THREE.Vector4()), BMC = u(new THREE.Vector3()); // the spot's shadow map, its near and far; the beam's origin and bearing, its light
const volPass = fx(/* glsl */`
uniform sampler2D tD, tSh, tSpSh; uniform mat4 uIVP, uVP, uShM, uSpM; uniform vec2 uNF, uPx, uSpS; uniform vec3 uEye, uSun, uSunC, uSpD, uSpC, uBmC, uLC[ ${nLamp} ]; uniform vec4 uFog, uSp, uBm, uL[ ${nLamp} ]; uniform float uK;
${BAYER}
float hg( float c, float g ) { return ( 1.0 - g * g ) / ( 12.566 * pow( 1.0 + g * g - 2.0 * g * c, 1.5 ) ); }
float lz( float d ) { return - perspectiveDepthToViewZ( d, uNF.x, uNF.y ); }
vec3 wp( vec2 q ) { vec4 w = uIVP * vec4( q * 2.0 - 1.0, textureLod( tD, q, 0.0 ).x * 2.0 - 1.0, 1.0 ); return w.xyz / w.w; }
// The way the surface in view at q faces (toward the eye), read off the depth beside it, on each axis the side that is nearer, so as not to straddle an edge
vec3 facing( vec2 q ) {
	vec3 p = wp( q ), l = wp( q - vec2( uPx.x, 0.0 ) ), r = wp( q + vec2( uPx.x, 0.0 ) ), d = wp( q - vec2( 0.0, uPx.y ) ), u = wp( q + vec2( 0.0, uPx.y ) );
	float e = distance( p, uEye );
	return normalize( cross( abs( distance( r, uEye ) - e ) < abs( e - distance( l, uEye ) ) ? r - p : p - l, abs( distance( u, uEye ) - e ) < abs( e - distance( d, uEye ) ) ? u - p : p - d ) );
}
// How much of the straight way from a to b (b is the lamp's end) the depth buffer leaves open: twelve steps along it, each one hidden where it lies behind the surface in view there by a hair or more. How thick that surface is, the buffer does not say:
// a wall is as thick as the air behind it is deep, up to 14 units (a tower, the globe), so a step is hidden from a hair behind it to 11 units and fades out by 14. Where the surface faces away from the way to the lamp, the lamp is behind it and it hides it
// at any depth: a light never shows through what it stands behind.
float seen( vec3 a, vec3 b, float jit ) {
	vec4 ca = uVP * vec4( a, 1.0 ), cb = uVP * vec4( b, 1.0 ); vec3 m = normalize( b - a ); float vis = 1.0;
	for ( int j = 0; j < 12; j ++ ) {
		vec4 c = mix( ca, cb, ( float( j ) + jit ) / 12.0 ); vec2 q = c.xy / c.w * 0.5 + 0.5;
		if ( c.w <= 0.0 || min( q.x, q.y ) < 0.0 || max( q.x, q.y ) > 1.0 ) continue;
		float gap = c.w - lz( textureLod( tD, q, 0.0 ).x ), hid = smoothstep( 0.05, 0.4, gap );
		if ( gap > 11.0 ) hid *= max( 1.0 - smoothstep( 11.0, 14.0, gap ), step( dot( facing( q ), m ), 0.0 ) );
		vis *= 1.0 - hid;
		if ( vis < 0.01 ) break;
	}
	return vis;
}
// The share of the spot's light that gets to p: its shadow map (a perspective one: the depth in it is not linear) says how far from the spot the first thing it lit was
float spotLit( vec3 p ) {
	vec4 c = uSpM * vec4( p, 1.0 ); vec3 q = c.xyz / c.w;
	if ( c.w <= 0.0 || min( q.x, q.y ) < 0.0 || max( q.x, q.y ) > 1.0 || q.z > 1.0 ) return 1.0;
	return step( c.w - 0.25, uSpS.x * uSpS.y / ( uSpS.y - textureLod( tSpSh, q.xy, 0.0 ).x * ( uSpS.y - uSpS.x ) ) );
}
void main() {
	float d = texture2D( tD, v ).x;
	vec4 w = uIVP * vec4( v * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); w.xyz /= w.w;
	vec3 rd = normalize( w.xyz - uEye ), acc = vec3( 0.0 );
	float tm = d >= 1.0 ? 4000.0 : length( w.xyz - uEye ), t0 = 0.0, t1 = tm, jit = bayer( gl_FragCoord.xy );
	if ( abs( rd.y ) > 1e-4 ) { float a = ( uFog.x - uEye.y ) / rd.y, b = ( uFog.y - uEye.y ) / rd.y; t0 = max( t0, min( a, b ) ); t1 = min( t1, max( a, b ) ); }
	if ( t1 > t0 ) {
		float dt = ( t1 - t0 ) / 64.0, ph = 0.08 + 0.9 * hg( dot( rd, uSun ), 0.6 );
		bool spOn = dot( uSpC, vec3( 1.0 ) ) > 0.0, bmOn = dot( uBmC, vec3( 1.0 ) ) > 0.0;
		vec3 bx = vec3( cos( uBm.w ), 0.0, sin( uBm.w ) ); // the beam's axis: level, turning
		for ( int i = 0; i < 64; i ++ ) {
			vec3 p = uEye + rd * ( t0 + ( float( i ) + jit ) * dt );
			float rho = uFog.w * exp( - max( p.y - uFog.x, 0.0 ) * uFog.z ) * dt, lit = 1.0;
			vec4 sc = uShM * vec4( p, 1.0 );
			if ( sc.x >= 0.0 && sc.x <= 1.0 && sc.y >= 0.0 && sc.y <= 1.0 && sc.z <= 1.0 ) lit = step( sc.z - 0.0008, textureLod( tSh, sc.xy, 0.0 ).x );
			acc += uSunC * ( lit * ph * rho * uK );
			if ( spOn ) {
				vec3 sv = p - uSp.xyz; float sl = length( sv ), cone = smoothstep( uSp.w, mix( uSp.w, 1.0, 0.4 ), dot( sv / max( sl, 1e-3 ), uSpD ) );
				if ( cone > 0.0 ) acc += uSpC * ( cone * spotLit( p ) * rho * 30.0 / ( 1.0 + 0.04 * sl * sl ) );
			}
			if ( bmOn ) {
				vec3 bv = p - uBm.xyz; float bl = length( bv ), tight = 1.0 - dot( bv, bx ) * dot( bv, bx ) / max( dot( bv, bv ), 1e-3 ); // tight: 1 - cos^2 of the angle to the axis, either way
				float beam = ( 1.0 - smoothstep( 0.0004, 0.012, tight ) ) * smoothstep( 0.7, 3.0, bl ) * exp( - bl / 30.0 ); // within about 6 degrees of it, soft at the edge, not in the lantern itself, thinning with the distance
				if ( beam > 0.002 ) acc += uBmC * ( beam * seen( p, uBm.xyz + bv / bl, fract( jit * 7.31 + float( i ) * 0.618 ) ) * rho );
			}
		}
	}
	for ( int i = 0; i < ${nLamp}; i ++ ) {
		if ( uL[ i ].w <= 0.0 ) continue;
		vec3 lp = uL[ i ].xyz, o = lp - uEye; float tc = dot( o, rd ), h2 = dot( o, o ) - tc * tc + uL[ i ].w * uL[ i ].w, h = sqrt( h2 ), win = pow( clamp( 1.0 - h2 / 20.25, 0.0, 1.0 ), 2.0 );
		if ( win <= 0.0 ) continue;
		float a0 = atan( - tc / h ), da = atan( ( tm - tc ) / h ) - a0, vis = 0.0;
		for ( int k = 0; k < 4; k ++ ) { // the closed form is the integral of 1 / ( h^2 + s^2 ) ds, which is flat in the angle atan( s / h ): four samples of that, each as bright as the lamp can be seen from there (what hides it stands within 6 units of it, and its own body is not counted)
			vec3 p = uEye + rd * ( tc + h * tan( a0 + ( float( k ) + jit ) * da * 0.25 ) );
			float dp = max( distance( p, lp ), 1e-3 );
			vis += seen( mix( lp, p, min( 1.0, 6.0 / dp ) ), mix( lp, p, min( 1.0, uL[ i ].w / dp ) ), fract( jit * 5.37 ) ) * 0.25;
		}
		acc += uLC[ i ] * ( da / h * win * vis );
	}
	gl_FragColor = vec4( acc, 1.0 );
}`, { tD: D, tSh: SHT, tSpSh: SPSH, uIVP: IVP, uVP: VP, uNF: NF, uPx: PX, uShM: SHM, uSpM: SPM, uSpS: SPS, uEye: EYE, uSun: LIT, uSunC: SUNC, uSpD: SPD, uSpC: SPC, uBm: BM, uBmC: BMC, uLC: LC, uFog: FOG, uSp: SP, uL: L, uK: K.shaft });

// The composite of the opaque scene: occlusion and micro-creases on it, then the air between it and the eye (scene.ts AIR_GLSL: the haze, and the fog layer). The sky is a gradient with the glow of the light (the sun, by night the moon).
// The sea does not end where the lens does: below the horizon, where nothing is drawn, the ray goes on to the plane of the water (SEA_Y), so water far off thins into the haze, and at the horizon it is the haze.
// A micro-crease: the depth round a pixel is a plane on a flat face, so how far the mean of its four neighbours stands off that plane (measured along the normal, in pixels of the screen) is how the surface bends there: toward the eye in a
// concave seam (a wall's foot, the joint of a step, a limb on a body), away from it on a convex edge (an eave, a stair's lip). A neighbour far off in depth is a silhouette, not a crease, and it fades out.
const sceneTex = u<THREE.Texture | null>(null), aoTex = u<THREE.Texture | null>(null), volTex = u<THREE.Texture | null>(null), SEAY = u(SEA_Y);
const compPass = fx(/* glsl */`
uniform sampler2D tC, tD, tA, tV; uniform mat4 uIVP; uniform vec3 uEye, uSunC, uZen; uniform float uAO, uCrease, uSea;
${AIR_GLSL}
${DEPTH}
vec3 sky( vec3 rd ) { return mix( haze( rd ), uZen, pow( saturate( rd.y * 1.6 ), 0.6 ) ) + uSunC * pow( saturate( dot( rd, aLit ) ), 24.0 ) * 0.5; }
float melt( float tm ) { float f = max( tm - 500.0, 0.0 ) / 350.0; return f * f; } // water past 500 units is hazier than the layer makes it, and lost in the haze by 1200, where the lens ends: the sea fades out where it is not a sea any more
vec3 at( vec2 uv ) { return vpos( uv, texture2D( tD, uv ).x ); }
float crease( vec3 p ) {
	vec2 px = 1.0 / vec2( textureSize( tD, 0 ) );
	vec3 l = at( v - vec2( px.x, 0.0 ) ), r = at( v + vec2( px.x, 0.0 ) ), dn = at( v - vec2( 0.0, px.y ) ), up = at( v + vec2( 0.0, px.y ) );
	vec3 dx = abs( r.z - p.z ) < abs( p.z - l.z ) ? r - p : p - l, dy = abs( up.z - p.z ) < abs( p.z - dn.z ) ? up - p : p - dn;
	float c = dot( normalize( cross( dx, dy ) ), 0.25 * ( l + r + dn + up ) - p ) / ( - p.z * uQ.y * 2.0 * px.y ); // in pixels: + where the neighbours stand toward the eye
	return 1.0 - uCrease * ( 0.15 * smoothstep( 0.06, 0.28, c ) - 0.08 * smoothstep( 0.06, 0.28, - c ) ) * ( 1.0 - smoothstep( 0.9, 2.5, abs( c ) ) );
}
void main() {
	float d = texture2D( tD, v ).x;
	vec4 w = uIVP * vec4( v * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); w.xyz /= w.w;
	vec3 rd = normalize( w.xyz - uEye ), c = texture2D( tC, v ).rgb;
	bool wet = d < 1.0 || rd.y < - 1e-4; // the ray ends on the water, drawn or not
	float tm = d < 1.0 ? length( w.xyz - uEye ) : wet ? ( uSea - uEye.y ) / rd.y : 4000.0;
	if ( d >= 1.0 ) c = sky( rd ); else c *= mix( 1.0, texture2D( tA, v ).r, uAO * ( 1.0 - smoothstep( 0.85, 1.8, max( c.r, max( c.g, c.b ) ) ) ) ) * crease( vpos( v, d ) );
	float tr = exp( - tau( uEye, rd, tm ) - ( wet ? melt( tm ) : 0.0 ) );
	gl_FragColor = vec4( c * tr + haze( rd ) * ( 1.0 - tr ) + texture2D( tV, v ).rgb, 1.0 );
}`, { ...AIR, tC: sceneTex, tD: D, tA: aoTex, tV: volTex, uIVP: IVP, uEye: EYE, uSunC: SUNC, uZen: ZEN, uAO: K.ao, uCrease: K.crease, uSea: SEAY, uNF: NF, uQ: Q });

// The translucent layer, drawn over the composite (the overlay target shares its colour, and the scene's depth, which the composite itself must read: a pass cannot read a depth it draws against). Its materials fog each
// fragment by its own distance and write depth where it is seen (see fxOf in scene.ts), so what follows, the focus, sees them where they are. The scene's colour background would clear the target: it is taken off for the draw.
function translucent() {
  const bg = scene.background, auto = scene.matrixWorldAutoUpdate;
  scene.background = null; scene.matrixWorldAutoUpdate = false; // the opaque draw has brought every matrix up to date
  hdCam.layers.set(LAYER_FX); renderer.autoClear = false;
  renderer.setRenderTarget(T!.over); renderer.render(scene, hdCam);
  hdCam.layers.set(0); scene.background = bg; scene.matrixWorldAutoUpdate = auto;
}

// Depth of field. The plane of focus is a Scheimpflug one, upright, through the view target and across the way the camera looks along the ground: the circle of confusion is zero for what stands at the target's horizontal distance
// from the eye, whatever its height (a tower from its foot to its spire, a missile over it), and grows with the distance of a row of the board before it or behind it, the miniature look; it is also no wider than the screen's
// own share (K.band) for the whole board in view, see `zoomed`. Besides, as it ever did, the further from the target along the view (the sea out to the horizon, the sky) the blurrier. The circle is signed: negative before the
// focus, where it is spilled over what is sharp, positive behind. A pixel's own circle is not all that decides its blur: a sharp one beside a blurred near object is covered by it (the tile max of the near circles over 16 x 16, and
// the tile beside it, says how far to look), and one behind a blurred near object sees what is behind it through its blur. The gather is of concentric-disc taps, each weighed by the area its own blur spreads over (so that a sharp token
// is not smeared over the blurred sea behind it, and a bright pixel is not brighter for being small), its brightness held down to 16 so that one sun-bright pixel does not make a firefly, and the rim of a bright tap's disc lifted: the discs
// of an out-of-focus lamp or a window are crisp rings, not grey blots. So few taps (each pixel begins its sequence at a different place) leave a grain a pixel or two wide: the gather says in its alpha how blurred it left a pixel, and
// a 3 x 3 tent over those that are takes the grain out; a sharp pixel is as it was.
const hdrTex = u<THREE.Texture | null>(null), cocTex = u<THREE.Texture | null>(null), tileTex = u<THREE.Texture | null>(null), spreadTex = u<THREE.Texture | null>(null), focusTex = u<THREE.Texture | null>(null);
const dofR = u(1), dofTilt = u(0), FOCUS = u(new THREE.Vector4()); // dofR: the widest blur in buffer pixels (K.blur is in CSS pixels); FOCUS: see uniforms
const cocPass = fx(/* glsl */`
uniform sampler2D tC, tD; uniform vec4 uS; uniform float uR, uBand, uFocus, uTilt;
${DEPTH}
void main() {
	float z = - vz( texture2D( tD, v ).x ), a = ( v.x * 2.0 - 1.0 + uQ.z ) * uQ.x, b = ( v.y * 2.0 - 1.0 + uQ.w ) * uQ.y;
	float s = uS.x + z * ( uS.w + uS.y * a + uS.z * b ); // how far this point is from the plane of focus, along the way the camera looks over the ground, as a share of the screen's height on the ground
	float tilt = uTilt * pow( saturate( ( abs( s ) - uBand ) / ( 0.5 - uBand ) ), 1.5 ), deep = saturate( ( abs( z - uFocus ) / uFocus - 0.14 ) / 0.3 );
	gl_FragColor = vec4( texture2D( tC, v ).rgb, uR * max( tilt, deep ) * sign( tilt >= deep ? s : z - uFocus ) );
}`, { tC: hdrTex, tD: D, uNF: NF, uQ: Q, uS: FOCUS, uR: dofR, uBand: K.band, uFocus: u(LENS), uTilt: dofTilt });
const tilePass = fx(/* glsl */`
uniform sampler2D tC;
void main() {
	ivec2 o = ivec2( gl_FragCoord.xy ) * 16, hi = textureSize( tC, 0 ) - 1; float m = 0.0;
	for ( int j = 0; j < 16; j ++ ) for ( int i = 0; i < 16; i ++ ) m = max( m, - texelFetch( tC, min( o + ivec2( i, j ), hi ), 0 ).a );
	gl_FragColor = vec4( m, 0.0, 0.0, 1.0 );
}`, { tC: cocTex });
const spreadPass = fx(/* glsl */`
uniform sampler2D tT;
void main() {
	ivec2 p = ivec2( gl_FragCoord.xy ), hi = textureSize( tT, 0 ) - 1; float m = 0.0;
	for ( int j = - 1; j <= 1; j ++ ) for ( int i = - 1; i <= 1; i ++ ) m = max( m, texelFetch( tT, clamp( p + ivec2( i, j ), ivec2( 0 ), hi ), 0 ).r );
	gl_FragColor = vec4( m, 0.0, 0.0, 1.0 );
}`, { tT: tileTex });
const gatherPass = fx(/* glsl */`
uniform sampler2D tC, tT; uniform vec2 uPx; uniform float uThr;
const vec3 LW = vec3( 0.2126, 0.7152, 0.0722 );
float ign( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
vec2 disk( vec2 q ) { // Shirley's concentric map: even over the disc, where radius and angle crowd its middle
	vec2 a = 2.0 * q - 1.0;
	if ( a.x == 0.0 && a.y == 0.0 ) return vec2( 0.0 );
	bool wide = abs( a.x ) > abs( a.y );
	float r = wide ? a.x : a.y, th = wide ? 0.7853982 * a.y / a.x : 1.5707963 - 0.7853982 * a.x / a.y;
	return r * vec2( cos( th ), sin( th ) );
}
vec3 held( vec3 c ) { return c * min( 1.0, 16.0 / max( dot( c, LW ), 1e-4 ) ); }
float rim( vec3 c, float r, float a ) { return dot( c, LW ) > uThr ? 1.0 + 0.8 * smoothstep( 0.7, 1.0, r / max( a, 1.0 ) ) : 1.0; } // the lifted edge of a bright tap's disc: r is how far this pixel is from the tap, a the disc's radius
void main() {
	vec4 s0 = texture2D( tC, v ); float c0 = s0.a, a0 = abs( c0 ), mf = texelFetch( tT, ivec2( gl_FragCoord.xy ) / 16, 0 ).r;
	if ( a0 < 0.4 && mf < 0.4 ) { gl_FragColor = vec4( s0.rgb, 0.0 ); return; } // sharp, and no near blur reaches it
	const vec2 G = vec2( 0.7548777, 0.5698403 ); // a sequence that fills a square evenly, begun at a different place for each pixel
	vec2 o = vec2( ign( gl_FragCoord.xy ), ign( gl_FragCoord.yx + 5.588238 ) );
	// what is on or behind the focus, over this pixel's own circle: the taps in front of the focus are the near field's, below
	vec3 bg = vec3( 0.0 ); float bw = 0.0;
	if ( c0 >= 0.0 ) { float w0 = 1.0 / max( a0 * a0, 1.0 ); bg = held( s0.rgb ) * w0; bw = w0; }
	float nb = a0 < 0.4 ? 0.0 : clamp( 8.0 + a0 * 4.0, 16.0, 56.0 );
	for ( int i = 0; i < 56; i ++ ) {
		if ( float( i ) >= nb ) break;
		vec2 d = disk( fract( o + float( i ) * G ) ) * a0; float r = length( d );
		vec4 s = texture2D( tC, v + d * uPx );
		if ( s.a < 0.0 ) continue;
		float cover = clamp( s.a - r + 1.0, 0.0, 1.0 ); // does the tap's own blur reach this pixel
		if ( s.a > c0 ) cover = min( cover, clamp( a0 - r + 1.0, 0.0, 1.0 ) ); // what is behind this pixel is seen through its blur, no wider
		float w = cover * rim( s.rgb, r, s.a ) / max( s.a * s.a, 1.0 );
		bg += held( s.rgb ) * w; bw += w;
	}
	vec3 col = bw > 0.0 ? bg / bw : s0.rgb; float blur = a0;
	// the near field: the taps in front of the focus over the widest near circle round here (a tile max), which cover this pixel with their own, by the area they spread over
	if ( mf >= 0.4 ) {
		float nf = clamp( 8.0 + mf * 4.0, 16.0, 40.0 ), R = mf + 1.0, area = 0.0, fw = 0.0; vec3 fg = vec3( 0.0 );
		for ( int i = 0; i < 40; i ++ ) {
			if ( float( i ) >= nf ) break;
			vec2 d = disk( fract( o.yx + float( i ) * G ) ) * R; float r = length( d );
			vec4 s = texture2D( tC, v + d * uPx ); float a = - s.a;
			if ( a <= 0.0 ) continue;
			float cover = clamp( a - r + 1.0, 0.0, 1.0 ), k = cover * rim( s.rgb, r, a );
			area += cover / max( a * a, 1.0 ); fg += held( s.rgb ) * k; fw += k;
		}
		if ( fw > 0.0 ) { float k = clamp( R * R / nf * area, 0.0, 1.0 ); col = mix( col, fg / fw, k ); blur = max( blur, k * R ); }
	}
	gl_FragColor = vec4( col, blur ); // and how blurred it is, for the pass after
}`, { tC: cocTex, tT: spreadTex, uPx: PX, uThr: K.thr });
const softPass = fx(/* glsl */`
uniform sampler2D tC; uniform vec2 uPx;
void main() {
	vec4 s = texture2D( tC, v ); float k = saturate( s.a - 0.5 ); // how far out of focus: a sharp pixel is as it was
	if ( k <= 0.0 ) { gl_FragColor = vec4( s.rgb, 1.0 ); return; }
	vec3 c = 4.0 * s.rgb; float w = 4.0;
	for ( int j = - 1; j <= 1; j ++ ) for ( int i = - 1; i <= 1; i ++ ) {
		if ( i == 0 && j == 0 ) continue;
		float f = i == 0 || j == 0 ? 2.0 : 1.0;
		c += f * texture2D( tC, v + vec2( i, j ) * uPx ).rgb; w += f;
	}
	gl_FragColor = vec4( mix( s.rgb, c / w, k ), 1.0 );
}`, { tC: hdrTex, uPx: PX });

// Bloom: what is brighter than the threshold (with a soft knee), blurred over four levels, each half the size of the last, and added back up the pyramid
const bSrc = u<THREE.Texture | null>(null), bPx = u(new THREE.Vector2());
const bright = fx(/* glsl */`
uniform sampler2D tS; uniform vec2 uPx; uniform float uThr;
void main() {
	vec3 c = 0.25 * ( texture2D( tS, v + uPx * vec2( - 1.0, - 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( 1.0, - 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( - 1.0, 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( 1.0, 1.0 ) ).rgb );
	float m = max( c.r, max( c.g, c.b ) ), k = clamp( m - uThr + 0.4, 0.0, 0.8 );
	gl_FragColor = vec4( c * ( max( k * k / 1.6, m - uThr ) / max( m, 1e-4 ) ), 1.0 );
}`, { tS: focusTex, uPx: bPx, uThr: K.thr });
const down = fx(/* glsl */`
uniform sampler2D tS; uniform vec2 uPx;
void main() {
	vec3 c = 4.0 * texture2D( tS, v ).rgb + texture2D( tS, v + uPx * vec2( - 1.0, - 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( 1.0, - 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( - 1.0, 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( 1.0, 1.0 ) ).rgb;
	gl_FragColor = vec4( c / 8.0, 1.0 );
}`, { tS: bSrc, uPx: bPx });
const up = fx(/* glsl */`
uniform sampler2D tS; uniform vec2 uPx;
void main() {
	vec2 h = 0.5 * uPx;
	vec3 c = texture2D( tS, v + h * vec2( - 2.0, 0.0 ) ).rgb + texture2D( tS, v + h * vec2( 2.0, 0.0 ) ).rgb + texture2D( tS, v + h * vec2( 0.0, - 2.0 ) ).rgb + texture2D( tS, v + h * vec2( 0.0, 2.0 ) ).rgb
		+ 2.0 * ( texture2D( tS, v + h * vec2( - 1.0, 1.0 ) ).rgb + texture2D( tS, v + h * vec2( 1.0, 1.0 ) ).rgb + texture2D( tS, v + h * vec2( - 1.0, - 1.0 ) ).rgb + texture2D( tS, v + h * vec2( 1.0, - 1.0 ) ).rgb );
	gl_FragColor = vec4( c / 12.0, 1.0 );
}`, { tS: bSrc, uPx: bPx }, true);

// The end of the chain. The tone map is AgX with a Punchy look (a power on the sigmoid's output, and a lift of saturation: that output is in [0, 1] on every channel, so a look cannot take one out of range as it would on linear light):
// it keeps a colour's hue as it brightens, so a neon magenta or cyan or a red-orange fire goes over to a soft saturated bright, where a per-channel curve turns it dead yellow or white. AgX alone lifts the night's darks and flattens
// the day, which K.exp and the world's light were set against: the gain and the power are set so that its darks, its middle grey and its lights stand about where the ACES curve it replaces put them (K.exp keeps its meaning), and the lift
// (PUNCH at K.sat's default, in step with K.sat) fades out toward black (a dark blue sea is not to glow). What the matrices bring out of the sRGB gamut is desaturated toward its luminance until it is in, or scaled down if it is over 1, and
// never clipped a channel at a time. The result is encoded to sRGB here, dithered, into an 8-bit target: SMAA (which wants the picture as it is seen) takes it from there.
const bloomTex = u<THREE.Texture | null>(null), endAsp = u(new THREE.Vector2(1.6, 1)), endMid = u(new THREE.Vector2(0.5, 0.5));
const endPass = fx(/* glsl */`
uniform sampler2D tC, tB; uniform float uExp, uBloom, uVig, uSat; uniform vec2 uMid, uAsp;
#include <tonemapping_pars_fragment>
const vec3 LW = vec3( 0.2126, 0.7152, 0.0722 );
const float GAIN = 3.4, POWER = 2.0, PUNCH = 1.25, RAMP = 0.3; // into the sigmoid, and out of it (Punchy's own are 1 and 1.35); the saturation lift, and the luminance by which it is all there
const mat3 AGX_IN = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ), vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
const mat3 AGX_OUT = mat3( vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ), vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ), vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 ) );
vec3 agx( vec3 c ) {
	c = AGX_IN * ( LINEAR_SRGB_TO_LINEAR_REC2020 * c );
	c = clamp( ( log2( max( c, 1e-10 ) ) + 12.47393 ) / 16.5, 0.0, 1.0 ); // from 10 stops under middle grey to 6.5 over it, to [0, 1]
	c = pow( clamp( agxDefaultContrastApprox( c ), 0.0, 1.0 ), vec3( POWER ) );
	float l = dot( c, LW );
	c = l + mix( 1.0, uSat * ( PUNCH / 1.15 ), smoothstep( 0.0, RAMP, l ) ) * ( c - l );
	c = LINEAR_REC2020_TO_LINEAR_SRGB * pow( max( AGX_OUT * c, 0.0 ), vec3( 2.2 ) );
	l = max( dot( c, LW ), 0.0 );
	float lo = min( c.r, min( c.g, c.b ) );
	if ( lo < 0.0 ) c = l + ( c - l ) * l / ( l - lo );
	return c / max( 1.0, max( c.r, max( c.g, c.b ) ) );
}
vec3 srgb( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 0.4166667 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
	vec3 c = agx( ( texture2D( tC, v ).rgb + texture2D( tB, v ).rgb * uBloom ) * uExp * GAIN );
	c *= 1.0 - uVig * smoothstep( 0.45, 1.15, length( ( v - uMid ) * uAsp ) );
	gl_FragColor = vec4( srgb( c ) + ( fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) - 0.5 ) / 255.0, 1.0 );
}`, { tC: focusTex, tB: bloomTex, uExp: K.exp, uBloom: K.bloom, uVig: K.vig, uSat: K.sat, uMid: endMid, uAsp: endAsp });

// ---- Targets and the frame ----
const mk = (w: number, h: number, o: THREE.RenderTargetOptions = {}) => new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), { type: THREE.HalfFloatType, depthBuffer: false, ...o });
// main: the opaque scene and its depth; hdr: the composite, then the picture as it is focused; over: the translucent layer's target, which is hdr's colour with main's depth; nrm: the normals; ao and vol: the occlusion and the shafts, each a pair to
// blur between; coc and tile: the colour with its circle of confusion, and the near circle's max over 16 x 16 (then a tile wider); aa: the finished picture in 8 bits, for SMAA
let T: { main: RT; hdr: RT; over: RT; nrm: RT; coc: RT; aa: RT; ao: RT[]; vol: RT[]; tile: RT[]; bloom: RT[] } | null = null;
// SMAA 1x, three's: edges, blending weights, neighbourhood blend, and their lookup textures. Its edge pass reads the colour, and takes every boundary of the pixel-art texels for an edge, rounding their corners: here the edges
// are the geometry's instead, found in the depth and the normals (a jump in depth that the plane the pixel lies on does not account for, or a turn of the normal), so a silhouette or a seam is closed and a texel is left as drawn.
const smaa = new SMAAPass(); smaa.renderToScreen = true; smaa.clear = true;
(smaa as unknown as { _materialEdges: THREE.ShaderMaterial })._materialEdges = fx(/* glsl */`
uniform sampler2D tD, tN; uniform vec2 resolution;
${DEPTH}
float lz( vec2 uv ) { float d = texture2D( tD, uv ).x; return d >= 1.0 ? 4000.0 : - vz( d ); }
vec3 nr( vec2 uv ) { return texture2D( tN, uv ).xyz * 2.0 - 1.0; }
void main() {
	float c = lz( v ), l = lz( v - vec2( resolution.x, 0.0 ) ), r = lz( v + vec2( resolution.x, 0.0 ) ), t = lz( v + vec2( 0.0, resolution.y ) ), b = lz( v - vec2( 0.0, resolution.y ) );
	vec3 n = nr( v );
	vec2 e = max( step( 0.003 * c, vec2( abs( l - c ) - abs( r - c ), abs( t - c ) - abs( b - c ) ) ), step( 0.12, 1.0 - vec2( dot( n, nr( v - vec2( resolution.x, 0.0 ) ) ), dot( n, nr( v + vec2( 0.0, resolution.y ) ) ) ) ) );
	if ( e.x + e.y == 0.0 ) discard;
	gl_FragColor = vec4( e, 0.0, 0.0 );
}`, { tD: D, tN: nrmTex, resolution: u(new THREE.Vector2()), uNF: NF, uQ: Q });
export function release() {
  if (T) for (const t of [T.main, T.hdr, T.over, T.nrm, T.coc, T.aa, ...T.ao, ...T.vol, ...T.tile, ...T.bloom]) t.dispose();
  T = null; smaa.setSize(1, 1);
}
export function resize(w: number, h: number) {
  release();
  const main = mk(w, h, { depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) }), hdr = mk(w, h), over = mk(w, h, { depthBuffer: true, depthTexture: main.depthTexture! });
  over.texture = hdr.texture;
  const u8 = { type: THREE.UnsignedByteType }, tw = Math.ceil(w / 16), th = Math.ceil(h / 16);
  T = {
    main, hdr, over, nrm: mk(w, h, u8), coc: mk(w, h), aa: mk(w, h, u8),
    ao: [0, 1].map(() => mk(w, h, { ...u8, format: THREE.RedFormat })), vol: [mk(w, h), mk(w, h)], tile: [mk(tw, th), mk(tw, th)],
    bloom: [2, 4, 8, 16].map((k) => mk(w / k, h / k)),
  };
  for (const t of [main, hdr, over]) renderer.initRenderTarget(t); // over last: it makes the colour's storage anew, and nothing is drawn on it yet
  D.value = main.depthTexture; sceneTex.value = main.texture; nrmTex.value = T.nrm.texture; aoTex.value = T.ao[0].texture; volTex.value = T.vol[0].texture;
  hdrTex.value = hdr.texture; cocTex.value = focusTex.value = T.coc.texture; tileTex.value = T.tile[0].texture; spreadTex.value = T.tile[1].texture; bloomTex.value = T.bloom[0].texture;
  PX.value.set(1 / main.width, 1 / main.height); smaa.setSize(main.width, main.height);
}

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene().add(quad), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quad.frustumCulled = false;
function pass(m: THREE.ShaderMaterial, to: RT | null, keep = false) { // keep: add to what the target holds
  quad.material = m; renderer.autoClear = !keep; renderer.setRenderTarget(to); renderer.render(qScene, qCam);
}
function denoise(m: THREE.ShaderMaterial, src: THREE.IUniform, [a, b]: RT[]) { // a blurred along x into b, b along y into a
  src.value = a.texture; dir.value.set(1 / a.width, 0); pass(m, b);
  src.value = b.texture; dir.value.set(0, 1 / a.height); pass(m, a);
}

const LAMP_SOFT = 0.65, LAMP_K = 0.0038, SPOT_K = 0.0009, BEAM_K = 0.65, SPOT_R = 1; // a lamp's halo: its softening radius (units), a 4.5-unit cutoff, and strength per unit of intensity; the spot's cone; the lighthouse's beam per unit of the lantern's; the spot's size (its shadows' penumbra, see light.ts)
function uniforms() {
  const P = hdCam.projectionMatrix.elements, e = hdCam.matrixWorld.elements, t = controls.target, h = T!.main.height;
  IVP.value.multiplyMatrices(hdCam.matrixWorld, hdCam.projectionMatrixInverse); VP.value.multiplyMatrices(hdCam.projectionMatrix, hdCam.matrixWorldInverse);
  EYE.value.copy(hdCam.position); NF.value.set(hdCam.near, hdCam.far); Q.value.set(1 / P[0], 1 / P[5], P[8], P[9]);
  SUNC.value.set(sky.lightC.r, sky.lightC.g, sky.lightC.b).multiplyScalar(sky.lightK); GLOW.value = sky.glow;
  SPS.value.set(spot.shadow.camera.near, spot.distance || spot.shadow.camera.far); // the far plane of its map is its reach (three's), or the camera's own while it has none
  U.uSp.value.set(SPS.value.x, SPS.value.y, 2 * Math.tan(spot.angle * spot.shadow.focus), SPOT_R);
  aoF.value = 0.5 * h * P[5];
  dofR.value = K.blur.value * renderer.getPixelRatio(); dofTilt.value = zoomed();
  // The plane of focus (see cocPass). f is the way the camera looks along the ground and sinE its tilt (the up axis's share of f); a point at depth D on the ray (a, b) of its pixel is s = s0 + D * ( the right axis's share of f * a + the up
  // axis's * b - the back axis's ) along f from the target, the matrix elements being the camera's axes; the whole is scaled to a share of the screen's height on the ground (it shows 2 LENS / P11 of it at the target, and a unit along f is sinE of it)
  const fl = Math.hypot(e[8], e[10]), fwx = -e[8] / fl, fwz = -e[10] / fl, sinE = e[4] * fwx + e[6] * fwz;
  FOCUS.value.set((hdCam.position.x - t.x) * fwx + (hdCam.position.z - t.z) * fwz, e[0] * fwx + e[2] * fwz, sinE, -(e[8] * fwx + e[10] * fwz)).multiplyScalar((sinE * P[5]) / (2 * LENS));
  FOG.value.w = K.haze.value;
  lamps.forEach((l, i) => {
    L.value[i].set(l.position.x, l.position.y, l.position.z, l.intensity > 0 ? LAMP_SOFT : 0);
    LC.value[i].set(l.color.r, l.color.g, l.color.b).multiplyScalar(l.intensity * LAMP_K * haloScale[i]);
  });
  SP.value.set(spot.position.x, spot.position.y, spot.position.z, Math.cos(spot.angle));
  SPD.value.copy(spot.target.position).sub(spot.position).normalize();
  SPC.value.set(spot.color.r, spot.color.g, spot.color.b).multiplyScalar(spot.intensity * SPOT_K);
  endMid.value.set(free.w / 2, 0.5); endAsp.value.set((T!.main.width * free.w) / h, 1); // the stage is what the column leaves of the canvas: the vignette is round it
}

export function render() {
  if (!T) return;
  const auto = renderer.autoClear;
  lights(performance.now() / 1000);
  uniforms();
  renderer.autoClear = true;
  renderer.setRenderTarget(T.main);
  renderer.render(scene, hdCam);
  SHM.value.copy(sun.shadow.matrix); SHT.value = sun.shadow.map?.depthTexture ?? null; // the shadow maps are drawn by that render, matrices and all: taken before it they would be the last frame's (a token's hop is half a unit a frame)
  SPM.value.copy(spot.shadow.matrix); SPSH.value = spot.shadow.map?.depthTexture ?? null;
  pass(nrmPass, T.nrm);
  pass(aoPass, T.ao[0]); denoise(aoBlur, aoSrc, T.ao);
  pass(volPass, T.vol[0]); denoise(volBlur, volSrc, T.vol);
  pass(compPass, T.hdr);
  translucent();
  pass(cocPass, T.coc); pass(tilePass, T.tile[0]); pass(spreadPass, T.tile[1]);
  pass(gatherPass, T.hdr); // the composite is no longer needed: the focused picture takes its place
  pass(softPass, T.coc); // and, filtered, the colour with its circles is not either
  const b = T.bloom;
  bPx.value.set(1 / T.coc.width, 1 / T.coc.height); pass(bright, b[0]);
  for (let i = 1; i < b.length; i++) { bSrc.value = b[i - 1].texture; bPx.value.set(1 / b[i - 1].width, 1 / b[i - 1].height); pass(down, b[i]); }
  for (let i = b.length - 2; i >= 0; i--) { bSrc.value = b[i + 1].texture; bPx.value.set(1 / b[i + 1].width, 1 / b[i + 1].height); pass(up, b[i], true); }
  pass(endPass, T.aa);
  renderer.autoClear = true; smaa.render(renderer, T.aa, T.aa, 0, false);
  renderer.autoClear = auto;
}
