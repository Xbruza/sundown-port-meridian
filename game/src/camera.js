// Cameras: a spring-damped rear three-quarter chase camera with steering
// look-ahead and a speed pullback, and an over-the-shoulder camera on foot.
import * as THREE from 'three';
import { groundHeight } from './world.js';

// Per-shot camera override, set by shots.js staging and cleared between
// shots. Null means "use the normal rig numbers", so gameplay and the
// unstaged shots keep the standard chase/shoulder framing.
export const shotCam = { side: null, back: null, height: null, lookAhead: null, lookY: null, lookSide: null };

export function createCameraRig(camera) {
  const pos = new THREE.Vector3(-280, 26, 120);
  const look = new THREE.Vector3(0, 2, 0);
  let mode = 'chase';
  const modes = ['chase', 'far', 'shoulder'];
  let modeIndex = 0;

  function cycle() {
    modeIndex = (modeIndex + 1) % modes.length;
    mode = modes[modeIndex];
    return mode;
  }

  // Place the rig exactly where the chase camera belongs, with no lerp:
  // captures must never catch it halfway from its spawn position.
  function snap(target, heading, speed, onFoot, aimYaw) {
    const back = shotCam.back ?? (mode === 'far' ? 9.5 : mode === 'shoulder' ? 6.0 : 5.8);
    const height = shotCam.height ?? (mode === 'far' ? 3.4 : mode === 'shoulder' ? 2.4 : 2.6);
    const pull = 1 + Math.min(Math.abs(speed) / 60, 1) * 0.2;
    if (onFoot) {
      const a = aimYaw ?? heading;
      const fx = Math.sin(a);
      const fz = Math.cos(a);
      const rx = Math.cos(a);
      const rz = -Math.sin(a);
      const la = shotCam.lookAhead ?? 6;
      const ls = shotCam.lookSide ?? 0;
      pos.set(target.x - fx * back * 0.8 - rx * 1.1, groundHeight(target.x, target.z) + height, target.z - fz * back * 0.8 - rz * 1.1);
      look.set(target.x + fx * la + fz * ls, groundHeight(target.x, target.z) + (shotCam.lookY ?? 1.6), target.z + fz * la - fx * ls);
    } else {
      const bx = Math.cos(heading);
      const bz = -Math.sin(heading);
      const side = shotCam.side ?? 0.28;
      const ls = shotCam.lookSide ?? 0;
      pos.set(
        target.x - bx * back * pull + -bz * side * back,
        groundHeight(target.x, target.z) + height + Math.min(Math.abs(speed) / 60, 1) * 0.6,
        target.z - bz * back * pull + bx * side * back,
      );
      look.set(target.x + bx * (shotCam.lookAhead ?? 14) + bz * ls, groundHeight(target.x, target.z) + (shotCam.lookY ?? 2), target.z + bz * (shotCam.lookAhead ?? 14) - bx * ls);
    }
    camera.position.copy(pos);
    camera.lookAt(look);
  }

  function update(dt, target, heading, speed, onFoot, aimYaw) {
    const back = shotCam.back ?? (mode === 'far' ? 9.5 : mode === 'shoulder' ? 6.0 : 5.8);
    const height = shotCam.height ?? (mode === 'far' ? 3.4 : mode === 'shoulder' ? 2.4 : 2.6);
    const pull = 1 + Math.min(Math.abs(speed) / 60, 1) * 0.2;
    let desired;
    if (onFoot) {
      const a = aimYaw ?? heading;
      const fx = Math.sin(a);
      const fz = Math.cos(a);
      const rx = Math.cos(a);
      const rz = -Math.sin(a);
      const la = shotCam.lookAhead ?? 6;
      const ls = shotCam.lookSide ?? 0;
      desired = new THREE.Vector3(
        target.x - fx * back * 0.8 - rx * 1.1,
        groundHeight(target.x, target.z) + height,
        target.z - fz * back * 0.8 - rz * 1.1,
      );
      look.lerp(new THREE.Vector3(target.x + fx * la + fz * ls, groundHeight(target.x, target.z) + (shotCam.lookY ?? 1.6), target.z + fz * la - fx * ls), Math.min(1, dt * 8));
    } else {
      const bx = Math.cos(heading);
      const bz = -Math.sin(heading);
      const side = shotCam.side ?? 0.28;
      const ls = shotCam.lookSide ?? 0;
      desired = new THREE.Vector3(
        target.x - bx * back * pull + -bz * side * back,
        groundHeight(target.x, target.z) + height + Math.min(Math.abs(speed) / 60, 1) * 0.6,
        target.z - bz * back * pull + bx * side * back,
      );
      look.lerp(new THREE.Vector3(target.x + bx * (shotCam.lookAhead ?? 14) + bz * ls, groundHeight(target.x, target.z) + (shotCam.lookY ?? 2), target.z + bz * (shotCam.lookAhead ?? 14) - bx * ls), Math.min(1, dt * 6));
    }
    // Spring damping toward the desired spot; the chase rig follows tightly
    // so a fast car never shrinks to a dot at the end of a long leash.
    const k = 1 - Math.exp(-dt * (onFoot ? 10 : 12));
    pos.lerp(desired, k);
    const gy = groundHeight(pos.x, pos.z);
    if (pos.y < gy + 1.2) pos.y = gy + 1.2;
    camera.position.copy(pos);
    camera.lookAt(look);
  }
  return { update, cycle, snap, get mode() { return mode; } };
}
