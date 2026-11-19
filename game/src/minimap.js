// Minimap: drawn from the real road graph and shoreline, with the player
// arrow, heading, police markers, the mission destination and the search
// zone. It is the same world the player drives, not a picture of it.
import { ROAD_EDGES, ROAD_NODES, WORLD } from './config.js';

export function createMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  // Canvas colors come from the same :root tokens as the CSS.
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const INK = token('--ink', '#e7e5de');
  const APRICOT = token('--apricot', '#eab38a');
  const SEA = token('--sea', '#1d3a4d');
  const ROAD_LINE = token('--road-line', '#6a6b78');
  const HOT = token('--hot', '#e5534b');
  const ALERT = token('--alert', '#ff5a4a');
  const GROUND = token('--ground', '#26272f');
  const MAP_BG = token('--map-bg', 'rgba(20,21,30,0.85)');
  const W = canvas.width;
  const H = canvas.height;
  function toMap(x, z) {
    return [((x + WORLD.half) / (WORLD.half * 2)) * W, ((z + WORLD.half) / (WORLD.half * 2)) * H];
  }
  function draw(s) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = MAP_BG;
    ctx.fillRect(0, 0, W, H);
    // Water: the bay west of the coastal highway, and the harbor basin east.
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, ((-330 + WORLD.half) / (WORLD.half * 2)) * W, H);
    ctx.fillRect(((380 + WORLD.half) / (WORLD.half * 2)) * W, ((140 + WORLD.half) / (WORLD.half * 2)) * H, W, H);
    // Roads.
    ctx.strokeStyle = ROAD_LINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [a, b] of ROAD_EDGES) {
      const [x1, y1] = toMap(ROAD_NODES[a].x, ROAD_NODES[a].z);
      const [x2, y2] = toMap(ROAD_NODES[b].x, ROAD_NODES[b].z);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    // Search zone.
    if (s.wanted > 0 && s.searchZone) {
      const [x, y] = toMap(s.searchZone.x, s.searchZone.z);
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = HOT;
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = HOT;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Mission marker.
    if (s.marker) {
      const [x, y] = toMap(s.marker.x, s.marker.z);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = APRICOT;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Police markers.
    ctx.fillStyle = ALERT;
    for (const u of s.policeUnits) {
      const [x, y] = toMap(u.x, u.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow with heading.
    const [px, py] = toMap(s.playerX, s.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-s.heading);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.strokeStyle = GROUND;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = INK;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('N', W - 6, 12);
  }
  return { draw };
}
