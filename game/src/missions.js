// Story missions: eight jobs in order, each a short list of steps with a
// live objective, a marker, a completion check and a fail check. Retrying a
// mission restores its actors and its starting step without duplicating pay.
import { GARAGE, MARINA_LOT, MISSIONS, PROMENADE, TERMINAL } from './config.js';

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function createMissions() {
  let index = 0; // 0-based into MISSIONS
  let step = 0;
  let status = 'idle'; // idle | active | done | failed
  let failReason = '';
  let timer = 0;

  function def() { return MISSIONS[index]; }

  // Step builders. Each step: { text, marker, check(ctx) -> 'done' | 'fail' | null }
  function stepsFor(i, ctx) {
    const hero = ctx.heroCar;
    switch (i) {
      case 0: return [
        { text: 'Get to the marina lot and take the blue Vela Mariner', marker: MARINA_LOT, check: (c) => c.player.inVehicle === c.heroCar ? 'done' : null },
        { text: 'Bring the Mariner to the garage in Palmetto Heights', marker: GARAGE, check: (c) => c.player.inVehicle === c.heroCar && dist(c.heroCar, GARAGE) < 16 ? 'done' : null },
      ];
      case 1: return [
        { text: 'Meet Tide on foot along the marina promenade', marker: PROMENADE, check: (c) => !c.player.inVehicle && dist(c.player, PROMENADE) < 6 ? 'done' : null },
        { text: 'Carry the package back to the car', marker: () => ({ x: hero.x, z: hero.z }), check: (c) => c.player.inVehicle ? 'done' : null },
        { text: 'Drive the package to the garage', marker: GARAGE, check: (c) => dist(c.heroCar, GARAGE) < 16 ? 'done' : null },
      ];
      case 2: return [
        { text: 'Tail the harbor courier over the north bridge. Keep your distance', marker: () => ({ x: ctx.courier.x, z: ctx.courier.z }), check: (c) => {
          const d = dist(c.playerCar || c.player, c.courier);
          if (c.courier.done) return 'done';
          if (d > 95) { c.tailFar = (c.tailFar || 0) + 1 / 60; if (c.tailFar > 5) return 'fail'; }
          else c.tailFar = 0;
          if (d < 8) { c.tailNear = (c.tailNear || 0) + 1 / 60; if (c.tailNear > 3) return 'fail'; }
          else c.tailNear = 0;
          return null;
        } },
      ];
      case 3: return [
        { text: 'Take the marked Rook Vantage from traffic', marker: () => ({ x: ctx.marked.x, z: ctx.marked.z }), check: (c) => c.player.inVehicle === c.marked ? 'done' : null },
        { text: 'Deliver the Vantage to the garage, in one piece', marker: GARAGE, check: (c) => {
          if (c.marked.health < 40) return 'fail';
          return c.player.inVehicle === c.marked && dist(c.marked, GARAGE) < 16 ? 'done' : null;
        } },
      ];
      case 4: return [
        { text: 'Enter the port terminal on foot and find the manifest', marker: TERMINAL, check: (c) => !c.player.inVehicle && dist(c.player, TERMINAL) < 7 ? 'done' : null },
        { text: 'Cross the quay to the extraction car', marker: () => ({ x: ctx.extract.x, z: ctx.extract.z }), check: (c) => c.player.inVehicle === c.extract ? 'done' : null },
        { text: 'Drive clear of the terminal', marker: GARAGE, check: (c) => dist(c.player, GARAGE) < 60 ? 'done' : null },
      ];
      case 5: return [
        { text: 'Move the manifest to the Glasswater contact. The direct ramp is blocked', marker: { x: 180, z: -60 }, check: (c) => dist(c.playerCar || c.player, { x: 180, z: -60 }) < 14 ? 'done' : null },
      ];
      case 6: return [
        { text: 'Leave the waterfront and lose the helicopter', marker: GARAGE, check: (c) => c.police.wanted === 0 ? 'done' : null },
        { text: 'Reach the garage once the search clears', marker: GARAGE, check: (c) => dist(c.playerCar || c.player, GARAGE) < 16 ? 'done' : null },
      ];
      case 7: return [
        { text: 'Deliver the final cargo to the harbor handoff at five stars', marker: { x: 330, z: 300 }, check: (c) => dist(c.playerCar || c.player, { x: 330, z: 300 }) < 16 ? 'done' : null },
        { text: 'Shake the pursuit before the handoff closes', marker: GARAGE, check: (c) => c.police.wanted === 0 && dist(c.playerCar || c.player, GARAGE) < 20 ? 'done' : null },
      ];
      default: return [];
    }
  }

  let steps = [];
  function start(ctx) {
    steps = stepsFor(index, ctx);
    step = 0;
    status = 'active';
    failReason = '';
    timer = 0;
    if (index === 6) ctx.police.setWanted(4, ctx.player);
    if (index === 7) ctx.police.setWanted(5, ctx.player);
    if (index === 5) ctx.police.setWanted(2, ctx.player);
  }
  function fail(reason) {
    status = 'failed';
    failReason = reason;
  }
  function complete(ctx) {
    status = 'done';
    ctx.player.cash += def().cash;
  }
  function retry(ctx) {
    ctx.resetMissionActors(index);
    start(ctx);
  }
  function next(ctx) {
    if (index < MISSIONS.length - 1) { index++; start(ctx); }
    else { status = 'idle'; }
  }

  function update(dt, ctx) {
    if (status !== 'active') return;
    timer += dt;
    const s = steps[step];
    if (!s) { complete(ctx); return; }
    const pos = ctx.player.inVehicle ? ctx.player.inVehicle : ctx.player;
    ctx.playerCar = ctx.player.inVehicle;
    const result = s.check(ctx);
    if (result === 'done') {
      step++;
      if (step >= steps.length) complete(ctx);
    } else if (result === 'fail') {
      fail(s.text.includes('Tail') ? 'The courier spotted you or slipped away.' : 'The car took too much damage.');
    }
    // Busted: car disabled with police on top of the player.
    if (ctx.player.inVehicle && ctx.player.inVehicle.disabled && ctx.police.wanted > 0) {
      const near = ctx.police.units.some((u) => Math.hypot(u.x - pos.x, u.z - pos.z) < 18);
      if (near) fail('PMPD boxed the car in. Busted.');
    }
    if (ctx.player.health <= 0) fail('Nico went down. The job is off.');
  }

  function objective() {
    if (status === 'idle') return 'Free roam. Press M for the next job.';
    if (status === 'done') return `${def().title} complete. +$${def().cash}. Press M for the next job.`;
    if (status === 'failed') return `Job failed. ${failReason} Press M to retry.`;
    const s = steps[step];
    return s ? s.text : '';
  }
  function marker() {
    if (status !== 'active') return null;
    const s = steps[step];
    if (!s || !s.marker) return null;
    return typeof s.marker === 'function' ? s.marker() : s.marker;
  }

  return {
    get index() { return index; },
    set index(v) { index = v; },
    get status() { return status; },
    set status(v) { status = v; },
    get step() { return step; },
    get failReason() { return failReason; },
    get current() { return def(); },
    start, retry, next, update, objective, marker,
  };
}
