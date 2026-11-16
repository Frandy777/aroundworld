import * as THREE from 'three';
import { TILES } from '../../shared/data';

export const hd = { on: false };
export const U = {
  uHd: { value: 0 },
  uLamp: { value: 1 },
  uSh: { value: new THREE.Vector2(439, 0.045) },
  uSp: { value: new THREE.Vector4(0.5, 24, 0.97, 1) },
};

export const CITY_COUNT = TILES.filter((t) => t.type === 'city').length;
export const LAMP = { strike: 4, fixed: 5, city: 37 };
export const lamps = Array.from({ length: LAMP.city + CITY_COUNT * 2 }, () => new THREE.PointLight(0xffffff, 0, 0, 2));
export const spot = new THREE.SpotLight(0xffe2b0, 0, 0, 0.45, 0.8, 1.6);
spot.shadow.mapSize.set(1024, 1024);
Object.assign(spot.shadow, { bias: -0.0004, normalBias: 0.03, radius: 2 });
export const setLamps = (on: boolean) => {
  [...lamps, spot].forEach((l) => (l.visible = on));
  spot.castShadow = on;
};
setLamps(false);

const PCSS = /* glsl */`
uniform float uHd;
uniform vec2 uSh;
uniform vec4 uSp;
float pcss( sampler2D sm, vec3 c, vec3 dx, vec3 dy, vec2 size, bool spot ) {
	float dr = spot ? uSp.x * uSp.y / ( uSp.y - c.z * ( uSp.y - uSp.x ) ) : 0.0;
	float wt = spot ? uSp.z * dr / size.x : uSh.y, zw = spot ? dr * dr * ( uSp.y - uSp.x ) / ( uSp.x * uSp.y ) : uSh.x;
	float det = dx.x * dy.y - dx.y * dy.x, ms = 8.0 * size.x * wt / zw;
	vec2 g = abs( det ) > 1e-14 ? clamp( vec2( dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z ) / det, - ms, ms ) : vec2( 0.0 );
	float tx = 1.0 / size.x, rot = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) * 6.2831853, gap = 0.0, n = 0.0, lit = 0.0, sr = ( spot ? 0.6 : 1.2 ) / wt * tx;
	for ( int i = 0; i < 12; i ++ ) {
		float a = float( i ) * 2.39996323 + rot;
		vec2 o = vec2( cos( a ), sin( a ) ) * sqrt( ( float( i ) + 0.5 ) / 12.0 ) * sr;
		float z = c.z + dot( g, o ) - texture2D( sm, c.xy + o ).r;
		if ( z > 0.0002 ) { gap += z; n += 1.0; }
	}
	if ( n < 0.5 ) return 1.0;
	float pw = gap / n * zw, rad = max( clamp( spot ? pw * uSp.w / max( dr - pw, 0.5 ) : pw * 0.09, 0.06, 0.75 ) / wt, 1.0 ) * tx;
	for ( int i = 0; i < 20; i ++ ) {
		float a = float( i ) * 2.39996323 + rot;
		vec2 o = vec2( cos( a ), sin( a ) ) * sqrt( ( float( i ) + 0.5 ) / 20.0 ) * rad;
		lit += step( c.z + dot( g, o ), texture2D( sm, c.xy + o ).r );
	}
	return lit / 20.0;
}
`;
const SHADOW = THREE.ShaderChunk.shadowmap_pars_fragment;
if (!SHADOW.includes('pcss')) {
  THREE.ShaderChunk.shadowmap_pars_fragment = PCSS + SHADOW
    .replace(/bool inFrustum =/g, 'vec3 sdx = dFdx( shadowCoord.xyz ), sdy = dFdy( shadowCoord.xyz );\n\t\t\tbool inFrustum =')
    .replace('shadow = step( shadowCoord.z, depth );', 'shadow = uHd > 0.5 ? pcss( shadowMap, shadowCoord.xyz, sdx, sdy, shadowMapSize, shadowRadius > 1.5 ) : step( shadowCoord.z, depth );');
}
export const soft = <M extends THREE.Material>(m: M) => { m.onBeforeCompile = (sh) => void Object.assign(sh.uniforms, U); return m; };

export type Pbr = [rough: number, spec: number, metal: number, relief: number];
const PBR: Pbr = [0.8, 1, 0, 0.5];
export const PAINT: Pbr = [0.88, 0.25, 0, 0];
const DARK = new THREE.Color(0);
export const ORM = new THREE.DataTexture(new Uint8Array([0, 255, 0, 255]), 1, 1);
ORM.needsUpdate = true;
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
	vec2 p = uv * hdDim, i = floor( p + 0.5 ), f = clamp( ( p - i ) / max( hdFw, 1e-4 ) + 0.5, 0.0, 1.0 );
	return textureLod( t, ( i - 0.5 + f ) / vec2( textureSize( t, hdMip ) ), float( hdMip ) );
}
float hdTap( vec2 c, vec2 sz ) { return textureLod( ormMap, c / sz, float( hdMip ) ).g; }
float hdRough() { return mix( uPbr.x, 0.14, hdGloss ); }
vec3 hdF0( vec3 albedo ) { return mix( vec3( 0.04 ), albedo, uPbr.z ); }
#if NUM_HEMI_LIGHTS > 0
	vec3 hdEnv( vec3 r, float rough ) {
		vec3 up = hemisphereLights[ 0 ].direction, ground = hemisphereLights[ 0 ].groundColor, sky = hemisphereLights[ 0 ].skyColor;
		#if NUM_DIR_LIGHTS > 0
			ground += directionalLights[ 0 ].color * ( 0.1 * saturate( dot( directionalLights[ 0 ].direction, up ) ) );
		#endif
		sky = mix( vec3( dot( sky, vec3( 0.2126, 0.7152, 0.0722 ) ) ), sky, 0.5 );
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
const RELIEF = /* glsl */`
#ifdef USE_MAP
	if ( uHd > 0.5 && uPbr.w > 0.0 && uOrm > 0.5 ) {
		vec2 sz = vec2( textureSize( ormMap, hdMip ) ), p = vMapUv * hdDim, i = floor( p + 0.5 ), e = p - i, w = max( hdFw, 1e-4 ), f = clamp( e / w + 0.5, 0.0, 1.0 );
		float a = hdTap( i - 0.5, sz ), b = hdTap( i + vec2( 0.5, - 0.5 ), sz ), c = hdTap( i + vec2( - 0.5, 0.5 ), sz ), d = hdTap( i + 0.5, sz );
		vec2 h = vec2( mix( b - a, d - c, f.y ), mix( c - a, d - b, f.x ) ) * step( abs( e ), 0.5 * w );
		vec3 q0 = dFdx( - vViewPosition ), q1 = dFdy( - vViewPosition ), q1p = cross( q1, normal ), q0p = cross( normal, q0 );
		vec2 s0 = dFdx( vMapUv ), s1 = dFdy( vMapUv );
		vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
		float m = max( dot( T, T ), dot( B, B ) );
		if ( m > 1e-20 ) normal = normalize( normal - uPbr.w * ( h.x * T + h.y * B ) * inversesqrt( m ) );
	}
#endif
`;
export function lit(this: THREE.Material, sh: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(sh.uniforms, U, { uPbr: { value: new THREE.Vector4(...((this.userData.pbr as Pbr | undefined) ?? PBR)) }, uBacklit: { value: (this.userData.backlit as number | undefined) ?? 0 }, uBacklitHd: backlitOf(this), uGlass: { value: (this.userData.glass as number | undefined) ?? -1 }, uNight: { value: (this.userData.night as THREE.Color | undefined) ?? DARK }, uSwitch: switchOf(this), uFlat: { value: (this.userData.flat as number | undefined) ?? -1 } }, texOf(this));
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <lights_toon_pars_fragment>', '')
    .replace('#include <shadowmap_pars_fragment>', `#include <shadowmap_pars_fragment>\n${TOON}`)
    .replace('#include <map_fragment>', MAP)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${RELIEF}`)
    .replace('#include <emissivemap_fragment>', `${EMISSIVE}\n${NIGHT}\ntotalEmissiveRadiance += diffuseColor.rgb * mix( uBacklit, uBacklitHd, uHd ) * uLamp;`)
    .replace('#include <opaque_fragment>', `if ( uHd < 0.5 && uFlat >= 0.0 ) outgoingLight = diffuseColor.rgb * mix( 1.0, uFlat, uLamp );\n#include <opaque_fragment>`)
    .replace('reflectedLight.indirectDiffuse + totalEmissiveRadiance', 'reflectedLight.indirectDiffuse + totalEmissiveRadiance + reflectedLight.directSpecular + reflectedLight.indirectSpecular');
}

export const glassy = <M extends THREE.Material>(m: M, share = 1) => { m.userData.glass = share; return m; };

export const backlit = <M extends THREE.Material>(m: M, t: number) => { m.userData.backlit = t; backlitOf(m).value = t; return m; };

export const backlitOf = (m: THREE.Material) => (m.userData.backlitHd ??= { value: 0 }) as THREE.IUniform<number>;

export const nightlit = <M extends THREE.Material>(m: M, c: THREE.ColorRepresentation, k = 1) => { m.userData.night = new THREE.Color(c).multiplyScalar(k); return m; };

export const switchOf = (m: THREE.Material) => (m.userData.on ??= { value: 1 }) as THREE.IUniform<number>;

export const flat = <M extends THREE.Material>(m: M, t = 1) => { m.userData.flat = t; return m; };

export const glow = <M extends THREE.MeshBasicMaterial>(m: M, k = 1.8) => {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uHd: U.uHd, uLamp: U.uLamp, uGlow: { value: k } });
    sh.fragmentShader = `uniform float uHd, uLamp, uGlow;\n${sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 + uGlow * uLamp * uHd;')}`;
  };
  return m;
};
