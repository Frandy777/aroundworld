import * as THREE from 'three';

export const U = { uLamp: { value: 1 } };

const DARK = new THREE.Color(0);
const NIGHT = /* glsl */`
float night = smoothstep( 0.12, 1.0, uLamp ) * uSwitch;
#ifdef USE_EMISSIVEMAP
	totalEmissiveRadiance *= night;
#endif
totalEmissiveRadiance += uNight * night;
`;

export function lit(this: THREE.Material, sh: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(sh.uniforms, U, {
    uBacklit: { value: (this.userData.backlit as number | undefined) ?? 0 },
    uNight: { value: (this.userData.night as THREE.Color | undefined) ?? DARK },
    uSwitch: switchOf(this),
    uFlat: { value: (this.userData.flat as number | undefined) ?? -1 },
  });
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uBacklit, uLamp, uSwitch, uFlat;\nuniform vec3 uNight;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${NIGHT}\ntotalEmissiveRadiance += diffuseColor.rgb * uBacklit * uLamp;`)
    .replace('#include <opaque_fragment>', `if ( uFlat >= 0.0 ) outgoingLight = diffuseColor.rgb * mix( 1.0, uFlat, uLamp );\n#include <opaque_fragment>`);
}

export const backlit = <M extends THREE.Material>(m: M, t: number) => { m.userData.backlit = t; return m; };

export const nightlit = <M extends THREE.Material>(m: M, c: THREE.ColorRepresentation, k = 1) => { m.userData.night = new THREE.Color(c).multiplyScalar(k); return m; };

export const switchOf = (m: THREE.Material) => (m.userData.on ??= { value: 1 }) as THREE.IUniform<number>;

export const flat = <M extends THREE.Material>(m: M, t = 1) => { m.userData.flat = t; return m; };
