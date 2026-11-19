// Civilian traffic: cars follow the road graph, keep gaps, slow at
// intersections and pull around a blocked lane. They never spawn in view.
import { ROAD_EDGES, ROAD_NODES } from './config.js';
import { createVehicle, stepVehicle } from './vehicles.js';

const TRAFFIC_COLORS = [0x8a8a92, 0x5a2a2a, 0x2a4a3a, 0xc8b890, 0x3a3a4a, 0x7a6a4a];
const TRAFFIC_KINDS = ['sedan', 'sedan', 'suv', 'van', 'sedan'];

function adjacency() {
  const adj = ROAD_NODES.map(() => []);
  for (const [a, b] of ROAD_EDGES) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

export function createTraffic(scene, random, colliders) {
  const adj = adjacency();
  const cars = [];
  const kinds = TRAFFIC_KINDS;
  function spawnCar(farFrom) {
    let node = random.int(0, ROAD_NODES.length - 2);
    let tries = 0;
    while (farFrom && Math.hypot(ROAD_NODES[node].x - farFrom.x, ROAD_NODES[node].z - farFrom.z) < 90 && tries < 12) {
      node = random.int(0, ROAD_NODES.length - 2);
      tries++;
    }
    const next = adj[node][random.int(0, adj[node].length - 1)];
    const n1 = ROAD_NODES[node];
    const n2 = ROAD_NODES[next];
    const heading = Math.atan2(-(n2.z - n1.z), n2.x - n1.x);
    const v = createVehicle(scene, {
      kind: random.pick(kinds), color: random.pick(TRAFFIC_COLORS),
      x: n1.x + random.range(-2, 2), z: n1.z + random.range(-2, 2), heading,
    });
    v.ai = { node, next, speed: random.range(9, 15), wait: 0 };
    cars.push(v);
    return v;
  }
  for (let i = 0; i < 16; i++) spawnCar(null);

  function step(dt, playerPos, others) {
    for (const v of cars) {
      if (v.disabled) continue;
      const a = v.ai;
      const target = ROAD_NODES[a.next];
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(-dz, dx);
      let dh = wantHeading - v.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // Slow for the car ahead and at intersections.
      let speed = a.speed;
      for (const o of others) {
        if (o === v || o.disabled) continue;
        const od = Math.hypot(o.x - v.x, o.z - v.z);
        if (od < 10) {
          const ahead = (o.x - v.x) * Math.cos(v.heading) + (o.z - v.z) * -Math.sin(v.heading);
          if (ahead > 0) speed = Math.min(speed, Math.max(0, (od - 5) * 1.2));
        }
      }
      if (dist < 14) speed = Math.min(speed, 6);
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      stepVehicle(v, dt, { throttle: speed > 0.5 ? 1 : 0, brake: speed < 1 ? 1 : 0, steer, handbrake: false }, colliders, others);
      if (Math.abs(v.speed) > a.speed + 4) v.speed = (a.speed + 4) * Math.sign(v.speed);
      if (dist < 6) {
        const opts = adj[a.next].filter((n) => n !== a.node);
        a.node = a.next;
        a.next = opts.length ? opts[random.int(0, opts.length - 1)] : a.node;
      }
      // Recycle a car that ends up far from the player.
      if (playerPos && Math.hypot(v.x - playerPos.x, v.z - playerPos.z) > 420) {
        const n = random.int(0, ROAD_NODES.length - 2);
        v.x = ROAD_NODES[n].x;
        v.z = ROAD_NODES[n].z;
        v.ai.node = n;
        v.ai.next = adj[n][0];
        v.speed = 0;
      }
    }
  }
  return { cars, spawnCar, step };
}
