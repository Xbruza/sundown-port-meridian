// PMPD pursuit: one wanted-state system with pursuit, search and clear
// states across five levels, ground units that ram and intercept, roadblocks
// and a helicopter with a searchlight at the top levels.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { createVehicle, flashLightBar, stepVehicle } from './vehicles.js';

const UNIT_NAMES = ['M-04', 'M-11', 'M-17', 'M-23', 'M-31', 'M-42', 'M-55', 'T-02', 'T-07'];

export function createPolice(scene, random, colliders) {
  const units = [];
  let heli = null;
  let roadblock = [];
  let wanted = 0;
  let state = 'clear'; // clear | pursuit | search
  let stateTimer = 0;
  let lastKnown = { x: 0, z: 0 };
  let seenTimer = 0;

  function spawnUnit(i, near) {
    const name = UNIT_NAMES[i % UNIT_NAMES.length];
    // Spawn in a ring 70-120 m out so units arrive instead of boxing the car in.
    const ang = random.range(0, Math.PI * 2);
    const r = random.range(70, 120);
    const v = createVehicle(scene, {
      kind: 'police', color: 0x404654,
      x: near.x + Math.cos(ang) * r, z: near.z + Math.sin(ang) * r,
      heading: random.range(0, Math.PI * 2),
    });
    v.ai = { name, status: 'Pursuit', dist: 0 };
    units.push(v);
    return v;
  }
  function ensureUnits(near) {
    const want = WANTED.levels[wanted].units;
    while (units.length < want) spawnUnit(units.length, near);
    while (units.length > want) {
      const v = units.pop();
      v.group.visible = false;
      v.disabled = true;
    }
  }
  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 2.2), new THREE.MeshStandardMaterial({ color: 0x4a505c, roughness: 0.5, metalness: 0.5 }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x2a2d34 }));
    tail.position.set(-4.5, 0.3, 0);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 11), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    rotor.position.y = 1.2;
    g.add(rotor);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 2), new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.1, metalness: 0.9 }));
    glass.position.set(2.2, 0.2, 0);
    g.add(glass);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(7, 46, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(0, -23, 0);
    g.add(beam);
    const spot = new THREE.SpotLight(0xfff2b0, 120, 90, 0.35, 0.5, 1.2);
    spot.position.set(0, -1, 0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -46, 0);
    g.add(spotTarget);
    spot.target = spotTarget;
    g.add(spot);
    scene.add(g);
    return { group: g, rotor, beam, spot, x: 0, z: 0, y: 55 };
  }
  function makeRoadblock(near) {
    clearRoadblock();
    // Across the road ahead of the player, on their line of travel.
    const h = near.inVehicle ? near.inVehicle.heading : (near.heading ?? 0);
    const fx = Math.cos(h);
    const fz = -Math.sin(h);
    const rx = Math.sin(h);
    const rz = Math.cos(h);
    const cx = near.x + fx * 48;
    const cz = near.z + fz * 48;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -4.5 : 4.5;
      const v = createVehicle(scene, {
        kind: 'police', color: 0x404654,
        x: cx + rx * side, z: cz + rz * side, heading: h + Math.PI / 2,
      });
      v.ai = { name: i === 0 ? 'M-31' : 'M-42', status: 'Roadblock', dist: 0 };
      v.speed = 0;
      roadblock.push(v);
    }
  }
  function clearRoadblock() {
    for (const v of roadblock) { v.group.visible = false; v.disabled = true; }
    roadblock = [];
  }

  function setWanted(level, pos) {
    wanted = Math.max(0, Math.min(5, level));
    if (wanted > 0 && state === 'clear') { state = 'pursuit'; stateTimer = 0; }
    if (wanted === 0) { state = 'clear'; clearRoadblock(); if (heli) { heli.group.visible = false; heli = null; } }
    ensureUnits(pos || { x: 0, z: 0 });
    if (wanted >= 4 && !heli) { heli = makeHeli(); }
    if (wanted >= 3 && pos) makeRoadblock(pos);
    if (wanted < 3) clearRoadblock();
  }
  function addWanted(n, pos) { setWanted(wanted + n, pos); }

  function step(dt, playerPos, playerSpeed, others, t) {
    if (wanted === 0) return;
    const cfg = WANTED.levels[wanted];
    ensureUnits(playerPos);
    if (state === 'pursuit') {
      lastKnown = { x: playerPos.x, z: playerPos.z };
      seenTimer = 0;
      // Break contact when the player is far from every unit and moving slow through cover.
      let nearest = Infinity;
      for (const u of units) nearest = Math.min(nearest, Math.hypot(u.x - playerPos.x, u.z - playerPos.z));
      if (nearest > 130 && playerSpeed < 8) {
        seenTimer += dt;
        if (seenTimer > 4) { state = 'search'; stateTimer = WANTED.searchTime; }
      }
    } else if (state === 'search') {
      stateTimer -= dt;
      let nearest = Infinity;
      for (const u of units) nearest = Math.min(nearest, Math.hypot(u.x - lastKnown.x, u.z - lastKnown.z));
      if (nearest < 25) { state = 'pursuit'; stateTimer = 0; }
      if (stateTimer <= 0) { setWanted(0, playerPos); return; }
    }
    // Ground units chase the last known position, then the player.
    const target = state === 'search' ? lastKnown : playerPos;
    for (const u of units) {
      if (u.disabled) continue;
      const dx = target.x - u.x;
      const dz = target.z - u.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(-dz, dx);
      let dh = wantHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.8));
      const ram = d < 14 && Math.abs(dh) < 0.5;
      stepVehicle(u, dt, { throttle: 1, brake: 0, steer, handbrake: false }, colliders, others);
      if (Math.abs(u.speed) > 52) u.speed = 52 * Math.sign(u.speed);
      u.ai.dist = Math.round(Math.hypot(u.x - playerPos.x, u.z - playerPos.z));
      u.ai.status = ram ? 'Ramming' : state === 'search' ? 'Searching' : 'Pursuit';
      flashLightBar(u, t);
    }
    for (const v of roadblock) {
      v.ai.dist = Math.round(Math.hypot(v.x - playerPos.x, v.z - playerPos.z));
      flashLightBar(v, t);
    }
    if (cfg.heli && heli) {
      heli.group.visible = true;
      // Hover ahead and to the side of the player so the helicopter reads
      // in the chase frame instead of hiding directly overhead.
      const h = playerPos.heading ?? 0;
      const fx = Math.cos(h);
      const fz = -Math.sin(h);
      const rx = Math.sin(h);
      const rz = Math.cos(h);
      const base = state === 'search' ? lastKnown : playerPos;
      const tx = base.x + fx * 90 + rx * 35;
      const tz = base.z + fz * 90 + rz * 35;
      if (Math.hypot(tx - heli.x, tz - heli.z) > 25) { heli.x = tx; heli.z = tz; }
      else { heli.x += (tx - heli.x) * Math.min(1, dt * 0.5); heli.z += (tz - heli.z) * Math.min(1, dt * 0.5); }
      heli.y = 24 + Math.sin(t * 0.7) * 2;
      heli.group.position.set(heli.x, heli.y, heli.z);
      heli.group.rotation.y = t * 0.2;
      heli.rotor.rotation.y = t * 22;
      heli.beam.visible = state === 'search' || wanted >= 4;
      heli.beam.lookAt(playerPos.x, 0, playerPos.z);
    } else if (heli) {
      heli.group.visible = false;
    }
  }

  return {
    get wanted() { return wanted; },
    get state() { return state; },
    get units() { return units; },
    get roadblock() { return roadblock; },
    get heli() { return heli; },
    get lastKnown() { return lastKnown; },
    get searchTimer() { return Math.max(0, stateTimer); },
    setWanted, addWanted, step,
  };
}
