// Nico Vale on foot: articulated character mesh, walk/run/sprint, jump,
// vehicle entry and exit, health and cash.
import * as THREE from 'three';
import { groundHeight } from './world.js';

export function buildCharacterMesh(jacket, pants) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.8 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.7 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.8 });
  // Local axes: +z is forward (rotation.y = heading maps +z onto the
  // walk direction), +x is the character's left-right. Limbs MUST sit
  // on x: the old build put arms and legs on z (fore-aft), so from the
  // behind-camera they overlapped into a single capsule column.
  // Tapered torso (narrow waist, broad shoulders) with a rounded shoulder
  // bar and a collar, so the figure reads as a person, not a box.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.78, 10), jacketMat);
  torso.scale.z = 0.62;
  torso.position.y = 1.25;
  torso.castShadow = true;
  g.add(torso);
  // Jacket back panel and shoulder yoke: a lighter panel down the back
  // and a stripe across the shoulders, so the back reads as clothing
  // with seams instead of one smooth capsule.
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.05), new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.7, emissive: jacket, emissiveIntensity: 0.12 }));
  backPanel.position.set(0, 1.28, -0.17);
  g.add(backPanel);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.06), new THREE.MeshStandardMaterial({ color: 0xeab38a, roughness: 0.8 }));
  yoke.position.set(0, 1.52, -0.16);
  g.add(yoke);
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.34, 4, 8), jacketMat);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = 1.58;
  shoulders.scale.z = 0.7;
  g.add(shoulders);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 10), new THREE.MeshStandardMaterial({ color: 0xeab38a, roughness: 0.8 }));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.66;
  g.add(collar);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.07, 10), darkMat);
  belt.scale.z = 0.62;
  belt.position.y = 0.88;
  g.add(belt);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.21, 0.08, 10), jacketMat);
  hem.scale.z = 0.62;
  hem.position.y = 0.93;
  g.add(hem);
  // Head: skin sphere, hair cap plus a hair mass at the back of the
  // head (visible from behind), nose and ears so the face direction
  // reads from the side as well as the front.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8), skin);
  neck.position.y = 1.7;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.86;
  head.castShadow = true;
  g.add(head);
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.9;
  g.add(hair);
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hairMat);
  hairBack.scale.set(0.95, 0.9, 0.75);
  hairBack.position.set(0, 1.84, -0.08);
  g.add(hairBack);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.08), skin);
  nose.position.set(0, 1.84, 0.22);
  g.add(nose);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), skin);
    ear.position.set(side * 0.21, 1.86, 0);
    g.add(ear);
  }
  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    // Arm on the character's side (x), hanging from the shoulder bar:
    // jacket sleeve, apricot cuff, skin hand with fingers below it.
    const arm = new THREE.Group();
    const am = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), jacketMat);
    am.position.y = -0.32;
    arm.add(am);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 8), new THREE.MeshStandardMaterial({ color: 0xeab38a, roughness: 0.8 }));
    cuff.position.y = -0.58;
    arm.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
    hand.position.y = -0.68;
    arm.add(hand);
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.06), skin);
    fingers.position.set(0, -0.79, 0.02);
    arm.add(fingers);
    arm.position.set(side * 0.44, 1.58, 0);
    arm.rotation.x = -0.08;
    arm.rotation.z = side * 0.12;
    g.add(arm);
    arms.push(arm);
    // Leg on the character's side (x): trouser leg, then a pale shoe
    // with the toe pointing forward (+z) and a dark sole, so the two
    // legs read as two legs with a gap between them from behind.
    const leg = new THREE.Group();
    const lm = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.55, 4, 8), pantsMat);
    lm.position.y = -0.4;
    leg.add(lm);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.36), shoeMat);
    shoe.position.set(0, -0.82, 0.06);
    leg.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.04, 0.37), soleMat);
    sole.position.set(0, -0.88, 0.06);
    leg.add(sole);
    leg.position.set(side * 0.17, 0.86, 0);
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, arms, legs, torso };
}

export function createPlayer(scene) {
  const { group, arms, legs } = buildCharacterMesh(0x3568a8, 0x2e2a30);
  scene.add(group);
  return {
    group, arms, legs,
    x: -290, z: 60, heading: 0, speed: 0,
    health: 100, cash: 250, inVehicle: null,
    vy: 0, grounded: true, walkPhase: 0,
    weapon: { name: 'PM-9 pistol', ammo: 12, reserve: 48, reloading: 0 },
  };
}

export function stepPlayer(p, dt, axis, sprint, jump, colliders) {
  if (p.inVehicle) return;
  const target = sprint ? 7.5 : axis.y !== 0 || axis.x !== 0 ? 4.2 : 0;
  const moving = axis.x !== 0 || axis.y !== 0;
  if (moving) {
    const wish = Math.atan2(-axis.x, axis.y);
    let dh = wish - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += dh * Math.min(1, dt * 10);
    p.speed += (target - p.speed) * Math.min(1, dt * 8);
  } else {
    p.speed += (0 - p.speed) * Math.min(1, dt * 10);
  }
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  p.x += fx * p.speed * dt;
  p.z += fz * p.speed * dt;
  for (const c of colliders) {
    if (c.half) {
      const dx = Math.max(Math.abs(p.x - c.x) - c.half.w, 0);
      const dz = Math.max(Math.abs(p.z - c.z) - c.half.d, 0);
      if (Math.hypot(dx, dz) < 0.8) {
        p.x += (p.x - c.x) * 0.02;
        p.z += (p.z - c.z) * 0.02;
      }
    } else {
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d < (c.r || 1) + 0.8 && d > 0.01) {
        p.x += ((p.x - c.x) / d) * 0.2;
        p.z += ((p.z - c.z) / d) * 0.2;
      }
    }
  }
  p.x = Math.max(-490, Math.min(490, p.x));
  p.z = Math.max(-490, Math.min(490, p.z));
  if (jump && p.grounded) { p.vy = 5.2; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= 14 * dt;
  }
  const gy = groundHeight(p.x, p.z);
  const y = (p.group.position.y || gy) + p.vy * dt;
  if (y <= gy) { p.group.position.y = gy; p.vy = 0; p.grounded = true; }
  else p.group.position.y = y;
  // Walk cycle: arms and legs swing with speed.
  p.walkPhase += p.speed * dt * 2.2;
  const swing = Math.min(1, p.speed / 5) * 0.65;
  p.legs[0].rotation.x = Math.sin(p.walkPhase) * swing;
  p.legs[1].rotation.x = -Math.sin(p.walkPhase) * swing;
  p.arms[0].rotation.x = -Math.sin(p.walkPhase) * swing * 0.8;
  p.arms[1].rotation.x = Math.sin(p.walkPhase) * swing * 0.8;
  p.group.position.x = p.x;
  p.group.position.z = p.z;
  p.group.rotation.y = p.heading;
}
