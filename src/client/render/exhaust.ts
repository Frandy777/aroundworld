import * as THREE from 'three';
import { U } from './light';

const PLUME = new THREE.PlaneGeometry(0.8, 1).translate(0, -0.5, 0);

// A GPU-animated plume, attached at the nozzle and pointing down local -Y.
// Only its width faces the camera: the length stays aligned with the missile.
export function exhaust(parent: THREE.Group, nozzle: number) {
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, power: { value: 0 }, plumeLength: { value: 1 }, uHd: U.uHd, uLamp: U.uLamp },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float plumeLength;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 axis = normalize(mat3(modelViewMatrix) * vec3(0., 1., 0.));
        vec2 side = vec2(axis.y, -axis.x);
        side = length(side) > .001 ? normalize(side) : vec2(1., 0.);
        vec4 p = modelViewMatrix * vec4(0., position.y * plumeLength, 0., 1.);
        p.xy += side * position.x * length(modelViewMatrix[0].xyz);
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform float time, power, uHd, uLamp;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                   mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
      }
      void main() {
        float t = 1. - vUv.y;
        float flow = noise(vec2(vUv.x * 7., t * 11. - time * 19.));
        float curl = sin(t * 19. - time * 27.) * .08 * t;
        float width = (.3 + sin(t * 3.14159) * .35) * (1. - t * .85);
        float r = abs((vUv.x - .5) * 2. + curl) / width;
        float envelope = (1. - smoothstep(.35, 1., r)) * (1. - smoothstep(.55, 1., t));
        float core = exp(-r * r * 8.) * (1. - t);
        float diamonds = pow(.5 + .5 * cos(t * 48. - time * 9.), 5.) * core;
        vec3 color = mix(vec3(.18, .5, 1.), vec3(1., .72, .28), smoothstep(.08, .6, t));
        color = mix(color, vec3(1., .98, .87), clamp(core + diamonds * .5, 0., 1.));
        gl_FragColor = vec4(color * (1.15 + (0.45 + 1.05 * uLamp) * uHd), envelope * (.65 + flow * .35) * power); // a restrained flash by day, HDR fire after dusk
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(PLUME, material); mesh.position.y = -nozzle;
  mesh.frustumCulled = false; // shader stretches the plane beyond its CPU bounds
  parent.add(mesh);
  return {
    update(time: number, power: number) {
      material.uniforms.time.value = time;
      material.uniforms.power.value = power;
      material.uniforms.plumeLength.value = (0.7 + power * 1.45) * (1 + 0.07 * Math.sin(time * 43));
    },
    dispose() { mesh.removeFromParent(); material.dispose(); },
  };
}
