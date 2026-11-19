// Screenshot scenes. Each one stages the real game at a real place with
// the real systems running (wanted level, police, mission, HUD), then the
// main loop keeps driving it, so the frame is what play looks like.
import { GARAGE, PROMENADE } from './config.js';
import { groundHeight } from './world.js';
import { shotCam } from './camera.js';

function clearShotCam() {
  shotCam.side = null;
  shotCam.back = null;
  shotCam.height = null;
  shotCam.lookAhead = null;
  shotCam.lookY = null;
  shotCam.lookSide = null;
}

function placeCar(car, x, z, heading, speed) {
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.health = 100;
  car.disabled = false;
  car.group.visible = true;
  car.group.position.set(x, groundHeight(x, z), z);
  car.group.rotation.y = heading;
}

function placePlayer(player, x, z, heading) {
  player.x = x;
  player.z = z;
  player.heading = heading;
  player.speed = 0;
  player.health = 100;
  player.inVehicle = null;
  player.group.visible = true;
  player.group.position.set(x, groundHeight(x, z), z);
  player.group.rotation.y = heading;
}

export function stageShot(name, game) {
  const { player, heroCar, police, missions, missionCtx } = game;
  // Clear any pursuit from a previous stage.
  police.setWanted(0, player);
  clearShotCam();
  let fov = null;
  if (name === 'cover') {
    // Sunset coastal highway chase, five stars, mission 8 running.
    // Same framing as the 03 pursuit shot (proven to show the chase):
    // rear three-quarter camera dead behind the car, looking straight
    // north up the highway, so the road ahead, the roadblock pair and
    // the helicopter all fall inside the frame. The old cover looked
    // north-west across the car (lookSide 8), which pushed the road
    // ahead and the helicopter out of frame.
    shotCam.side = 0.28;
    shotCam.back = 6.2;
    shotCam.height = 2.4;
    shotCam.lookAhead = 16;
    shotCam.lookY = 1.8;
    shotCam.lookSide = 0;
    fov = 58;
    missions.index = 7;
    missions.status = 'idle';
    missions.start(missionCtx);
    placeCar(heroCar, -300, 90, Math.PI / 2, 33);
    player.inVehicle = heroCar;
    player.group.visible = false;
    heroCar.isPlayer = true;
    // Pass the hero car (not a bare {x, z}) so the roadblock lands 48 m
    // ahead ON the road, across both lanes, and the helicopter hovers
    // ahead-east of the chase — the pair that reads as the flanking
    // cruisers in shot 03. A bare position defaults heading to 0 and
    // drops the roadblock 48 m east, off the road.
    police.setWanted(5, heroCar);
    // Two cruisers ahead in the adjacent lanes, closing slowly: one in
    // the east lane near the car's rear quarter line, a second farther
    // along the curve in the west lane. Slow entry speeds keep them
    // from ramming the hero before the capture frame. The rest trail
    // behind for the HUD count.
    // (Round 1 fix: the ahead-staged units U-turned into the hero and
    // crowded the frame — M-04 ramming at 7 m. The 03 composition works
    // because every pursuit unit starts BEHIND the hero and the visible
    // pair is the roadblock, so the cover stages the same way: all five
    // units trail south of the hero, out of frame at capture, and the
    // roadblock pair 48 m ahead is the in-frame cruiser pair.)
    const staged = [[-288, 130, 30], [-312, 148, 28], [-296, 170, 28], [-284, 192, 26], [-304, 212, 24]];
    police.units.forEach((u, i) => {
      const s = staged[i % staged.length];
      placeCar(u, s[0], s[1], Math.PI / 2, s[2]);
    });
    game.shotDrive = { x: -300, z: -400 };
  } else if (name === 'foot') {
    // Marina promenade, Low Tide contact, no heat. The player faces north
    // along the promenade so the chase camera stays west of the seawall
    // at x=-258 instead of being buried in it.
    missions.index = 1;
    missions.status = 'idle';
    missions.start(missionCtx);
    placePlayer(player, PROMENADE.x, PROMENADE.z + 20, Math.PI);
    // Hero car parked ahead-right of the player, in frame at the right curb.
    placeCar(heroCar, PROMENADE.x + 8, PROMENADE.z - 22, Math.PI / 2, 0);
    game.contact.x = PROMENADE.x;
    game.contact.z = PROMENADE.z;
    game.contact.tx = PROMENADE.x;
    game.contact.tz = PROMENADE.z;
    game.contact.heading = 0;
    game.contact.stay = true;
    game.shotDrive = null;
  } else if (name === 'pursuit') {
    // Bridge approach at dusk, five stars, roadblock ahead.
    missions.index = 6;
    missions.status = 'idle';
    missions.start(missionCtx);
    placeCar(heroCar, -300, -340, Math.PI / 2, 26);
    player.inVehicle = heroCar;
    player.group.visible = false;
    heroCar.isPlayer = true;
    police.setWanted(5, heroCar);
    const staged = [[-288, -300, 24], [-312, -282, 22], [-296, -260, 24], [-284, -240, 22], [-308, -220, 20]];
    police.units.forEach((u, i) => {
      const s = staged[i % staged.length];
      placeCar(u, s[0], s[1], Math.PI / 2, s[2]);
    });
    game.shotDrive = { x: -300, z: -460 };
  } else {
    // Harbor terminal extraction, Gate Receipt, two stars, search state.
    // Staged on the quay apron: the player stands just west of the stepped
    // quay facing south down its length, so the quay edge and harbor water
    // run down the left of the frame, the tug and its wake sit left-center
    // out in the basin, the crane boom stands ahead, and the extraction car
    // waits ahead-right by the quay.
    missions.index = 4;
    missions.status = 'idle';
    missions.start(missionCtx);
    shotCam.back = 5.0;
    shotCam.height = 3.0;
    shotCam.lookAhead = 12;
    placePlayer(player, 376, 230, 0);
    // Extraction car ahead-right, hard by the quay.
    placeCar(game.extract, 360, 258, -Math.PI / 2, 0);
    police.setWanted(2, { x: 376, z: 230 });
    const [u1] = police.units;
    if (u1) placeCar(u1, 330, 265, -Math.PI / 2, 6);
    game.shotDrive = null;
  }
  return { screen: 'play', fov };
}
