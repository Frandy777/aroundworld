import * as THREE from 'three';
import { TILES } from '../../shared/data';

// ---- Two looks, one world ----
// The restrained look (a pixel buffer, banded toon light, hard shadows, inked edges) is the game's own. HD-2D is the option, after Octopath Traveler: the same pixel-art
// surfaces, kept sharp, under modern light. This file is the light of it: smooth sun and sky with GGX highlights, relief read off the textures, soft shadows (PCSS) and
// local lamps. hd2d.ts does the rest (occlusion, haze and light shafts, tilt-shift focus, bloom, tone map). Every lit material carries both looks, switched by one shared
// uniform, and every light that is only for HD-2D is hidden while it is off, so the restrained look is drawn exactly as it was.
export const hd = { on: false };
export const U = {
  uHd: { value: 0 }, // 1 while HD-2D is on
  uLamp: { value: 1 }, // artificial light's share of its night strength (sky.ts)
  uSh: { value: new THREE.Vector2(439, 0.045) }, // the sun's shadow map as the soft shadows need it: the depth it spans and one texel of it, in world units (see fitShadow)
};

// The local lights: a fixed set, parked at zero intensity when idle, because a different count would make every material compile again (hd2d.ts places them).
export const CITY_COUNT = TILES.filter((t) => t.type === 'city').length;
export const LAMP = { strike: 4, fixed: 5, city: 25 }; // 0-3 tokens, 4 missile, 5-24 fixed landmarks/islets, 25+ two lamps (front-right key + back-left fill) per ordinary city
export const lamps = Array.from({ length: LAMP.city + CITY_COUNT * 2 }, () => new THREE.PointLight(0xffffff, 0, 0, 2));
export const spot = new THREE.SpotLight(0xffe2b0, 0, 0, 0.45, 0.8, 1.6);
export const setLamps = (on: boolean) => [...lamps, spot].forEach((l) => (l.visible = on)); // a hidden light is not in the shaders at all
setLamps(false);

// Soft shadows: the sun's map is a plain depth map (BasicShadowMap), so a lookup can be made as wide as it likes. PCSS: a search for the blockers in front of the pixel
// gives how far the light travelled past them, which sets the width of the filter, sharp at the foot of a wall and soft at the end of its shadow. The depth of a sloped
// receiver is followed across the filter (from the screen-space derivatives), so a wide filter does not shadow the ground with itself.
const PCSS = /* glsl */`
uniform float uHd;
uniform vec2 uSh;
float pcss( sampler2D sm, vec3 c, vec3 dx, vec3 dy, vec2 size ) {
	float det = dx.x * dy.y - dx.y * dy.x;
	vec2 g = abs( det ) > 1e-14 ? vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det : vec2( 0.0 );
	float tx = 1.0 / size.x, rot = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) * 6.2831853, gap = 0.0, n = 0.0, lit = 0.0;
	for ( int i = 0; i < 12; i ++ ) {
		float a = float( i ) * 2.39996323 + rot;
		vec2 o = vec2( cos( a ), sin( a ) ) * sqrt( ( float( i ) + 0.5 ) / 12.0 ) * 12.0 * tx;
		float z = c.z + dot( g, o ) - texture2D( sm, c.xy + o ).r;
		if ( z > 0.0002 ) { gap += z; n += 1.0; }
	}
	if ( n < 0.5 ) return 1.0;
	float rad = clamp( gap / n * uSh.x * 0.09 / uSh.y, 1.5, 14.0 ) * tx;
	for ( int i = 0; i < 20; i ++ ) {
		float a = float( i ) * 2.39996323 + rot;
		vec2 o = vec2( cos( a ), sin( a ) ) * sqrt( ( float( i ) + 0.5 ) / 20.0 ) * rad;
		lit += step( c.z + dot( g, o ), texture2D( sm, c.xy + o ).r );
	}
	return lit / 20.0;
}
`;
const SHADOW = THREE.ShaderChunk.shadowmap_pars_fragment;
if (!SHADOW.includes('pcss')) { // three keeps its chunks across a hot update: patch them once
  THREE.ShaderChunk.shadowmap_pars_fragment = PCSS + SHADOW
    .replace(/bool inFrustum =/g, 'vec3 sdx = dFdx( shadowCoord.xyz ), sdy = dFdy( shadowCoord.xyz );\n\t\t\tbool inFrustum =') // before any branch: derivatives need every pixel of the quad
    .replace('shadow = step( shadowCoord.z, depth );', 'shadow = uHd > 0.5 ? pcss( shadowMap, shadowCoord.xyz, sdx, sdy, shadowMapSize ) : step( shadowCoord.z, depth );');
}
/** A material that only receives the sun's shadow (the dimming of the sea) takes the soft ones too. */
export const soft = <M extends THREE.Material>(m: M) => { m.onBeforeCompile = (sh) => void Object.assign(sh.uniforms, U); return m; };

// The lit materials. Everything the restrained look does stays in the `uHd < 0.5` branches, untouched; HD-2D is Lambert with a GGX highlight per light, the sky in the mirror
// direction by Fresnel, and a bump read off the texture's own brightness, so a pixel-art brick has mortar you can feel in a raking light.
// uPbr: roughness, specular strength, metalness, relief. Glass is found by its blue (the windows, the domes): sharper and brighter than the rest.
export type Pbr = [rough: number, spec: number, metal: number, relief: number];
const PBR: Pbr = [0.8, 1, 0, 0.5];
const DARK = new THREE.Color(0); // the lamps of a material that has none (see `nightlit`)
const TOON = /* glsl */`
varying vec3 vViewPosition;
uniform vec4 uPbr;
uniform float uBacklit, uLamp;
uniform vec3 uNight;
float hdGloss;
struct ToonMaterial { vec3 diffuseColor; };
#ifdef USE_MAP
	float hdH( vec2 uv ) { return dot( texture2D( map, uv ).rgb, vec3( 0.299, 0.587, 0.114 ) ); }
#endif
float hdRough() { return mix( uPbr.x, 0.14, hdGloss ); }
vec3 hdF0( vec3 albedo ) { return mix( vec3( 0.04 ), albedo, uPbr.z ); }
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	if ( uHd < 0.5 ) {
		vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
		reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
		return;
	}
	float nl = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irr = nl * directLight.color, h = normalize( directLight.direction + geometryViewDir );
	reflectedLight.directDiffuse += irr * BRDF_Lambert( material.diffuseColor * ( 1.0 - uPbr.z ) );
	float nh = saturate( dot( geometryNormal, h ) ), nv = max( dot( geometryNormal, geometryViewDir ), 0.001 ), vh = saturate( dot( geometryViewDir, h ) );
	float a2 = pow2( pow2( hdRough() ) ), dd = nh * nh * ( a2 - 1.0 ) + 1.0;
	float gv = nl * sqrt( a2 + ( 1.0 - a2 ) * nv * nv ), gl = nv * sqrt( a2 + ( 1.0 - a2 ) * nl * nl );
	reflectedLight.directSpecular += irr * F_Schlick( hdF0( material.diffuseColor ), 1.0, vh ) * ( uPbr.y * RECIPROCAL_PI * a2 / ( dd * dd ) * 0.5 / max( gv + gl, 0.0001 ) );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	if ( uHd < 0.5 ) {
		reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
		return;
	}
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor * ( 1.0 - uPbr.z ) );
	#if NUM_HEMI_LIGHTS > 0
		vec3 r = reflect( - geometryViewDir, geometryNormal ), f0 = hdF0( material.diffuseColor );
		float nv = saturate( dot( geometryNormal, geometryViewDir ) ), gloss = 1.0 - hdRough();
		reflectedLight.indirectSpecular += ( f0 + ( max( vec3( gloss ), f0 ) - f0 ) * pow( 1.0 - nv, 5.0 ) ) * getHemisphereLightIrradiance( hemisphereLights[ 0 ], r ) * ( RECIPROCAL_PI * uPbr.y );
	#endif
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;
const GLOSS = /* glsl */`
hdGloss = 0.0;
#ifdef USE_MAP
	hdGloss = smoothstep( 0.1, 0.4, sampledDiffuseColor.b - max( sampledDiffuseColor.r, sampledDiffuseColor.g ) );
#endif
`;
const NIGHT = /* glsl */`
float night = smoothstep( 0.12, 1.0, uLamp );
#ifdef USE_EMISSIVEMAP
	totalEmissiveRadiance = totalEmissiveRadiance * ( 1.0 + 0.42 * uHd ) + diffuseColor.rgb * vec3( 0.08, 0.05, 0.022 ) * uHd;
	totalEmissiveRadiance *= night;
#endif
totalEmissiveRadiance += uNight * night * ( 1.0 + 0.45 * uHd );
`;
const RELIEF = /* glsl */`
#ifdef USE_MAP
	if ( uHd > 0.5 && uPbr.w > 0.0 ) {
		vec2 ts = 1.0 / vec2( textureSize( map, 0 ) );
		float hx = hdH( vMapUv + vec2( ts.x, 0.0 ) ) - hdH( vMapUv - vec2( ts.x, 0.0 ) ), hy = hdH( vMapUv + vec2( 0.0, ts.y ) ) - hdH( vMapUv - vec2( 0.0, ts.y ) );
		vec3 q0 = dFdx( - vViewPosition ), q1 = dFdy( - vViewPosition ), q1p = cross( q1, normal ), q0p = cross( normal, q0 );
		vec2 s0 = dFdx( vMapUv ), s1 = dFdy( vMapUv );
		vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
		float m = max( dot( T, T ), dot( B, B ) );
		if ( m > 1e-20 ) normal = normalize( normal - uPbr.w * ( hx * T + hy * B ) * inversesqrt( m ) );
	}
#endif
`;
/** onBeforeCompile of every `toon()` material (one function, so every program of the same kind is shared: three names a program by its text). */
export function lit(this: THREE.Material, sh: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(sh.uniforms, U, { uPbr: { value: new THREE.Vector4(...((this.userData.pbr as Pbr | undefined) ?? PBR)) }, uBacklit: { value: (this.userData.backlit as number | undefined) ?? 0 }, uNight: { value: (this.userData.night as THREE.Color | undefined) ?? DARK } });
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <lights_toon_pars_fragment>', '')
    .replace('#include <shadowmap_pars_fragment>', `#include <shadowmap_pars_fragment>\n${TOON}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${GLOSS}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${RELIEF}`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${NIGHT}\ntotalEmissiveRadiance += diffuseColor.rgb * uBacklit * uLamp;`) // a nightlit one's lamps (the emissive map is gated before anything is added to it), and a backlit material's own colour (see `backlit`), unshadowed
    .replace('reflectedLight.indirectDiffuse + totalEmissiveRadiance', 'reflectedLight.indirectDiffuse + totalEmissiveRadiance + reflectedLight.directSpecular + reflectedLight.indirectSpecular');
}

/** The lamp inside a tile (artificial light, so it follows `uLamp`) shines up through this material: `t` of its own colour, texels and all, is added to what the sun and sky give it, in either look (see `lit`).
 * A dark material passes little of it and a white one a lot, so the light comes out tinted by what it went through; shadows do not reach it. */
export const backlit = <M extends THREE.Material>(m: M, t: number) => { m.userData.backlit = t; return m; };

/** A surface with lamps of its own: they are out by day (`uLamp` is 0.12 then, see sky.ts: the day look is untouched) and come on with the dusk, in either look (see `lit`).
 * A plain material shines all over in `c` times `k` (past 1 is HDR, which blooms in HD-2D): a lit path, a strip of light. A textured one (the windows of a building) is lit where its `emissiveMap` is (see `lodMap`, which draws
 * it per zoom level like the colour): that drawing is the night's own, window by window, a quarter brighter again in HD-2D, to bloom. Every other material has black lamps: it adds nothing. */
export const nightlit = <M extends THREE.Material>(m: M, c: THREE.ColorRepresentation, k = 1) => { m.userData.night = new THREE.Color(c).multiplyScalar(k); return m; };

/** An unlit card is as bright by night as by day, so the lettering that the lamp lights (see `backlit`) stands out of it no better than by day: as the lamp (`uLamp`) comes on, the card is dimmed to `t` of its colours. */
export const dusk = <M extends THREE.MeshBasicMaterial>(m: M, t: number) => {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uLamp: U.uLamp, uDusk: { value: t } });
    sh.fragmentShader = `uniform float uLamp, uDusk;\n${sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, uDusk, uLamp);')}`;
  };
  return m;
};

/** Neon, lamps and flames are unlit (see builder.ts); HD-2D gives them a little daylight colour and enough HDR light to bloom after dusk. */
export const glow = <M extends THREE.MeshBasicMaterial>(m: M) => {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uHd: U.uHd, uLamp: U.uLamp });
    sh.fragmentShader = `uniform float uHd, uLamp;\n${sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 + 1.8 * uLamp * uHd;')}`;
  };
  return m;
};
