import * as THREE from 'three';
import { TILES } from '../../shared/data';

// ---- Two looks, one world ----
// The restrained look (a pixel buffer, banded toon light, hard shadows, inked edges) is the game's own. HD-2D is the option, after Octopath Traveler: the same pixel-art
// surfaces, kept sharp, under modern light. This file is the light of it: smooth sun and sky with GGX highlights, glass and relief read off the textures' masks, soft shadows (PCSS) and
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
export const LAMP = { strike: 4, fixed: 5, city: 29 }; // 0-3 tokens, 4 missile, 5-28 fixed landmark/scenery lamps (declared by the models and lamps.ts), 29+ two lamps (front-right key + back-left fill) per ordinary city
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
// direction by Fresnel, and a bevel a pixel wide where the texture's mask steps in height, so a pixel-art brick has mortar you can feel in a raking light.
// uPbr: roughness, specular strength, metalness, relief. Glass is sharper and brighter than the rest: a texture's is where its mask says (the windows, drawn with it: art.ts) unless `glassy` says otherwise.
export type Pbr = [rough: number, spec: number, metal: number, relief: number];
const PBR: Pbr = [0.8, 1, 0, 0.5];
export const PAINT: Pbr = [0.88, 0.25, 0, 0]; // a painted board (a card, a sign): matte, a little sheen, flat: nothing in it to read a relief from
const DARK = new THREE.Color(0); // the lamps of a material that has none (see `nightlit`)
export const ORM = new THREE.DataTexture(new Uint8Array([0, 255, 0, 255]), 1, 1); // the mask of a texture that says nothing of its material (flat and matte), bound where there is none to read: `uOrm` is 0 then
ORM.needsUpdate = true;
/** What `lit` reads of a material's textures in HD-2D, set by `lodMap` (scene.ts): `ormMap`, the mask of the texture (R gloss, G height, see art.ts) and `uOrm` whether it has one, and `uLv`, the sizes of the three drawings that are
 * the first mips of its chain (see `hdPick`: a drawing is padded to halve exactly, and its own size is its grid). A material whose textures are no lodMap's has none of it: zeros. */
export const texOf = (m: THREE.Material) => (m.userData.tex ??= { ormMap: { value: ORM }, uOrm: { value: 0 }, uLv: { value: [0, 1, 2].map(() => new THREE.Vector2()) } }) as { ormMap: THREE.IUniform<THREE.Texture>; uOrm: THREE.IUniform<number>; uLv: THREE.IUniform<THREE.Vector2[]> };
const TOON = /* glsl */`
varying vec3 vViewPosition;
uniform vec4 uPbr;
uniform float uBacklit, uBacklitHd, uLamp, uSwitch, uGlass, uFlat, uOrm;
uniform vec3 uNight;
uniform vec2 uLv[ 3 ];
uniform sampler2D ormMap;
float hdGloss;
int hdMip;
vec2 hdDim, hdFw;
struct ToonMaterial { vec3 diffuseColor; };
// HD-2D reads a pixel texture through the box of one screen pixel (hdSample): a texel is flat but for the width of that pixel where it meets the next, so a line neither breaks up nor shimmers as the view turns. hdPick comes
// first and says which mip the pixel reads, the grid of its texels (hdDim) and how many of them a pixel spans (hdFw). The three hand-drawn mips of a lodMap's chain (uLv, see scene.ts chainOf) are taken at the finest whose texels
// are a whole pixel or more, like the restrained look's levels; past them, as the hardware rounds a plain texture's mips (a mip whose texels are up to 1.4 pixels wide). The derivatives are taken here, once, where every pixel of the quad does.
vec2 hdGrid( sampler2D t, int k ) {
	return uLv[ 0 ].x > 0.0 ? uLv[ min( k, 2 ) ] * exp2( float( min( 2 - k, 0 ) ) ) : vec2( textureSize( t, k ) );
}
void hdPick( sampler2D t, vec2 uv ) {
	vec2 dx = dFdx( uv ), dy = dFdy( uv ), g = vec2( textureSize( t, 0 ) );
	int top = int( log2( max( g.x, g.y ) ) + 0.01 ), own = uLv[ 0 ].x > 0.0 ? 2 : 0;
	hdMip = 0; hdDim = hdGrid( t, 0 );
	for ( int k = 1; k <= top; k ++ ) {
		vec2 a = dx * hdDim, b = dy * hdDim;
		if ( sqrt( max( dot( a, a ), dot( b, b ) ) ) <= ( hdMip < own ? 1.0 : 1.4142 ) ) break;
		hdMip = k; hdDim = hdGrid( t, k );
	}
	hdFw = ( abs( dx ) + abs( dy ) ) * hdDim;
}
vec4 hdSample( sampler2D t, vec2 uv ) {
	vec2 p = uv * hdDim, i = floor( p + 0.5 ), f = clamp( ( p - i ) / max( hdFw, 1e-4 ) + 0.5, 0.0, 1.0 ); // the nearest texel corner, and how far past it this pixel's box reaches
	return textureLod( t, ( i - 0.5 + f ) / vec2( textureSize( t, hdMip ) ), float( hdMip ) );
}
float hdTap( vec2 c, vec2 sz ) { return textureLod( ormMap, c / sz, float( hdMip ) ).g; }
float hdRough() { return mix( uPbr.x, 0.14, hdGloss ); }
vec3 hdF0( vec3 albedo ) { return mix( vec3( 0.04 ), albedo, uPbr.z ); }
#if NUM_HEMI_LIGHTS > 0
	// What a mirror sees in direction r: the sky over a ground that the sun lights (warm, and the brighter the higher the sun), split at the horizon by a blend as wide as the surface is rough. A smooth one shows the line itself,
	// cool over warm, which the hemisphere's own cosine blend (getHemisphereLightIrradiance, the light a wall takes in) smears into one flat tone: a metal that reflects only that cannot be told from a painted one. Twice what a wall takes in: a metal has little paint left to carry its light.
	vec3 hdEnv( vec3 r, float rough ) {
		vec3 up = hemisphereLights[ 0 ].direction, ground = hemisphereLights[ 0 ].groundColor, sky = hemisphereLights[ 0 ].skyColor;
		#if NUM_DIR_LIGHTS > 0
			ground += directionalLights[ 0 ].color * ( 0.1 * saturate( dot( directionalLights[ 0 ].direction, up ) ) );
		#endif
		sky = mix( vec3( dot( sky, vec3( 0.2126, 0.7152, 0.0722 ) ) ), sky, 0.5 ); // dulled toward white: a gold that mirrored the full blue of the sky would turn green
		float w = mix( 0.04, 0.9, rough );
		return 2.0 * mix( ground, sky, smoothstep( - w, w, dot( r, up ) ) );
	}
#endif
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
		reflectedLight.indirectSpecular += ( f0 + ( max( vec3( gloss ), f0 ) - f0 ) * pow( 1.0 - nv, 5.0 ) ) * hdEnv( r, hdRough() ) * ( RECIPROCAL_PI * uPbr.y );
	#endif
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;
const GLOSS = /* glsl */`
hdGloss = max( uGlass, 0.0 );
#ifdef USE_MAP
	if ( uHd > 0.5 && uGlass < 0.0 && uOrm > 0.5 ) hdGloss = hdSample( ormMap, vMapUv ).r;
#endif
`;
const MAP = /* glsl */`
#ifdef USE_MAP
	vec4 sampledDiffuseColor;
	if ( uHd > 0.5 ) { hdPick( map, vMapUv ); sampledDiffuseColor = hdSample( map, vMapUv ); } else sampledDiffuseColor = texture2D( map, vMapUv );
	diffuseColor *= sampledDiffuseColor;
#endif
${GLOSS}`;
const EMISSIVE = /* glsl */`
#ifdef USE_EMISSIVEMAP
	#ifndef USE_MAP
		if ( uHd > 0.5 ) hdPick( emissiveMap, vEmissiveMapUv );
	#endif
	vec4 emissiveColor = uHd > 0.5 ? hdSample( emissiveMap, vEmissiveMapUv ) : texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif
`;
const NIGHT = /* glsl */`
float night = smoothstep( 0.12, 1.0, uLamp ) * uSwitch;
#ifdef USE_EMISSIVEMAP
	totalEmissiveRadiance = totalEmissiveRadiance * ( 1.0 + 0.42 * uHd );
	totalEmissiveRadiance *= night;
#endif
totalEmissiveRadiance += uNight * night * ( 1.0 + 0.45 * uHd );
`;
// The relief is the step of the mask's height (G) across the edge of a texel, at the mip the pixel reads (hdPick) and only within the width of the pixel that straddles it (the same blend as hdSample's): a bevel a pixel wide at
// every sunk frame and joint, and the flat of a texel, which has no height step, is never tilted.
const RELIEF = /* glsl */`
#ifdef USE_MAP
	if ( uHd > 0.5 && uPbr.w > 0.0 && uOrm > 0.5 ) {
		vec2 sz = vec2( textureSize( ormMap, hdMip ) ), p = vMapUv * hdDim, i = floor( p + 0.5 ), e = p - i, w = max( hdFw, 1e-4 ), f = clamp( e / w + 0.5, 0.0, 1.0 );
		float a = hdTap( i - 0.5, sz ), b = hdTap( i + vec2( 0.5, - 0.5 ), sz ), c = hdTap( i + vec2( - 0.5, 0.5 ), sz ), d = hdTap( i + 0.5, sz ); // the four texels round the corner: below left, right, above left, right
		vec2 h = vec2( mix( b - a, d - c, f.y ), mix( c - a, d - b, f.x ) ) * step( abs( e ), 0.5 * w ); // the rise across the corner's two edges, where this pixel is on them
		vec3 q0 = dFdx( - vViewPosition ), q1 = dFdy( - vViewPosition ), q1p = cross( q1, normal ), q0p = cross( normal, q0 );
		vec2 s0 = dFdx( vMapUv ), s1 = dFdy( vMapUv );
		vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
		float m = max( dot( T, T ), dot( B, B ) );
		if ( m > 1e-20 ) normal = normalize( normal - uPbr.w * ( h.x * T + h.y * B ) * inversesqrt( m ) );
	}
#endif
`;
/** onBeforeCompile of every `toon()` material (one function, so every program of the same kind is shared: three names a program by its text). */
export function lit(this: THREE.Material, sh: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(sh.uniforms, U, { uPbr: { value: new THREE.Vector4(...((this.userData.pbr as Pbr | undefined) ?? PBR)) }, uBacklit: { value: (this.userData.backlit as number | undefined) ?? 0 }, uBacklitHd: backlitOf(this), uGlass: { value: (this.userData.glass as number | undefined) ?? -1 }, uNight: { value: (this.userData.night as THREE.Color | undefined) ?? DARK }, uSwitch: switchOf(this), uFlat: { value: (this.userData.flat as number | undefined) ?? -1 } }, texOf(this));
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <lights_toon_pars_fragment>', '')
    .replace('#include <shadowmap_pars_fragment>', `#include <shadowmap_pars_fragment>\n${TOON}`)
    .replace('#include <map_fragment>', MAP) // the colour's own sample, through HD-2D's pixel filter there (see hdSample); the restrained look's is the one it was
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${RELIEF}`)
    .replace('#include <emissivemap_fragment>', `${EMISSIVE}\n${NIGHT}\ntotalEmissiveRadiance += diffuseColor.rgb * mix( uBacklit, uBacklitHd, uHd ) * uLamp;`) // a nightlit one's lamps (the emissive map is gated before anything is added to it), and a backlit material's own colour (see `backlit`), unshadowed
    .replace('#include <opaque_fragment>', `if ( uHd < 0.5 && uFlat >= 0.0 ) outgoingLight = diffuseColor.rgb * mix( 1.0, uFlat, uLamp );\n#include <opaque_fragment>`) // a flat material (see `flat`) is unlit in the restrained look: its exact colour, dimmed as the lamp comes on
    .replace('reflectedLight.indirectDiffuse + totalEmissiveRadiance', 'reflectedLight.indirectDiffuse + totalEmissiveRadiance + reflectedLight.directSpecular + reflectedLight.indirectSpecular');
}

/** How much of a material is glass, the sharp bright gloss of `lit`: `glassy(m)` says all of it (a pane of plain colour, which has no texture to find its glass in), `glassy(m, 0)` none: it forces the mask aside (a blue floor, the sea of the globe,
 * a player's colour are paint and water, not windows, though a texture that has no mask has none to begin with). Left alone, a textured material has glass where its mask says (the windows of a wall, drawn with it) and a plain one has none. */
export const glassy = <M extends THREE.Material>(m: M, share = 1) => { m.userData.glass = share; return m; };

/** The lamp inside a tile (artificial light, so it follows `uLamp`) shines up through this material: `t` of its own colour, texels and all, is added to what the sun and sky give it, in either look (see `lit`).
 * A dark material passes little of it and a white one a lot, so the light comes out tinted by what it went through; shadows do not reach it. */
export const backlit = <M extends THREE.Material>(m: M, t: number) => { m.userData.backlit = t; backlitOf(m).value = t; return m; };

/** The share of a material's backlight that HD-2D uses (`t` of `backlit` until set), to be changed on its own: the restrained look keeps the `t` that `backlit` gave. A plot's lamp is lit while its lot stands and out while it is for sale
 * or mortgaged (see board.ts): the pads are shared through memo by colour, and a colour is one state of a lot, so what is set on a pad's material is what every lot drawn with it has. */
export const backlitOf = (m: THREE.Material) => (m.userData.backlitHd ??= { value: 0 }) as THREE.IUniform<number>;

/** A surface with lamps of its own: they are out by day (`uLamp` is 0.12 then, see sky.ts: the day look is untouched) and come on with the dusk, in either look (see `lit`).
 * A plain material shines all over in `c` times `k` (past 1 is HDR, which blooms in HD-2D): a lit path, a strip of light. A textured one (the windows of a building) is lit where its `emissiveMap` is (see `lodMap`, which draws
 * it per zoom level like the colour): that drawing is the night's own, window by window, a quarter brighter again in HD-2D, to bloom. Every other material has black lamps: it adds nothing. */
export const nightlit = <M extends THREE.Material>(m: M, c: THREE.ColorRepresentation, k = 1) => { m.userData.night = new THREE.Color(c).multiplyScalar(k); return m; };

/** The switch of a material's lamps (see `nightlit`), 1 until set: 0 puts them all out, 1 lights them again, in either look. A material is shared by everything drawn with it (see memo), so only one that a single tile uses
 * can be switched on its own (see ModelDef.owner). */
export const switchOf = (m: THREE.Material) => (m.userData.on ??= { value: 1 }) as THREE.IUniform<number>;

/** A card or a sign that HD-2D lights like anything else (the sun's soft shadows by day, the lamps' tint and the dark by night) is drawn by the restrained look as it always was: unlit, in its exact colours, with no banding and no shadow
 * smudges. An unlit card is as bright by night as by day, so the lettering that the lamp lights (see `backlit`) stands out of it no better than by day: as the lamp (`uLamp`) comes on, it is dimmed to `t` of its colours. */
export const flat = <M extends THREE.Material>(m: M, t = 1) => { m.userData.flat = t; return m; };

/** Neon, lamps and flames are unlit (see builder.ts); HD-2D gives them a little daylight colour and enough HDR light to bloom after dusk: `k` times their colour on top of it at night, 1.8 for a lamp or a flame. A sign has lettering and bulbs
 * to read, which the bloom of a big one swallows, so it takes less (see plateMat). Every glow shares a program, so `k` is a uniform. */
export const glow = <M extends THREE.MeshBasicMaterial>(m: M, k = 1.8) => {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uHd: U.uHd, uLamp: U.uLamp, uGlow: { value: k } });
    sh.fragmentShader = `uniform float uHd, uLamp, uGlow;\n${sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 + uGlow * uLamp * uHd;')}`;
  };
  return m;
};
