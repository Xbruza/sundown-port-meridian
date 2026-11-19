// Vehicles: curved car bodies built from extruded side profiles, separate
// wheels, lamps and cockpits, plus arcade driving physics with drift,
// collision response and a way out of the water.
import * as THREE from 'three';
import { PLAYER_CAR } from './config.js';
import { groundHeight } from './world.js';

function carBodyGeometry(kind) {
  // Side profile with rounded fenders, extruded across the car width.
  const s = new THREE.Shape();
  const L = kind === 'van' ? 5.6 : kind === 'suv' ? 5.0 : 4.6;
  const H = kind === 'van' ? 2.3 : kind === 'suv' ? 1.9 : 1.25;
  const half = L / 2;
  s.moveTo(-half, 0.35);
  s.lineTo(-half + 0.3, 0.32);
  s.quadraticCurveTo(-half + 0.9, 0.15, -half + 1.3, 0.55);
  s.lineTo(-half + 1.9, 0.6);
  if (kind === 'convertible') {
    s.lineTo(-half + 2.1, H - 0.25);
    s.lineTo(-half + 2.9, H - 0.2);
    s.lineTo(-half + 3.4, 0.62);
  } else if (kind === 'van' || kind === 'suv') {
    s.lineTo(-half + 1.0, H);
    s.lineTo(half - 0.9, H);
    s.lineTo(half - 0.4, 0.62);
  } else {
    s.lineTo(-half + 1.6, H - 0.15);
    s.lineTo(-half + 2.6, H);
    s.lineTo(half - 1.6, H - 0.05);
    s.lineTo(half - 0.7, 0.62);
  }
  s.lineTo(half - 0.3, 0.55);
  s.quadraticCurveTo(half - 0.1, 0.15, half - 0.5, 0.35);
  s.lineTo(half - 1.2, 0.3);
  s.quadraticCurveTo(half - 1.7, 0.12, half - 2.1, 0.32);
  s.lineTo(-half + 1.7, 0.3);
  s.quadraticCurveTo(-half + 1.2, 0.12, -half + 0.6, 0.35);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, steps: 1 });
  geo.translate(0, 0, -0.95);
  return { geo, length: L, height: H };
}

export function buildCarMesh(kind, color) {
  const group = new THREE.Group();
  const { geo, length, height } = carBodyGeometry(kind);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.16, metalness: 0.75 });
  const body = new THREE.Mesh(geo, paint);
  body.position.y = 0.35;
  body.castShadow = true;
  group.add(body);

  // Wheel-arch trims: curved fender lips over each wheel.
  const archGeo = new THREE.TorusGeometry(0.5, 0.07, 6, 12, Math.PI);
  for (const x of (kind === 'van' ? [-1.8, 1.8] : [-1.55, 1.55])) {
    for (const z of [-1.0, 1.0]) {
      const arch = new THREE.Mesh(archGeo, paint);
      arch.position.set(x, 0.44, z);
      group.add(arch);
    }
  }

  // Glasshouse: angled windshield and side glass; the convertible gets an
  // open cockpit instead, with tub, seats, dash, wheel and roll hoops.
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.1, metalness: 0.9 });
  if (kind !== 'convertible') {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(length * 0.42, height * 0.42, 1.7), glassMat);
    glass.position.set(-0.2, 0.35 + height * 0.72, 0);
    glass.rotation.z = 0.06;
    group.add(glass);
  } else {
    const tub = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.6), new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.9 }));
    tub.position.set(0.1, 0.95, 0);
    group.add(tub);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.6), new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 }));
    dash.position.set(1.0, 1.12, 0);
    group.add(dash);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 14), new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.7 }));
    wheel.position.set(0.72, 1.18, -0.45);
    wheel.rotation.y = Math.PI / 2;
    wheel.rotation.x = -0.5;
    group.add(wheel);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x4a2a24, roughness: 0.8 });
    for (const z of [-0.45, 0.45]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), seatMat);
      seat.position.set(-0.1, 1.15, z);
      seat.rotation.z = -0.18;
      group.add(seat);
      const rest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), seatMat);
      rest.position.set(-0.32, 1.55, z);
      rest.rotation.z = -0.18;
      group.add(rest);
    }
    const hoopGeo = new THREE.TorusGeometry(0.34, 0.05, 6, 12, Math.PI);
    for (const z of [-0.45, 0.45]) {
      const hoop = new THREE.Mesh(hoopGeo, paint);
      hoop.position.set(-0.55, 1.05, z);
      group.add(hoop);
    }
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 1.75), glassMat);
    shield.position.set(1.15, 1.28, 0);
    shield.rotation.z = -0.35;
    group.add(shield);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.9), paint);
    spoiler.position.set(-length / 2 + 0.15, 1.15, 0);
    group.add(spoiler);
    for (const z of [-0.8, 0.8]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.08), paint);
      fin.position.set(-length / 2 + 0.15, 0.95, z);
      group.add(fin);
    }
  }

  // Wheels with rims, tucked under the arches.
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, roughness: 0.25, metalness: 0.9 });
  const wheels = [];
  const wheelX = kind === 'van' ? [-1.8, 1.8] : [-1.55, 1.55];
  for (const x of wheelX) {
    for (const z of [-0.95, 0.95]) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18), tireMat);
      tire.rotation.x = Math.PI / 2;
      wheel.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10), rimMat);
      rim.rotation.x = Math.PI / 2;
      wheel.add(rim);
      wheel.position.set(x, 0.42, z);
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  // Rear haunches and sloped rear deck so the back reads as shaped
  // bodywork from the chase camera instead of one flat vertical face.
  for (const z of [-0.72, 0.72]) {
    const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), paint);
    haunch.scale.set(1.15, 0.55, 0.75);
    haunch.position.set(-length / 2 + 0.75, 0.95, z);
    group.add(haunch);
  }
  const deckPanel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.7), paint);
  deckPanel.position.set(-length / 2 + 1.15, 1.02, 0);
  deckPanel.rotation.z = 0.12;
  group.add(deckPanel);

  // Lamps: slim clusters. Headlamps up front, twin taillights with an
  // amber indicator each at the rear, a reflector strip, plate and bumper.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2211, emissiveIntensity: 1.2 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xaa6611, emissive: 0xff8811, emissiveIntensity: 1.0 });
  for (const z of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.36), headMat);
    head.position.set(length / 2 + 0.05, 0.88, z);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.34), tailMat);
    tail.position.set(-length / 2 - 0.04, 0.92, z);
    group.add(tail);
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.14), amberMat);
    ind.position.set(-length / 2 - 0.04, 0.92, z + (z < 0 ? -0.26 : 0.26));
    group.add(ind);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), paint);
    mirror.position.set(1.0, 1.05, z * 1.15);
    group.add(mirror);
  }
  const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0x881111, emissiveIntensity: 0.4 }));
  reflector.position.set(-length / 2 - 0.04, 0.78, 0);
  group.add(reflector);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.52), new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.4 }));
  plate.position.set(-length / 2 - 0.06, 0.62, 0);
  group.add(plate);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.9), new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.7 }));
  bumper.position.set(-length / 2 + 0.05, 0.5, 0);
  group.add(bumper);
  for (const z of [0.18, 0.52]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), rimMat);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-length / 2 - 0.1, 0.42, z);
    group.add(exhaust);
  }

  // Police two-tone: white doors, roof and trunk lid over the dark body,
  // so a cruiser reads as a black-and-white PMPD sedan.
  if (kind === 'police') {
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.4, metalness: 0.3 });
    for (const z of [-1.0, 1.0]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 0.05), white);
      door.position.set(-0.1, 0.82, z);
      group.add(door);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 1.75), white);
    roof.position.set(-0.2, 0.35 + height + 0.02, 0);
    group.add(roof);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.8), white);
    trunk.position.set(-length / 2 + 0.55, 0.99, 0);
    group.add(trunk);
    const rearBand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 1.8), white);
    rearBand.position.set(-length / 2 - 0.03, 0.72, 0);
    group.add(rearBand);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 1.1), rimMat);
    grille.position.set(length / 2 + 0.04, 0.62, 0);
    group.add(grille);
  }

  // Police light bar for cruisers.
  let lightBar = null;
  if (kind === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    red.position.z = -0.45;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: 0x0000aa, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.z = 0.45;
    const clear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0.6 }));
    lightBar.add(red, blue, clear);
    lightBar.position.set(-0.2, 0.35 + height + 0.14, 0);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  return { group, wheels, lightBar, length };
}

export function createVehicle(scene, opts) {
  const { group, wheels, lightBar, length } = buildCarMesh(opts.kind, opts.color);
  group.position.set(opts.x, groundHeight(opts.x, opts.z), opts.z);
  group.rotation.y = opts.heading ?? 0;
  scene.add(group);
  const v = {
    kind: opts.kind,
    color: opts.color,
    group, wheels, lightBar, length,
    x: opts.x, z: opts.z, heading: opts.heading ?? 0,
    speed: 0, steer: 0, health: 100, disabled: false,
    isPlayer: !!opts.isPlayer,
    lastSafe: { x: opts.x, z: opts.z },
    brakeLight: 0,
    ai: opts.ai ?? null,
  };
  return v;
}

function collide(v, colliders, others) {
  const r = v.length / 2;
  for (const c of colliders) {
    if (c.half) {
      const dx = Math.max(Math.abs(v.x - c.x) - c.half.w, 0);
      const dz = Math.max(Math.abs(v.z - c.z) - c.half.d, 0);
      const d = Math.hypot(dx, dz);
      if (d < r) {
        const push = r - d + 0.1;
        const nx = dx === 0 && dz === 0 ? 1 : (v.x - c.x) / Math.max(0.01, Math.hypot(v.x - c.x, v.z - c.z));
        const nz = dx === 0 && dz === 0 ? 0 : (v.z - c.z) / Math.max(0.01, Math.hypot(v.x - c.x, v.z - c.z));
        v.x += nx * push;
        v.z += nz * push;
        v.speed *= 0.55;
        v.health -= 3;
        return true;
      }
    } else {
      const d = Math.hypot(v.x - c.x, v.z - c.z);
      if (d < r + (c.r || 1)) {
        const push = r + (c.r || 1) - d + 0.1;
        const nx = (v.x - c.x) / Math.max(0.01, d);
        const nz = (v.z - c.z) / Math.max(0.01, d);
        v.x += nx * push;
        v.z += nz * push;
        v.speed *= 0.55;
        v.health -= 3;
        return true;
      }
    }
  }
  for (const o of others) {
    if (o === v || o.disabled) continue;
    const d = Math.hypot(v.x - o.x, v.z - o.z);
    const min = (v.length + o.length) / 2 - 0.4;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = (v.x - o.x) / d;
      const nz = (v.z - o.z) / d;
      v.x += nx * push;
      v.z += nz * push;
      o.x -= nx * push;
      o.z -= nz * push;
      o.group.position.set(o.x, groundHeight(o.x, o.z), o.z);
      o.group.rotation.y = o.heading;
      const s = v.speed;
      v.speed = o.speed * 0.5;
      o.speed = s * 0.5;
      v.health -= 2;
      o.health -= 2;
      return true;
    }
  }
  return false;
}

export function stepVehicle(v, dt, ctl, colliders, others) {
  if (v.disabled) return false;
  const t = PLAYER_CAR;
  const targetSteer = (ctl.steer || 0) * t.steerMax * (1 - Math.min(Math.abs(v.speed) / t.maxSpeed, 0.7) * 0.55);
  v.steer += (targetSteer - v.steer) * Math.min(1, dt * 9);
  const grip = ctl.handbrake ? t.handbrakeGrip : t.grip;
  const forward = { x: Math.cos(v.heading), z: -Math.sin(v.heading) };
  if (ctl.throttle) v.speed += t.accel * dt * (v.speed < 0 ? 2.2 : 1);
  if (ctl.brake) {
    if (v.speed > 0.5) v.speed -= t.brake * dt;
    else v.speed -= t.reverseAccel * dt;
  }
  if (ctl.handbrake && Math.abs(v.speed) > 2) {
    v.speed *= Math.max(0, 1 - dt * 1.4);
    v.heading += v.steer * dt * (v.speed > 0 ? 1 : -1) * 1.9;
  }
  v.speed -= v.speed * t.drag * dt * 0.12;
  if (!ctl.throttle && !ctl.brake) v.speed -= v.speed * dt * 0.6;
  v.speed = Math.max(-t.maxReverse, Math.min(t.maxSpeed, v.speed));
  v.heading += (v.steer * v.speed * dt) / Math.max(2.2, Math.abs(v.speed) * 0.45 + 1.6) * (v.speed >= 0 ? 1 : -1) * 1.15;
  const slip = Math.min(1, Math.abs(v.steer) * Math.abs(v.speed) / 30);
  const lat = { x: -forward.z, z: forward.x };
  const drift = ctl.handbrake ? slip * 0.5 : slip * 0.12;
  v.x += (forward.x * v.speed + lat.x * v.speed * drift) * dt;
  v.z += (forward.z * v.speed + lat.z * v.speed * drift) * dt;
  const hit = collide(v, colliders, others);
  // The bay starts west of the coastal highway: x < -315 is water. A car
  // in the water is winched back to its last safe road spot.
  if (v.x < -315 && groundHeight(v.x, v.z) < 1) {
    v.x = v.lastSafe.x;
    v.z = v.lastSafe.z;
    v.speed = 0;
    v.health -= 8;
  }
  if (v.x > 498) v.x = 498;
  if (v.x < -498) v.x = -498;
  if (v.z > 498) v.z = 498;
  if (v.z < -498) v.z = -498;
  const onRoad = Math.abs(v.x) < 470 && Math.abs(v.z) < 470;
  if (onRoad && Math.abs(v.speed) < 20) { v.lastSafe.x = v.x; v.lastSafe.z = v.z; }
  v.group.position.set(v.x, groundHeight(v.x, v.z), v.z);
  v.group.rotation.y = v.heading;
  v.group.rotation.z = -v.steer * Math.min(Math.abs(v.speed) / 40, 1) * 0.06;
  for (const w of v.wheels) w.rotation.z -= (v.speed * dt) / 0.42;
  if (v.health <= 0) {
    v.disabled = true;
    v.speed = 0;
  }
  return hit;
}

export function flashLightBar(v, t) {
  if (!v.lightBar) return;
  const phase = Math.floor(t * 6) % 2 === 0;
  v.lightBar.userData.red.material.emissiveIntensity = phase ? 3 : 0.2;
  v.lightBar.userData.blue.material.emissiveIntensity = phase ? 0.2 : 3;
}
