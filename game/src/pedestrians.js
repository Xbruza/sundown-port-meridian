// Pedestrians: sidewalk walkers with crossings and a flee reaction to
// nearby danger. Articulated meshes with readable walk and run poses.
import { buildCharacterMesh } from './player.js';

const SHIRTS = [0xc8a03a, 0x7a3a4a, 0x3a6a8a, 0x8a8a92, 0x4a7a3a, 0xa85a2a];
const PANTS = [0x2a2a34, 0x4a3a2a, 0x3a3a4a];

export function createPedestrians(scene, random, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const { group, arms, legs } = buildCharacterMesh(random.pick(SHIRTS), random.pick(PANTS));
    const scale = random.range(0.92, 1.06);
    group.scale.setScalar(scale);
    scene.add(group);
    const x = random.range(-280, 380);
    const z = random.range(-440, 440);
    peds.push({
      group, arms, legs,
      x, z, heading: random.range(0, Math.PI * 2),
      speed: random.range(1.1, 1.9), phase: random.range(0, 6),
      flee: 0, tx: x + random.range(-60, 60), tz: z + random.range(-60, 60),
    });
  }
  function step(dt, danger) {
    for (const p of peds) {
      // A staged contact (Low Tide) holds position instead of wandering.
      if (p.stay) { p.group.position.set(p.x, 0, p.z); p.group.rotation.y = p.heading; continue; }
      let speed = p.speed;
      if (danger) {
        const d = Math.hypot(p.x - danger.x, p.z - danger.z);
        if (d < 26) {
          p.flee = 2.5;
          p.tx = p.x + ((p.x - danger.x) / Math.max(1, d)) * 60;
          p.tz = p.z + ((p.z - danger.z) / Math.max(1, d)) * 60;
        }
      }
      if (p.flee > 0) { p.flee -= dt; speed = 5.2; }
      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        p.tx = p.x + (Math.random() - 0.5) * 120;
        p.tz = p.z + (Math.random() - 0.5) * 120;
      } else {
        const want = Math.atan2(-dz, dx) + Math.PI / 2;
        let dh = want - p.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        p.heading += dh * Math.min(1, dt * 4);
      }
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      p.x = Math.max(-290, Math.min(400, p.x));
      p.z = Math.max(-470, Math.min(470, p.z));
      p.phase += speed * dt * 2.4;
      const swing = 0.55;
      p.legs[0].rotation.x = Math.sin(p.phase) * swing;
      p.legs[1].rotation.x = -Math.sin(p.phase) * swing;
      p.arms[0].rotation.x = -Math.sin(p.phase) * swing * 0.8;
      p.arms[1].rotation.x = Math.sin(p.phase) * swing * 0.8;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.heading;
    }
  }
  return { peds, step };
}
