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

const FIXED = fixedLamps(defOf).map((l, slot) => ({ ...l, slot: LAMP.fixed + slot }));
if (FIXED.length > LAMP.city - LAMP.fixed) throw new Error(`fixed lamps overflow the ${LAMP.city - LAMP.fixed} free slots (${FIXED.length} declared)`);
for (const l of FIXED) { const lamp = lamps[l.slot]; lamp.position.copy(l.at); lamp.color.setHex(l.color); lamp.distance = l.reach; }
const BEACON = FIXED.find((l) => l.pulse === 'beacon')!;

const WARM = new THREE.Color(0xffd9a0);
const CITY_LIT: [number, number, number, number, number, number, number, number, number, number][] = [
  [0.2, 0.7, 1.52, -1.45, 0.75, -0.3, 0xffab42, 3.2, 1.8, 5.8],
  [0.22, 0.88, 1.55, -1.48, 0.95, -0.3, 0xffb44c, 1.8, 1.0, 6.2],
  [0.15, 1.18, 1.52, -1.48, 1.3, -0.35, 0xeef2ff, 3.4, 2.0, 7.0],
];
const haloScale = new Float32Array(lamps.length).fill(1);
function lights(t: number) {
  const act = tokens.find((k) => k?.active), k = sky.lampK;
  const flk = 1 + 0.12 * Math.sin(t * 7) * Math.sin(t * 3.1), bcn = 0.92 + 0.08 * Math.sin(t * 2.2);
  for (const l of FIXED) {
    const lamp = lamps[l.slot];
    lamp.intensity = l.tile !== undefined && !lotVisible(l.tile) ? 0 : l.power * k;
    if (l.pulse === 'flare') lamp.intensity *= flk;
    else if (l.pulse === 'beacon') lamp.intensity *= bcn;
    if (l.owned) lamp.intensity *= +lotLit(l.tile!);
  }
  const lh = lamps[BEACON.slot];
  BM.value.set(BEACON.at.x, BEACON.at.y, BEACON.at.z, (t * 0.8) % (2 * Math.PI));
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
    haloScale[LAMP.city + i * 2] = 0.75; haloScale[LAMP.city + i * 2 + 1] = 0.35;
  }
  spot.intensity = act && lotVisible(act.tile) ? 70 * k : 0;
  if (act) {
    spot.position.copy(act.g.position).add(new THREE.Vector3(-3, 11, 4));
    spot.target.position.copy(act.g.position);
    spot.distance = 24;
  }
}

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

const DEPTH = /* glsl */`
uniform vec2 uNF; uniform vec4 uQ;
float vz( float d ) { return perspectiveDepthToViewZ( d, uNF.x, uNF.y ); }
vec3 vpos( vec2 uv, float d ) { float z = vz( d ); return vec3( ( uv * 2.0 - 1.0 + uQ.zw ) * uQ.xy * - z, z ); }
`;

const D = u<THREE.Texture | null>(null), NF = u(new THREE.Vector2()), Q = u(new THREE.Vector4()), PX = u(new THREE.Vector2()), IVP = u(new THREE.Matrix4()), VP = u(new THREE.Matrix4()), EYE = u(new THREE.Vector3());
const { aFog: FOG, aLit: LIT, aGlow: GLOW } = AIR;
const SUNC = u(new THREE.Vector3()), ZEN = u(sky.zenith);
export const K = {
  ao: u(0.9), aoR: u(2.2),
  crease: u(1),
  haze: u(0.0025), shaft: u(0.6),
  band: u(0.2), blur: u(7),
  thr: u(1.15), bloom: u(0.32),
  exp: u(0.8), sat: u(1.15), vig: u(0.4),
};

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

const nLamp = lamps.length;
const L = u(Array.from({ length: nLamp }, () => new THREE.Vector4())), LC = u(Array.from({ length: nLamp }, () => new THREE.Vector3()));
const SP = u(new THREE.Vector4()), SPD = u(new THREE.Vector3()), SPC = u(new THREE.Vector3()), SHM = u(new THREE.Matrix4()), SHT = u<THREE.Texture | null>(null);
const SPM = u(new THREE.Matrix4()), SPSH = u<THREE.Texture | null>(null), SPS = u(new THREE.Vector2()), BM = u(new THREE.Vector4()), BMC = u(new THREE.Vector3());
const volPass = fx(/* glsl */`
uniform sampler2D tD, tSh, tSpSh; uniform mat4 uIVP, uVP, uShM, uSpM; uniform vec2 uNF, uPx, uSpS; uniform vec3 uEye, uSun, uSunC, uSpD, uSpC, uBmC, uLC[ ${nLamp} ]; uniform vec4 uFog, uSp, uBm, uL[ ${nLamp} ]; uniform float uK;
${BAYER}
float hg( float c, float g ) { return ( 1.0 - g * g ) / ( 12.566 * pow( 1.0 + g * g - 2.0 * g * c, 1.5 ) ); }
float lz( float d ) { return - perspectiveDepthToViewZ( d, uNF.x, uNF.y ); }
vec3 wp( vec2 q ) { vec4 w = uIVP * vec4( q * 2.0 - 1.0, textureLod( tD, q, 0.0 ).x * 2.0 - 1.0, 1.0 ); return w.xyz / w.w; }
vec3 facing( vec2 q ) {
	vec3 p = wp( q ), l = wp( q - vec2( uPx.x, 0.0 ) ), r = wp( q + vec2( uPx.x, 0.0 ) ), d = wp( q - vec2( 0.0, uPx.y ) ), u = wp( q + vec2( 0.0, uPx.y ) );
	float e = distance( p, uEye );
	return normalize( cross( abs( distance( r, uEye ) - e ) < abs( e - distance( l, uEye ) ) ? r - p : p - l, abs( distance( u, uEye ) - e ) < abs( e - distance( d, uEye ) ) ? u - p : p - d ) );
}
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
		vec3 bx = vec3( cos( uBm.w ), 0.0, sin( uBm.w ) );
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
				vec3 bv = p - uBm.xyz; float bl = length( bv ), tight = 1.0 - dot( bv, bx ) * dot( bv, bx ) / max( dot( bv, bv ), 1e-3 );
				float beam = ( 1.0 - smoothstep( 0.0004, 0.012, tight ) ) * smoothstep( 0.7, 3.0, bl ) * exp( - bl / 30.0 );
				if ( beam > 0.002 ) acc += uBmC * ( beam * seen( p, uBm.xyz + bv / bl, fract( jit * 7.31 + float( i ) * 0.618 ) ) * rho );
			}
		}
	}
	for ( int i = 0; i < ${nLamp}; i ++ ) {
		if ( uL[ i ].w <= 0.0 ) continue;
		vec3 lp = uL[ i ].xyz, o = lp - uEye; float tc = dot( o, rd ), h2 = dot( o, o ) - tc * tc + uL[ i ].w * uL[ i ].w, h = sqrt( h2 ), win = pow( clamp( 1.0 - h2 / 20.25, 0.0, 1.0 ), 2.0 );
		if ( win <= 0.0 ) continue;
		float a0 = atan( - tc / h ), da = atan( ( tm - tc ) / h ) - a0, vis = 0.0;
		for ( int k = 0; k < 4; k ++ ) {
			vec3 p = uEye + rd * ( tc + h * tan( a0 + ( float( k ) + jit ) * da * 0.25 ) );
			float dp = max( distance( p, lp ), 1e-3 );
			vis += seen( mix( lp, p, min( 1.0, 6.0 / dp ) ), mix( lp, p, min( 1.0, uL[ i ].w / dp ) ), fract( jit * 5.37 ) ) * 0.25;
		}
		acc += uLC[ i ] * ( da / h * win * vis );
	}
	gl_FragColor = vec4( acc, 1.0 );
}`, { tD: D, tSh: SHT, tSpSh: SPSH, uIVP: IVP, uVP: VP, uNF: NF, uPx: PX, uShM: SHM, uSpM: SPM, uSpS: SPS, uEye: EYE, uSun: LIT, uSunC: SUNC, uSpD: SPD, uSpC: SPC, uBm: BM, uBmC: BMC, uLC: LC, uFog: FOG, uSp: SP, uL: L, uK: K.shaft });

const sceneTex = u<THREE.Texture | null>(null), aoTex = u<THREE.Texture | null>(null), volTex = u<THREE.Texture | null>(null), SEAY = u(SEA_Y);
const compPass = fx(/* glsl */`
uniform sampler2D tC, tD, tA, tV; uniform mat4 uIVP; uniform vec3 uEye, uSunC, uZen; uniform float uAO, uCrease, uSea;
${AIR_GLSL}
${DEPTH}
vec3 sky( vec3 rd ) { return mix( haze( rd ), uZen, pow( saturate( rd.y * 1.6 ), 0.6 ) ) + uSunC * pow( saturate( dot( rd, aLit ) ), 24.0 ) * 0.5; }
float melt( float tm ) { float f = max( tm - 500.0, 0.0 ) / 350.0; return f * f; }
vec3 at( vec2 uv ) { return vpos( uv, texture2D( tD, uv ).x ); }
float crease( vec3 p ) {
	vec2 px = 1.0 / vec2( textureSize( tD, 0 ) );
	vec3 l = at( v - vec2( px.x, 0.0 ) ), r = at( v + vec2( px.x, 0.0 ) ), dn = at( v - vec2( 0.0, px.y ) ), up = at( v + vec2( 0.0, px.y ) );
	vec3 dx = abs( r.z - p.z ) < abs( p.z - l.z ) ? r - p : p - l, dy = abs( up.z - p.z ) < abs( p.z - dn.z ) ? up - p : p - dn;
	float c = dot( normalize( cross( dx, dy ) ), 0.25 * ( l + r + dn + up ) - p ) / ( - p.z * uQ.y * 2.0 * px.y );
	return 1.0 - uCrease * ( 0.15 * smoothstep( 0.06, 0.28, c ) - 0.08 * smoothstep( 0.06, 0.28, - c ) ) * ( 1.0 - smoothstep( 0.9, 2.5, abs( c ) ) );
}
void main() {
	float d = texture2D( tD, v ).x;
	vec4 w = uIVP * vec4( v * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); w.xyz /= w.w;
	vec3 rd = normalize( w.xyz - uEye ), c = texture2D( tC, v ).rgb;
	bool wet = d < 1.0 || rd.y < - 1e-4;
	float tm = d < 1.0 ? length( w.xyz - uEye ) : wet ? ( uSea - uEye.y ) / rd.y : 4000.0;
	if ( d >= 1.0 ) c = sky( rd ); else c *= mix( 1.0, texture2D( tA, v ).r, uAO * ( 1.0 - smoothstep( 0.85, 1.8, max( c.r, max( c.g, c.b ) ) ) ) ) * crease( vpos( v, d ) );
	float tr = exp( - tau( uEye, rd, tm ) - ( wet ? melt( tm ) : 0.0 ) );
	gl_FragColor = vec4( c * tr + haze( rd ) * ( 1.0 - tr ) + texture2D( tV, v ).rgb, 1.0 );
}`, { ...AIR, tC: sceneTex, tD: D, tA: aoTex, tV: volTex, uIVP: IVP, uEye: EYE, uSunC: SUNC, uZen: ZEN, uAO: K.ao, uCrease: K.crease, uSea: SEAY, uNF: NF, uQ: Q });

function translucent() {
  const bg = scene.background, auto = scene.matrixWorldAutoUpdate;
  scene.background = null; scene.matrixWorldAutoUpdate = false;
  hdCam.layers.set(LAYER_FX); renderer.autoClear = false;
  renderer.setRenderTarget(T!.over); renderer.render(scene, hdCam);
  hdCam.layers.set(0); scene.background = bg; scene.matrixWorldAutoUpdate = auto;
}

const hdrTex = u<THREE.Texture | null>(null), cocTex = u<THREE.Texture | null>(null), tileTex = u<THREE.Texture | null>(null), spreadTex = u<THREE.Texture | null>(null), focusTex = u<THREE.Texture | null>(null);
const dofR = u(1), dofTilt = u(0), FOCUS = u(new THREE.Vector4());
const cocPass = fx(/* glsl */`
uniform sampler2D tC, tD; uniform vec4 uS; uniform float uR, uBand, uFocus, uTilt;
${DEPTH}
void main() {
	float z = - vz( texture2D( tD, v ).x ), a = ( v.x * 2.0 - 1.0 + uQ.z ) * uQ.x, b = ( v.y * 2.0 - 1.0 + uQ.w ) * uQ.y;
	float s = uS.x + z * ( uS.w + uS.y * a + uS.z * b );
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
vec2 disk( vec2 q ) {
	vec2 a = 2.0 * q - 1.0;
	if ( a.x == 0.0 && a.y == 0.0 ) return vec2( 0.0 );
	bool wide = abs( a.x ) > abs( a.y );
	float r = wide ? a.x : a.y, th = wide ? 0.7853982 * a.y / a.x : 1.5707963 - 0.7853982 * a.x / a.y;
	return r * vec2( cos( th ), sin( th ) );
}
vec3 held( vec3 c ) { return c * min( 1.0, 16.0 / max( dot( c, LW ), 1e-4 ) ); }
float rim( vec3 c, float r, float a ) { return dot( c, LW ) > uThr ? 1.0 + 0.8 * smoothstep( 0.7, 1.0, r / max( a, 1.0 ) ) : 1.0; }
void main() {
	vec4 s0 = texture2D( tC, v ); float c0 = s0.a, a0 = abs( c0 ), mf = texelFetch( tT, ivec2( gl_FragCoord.xy ) / 16, 0 ).r;
	if ( a0 < 0.4 && mf < 0.4 ) { gl_FragColor = vec4( s0.rgb, 0.0 ); return; }
	const vec2 G = vec2( 0.7548777, 0.5698403 );
	vec2 o = vec2( ign( gl_FragCoord.xy ), ign( gl_FragCoord.yx + 5.588238 ) );
	vec3 bg = vec3( 0.0 ); float bw = 0.0;
	if ( c0 >= 0.0 ) { float w0 = 1.0 / max( a0 * a0, 1.0 ); bg = held( s0.rgb ) * w0; bw = w0; }
	float nb = a0 < 0.4 ? 0.0 : clamp( 8.0 + a0 * 4.0, 16.0, 56.0 );
	for ( int i = 0; i < 56; i ++ ) {
		if ( float( i ) >= nb ) break;
		vec2 d = disk( fract( o + float( i ) * G ) ) * a0; float r = length( d );
		vec4 s = texture2D( tC, v + d * uPx );
		if ( s.a < 0.0 ) continue;
		float cover = clamp( s.a - r + 1.0, 0.0, 1.0 );
		if ( s.a > c0 ) cover = min( cover, clamp( a0 - r + 1.0, 0.0, 1.0 ) );
		float w = cover * rim( s.rgb, r, s.a ) / max( s.a * s.a, 1.0 );
		bg += held( s.rgb ) * w; bw += w;
	}
	vec3 col = bw > 0.0 ? bg / bw : s0.rgb; float blur = a0;
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
	gl_FragColor = vec4( col, blur );
}`, { tC: cocTex, tT: spreadTex, uPx: PX, uThr: K.thr });
const softPass = fx(/* glsl */`
uniform sampler2D tC; uniform vec2 uPx;
void main() {
	vec4 s = texture2D( tC, v ); float k = saturate( s.a - 0.5 );
	if ( k <= 0.0 ) { gl_FragColor = vec4( s.rgb, 1.0 ); return; }
	vec3 c = 4.0 * s.rgb; float w = 4.0;
	for ( int j = - 1; j <= 1; j ++ ) for ( int i = - 1; i <= 1; i ++ ) {
		if ( i == 0 && j == 0 ) continue;
		float f = i == 0 || j == 0 ? 2.0 : 1.0;
		c += f * texture2D( tC, v + vec2( i, j ) * uPx ).rgb; w += f;
	}
	gl_FragColor = vec4( mix( s.rgb, c / w, k ), 1.0 );
}`, { tC: hdrTex, uPx: PX });

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

const bloomTex = u<THREE.Texture | null>(null), endAsp = u(new THREE.Vector2(1.6, 1)), endMid = u(new THREE.Vector2(0.5, 0.5));
const endPass = fx(/* glsl */`
uniform sampler2D tC, tB; uniform float uExp, uBloom, uVig, uSat; uniform vec2 uMid, uAsp;
#include <tonemapping_pars_fragment>
const vec3 LW = vec3( 0.2126, 0.7152, 0.0722 );
const float GAIN = 3.4, POWER = 2.0, PUNCH = 1.25, RAMP = 0.3;
const mat3 AGX_IN = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ), vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
const mat3 AGX_OUT = mat3( vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ), vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ), vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 ) );
vec3 agx( vec3 c ) {
	c = AGX_IN * ( LINEAR_SRGB_TO_LINEAR_REC2020 * c );
	c = clamp( ( log2( max( c, 1e-10 ) ) + 12.47393 ) / 16.5, 0.0, 1.0 );
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

const mk = (w: number, h: number, o: THREE.RenderTargetOptions = {}) => new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), { type: THREE.HalfFloatType, depthBuffer: false, ...o });
let T: { main: RT; hdr: RT; over: RT; nrm: RT; coc: RT; aa: RT; ao: RT[]; vol: RT[]; tile: RT[]; bloom: RT[] } | null = null;
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
  for (const t of [main, hdr, over]) renderer.initRenderTarget(t);
  D.value = main.depthTexture; sceneTex.value = main.texture; nrmTex.value = T.nrm.texture; aoTex.value = T.ao[0].texture; volTex.value = T.vol[0].texture;
  hdrTex.value = hdr.texture; cocTex.value = focusTex.value = T.coc.texture; tileTex.value = T.tile[0].texture; spreadTex.value = T.tile[1].texture; bloomTex.value = T.bloom[0].texture;
  PX.value.set(1 / main.width, 1 / main.height); smaa.setSize(main.width, main.height);
}

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene().add(quad), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quad.frustumCulled = false;
function pass(m: THREE.ShaderMaterial, to: RT | null, keep = false) {
  quad.material = m; renderer.autoClear = !keep; renderer.setRenderTarget(to); renderer.render(qScene, qCam);
}
function denoise(m: THREE.ShaderMaterial, src: THREE.IUniform, [a, b]: RT[]) {
  src.value = a.texture; dir.value.set(1 / a.width, 0); pass(m, b);
  src.value = b.texture; dir.value.set(0, 1 / a.height); pass(m, a);
}

const LAMP_SOFT = 0.65, LAMP_K = 0.0038, SPOT_K = 0.0009, BEAM_K = 0.65, SPOT_R = 1;
function uniforms() {
  const P = hdCam.projectionMatrix.elements, e = hdCam.matrixWorld.elements, t = controls.target, h = T!.main.height;
  IVP.value.multiplyMatrices(hdCam.matrixWorld, hdCam.projectionMatrixInverse); VP.value.multiplyMatrices(hdCam.projectionMatrix, hdCam.matrixWorldInverse);
  EYE.value.copy(hdCam.position); NF.value.set(hdCam.near, hdCam.far); Q.value.set(1 / P[0], 1 / P[5], P[8], P[9]);
  SUNC.value.set(sky.lightC.r, sky.lightC.g, sky.lightC.b).multiplyScalar(sky.lightK); GLOW.value = sky.glow;
  SPS.value.set(spot.shadow.camera.near, spot.distance || spot.shadow.camera.far);
  U.uSp.value.set(SPS.value.x, SPS.value.y, 2 * Math.tan(spot.angle * spot.shadow.focus), SPOT_R);
  aoF.value = 0.5 * h * P[5];
  dofR.value = K.blur.value * renderer.getPixelRatio(); dofTilt.value = zoomed();
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
  endMid.value.set(free.w / 2, 0.5); endAsp.value.set((T!.main.width * free.w) / h, 1);
}

export function render() {
  if (!T) return;
  const auto = renderer.autoClear;
  lights(performance.now() / 1000);
  uniforms();
  renderer.autoClear = true;
  renderer.setRenderTarget(T.main);
  renderer.render(scene, hdCam);
  SHM.value.copy(sun.shadow.matrix); SHT.value = sun.shadow.map?.depthTexture ?? null;
  SPM.value.copy(spot.shadow.matrix); SPSH.value = spot.shadow.map?.depthTexture ?? null;
  pass(nrmPass, T.nrm);
  pass(aoPass, T.ao[0]); denoise(aoBlur, aoSrc, T.ao);
  pass(volPass, T.vol[0]); denoise(volBlur, volSrc, T.vol);
  pass(compPass, T.hdr);
  translucent();
  pass(cocPass, T.coc); pass(tilePass, T.tile[0]); pass(spreadPass, T.tile[1]);
  pass(gatherPass, T.hdr);
  pass(softPass, T.coc);
  const b = T.bloom;
  bPx.value.set(1 / T.coc.width, 1 / T.coc.height); pass(bright, b[0]);
  for (let i = 1; i < b.length; i++) { bSrc.value = b[i - 1].texture; bPx.value.set(1 / b[i - 1].width, 1 / b[i - 1].height); pass(down, b[i]); }
  for (let i = b.length - 2; i >= 0; i--) { bSrc.value = b[i + 1].texture; bPx.value.set(1 / b[i + 1].width, 1 / b[i + 1].height); pass(up, b[i], true); }
  pass(endPass, T.aa);
  renderer.autoClear = true; smaa.render(renderer, T.aa, T.aa, 0, false);
  renderer.autoClear = auto;
}
