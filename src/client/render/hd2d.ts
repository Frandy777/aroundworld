import * as THREE from 'three';
import { tokens } from './actors';
import { cityLamps, lotLit, lotVisible } from './board';
import { LOT, PAD, POS } from './layout';
import { fixedLamps } from './lamps';
import { LAMP, U, lamps, spot } from './light';
import { defOf } from './models';
import { free, hdCam, LENS, renderer, scene, sun, zoomed } from './scene';
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

// ---- The passes. The scene is drawn once, in HDR, to a colour and a depth texture; everything after works on those two. It is not multisampled: a multisampled depth resolves to a single sample a pixel (not every mobile
// and Safari WebGL2 driver does that well), and beside a colour averaged from four, an edge pixel can be fogged and blurred as the wrong side of its silhouette, a 1px fringe. The passes:
//  1. ambient occlusion (GTAO) from the depth alone, at half size, blurred along depth edges;
//  2. light shafts at half size, marched through the sun's shadow map in the haze, plus a halo round every lamp (not over what stands in front of it), the spot's cone (cut by its own shadow map) and the lighthouse's beam; blurred likewise;
//  3. the composite: the occlusion on the lit scene, the sky and the haze by distance (a layer of fog hugging the sea, and the sea itself out to the horizon), the shafts on top;
//  4. tilt-shift: a gather blur that grows from a sharp band across the middle of the screen (for a close view), and with the distance from the focus;
//  5. bloom: a threshold, then a pyramid of four dual-filter blurs;
//  6. the end: bloom added, ACES tone map, a little saturation, vignette, a dither against banding, and the sRGB encoding. ----
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

// What the passes share, and the knobs (exported: a tweak from the console shows at once)
const D = u<THREE.Texture | null>(null), NF = u(new THREE.Vector2()), IP = u(new THREE.Matrix4()), IVP = u(new THREE.Matrix4()), VP = u(new THREE.Matrix4()), EYE = u(new THREE.Vector3());
// The sky of the hour (sky.ts): the way to the sun and to the light that casts the shadows (the moon by night), the light's colour times its strength, the sky's own two colours, and the sun's share of the horizon's glow
const SUN = u(sky.sun), LIT = u(sky.light), SUNC = u(new THREE.Vector3()), ZEN = u(sky.zenith), HOR = u(sky.horizon), GLOW = u(1);
export const K = {
  ao: u(0.9), aoR: u(2.2), // occlusion: how much of it shows, the radius it looks for occluders in (world units)
  haze: u(0.0025), shaft: u(0.6), // fog density at the sea and the strength of the light shafts
  band: u(0.2), blur: u(7), // tilt-shift: half the height of the sharp band (of the screen) and the widest blur (CSS pixels)
  thr: u(1.15), bloom: u(0.32), // bloom: where it starts, how much is added
  exp: u(0.8), sat: u(1.15), vig: u(0.4), // exposure, saturation, vignette
};

const aoPx = u(new THREE.Vector2()), aoF = u(1);
const aoPass = fx(/* glsl */`
uniform sampler2D tD; uniform mat4 uIP; uniform vec2 uPx; uniform float uR, uF;
${BAYER}
vec3 vp( vec2 uv ) { vec4 p = uIP * vec4( uv * 2.0 - 1.0, texture2D( tD, uv ).x * 2.0 - 1.0, 1.0 ); return p.xyz / p.w; }
void main() {
	if ( texture2D( tD, v ).x >= 1.0 ) { gl_FragColor = vec4( 1.0 ); return; }
	vec3 p = vp( v ), l = vp( v - vec2( uPx.x, 0.0 ) ), r = vp( v + vec2( uPx.x, 0.0 ) ), dn = vp( v - vec2( 0.0, uPx.y ) ), up = vp( v + vec2( 0.0, uPx.y ) );
	vec3 dx = abs( r.z - p.z ) < abs( p.z - l.z ) ? r - p : p - l, dy = abs( up.z - p.z ) < abs( p.z - dn.z ) ? up - p : p - dn;
	vec3 n = normalize( cross( dx, dy ) ), w = normalize( - p );
	float rad = min( uR * uF / - p.z, 80.0 ), jit = bayer( gl_FragCoord.xy ), vis = 0.0;
	for ( int s = 0; s < 3; s ++ ) {
		float phi = ( float( s ) + jit ) * PI / 3.0;
		vec2 om = vec2( cos( phi ), sin( phi ) );
		vec3 dir = vec3( om, 0.0 ), ax = normalize( cross( dir, w ) ), pn = n - ax * dot( n, ax ), od = dir - w * dot( dir, w );
		float pl = length( pn ), cn = clamp( dot( pn, w ) / max( pl, 1e-4 ), 0.0, 1.0 ), a = sign( dot( od, pn ) ) * acos( cn );
		float lo0 = cos( a + PI_HALF ), lo1 = cos( a - PI_HALF ), c0 = lo0, c1 = lo1;
		for ( int j = 0; j < 6; j ++ ) {
			float t = ( float( j ) + fract( jit * 5.37 + float( s ) * 0.31 ) ) / 6.0;
			vec2 o = om * max( t * t * rad, float( j ) + 1.0 ) * uPx;
			vec3 d0 = vp( v + o ) - p, d1 = vp( v - o ) - p;
			float l0 = max( length( d0 ), 1e-4 ), l1 = max( length( d1 ), 1e-4 );
			c0 = max( c0, mix( lo0, dot( d0, w ) / l0, clamp( 2.0 - l0 / uR, 0.0, 1.0 ) ) );
			c1 = max( c1, mix( lo1, dot( d1, w ) / l1, clamp( 2.0 - l1 / uR, 0.0, 1.0 ) ) );
		}
		float ha = a + clamp( - acos( clamp( c1, - 1.0, 1.0 ) ) - a, - PI_HALF, PI_HALF ), hb = a + clamp( acos( clamp( c0, - 1.0, 1.0 ) ) - a, - PI_HALF, PI_HALF ), sa = sin( a );
		vis += pl * ( ( cn + 2.0 * ha * sa - cos( 2.0 * ha - a ) ) + ( cn + 2.0 * hb * sa - cos( 2.0 * hb - a ) ) ) * 0.25;
	}
	gl_FragColor = vec4( vec3( clamp( pow( vis / 3.0, 1.5 ), 0.03, 1.0 ) ), 1.0 );
}`, { tD: D, uIP: IP, uPx: aoPx, uR: K.aoR, uF: aoF });

// A 4 x 4 blur that does not cross a depth edge: it takes the dither of the occlusion and of the shafts out
const hPx = u(new THREE.Vector2());
const blur = (src: THREE.IUniform) => fx(/* glsl */`
uniform sampler2D tS, tD; uniform vec2 uPx, uNF;
float lz( vec2 uv ) { return - perspectiveDepthToViewZ( texture2D( tD, uv ).x, uNF.x, uNF.y ); }
void main() {
	float z0 = lz( v ), ws = 0.0; vec4 sum = vec4( 0.0 );
	for ( int j = 0; j < 4; j ++ ) for ( int i = 0; i < 4; i ++ ) {
		vec2 uv = v + ( vec2( float( i ), float( j ) ) - 1.5 ) * uPx;
		float w = exp( - abs( lz( uv ) - z0 ) / z0 * 80.0 );
		sum += texture2D( tS, uv ) * w; ws += w;
	}
	gl_FragColor = sum / max( ws, 1e-4 );
}`, { tS: src, tD: D, uPx: hPx, uNF: NF });
const aoSrc = u<THREE.Texture | null>(null), volSrc = u<THREE.Texture | null>(null), aoBlur = blur(aoSrc), volBlur = blur(volSrc);

// The shafts: for each of 64 steps along the view ray through the haze layer (jittered, so the blur can average the steps away), the sunlight that reaches it (the sun's shadow map
// says whether a building is in the way) scatters toward the eye, most of all toward the sun; the spot adds its cone, cut by its own shadow map where a token or a building is in the way, and the lighthouse its beam, two
// cones back to back that turn about it. A lamp's halo is the closed form of its 1/r^2 falloff along the ray, each part of it counted only where the depth buffer shows nothing between the air and the lamp: a lamp behind a wall does not glow over it.
const nLamp = lamps.length;
const L = u(Array.from({ length: nLamp }, () => new THREE.Vector4())), LC = u(Array.from({ length: nLamp }, () => new THREE.Vector3()));
const SP = u(new THREE.Vector4()), SPD = u(new THREE.Vector3()), SPC = u(new THREE.Vector3()), SHM = u(new THREE.Matrix4()), SHT = u<THREE.Texture | null>(null);
const SPM = u(new THREE.Matrix4()), SPSH = u<THREE.Texture | null>(null), SPS = u(new THREE.Vector2()), BM = u(new THREE.Vector4()), BMC = u(new THREE.Vector3()), vPx = u(new THREE.Vector2()); // the spot's shadow map, its near and far; the beam's origin and bearing, its light; a pixel of the buffer
const FOG = u(new THREE.Vector4(-1.2, 40, 0.07, 0.005)); // the layer: its floor and ceiling, how fast it thins with height, its density at the floor
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
	gl_FragColor = vec4( acc, tm ); // the distance goes with it, for the composite to tell what each texel belongs to
}`, { tD: D, tSh: SHT, tSpSh: SPSH, uIVP: IVP, uVP: VP, uNF: NF, uPx: vPx, uShM: SHM, uSpM: SPM, uSpS: SPS, uEye: EYE, uSun: LIT, uSunC: SUNC, uSpD: SPD, uSpC: SPC, uBm: BM, uBmC: BMC, uLC: LC, uFog: FOG, uSp: SP, uL: L, uK: K.shaft });

// The composite: occlusion on the scene, then the air between it and the eye. The sky is a gradient with the glow of the light (the sun, by night the moon); the haze is the sky's own horizon colour,
// thickest at grazing angles and brighter on the side of the sun, which goes on under the horizon at dusk, and by night on the side of the moon (`sky.glow` is the share of the sun's).
// The sea does not end where the lens does: below the horizon, where nothing is drawn, the ray goes on to the plane of the water (SEA_Y), so water far off thins into the haze, and at the horizon it is the haze.
const sceneTex = u<THREE.Texture | null>(null), aoTex = u<THREE.Texture | null>(null), volTex = u<THREE.Texture | null>(null), SEAY = u(SEA_Y);
const compPass = fx(/* glsl */`
uniform sampler2D tC, tD, tA, tV; uniform mat4 uIVP; uniform vec3 uEye, uSun, uLit, uSunC, uHor, uZen; uniform vec4 uFog; uniform float uAO, uGlow, uSea;
// The shafts are made at half size: at full size, of the four texels round the pixel the ones on its own surface (their alpha is their distance) weigh the most, so a shaft or a halo does not spill over an edge
vec3 vol( float tm ) {
	vec2 sz = vec2( textureSize( tV, 0 ) ), f = v * sz - 0.5, i = floor( f ), fr = f - i; vec4 sum = vec4( 0.0 );
	for ( int k = 0; k < 4; k ++ ) {
		vec2 o = vec2( float( k & 1 ), float( k >> 1 ) ); vec4 s = texture2D( tV, ( i + o + 0.5 ) / sz );
		sum += vec4( s.rgb, 1.0 ) * ( ( o.x > 0.5 ? fr.x : 1.0 - fr.x ) * ( o.y > 0.5 ? fr.y : 1.0 - fr.y ) * ( exp( - abs( s.a - tm ) / tm * 80.0 ) + 0.002 ) );
	}
	return sum.rgb / sum.a;
}
float lobe( vec2 h, vec3 d ) { return pow( saturate( dot( h, normalize( d.xz ) ) ), 4.0 ); }
vec3 haze( vec3 rd ) { vec2 h = normalize( rd.xz ); return uHor * ( 0.85 + 0.3 * mix( lobe( h, uLit ), lobe( h, uSun ), uGlow ) ); }
vec3 sky( vec3 rd ) { return mix( haze( rd ), uZen, pow( saturate( rd.y * 1.6 ), 0.6 ) ) + uSunC * pow( saturate( dot( rd, uLit ) ), 24.0 ) * 0.5; }
float tau( vec3 ro, vec3 rd, float tm ) { // the optical depth of the layer along the ray: its density falls off as exp( - k h ), integrated in closed form
	float k = uFog.z, y0 = uFog.x, ye = ro.y + rd.y * tm;
	return uFog.w * abs( exp( - k * max( ro.y - y0, 0.0 ) ) - exp( - k * max( ye - y0, 0.0 ) ) ) / ( k * max( abs( rd.y ), 1e-3 ) );
}
float melt( float tm ) { float f = max( tm - 500.0, 0.0 ) / 350.0; return f * f; } // water past 500 units is hazier than the layer makes it, and lost in the haze by 1200, where the lens ends: the sea fades out where it is not a sea any more
void main() {
	float d = texture2D( tD, v ).x;
	vec4 w = uIVP * vec4( v * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); w.xyz /= w.w;
	vec3 rd = normalize( w.xyz - uEye ), c = texture2D( tC, v ).rgb;
	bool wet = d < 1.0 || rd.y < - 1e-4; // the ray ends on the water, drawn or not
	float tm = d < 1.0 ? length( w.xyz - uEye ) : wet ? ( uSea - uEye.y ) / rd.y : 4000.0, tv = d < 1.0 ? tm : 4000.0; // tv: the distance the shafts were made to
	if ( d >= 1.0 ) c = sky( rd ); else c *= mix( 1.0, texture2D( tA, v ).r, uAO * ( 1.0 - smoothstep( 0.85, 1.8, max( c.r, max( c.g, c.b ) ) ) ) );
	float tr = exp( - tau( uEye, rd, tm ) - ( wet ? melt( tm ) : 0.0 ) );
	gl_FragColor = vec4( c * tr + haze( rd ) * ( 1.0 - tr ) + vol( tv ), 1.0 );
}`, { tC: sceneTex, tD: D, tA: aoTex, tV: volTex, uIVP: IVP, uEye: EYE, uSun: SUN, uLit: LIT, uSunC: SUNC, uHor: HOR, uZen: ZEN, uFog: FOG, uAO: K.ao, uGlow: GLOW, uSea: SEAY });

// Tilt-shift: the circle of confusion is none in a band across the middle of the screen and grows toward its top and bottom (the miniature look, for a close view: with the whole board in it, whose
// outer rows are there, it is all in focus, see `zoomed`), and with the distance from the focus
// (the board's depth at the target is the focus: the sea out to the horizon and the sky blur). A gather of 24 golden-angle taps, each weighed by whether its own blur reaches the pixel, so a sharp
// token is not smeared over the blurred sea behind it, and by 1 / (1 + luminance) so one bright pixel does not make a firefly.
const compTex = u<THREE.Texture | null>(null), dofPx = u(new THREE.Vector2()), dofR = u(1), dofTilt = u(0); // dofR: the widest blur in buffer pixels (K.blur is in CSS pixels)
const dofPass = fx(/* glsl */`
uniform sampler2D tC, tD; uniform vec2 uPx, uNF; uniform float uR, uBand, uFocus, uTilt;
float coc( vec2 uv ) {
	float z = - perspectiveDepthToViewZ( texture2D( tD, uv ).x, uNF.x, uNF.y );
	float tilt = uTilt * pow( saturate( ( abs( uv.y - 0.5 ) - uBand ) / ( 0.5 - uBand ) ), 1.5 ), deep = saturate( ( abs( z - uFocus ) / uFocus - 0.14 ) / 0.3 );
	return uR * max( tilt, deep );
}
void main() {
	vec3 c0 = texture2D( tC, v ).rgb;
	float r0 = coc( v );
	if ( r0 < 0.4 ) { gl_FragColor = vec4( c0, 1.0 ); return; }
	float rot = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) * 6.2831853, ws = 0.0;
	vec3 sum = vec3( 0.0 );
	for ( int i = 0; i < 24; i ++ ) {
		float a = float( i ) * 2.39996323 + rot, r = sqrt( ( float( i ) + 0.5 ) / 24.0 ) * r0;
		vec2 uv = v + vec2( cos( a ), sin( a ) ) * r * uPx;
		vec3 s = texture2D( tC, uv ).rgb;
		float w = clamp( coc( uv ) - r + 1.0, 0.0, 1.0 ) / ( 1.0 + dot( s, vec3( 0.2126, 0.7152, 0.0722 ) ) );
		sum += s * w; ws += w;
	}
	gl_FragColor = vec4( mix( c0, sum / max( ws, 1e-4 ), smoothstep( 0.0, 1.0, r0 ) ), 1.0 );
}`, { tC: compTex, tD: D, uPx: dofPx, uNF: NF, uR: dofR, uBand: K.band, uFocus: u(LENS), uTilt: dofTilt });

// Bloom: what is brighter than the threshold (with a soft knee), blurred over four levels, each half the size of the last, and added back up the pyramid
const dofTex = u<THREE.Texture | null>(null), bSrc = u<THREE.Texture | null>(null), bPx = u(new THREE.Vector2());
const bright = fx(/* glsl */`
uniform sampler2D tS; uniform vec2 uPx; uniform float uThr;
void main() {
	vec3 c = 0.25 * ( texture2D( tS, v + uPx * vec2( - 1.0, - 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( 1.0, - 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( - 1.0, 1.0 ) ).rgb + texture2D( tS, v + uPx * vec2( 1.0, 1.0 ) ).rgb );
	float m = max( c.r, max( c.g, c.b ) ), k = clamp( m - uThr + 0.4, 0.0, 0.8 );
	gl_FragColor = vec4( c * ( max( k * k / 1.6, m - uThr ) / max( m, 1e-4 ) ), 1.0 );
}`, { tS: dofTex, uPx: bPx, uThr: K.thr });
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

// The end of the chain, to the canvas
const bloomTex = u<THREE.Texture | null>(null), endAsp = u(new THREE.Vector2(1.6, 1)), endMid = u(new THREE.Vector2(0.5, 0.5));
const endPass = fx(/* glsl */`
uniform sampler2D tC, tB; uniform float uExp, uBloom, uVig, uSat; uniform vec2 uMid, uAsp;
vec3 aces( vec3 x ) { return clamp( ( x * ( 2.51 * x + 0.03 ) ) / ( x * ( 2.43 * x + 0.59 ) + 0.14 ), 0.0, 1.0 ); }
void main() {
	vec3 c = aces( ( texture2D( tC, v ).rgb + texture2D( tB, v ).rgb * uBloom ) * uExp );
	c = mix( vec3( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) ), c, uSat );
	c *= 1.0 - uVig * smoothstep( 0.45, 1.15, length( ( v - uMid ) * uAsp ) );
	c += ( fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) - 0.5 ) / 255.0;
	gl_FragColor = vec4( c, 1.0 );
	#include <colorspace_fragment>
}`, { tC: dofTex, tB: bloomTex, uExp: K.exp, uBloom: K.bloom, uVig: K.vig, uSat: K.sat, uMid: endMid, uAsp: endAsp });

// ---- Targets and the frame ----
const mk = (w: number, h: number, o: THREE.RenderTargetOptions = {}) => new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), { type: THREE.HalfFloatType, depthBuffer: false, ...o });
let T: { main: RT; hdr: RT; dof: RT; ao: RT[]; vol: RT[]; bloom: RT[] } | null = null;
export function release() { if (T) for (const t of [T.main, T.hdr, T.dof, ...T.ao, ...T.vol, ...T.bloom]) t.dispose(); T = null; }
export function resize(w: number, h: number) {
  release();
  const main = mk(w, h, { depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) });
  T = {
    main, hdr: mk(w, h), dof: mk(w, h),
    ao: [mk(w / 2, h / 2, { type: THREE.UnsignedByteType }), mk(w / 2, h / 2, { type: THREE.UnsignedByteType })], vol: [mk(w / 2, h / 2), mk(w / 2, h / 2)],
    bloom: [2, 4, 8, 16].map((k) => mk(w / k, h / k)),
  };
  D.value = main.depthTexture; sceneTex.value = main.texture;
  aoPx.value.set(2 / w, 2 / h); hPx.value.set(2 / w, 2 / h); dofPx.value.set(1 / w, 1 / h); vPx.value.set(1 / w, 1 / h);
  endAsp.value.set(w / h, 1);
}

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene().add(quad), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quad.frustumCulled = false;
function pass(m: THREE.ShaderMaterial, to: RT | null, keep = false) { // keep: add to what the target holds
  quad.material = m; renderer.autoClear = !keep; renderer.setRenderTarget(to); renderer.render(qScene, qCam);
}

const LAMP_SOFT = 0.65, LAMP_K = 0.0038, SPOT_K = 0.0009, BEAM_K = 0.65, SPOT_R = 1; // a lamp's halo: its softening radius (units), a 4.5-unit cutoff, and strength per unit of intensity; the spot's cone; the lighthouse's beam per unit of the lantern's; the spot's size (its shadows' penumbra, see light.ts)
function uniforms() {
  IP.value.copy(hdCam.projectionMatrixInverse); IVP.value.multiplyMatrices(hdCam.matrixWorld, hdCam.projectionMatrixInverse); VP.value.multiplyMatrices(hdCam.projectionMatrix, hdCam.matrixWorldInverse);
  EYE.value.copy(hdCam.position); NF.value.set(hdCam.near, hdCam.far);
  SUNC.value.set(sky.lightC.r, sky.lightC.g, sky.lightC.b).multiplyScalar(sky.lightK); GLOW.value = sky.glow;
  SPS.value.set(spot.shadow.camera.near, spot.distance || spot.shadow.camera.far); // the far plane of its map is its reach (three's), or the camera's own while it has none
  U.uSp.value.set(SPS.value.x, SPS.value.y, 2 * Math.tan(spot.angle * spot.shadow.focus), SPOT_R);
  aoF.value = 0.5 * T!.ao[0].height * hdCam.projectionMatrix.elements[5];
  dofR.value = K.blur.value * renderer.getPixelRatio(); dofTilt.value = zoomed();
  FOG.value.w = K.haze.value;
  lamps.forEach((l, i) => {
    L.value[i].set(l.position.x, l.position.y, l.position.z, l.intensity > 0 ? LAMP_SOFT : 0);
    LC.value[i].set(l.color.r, l.color.g, l.color.b).multiplyScalar(l.intensity * LAMP_K * haloScale[i]);
  });
  SP.value.set(spot.position.x, spot.position.y, spot.position.z, Math.cos(spot.angle));
  SPD.value.copy(spot.target.position).sub(spot.position).normalize();
  SPC.value.set(spot.color.r, spot.color.g, spot.color.b).multiplyScalar(spot.intensity * SPOT_K);
  endMid.value.set(free.w / 2, 0.5);
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
  pass(aoPass, T.ao[0]); aoSrc.value = T.ao[0].texture; pass(aoBlur, T.ao[1]); aoTex.value = T.ao[1].texture;
  pass(volPass, T.vol[0]); volSrc.value = T.vol[0].texture; pass(volBlur, T.vol[1]); volTex.value = T.vol[1].texture;
  pass(compPass, T.hdr); compTex.value = T.hdr.texture;
  pass(dofPass, T.dof); dofTex.value = T.dof.texture;
  const b = T.bloom;
  bPx.value.set(1 / T.dof.width, 1 / T.dof.height); pass(bright, b[0]);
  for (let i = 1; i < b.length; i++) { bSrc.value = b[i - 1].texture; bPx.value.set(1 / b[i - 1].width, 1 / b[i - 1].height); pass(down, b[i]); }
  for (let i = b.length - 2; i >= 0; i--) { bSrc.value = b[i + 1].texture; bPx.value.set(1 / b[i + 1].width, 1 / b[i + 1].height); pass(up, b[i], true); }
  bloomTex.value = b[0].texture;
  pass(endPass, null);
  renderer.autoClear = auto;
}
