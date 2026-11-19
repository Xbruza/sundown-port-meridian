// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, paused. ?seed=N fixes the city. ?shot=cover|foot|pursuit|harbor
// stages that scene from the real systems and sets window.__shotReady.
import * as THREE from 'three';
import { GARAGE, MARINA_LOT, MISSIONS, PROMENADE, STEP, TERMINAL } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_ENTER, ACTION_LIGHTS, ACTION_MISSION, ACTION_PAUSE, ACTION_RADIO, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { buildWorld, groundHeight } from './world.js';
import { createVehicle, flashLightBar, stepVehicle } from './vehicles.js';
import { createPlayer, stepPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createCameraRig } from './camera.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { clearSave, defaultSave, loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;
const random = createRandom(seed);

window.addEventListener('error', (e) => {
  const el = document.getElementById('game-error');
  if (el) el.textContent = `ERROR: ${e.message}`;
  window.__gameError = String(e.message);
});

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const scene = renderer.scene;
const world = buildWorld(scene, random);
const colliders = world.colliders;
const audio = createAudio();
const hud = createHud();
const minimap = createMinimap();
const cameraRig = createCameraRig(renderer.camera);
const input = createInput(canvas);
const missions = createMissions();
const combat = createCombat(scene);
const police = createPolice(scene, random, colliders);
const traffic = createTraffic(scene, random, colliders);
const pedestrians = createPedestrians(scene, random, 26);
const player = createPlayer(scene);

// Hero car: the blue Vela Mariner, parked at the marina lot at the start.
const heroCar = createVehicle(scene, { kind: 'convertible', color: 0x2f6bff, x: MARINA_LOT.x, z: MARINA_LOT.z, heading: Math.PI / 2, isPlayer: true });
heroCar.name = 'Vela Mariner';
// Mission actors.
const courier = createVehicle(scene, { kind: 'sedan', color: 0x8a8a92, x: 240, z: 180, heading: Math.PI });
courier.ai = { route: [[240, 180], [240, -140], [100, -140], [100, -300], [-40, -300], [-180, -300], [-300, -300], [-300, -460]], wp: 0, done: false };
const marked = createVehicle(scene, { kind: 'sedan', color: 0xc82a2a, x: 100, z: 20, heading: 0 });
marked.name = 'Rook Vantage';
const extract = createVehicle(scene, { kind: 'convertible', color: 0x2f6bff, x: TERMINAL.x - 10, z: TERMINAL.z + 6, heading: Math.PI / 2 });
extract.name = 'Extraction Mariner';
// Contact NPC for Low Tide, standing on the promenade.
const contact = pedestrians.peds[0];
contact.x = PROMENADE.x;
contact.z = PROMENADE.z;
contact.tx = PROMENADE.x;
contact.tz = PROMENADE.z;

const allVehicles = () => [heroCar, courier, marked, extract, ...traffic.cars, ...police.units, ...police.roadblock];

let screen = SCREEN_TITLE;
let elapsed = 0;
let saveTimer = 0;
let garageTimer = 0;
let hitCooldown = 0;
let headlights = false;
let shotFrames = 0;
let shotDrive = null;
let missionCtx = null;

function resetMissionActors(i) {
  heroCar.x = MARINA_LOT.x; heroCar.z = MARINA_LOT.z; heroCar.heading = Math.PI / 2; heroCar.speed = 0; heroCar.health = 100; heroCar.disabled = false;
  heroCar.group.position.set(heroCar.x, groundHeight(heroCar.x, heroCar.z), heroCar.z);
  courier.x = 240; courier.z = 180; courier.heading = Math.PI; courier.speed = 0; courier.health = 100; courier.disabled = false;
  courier.ai.wp = 0; courier.ai.done = false;
  marked.x = 100; marked.z = 20; marked.heading = 0; marked.speed = 0; marked.health = 100; marked.disabled = false;
  extract.x = TERMINAL.x - 10; extract.z = TERMINAL.z + 6; extract.speed = 0; extract.health = 100; extract.disabled = false;
  player.health = 100;
  if (i === 0) { player.x = MARINA_LOT.x + 6; player.z = MARINA_LOT.z + 4; player.inVehicle = null; }
  if (i === 4) { player.x = TERMINAL.x - 20; player.z = TERMINAL.z + 20; player.inVehicle = null; }
}

missionCtx = {
  player, heroCar, courier, marked, extract, police,
  resetMissionActors,
  tailFar: 0, tailNear: 0,
};

function saveGame() {
  writeSave({
    version: 1,
    missionIndex: missions.index,
    cash: player.cash,
    garage: [],
    station: 0,
    completed: [],
  });
}

function loadIntoGame(data) {
  if (!data) return;
  missions.index = data.missionIndex || 0;
  player.cash = data.cash || 250;
}

function nearestVehicle(maxD) {
  let best = null;
  let bestD = maxD;
  const px = player.x;
  const pz = player.z;
  for (const v of allVehicles()) {
    if (v.disabled || v === player.inVehicle) continue;
    const d = Math.hypot(v.x - px, v.z - pz);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

function enterVehicle(v) {
  const isTraffic = traffic.cars.includes(v) || v === marked;
  player.inVehicle = v;
  player.group.visible = false;
  v.isPlayer = true;
  if (isTraffic) {
    police.addWanted(1, player);
    hud.message('Car taken. PMPD has your description.');
    audio.mission();
  } else {
    hud.message(`${v.name || 'Car'} ready.`);
  }
  audio.click();
}

function exitVehicle() {
  const v = player.inVehicle;
  if (!v) return;
  player.inVehicle = null;
  player.group.visible = true;
  player.x = v.x + Math.sin(v.heading + Math.PI / 2) * 3;
  player.z = v.z + Math.cos(v.heading + Math.PI / 2) * 3;
  player.heading = v.heading;
  v.speed = 0;
  audio.click();
}

function announce(text) { status.textContent = text; }

function startGame(fresh) {
  if (fresh) {
    clearSave();
    missions.index = 0;
    missions.status = 'idle';
    player.cash = 250;
    player.health = 100;
    resetMissionActors(0);
    police.setWanted(0, player);
  }
  screen = SCREEN_PLAY;
  hud.showMenu(false);
  hud.showPause(false);
  audio.unlock();
  if (missions.status === 'idle') missions.start(missionCtx);
  announce('Playing. Follow the mission panel.');
}

function stepGame(dt) {
  elapsed += dt;
  const actions = input.takeActions();
  const aim = input.takeAim();
  if (!player.inVehicle) player.heading += aim.x * 0.004;

  if (actions & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; hud.showPause(true); }
    else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; hud.showPause(false); }
  }
  if (screen !== SCREEN_PLAY) return;

  if (actions & ACTION_CAMERA) cameraRig.cycle();
  if (actions & ACTION_RADIO) hud.message(`Radio: ${audio.cycleStation()}`);
  if (actions & ACTION_LIGHTS) { headlights = !headlights; hud.message(headlights ? 'Headlights on.' : 'Headlights off.'); }
  if (actions & ACTION_MISSION) {
    if (missions.status === 'done') { missions.next(missionCtx); hud.message(missions.status === 'active' ? `${missions.current.title} started.` : 'All jobs done. Free roam.'); }
    else if (missions.status === 'failed') { missions.retry(missionCtx); hud.message('Job restarted.'); audio.click(); }
    else if (missions.status === 'idle') { missions.start(missionCtx); hud.message(`${missions.current.title} started.`); }
  }
  if (actions & ACTION_RELOAD) {
    const w = player.weapon;
    if (w.reloading <= 0 && w.ammo < 12 && w.reserve > 0) {
      w.reloading = 1.2;
      hud.message('Reloading.');
    }
  }

  // Player / vehicle control.
  const axis = input.axis();
  if (player.inVehicle) {
    const v = player.inVehicle;
    const ctl = { throttle: input.throttle, brake: input.brake, steer: axis.x, handbrake: input.handbrake };
    // Screenshot mode: keep the car driving itself down the staged route.
    if (shot && shotDrive) {
      const dx = shotDrive.x - v.x;
      const dz = shotDrive.z - v.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(-dz, dx);
      let dh = want - v.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ctl.throttle = 1;
      ctl.steer = Math.max(-1, Math.min(1, dh * 1.8));
      // Hold a chase speed near 120 km/h and brake into the staged
      // framing instead of blowing past it.
      if (Math.abs(v.speed) > 33) ctl.throttle = 0;
      if (dist < 15) { ctl.throttle = 0; ctl.brake = 1; }
    }
    const hit = stepVehicle(v, dt, ctl, colliders, allVehicles());
    if (hit) audio.impact(Math.abs(v.speed) / 30);
    audio.engine(Math.abs(v.speed) / 62, input.throttle);
    audio.skid(input.handbrake && Math.abs(v.speed) > 12);
    if (actions & ACTION_ENTER) exitVehicle();
    // Garage: park the hero car inside the zone to store and repair it.
    if (v === heroCar && Math.hypot(v.x - GARAGE.x, v.z - GARAGE.z) < 14) {
      garageTimer += dt;
      if (garageTimer > 2) {
        garageTimer = 0;
        heroCar.health = 100;
        hud.message('Mariner stored in the garage and repaired.');
        saveGame();
      }
    } else garageTimer = 0;
  } else {
    stepPlayer(player, dt, { x: axis.x, y: axis.y }, input.sprint, input.keys.has('Space'), colliders);
    audio.engine(0, 0);
    if (actions & ACTION_ENTER) {
      const v = nearestVehicle(5);
      if (v) enterVehicle(v);
    }
    // Firing on foot.
    const w = player.weapon;
    if (w.reloading > 0) {
      w.reloading -= dt;
      if (w.reloading <= 0) {
        const need = 12 - w.ammo;
        const take = Math.min(need, w.reserve);
        w.ammo += take;
        w.reserve -= take;
      }
    }
    const firing = (actions & 256) || input.mouseDown;
    if (firing && w.reloading <= 0 && w.ammo > 0) {
      w.ammo -= 1;
      const dir = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
      const res = combat.fire({ x: player.x, z: player.z }, dir, [...police.units, ...traffic.cars], police, player);
      audio.gunshot();
      if (res.hit) hud.message('Hit. PMPD is closing in.');
    }
    // Hitting a pedestrian with the body raises heat.
    if (hitCooldown > 0) hitCooldown -= dt;
    for (const p of pedestrians.peds) {
      if (Math.hypot(p.x - player.x, p.z - player.z) < 1.2 && hitCooldown <= 0) {
        hitCooldown = 3;
        police.addWanted(1, player);
        hud.message('A pedestrian went down. Someone called it in.');
      }
    }
  }

  // Traffic, pedestrians, police, courier.
  traffic.step(dt, player, allVehicles());
  const danger = player.inVehicle ? { x: player.inVehicle.x, z: player.inVehicle.z, heading: player.inVehicle.heading } : { x: player.x, z: player.z, heading: player.heading };
  pedestrians.step(dt, player.inVehicle && Math.abs(player.inVehicle.speed) > 8 ? danger : null);

  // Courier drives its route on mission 3.
  if (missions.index === 2 && missions.status === 'active') {
    const route = courier.ai.route;
    const wp = route[courier.ai.wp];
    if (wp && !courier.ai.done) {
      const dx = wp[0] - courier.x;
      const dz = wp[1] - courier.z;
      const d = Math.hypot(dx, dz);
      if (d < 8) {
        courier.ai.wp++;
        if (courier.ai.wp >= route.length) courier.ai.done = true;
      } else {
        const want = Math.atan2(-dz, dx);
        let dh = want - courier.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        stepVehicle(courier, dt, { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, dh * 1.6)), handbrake: false }, colliders, allVehicles());
        if (Math.abs(courier.speed) > 13) courier.speed = 13 * Math.sign(courier.speed);
      }
    }
  }
  // Marked coupe cruises with traffic on mission 4.
  if (missions.index === 3 && missions.status === 'active' && !player.inVehicle) {
    stepVehicle(marked, dt, { throttle: 0.6, brake: 0, steer: Math.sin(elapsed * 0.2) * 0.3, handbrake: false }, colliders, allVehicles());
    if (Math.abs(marked.speed) > 12) marked.speed = 12 * Math.sign(marked.speed);
  }

  police.step(dt, danger, player.inVehicle ? Math.abs(player.inVehicle.speed) : Math.abs(player.speed), allVehicles(), elapsed);
  audio.siren(police.wanted > 0, elapsed);
  audio.rotor(!!police.heli, elapsed);

  // Missions.
  const prevStatus = missions.status;
  missions.update(dt, missionCtx);
  if (missions.status === 'done' && prevStatus === 'active') {
    audio.mission();
    hud.banner(`${missions.current.title} complete. +$${missions.current.cash}`);
    saveGame();
  } else if (missions.status === 'failed' && prevStatus === 'active') {
    audio.fail();
    hud.banner(`Job failed. ${missions.failReason}`);
  }

  combat.update(dt);
  world.update(elapsed, dt);

  // Camera, HUD, minimap.
  const focus = player.inVehicle || { x: player.x, z: player.z };
  const focusHeading = player.inVehicle ? player.inVehicle.heading : player.heading;
  const focusSpeed = player.inVehicle ? player.inVehicle.speed : player.speed;
  cameraRig.update(dt, focus, focusHeading, focusSpeed, !player.inVehicle, player.heading);
  const marker = missions.marker();
  const driving = !!player.inVehicle;
  hud.update(dt, {
    missionTitle: missions.status === 'idle' ? 'Free roam' : missions.current.title,
    objective: missions.objective(),
    missionSub: missions.status === 'active' ? `Job ${missions.index + 1} of ${MISSIONS.length} \u00b7 ${missions.current.brief}` : '',
    missionDone: missions.status === 'done',
    policeUnits: [...police.units, ...police.roadblock].filter((u) => !u.disabled).map((u) => ({ name: u.ai?.name || 'M-??', dist: u.ai?.dist ?? 0, status: u.ai?.status || 'Pursuit', x: u.x, z: u.z })),
    wanted: police.wanted,
    policeState: police.state,
    searchTimer: police.searchTimer,
    cash: player.cash,
    driving,
    kmh: Math.abs(focusSpeed) * 3.6,
    gear: driving ? Math.max(1, Math.min(6, Math.floor(Math.abs(focusSpeed) / 11) + 1)) : 1,
    hint: driving ? 'E exit \u00b7 Space handbrake \u00b7 Q radio \u00b7 M jobs' : 'E enter a car \u00b7 Click to fire \u00b7 R reload \u00b7 M jobs',
  });
  minimap.draw({
    playerX: focus.x, playerZ: focus.z, heading: focusHeading,
    marker, wanted: police.wanted,
    searchZone: police.wanted > 0 ? police.lastKnown : null,
    policeUnits: [...police.units, ...police.roadblock].filter((u) => !u.disabled),
  });

  // Autosave.
  saveTimer += dt;
  if (saveTimer > 10) { saveTimer = 0; saveGame(); }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = now - (frame.last || now);
  frame.last = now;
  const dt = Math.min(dtMs / 1000, MAX_FRAME);
  if (screen === SCREEN_PLAY || shot) {
    let acc = dt;
    let n = 0;
    while (acc >= STEP && n < 5) { stepGame(STEP); acc -= STEP; n++; }
  }
  renderer.render();
  if (shot) {
    shotFrames++;
    if (shotFrames < 3) {
      // Snap the chase camera into place on the first frames so a capture
      // never catches the rig mid-lerp from its spawn position.
      const focus2 = player.inVehicle || { x: player.x, z: player.z };
      cameraRig.update(5, focus2, player.inVehicle ? player.inVehicle.heading : player.heading, player.inVehicle ? player.inVehicle.speed : player.speed, !player.inVehicle, player.heading);
    }
    const focus3 = player.inVehicle || player;
    window.__shotState = { x: Math.round(focus3.x), z: Math.round(focus3.z), speed: Math.round(Math.abs(player.inVehicle ? player.inVehicle.speed : player.speed) * 10) / 10, wanted: police.wanted, cam: renderer.camera.position.toArray().map((v) => Math.round(v)), heroVisible: heroCar.group.visible, heroHealth: Math.round(heroCar.health), pHeading: Math.round(player.heading * 100) / 100, camMode: cameraRig.mode, pGroup: player.group.position.toArray().map((v) => Math.round(v * 10) / 10), pVis: player.group.visible, contact: pedestrians.peds[0] ? [Math.round(pedestrians.peds[0].x), Math.round(pedestrians.peds[0].z)] : null, heli: police.heli ? [Math.round(police.heli.x), Math.round(police.heli.y), Math.round(police.heli.z), police.heli.group.visible] : null, roadblock: police.roadblock.map((v) => [Math.round(v.x), Math.round(v.z), v.group.visible]) };
    const sr = document.getElementById('shot-ready');
    if (sr) sr.textContent = JSON.stringify(window.__shotState);
    if (shotFrames === 12) {
      window.__shotReady = true;
      const el = document.getElementById('shot-ready');
      if (el) el.textContent = 'ready';
    }
  }
}

function runShot(name) {
  screen = SCREEN_PLAY;
  hud.showMenu(false);
  hud.showPause(false);
  const shotGame = {
    player, heroCar, courier, marked, extract, police, missions, missionCtx,
    resetMissionActors, traffic, pedestrians, contact,
  };
  const staged = stageShot(name, shotGame);
  if (staged.fov) {
    renderer.camera.fov = staged.fov;
    renderer.camera.updateProjectionMatrix();
  }
  shotDrive = shotGame.shotDrive || null;
  // Snap the camera onto the staged framing before the first painted frame.
  const focus = player.inVehicle || { x: player.x, z: player.z };
  cameraRig.snap(focus, player.inVehicle ? player.inVehicle.heading : player.heading, player.inVehicle ? player.inVehicle.speed : 0, !player.inVehicle, player.heading);
  announce(`Shot ${name} staged.`);
  requestAnimationFrame(frame);
}

function runGame() {
  const saved = loadSave();
  if (saved) loadIntoGame(saved);
  hud.onStart(() => startGame(true));
  hud.onContinue(() => startGame(false));
  hud.onReset(() => startGame(true));
  hud.onResume(() => { screen = SCREEN_PLAY; hud.showPause(false); });
  hud.onQuit(() => { screen = SCREEN_TITLE; hud.showPause(false); hud.showMenu(true); saveGame(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; hud.showPause(true); }
  });
  canvas.addEventListener('click', () => { if (screen === SCREEN_PLAY && !player.inVehicle) input.lockPointer(); });
  hud.showMenu(true);
  announce('SUNDOWN: Port Meridian. Press Start to drive.');
  requestAnimationFrame(frame);
}

window.__gameDebug = { scene, heroCar, player, police, camera: renderer.camera };

if (shot) runShot(shot);
else runGame();
