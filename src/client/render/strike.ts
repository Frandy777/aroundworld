import * as THREE from 'three';
import { exhaust } from './exhaust';
import { flight } from './flight';
import { LOT, PAD, POS } from './layout';
import { LAMP, glow, lamps } from './light';
import { LAUNCH_PAD, MISSILE_LENGTH, MISSILE_SCALE, missile } from './models/missile';
import { scene, tween } from './scene';

const UP = new THREE.Vector3(0, 1, 0);
const IGNITION_TIME = 0.24, BLAST_TIME = 1.3;
const SMOKE_COUNT = 36, SMOKE_STEP = 0.035, SMOKE_LIFE = SMOKE_COUNT * SMOKE_STEP;
const CUBE = new THREE.BoxGeometry(1, 1, 1);
const PUFF = new THREE.IcosahedronGeometry(1, 1);
const RING = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
const FLASH = new THREE.IcosahedronGeometry(1, 1);

const launchPoint = (i: number) => POS[i].clone().add(new THREE.Vector3(LOT.x + LAUNCH_PAD.x, PAD.h + LAUNCH_PAD.y + MISSILE_LENGTH * MISSILE_SCALE, LOT.z + LAUNCH_PAD.z));
const impactPoint = (i: number) => POS[i].clone().add(new THREE.Vector3(LOT.x, PAD.h + 0.35, LOT.z));

export async function strike(from: number, to: number, start = launchPoint(from), end = impactPoint(to)) {
  const plan = flight(start, end), impactTime = IGNITION_TIME + plan.duration, total = impactTime + BLAST_TIME;
  const rocket = new THREE.Group(); rocket.scale.setScalar(MISSILE_SCALE); rocket.position.copy(start);
  missile(rocket);
  const flame = exhaust(rocket, MISSILE_LENGTH);
  const effects = new THREE.Group(), owned: THREE.Material[] = [];
  const material = (color: number, additive = false) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    if (additive) glow(m);
    owned.push(m); return m;
  };
  const puffs = (count: number, color: number) => Array.from({ length: count }, (_, i) => {
    const mesh = new THREE.Mesh(PUFF, material(color)); mesh.visible = false;
    mesh.rotation.set(i * 1.7, i * 2.4, i * 0.8); effects.add(mesh); return mesh;
  });
  const smoke = puffs(SMOKE_COUNT, 0xd5dce1);
  const launchDust = puffs(10, 0xc6cdd1), impactDust = puffs(14, 0x8a929e);
  const ground = start.clone(); ground.y -= MISSILE_LENGTH * MISSILE_SCALE;
  const aimMaterial = material(0xe8bf69);
  const aim = new THREE.Mesh(RING, aimMaterial); aim.position.copy(end); aim.position.y -= 0.25;
  effects.add(aim);
  const blast = new THREE.Group(); blast.position.copy(end); blast.visible = false; effects.add(blast);
  const flashMaterial = material(0xffefbc, true);
  const flash = new THREE.Mesh(FLASH, flashMaterial); flash.position.y = 0.3; blast.add(flash);
  const sparkMaterial = material(0xffd788, true);
  const sparks = Array.from({ length: 16 }, (_, i) => {
    const mesh = new THREE.Mesh(CUBE, sparkMaterial), angle = i * 2.399, speed = 1.2 + (i % 4) * 0.4;
    blast.add(mesh);
    return { mesh, velocity: new THREE.Vector3(Math.cos(angle) * speed, 1.8 + (i % 3) * 0.6, Math.sin(angle) * speed) };
  });
  const ringMaterial = material(0xffdc95, true);
  const ring = new THREE.Mesh(RING, ringMaterial); ring.position.y = -0.25; blast.add(ring);
  scene.add(rocket, effects);

  const p = new THREE.Vector3(), v = new THREE.Vector3(), tp = new THREE.Vector3(), tv = new THREE.Vector3();
  const fire = lamps[LAMP.strike]; fire.distance = 24; // HD-2D: the flame lights the board as it flies, and the blast flashes it
  const cloud = (meshes: typeof smoke, origin: THREE.Vector3, age: number, duration: number, spread: number) => {
    const q = THREE.MathUtils.clamp(age / duration, 0, 1);
    meshes.forEach((mesh, i) => {
      mesh.visible = age >= 0 && q < 1;
      if (!mesh.visible) return;
      const a = i * 2.399, radius = (0.15 + Math.sqrt(q) * spread) * (0.7 + (i % 3) * 0.15);
      mesh.position.set(origin.x + Math.cos(a) * radius, origin.y + 0.1 + q * (0.45 + (i % 3) * 0.2), origin.z + Math.sin(a) * radius);
      mesh.scale.setScalar(0.1 + Math.sqrt(q) * (0.45 + (i % 3) * 0.1));
      mesh.scale.y *= 0.65;
      mesh.material.opacity = 0.48 * Math.min(1, q * 12) * (1 - q) ** 2;
    });
  };
  try {
    await tween(total, (k) => {
      const time = k * total, flightTime = Math.max(0, time - IGNITION_TIME), hit = time - impactTime;
      cloud(launchDust, ground, time, 1.6, 1.5);
      cloud(impactDust, end, hit - 0.05, BLAST_TIME - 0.05, 2);
      // Fixed birth times keep smoke in world space, including the residual trail after impact.
      smoke.forEach((mesh, i) => {
        const slot = i * SMOKE_STEP;
        const cycle = Math.floor((flightTime - slot) / SMOKE_LIFE);
        const born = slot + cycle * SMOKE_LIFE, age = flightTime - born;
        mesh.visible = cycle >= 0 && born < plan.duration && time >= IGNITION_TIME;
        if (!mesh.visible) return;
        plan.at(born, tp, tv);
        if (tv.lengthSq() < 1e-8) tv.copy(UP); else tv.normalize();
        mesh.position.copy(tp).addScaledVector(tv, -MISSILE_LENGTH * MISSILE_SCALE);
        mesh.position.x += Math.sin(i * 2.399) * age * 0.18;
        mesh.position.z += Math.cos(i * 2.399) * age * 0.18;
        mesh.position.y += age * 0.28;
        mesh.scale.setScalar(0.06 + age * 0.24);
        mesh.material.opacity = 0.3 * Math.min(1, age / 0.1) * (1 - age / SMOKE_LIFE) ** 2;
      });
      rocket.visible = hit < 0;
      aim.visible = hit < 0;
      blast.visible = hit >= 0;
      if (hit < 0) {
        plan.at(flightTime, p, v);
        rocket.position.copy(p);
        rocket.quaternion.setFromUnitVectors(UP, v.lengthSq() > 1e-8 ? v.normalize() : UP);
        const ignition = THREE.MathUtils.smoothstep(time, 0, IGNITION_TIME);
        const sustain = THREE.MathUtils.smoothstep(flightTime, plan.boost - 0.2, plan.boost + 0.3);
        const terminal = THREE.MathUtils.smoothstep(flightTime, plan.boost + plan.coast - 0.15, plan.boost + plan.coast + 0.2);
        const dive = THREE.MathUtils.clamp((flightTime - plan.boost - plan.coast) / plan.terminal, 0, 1);
        flame.update(time, ignition * (1 - 0.4 * sustain + 0.25 * terminal + 0.45 * dive ** 2));
        fire.position.copy(p); fire.color.setHex(0xffa860); fire.intensity = 26 * ignition;
        aim.scale.setScalar(0.8 + 0.07 * Math.sin(time * 8));
        aimMaterial.opacity = Math.min(1, flightTime / plan.duration * 2) * (0.22 + terminal * 0.3);
        return;
      }
      const q = Math.min(1, hit / BLAST_TIME), fade = 1 - q;
      const flashAge = Math.min(1, hit / 0.3);
      flash.visible = flashAge < 1;
      flash.scale.setScalar(0.3 + Math.sin(flashAge * Math.PI / 2) * 1.7);
      flashMaterial.opacity = (1 - flashAge) ** 2;
      fire.position.copy(end); fire.position.y += 1.2; fire.color.setHex(0xffd08a); fire.intensity = 150 * (1 - flashAge) ** 2 + 40 * fade ** 2;
      sparkMaterial.opacity = fade ** 2;
      sparks.forEach(({ mesh, velocity }, i) => {
        mesh.position.copy(velocity).multiplyScalar(hit);
        mesh.position.y = Math.max(-0.2, mesh.position.y - 3.8 * hit * hit);
        mesh.scale.set(0.045 * fade, (0.16 + (i % 3) * 0.05) * fade, 0.045 * fade);
        mesh.rotation.set(hit * (i + 1), hit * i * 0.7, i);
      });
      const shock = Math.min(1, hit / 0.7);
      ring.scale.setScalar(0.2 + (1 - (1 - shock) ** 3) * 3.2);
      ringMaterial.opacity = 0.7 * (1 - shock) ** 2;
    });
  } finally {
    fire.intensity = 0;
    scene.remove(rocket, effects);
    flame.dispose();
    owned.forEach((m) => m.dispose());
  }
}
