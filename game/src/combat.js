// Combat: a compact hitscan pistol with aim, ammo, reload and hit feedback.
// Witnessed shooting raises the wanted level, so gunfire has a cost.
import * as THREE from 'three';

export function createCombat(scene) {
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
  let tracer = null;
  let tracerLife = 0;

  function fire(from, dir, targets, police, playerPos) {
    // Find the closest target inside a narrow cone ahead.
    let best = null;
    let bestD = 60;
    for (const t of targets) {
      if (t.disabled) continue;
      const dx = t.x - from.x;
      const dz = t.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > 60 || d < 1) continue;
      const dot = (dx * dir.x + dz * dir.z) / d;
      if (dot < 0.92) continue;
      if (d < bestD) { bestD = d; best = t; }
    }
    const end = best
      ? { x: best.x, z: best.z }
      : { x: from.x + dir.x * 60, z: from.z + dir.z * 60 };
    if (tracer) scene.remove(tracer);
    const len = Math.hypot(end.x - from.x, end.z - from.z);
    tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 5), tracerMat);
    tracer.position.set((from.x + end.x) / 2, 1.3, (from.z + end.z) / 2);
    tracer.rotation.z = Math.PI / 2;
    tracer.rotation.y = -Math.atan2(end.z - from.z, end.x - from.x);
    scene.add(tracer);
    tracerLife = 0.09;
    if (best) {
      best.health -= 34;
      if (best.health <= 0) best.disabled = true;
      if (police) police.addWanted(1, playerPos);
      return { hit: true, target: best };
    }
    if (police) police.addWanted(1, playerPos);
    return { hit: false, target: null };
  }

  function update(dt) {
    if (tracer && tracerLife > 0) {
      tracerLife -= dt;
      if (tracerLife <= 0) { scene.remove(tracer); tracer = null; }
    }
  }
  return { fire, update };
}
