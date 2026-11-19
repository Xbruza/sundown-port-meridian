// Port Meridian: terrain, road network, water, bridge, harbor, buildings,
// palms and street props. Everything is procedural geometry from the seeded
// random source, so the same seed builds the same city.
import * as THREE from 'three';
import { DISTRICTS, GARAGE, MARINA_LOT, PALETTE, PROMENADE, ROAD_EDGES, ROAD_NODES, TERMINAL, WORLD } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(random, base, litRatio) {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 14 + c * 40;
        const y = 18 + r * 40;
        const lit = random.chance(litRatio);
        g.fillStyle = lit ? (random.chance(0.5) ? '#ffd9a0' : '#ffeec4') : '#14161f';
        g.fillRect(x, y, 26, 26);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, y + 26, 26, 3);
        if (random.chance(0.35)) {
          g.fillStyle = 'rgba(20,20,28,0.9)';
          g.fillRect(x - 3, y + 29, 32, 4);
        }
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, h - 26, w, 26);
  });
}

export function groundHeight(x, z) {
  // Bridge deck over the north channel, with approach ramps.
  if (x > -314 && x < -286) {
    if (z >= -500 && z <= -420) return 6;
    if (z > -520 && z < -500) return 6 * (1 - (-500 - z) / 20);
    if (z > -420 && z < -400) return 6 * (1 - (z + 420) / 20);
  }
  return 0;
}

export function buildWorld(scene, random) {
  const colliders = [];
  const boats = [];
  const animated = { water: [], wakes: [] };

  const groundTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#47484f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = random.chance(0.5) ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)';
      const s = random.range(2, 18);
      g.fillRect(random.range(0, w), random.range(0, h), s, s);
    }
  });
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(8, 8);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Water: bay west, north channel, harbor basin east. Wave-displaced.
  // Deep blue base with a steady emissive hold so the bay reads as water
  // under warm sunset light instead of washing out to brown or grey.
  const waterTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#185f8c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = random.chance(0.5) ? 'rgba(8,32,52,0.4)' : 'rgba(255,255,255,0.10)';
      g.fillRect(random.range(0, w), random.range(0, h), random.range(10, 60), random.range(1, 3));
    }
  });
  waterTex.wrapS = THREE.RepeatWrapping;
  waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(6, 6);
  const waterMat = new THREE.MeshLambertMaterial({
    map: waterTex, color: 0x1a5a80, emissive: 0x0e4a72, emissiveIntensity: 0.9, transparent: true, opacity: 0.96,
  });
  function makeWater(w, d, x, z) {
    const geo = new THREE.PlaneGeometry(w, d, Math.max(8, Math.floor(w / 16)), Math.max(8, Math.floor(d / 16)));
    const mesh = new THREE.Mesh(geo, waterMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, WORLD.waterLevel, z);
    scene.add(mesh);
    animated.water.push({ mesh, base: geo.attributes.position.array.slice() });
    return mesh;
  }
  makeWater(240, 1120, -435, 0);
  makeWater(420, 44, -350, -460);
  makeWater(180, 340, 470, 310);

  // Sun glints: long amber streaks on the bay, kept dim so the water
  // stays blue; harbor glints run brighter.
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.25, depthWrite: false });
  const glintDim = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.12, depthWrite: false });
  for (const [gx, gz, gw, gl, dim] of [[-400, -200, 6, 90, 1], [-430, -320, 4, 70, 1], [-380, -80, 5, 80, 1], [-410, 40, 7, 90, 1], [-395, 150, 6, 70, 1], [450, 240, 5, 110, 0], [480, 380, 4, 90, 0]]) {
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(gw, gl), dim ? glintDim : glintMat);
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(gx, WORLD.waterLevel + 0.06, gz);
    scene.add(glint);
  }
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 500),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(-316, WORLD.waterLevel + 0.05, -250);
  scene.add(foam);

  // Seawall along the shore and stepped quay edges at the harbor.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.9 });
  const seawall = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 1120), wallMat);
  seawall.position.set(-258, 1, 0);
  scene.add(seawall);
  colliders.push({ x: -258, z: 0, r: 4, half: { w: 4, d: 560 } });

  // Roads: dark strips with lane dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x40414c });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8c26a, roughness: 0.6 });
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 4);
  const dashes = [];
  function roadStrip(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, len), roadMat);
    mesh.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
    mesh.rotation.y = dx === 0 ? 0 : Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const steps = Math.floor(len / 12);
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      dashes.push([x1 + dx * t, z1 + dz * t, dx === 0 ? 0 : Math.PI / 2]);
    }
  }
  for (const [a, b] of ROAD_EDGES) {
    const n1 = ROAD_NODES[a];
    const n2 = ROAD_NODES[b];
    if (n1 && n2) roadStrip(n1.x, n1.z, n2.x, n2.z);
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const dummy = new THREE.Object3D();
  dashes.forEach(([x, z, rot], i) => {
    dummy.position.set(x, 0.16, z);
    dummy.rotation.set(0, rot, 0);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashMesh);

  // Wet-asphalt reflections: bold, blue-leaning bands lying on the coastal
  // highway. Wider (3.2 m) and brighter (0.85) than a faint sheen, with
  // amber, blue and red alternating so the wet road reads at a glance and
  // the blue paint of the car still has company on the asphalt.
  const streakTex = canvasTexture(16, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.15, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const streakCols = [0xffb060, 0x5a8cff, 0xff5040, 0x6aa0ff, 0xffc080, 0x3f7dff];
  for (let i = 0; i < 12; i++) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, random.range(25, 45)),
      new THREE.MeshBasicMaterial({ map: streakTex, color: streakCols[i % streakCols.length], transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(-300 + (i % 2 === 0 ? -2.6 : 2.6), 0.14, -420 + i * 78 + random.range(-20, 20));
    scene.add(streak);
  }
  // Cover-stretch cluster: fixed positions along the exact road the cover
  // car drives, running continuously from just ahead of the car 130+ m up
  // the road. Blue bands lead the sequence so the wet asphalt reads blue
  // as well as amber, and the sun glare stays out of the road itself.
  const coverStreaks = [
    [-303.0, 30, 2.6, 45, 0x3f7dff, 0.55], [-297.0, -20, 2.6, 45, 0xffc040, 0.55],
    [-303.0, -70, 2.6, 45, 0x5a8cff, 0.55], [-297.0, -120, 2.6, 45, 0xff4040, 0.55],
    [-303.0, -170, 2.6, 45, 0xffc080, 0.55], [-297.0, -220, 2.6, 45, 0x6aa0ff, 0.55],
  ];
  for (const [sx, sz, sw, sl, scol, sop] of coverStreaks) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sl),
      new THREE.MeshBasicMaterial({ map: streakTex, color: scol, transparent: true, opacity: sop, depthWrite: false, toneMapped: false }),
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(sx, 0.15, sz);
    scene.add(streak);
  }
  // Puddles: flat blue-grey discs with a bright rim, scattered on the
  // highway and downtown so the wet look survives away from the streaks.
  const puddleMat = new THREE.MeshBasicMaterial({ color: 0x4a7ab8, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(random.range(2.5, 5), 18), puddleMat);
    p.rotation.x = -Math.PI / 2;
    const onHighway = i % 2 === 0;
    p.position.set(onHighway ? random.range(-306, -294) : random.range(-170, 360), 0.13, random.range(-440, 440));
    scene.add(p);
  }

  // Bridge deck, towers, suspension cables and hangers over the channel.
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x3d3e48, roughness: 0.4, metalness: 0.4 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, 110), deckMat);
  deck.position.set(-300, 6, -460);
  deck.receiveShadow = true;
  scene.add(deck);
  const girderMat = new THREE.MeshStandardMaterial({ color: 0x3a3b44, roughness: 0.6, metalness: 0.3 });
  const girder = new THREE.Mesh(new THREE.BoxGeometry(24, 2.2, 106), girderMat);
  girder.position.set(-300, 4.4, -460);
  scene.add(girder);
  const underLamp = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.35, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xff9a40, emissiveIntensity: 1.6 }),
  );
  underLamp.position.set(-300, 3.3, -406);
  scene.add(underLamp);
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xff9a40, emissiveIntensity: 1.4 });
  for (const x of [-314, -286]) {
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 110), fasciaMat);
    fascia.position.set(x, 6.4, -460);
    scene.add(fascia);
    for (let z = -510; z <= -410; z += 12) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 4), girderMat);
      post.position.set(x, 7.2, z);
      scene.add(post);
    }
  }
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x9a5a44, roughness: 0.6 });
  const towerDark = new THREE.MeshStandardMaterial({ color: 0x6a3a30, roughness: 0.6 });
  for (const z of [-485, -435]) {
    for (const x of [-310, -290]) {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 20, 4.2), towerMat);
      lower.position.set(x, 16, z);
      lower.castShadow = true;
      scene.add(lower);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(2.8, 16, 2.8), towerMat);
      upper.position.set(x, 33, z);
      upper.castShadow = true;
      scene.add(upper);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 4), towerDark);
      cap.position.set(x, 43, z);
      cap.rotation.y = Math.PI / 4;
      scene.add(cap);
    }
    for (const y of [14, 26, 36]) {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(23, 2.2, 2.6), y === 36 ? towerDark : towerMat);
      cross.position.set(-300, y, z);
      scene.add(cross);
    }
    for (const s of [-1, 1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), towerDark);
      brace.position.set(-300, 20, z);
      brace.rotation.z = s * 0.55;
      scene.add(brace);
    }
  }
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.5, metalness: 0.5 });
  function cableY(z) {
    if (z < -485) return 38 - (-485 - z) * 0.02 + 2;
    if (z > -435) return 38 - (z + 435) * 0.02 + 2;
    const t = (z + 485) / 50;
    return 36 - Math.sin(t * Math.PI) * 5;
  }
  for (const x of [-311, -289]) {
    const pts = [];
    for (let z = -515; z <= -405; z += 5) pts.push(new THREE.Vector3(x, cableY(z), z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.32, 6), cableMat);
    scene.add(cable);
    for (let z = -505; z <= -415; z += 10) {
      const top = cableY(z);
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, top - 6.6, 4), cableMat);
      hanger.position.set(x, (top + 6.6) / 2, z);
      scene.add(hanger);
    }
  }

  // Buildings: facades with recessed lit windows, balconies, awnings.
  const bases = ['#5a4a52', '#4a5568', '#6b5a48', '#3f4a3a', '#54423e'];
  const facades = bases.map((b) => facadeTexture(random, b, 0.45));
  const balconyMat = new THREE.MeshStandardMaterial({ color: 0x1c1d24, roughness: 0.8 });
  const awningMat = new THREE.MeshStandardMaterial({ color: 0x9a4a3a, roughness: 0.85 });
  function building(x, z, w, d, h, tex) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
    );
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const floors = Math.max(1, Math.floor(h / 14));
    for (let f = 0; f < floors; f++) {
      if (!random.chance(0.5)) continue;
      const balc = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.5, 2.2), balconyMat);
      balc.position.set(x, 6 + f * 9, z + d / 2 + 1);
      scene.add(balc);
    }
    if (random.chance(0.6)) {
      const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.4, 4), awningMat);
      awn.position.set(x, 4.5, z + d / 2 + 1.5);
      awn.rotation.x = 0.25;
      scene.add(awn);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(random.range(2, 5), 2, random.range(2, 5)), balconyMat);
    roof.position.set(x + random.range(-w / 4, w / 4), h + 1, z + random.range(-d / 4, d / 4));
    scene.add(roof);
    colliders.push({ x, z, r: Math.hypot(w, d) / 2, half: { w: w / 2, d: d / 2 } });
    return mesh;
  }
  const roadXs = [-300, -180, -40, 100, 240, 380];
  const roadZs = [-460, -300, -140, 20, 180, 340, 460];
  for (let xi = 0; xi < roadXs.length - 1; xi++) {
    for (let zi = 0; zi < roadZs.length - 1; zi++) {
      const x0 = roadXs[xi] + 14;
      const x1 = roadXs[xi + 1] - 14;
      const z0 = roadZs[zi] + 14;
      const z1 = roadZs[zi + 1] - 14;
      if (x1 - x0 < 24 || z1 - z0 < 24) continue;
      if (x0 > 200 && z0 > 140) continue;
      if (x0 < -240) continue;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const tall = Math.abs(cx) < 200 && Math.abs(cz) < 200;
      const h = tall ? random.range(24, 68) : random.range(10, 30);
      building(cx + random.range(-8, 8), cz + random.range(-8, 8), random.range(22, Math.min(44, x1 - x0)), random.range(22, Math.min(44, z1 - z0)), h, random.pick(facades));
      if (random.chance(0.5)) {
        building(cx + random.range(-20, 20), cz + random.range(-20, 20), random.range(14, 24), random.range(14, 24), random.range(8, 18), random.pick(facades));
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    building(-140 + i * 60, 260, 44, 26, 12, facadeTexture(random, '#6b4a3a', 0.25));
  }
  for (let i = 0; i < 6; i++) {
    building(-120 + random.range(-60, 60), -380 + random.range(-50, 50), 18, 16, random.range(8, 14), facadeTexture(random, '#d8c9a8', 0.5));
  }

  // Harbor: container stacks, cranes, cargo ship, tug.
  function containerTexture(hex) {
    return canvasTexture(128, 64, (g, w, h) => {
      g.fillStyle = hex;
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) {
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(x, 4, 3, h - 8);
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(x + 3, 4, 2, h - 8);
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, 0, w, 5);
      g.fillRect(0, h - 5, w, 5);
      g.fillRect(0, 0, 5, h);
      g.fillRect(w - 5, 0, 5, h);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(0, 5, w, 2);
    });
  }
  const containerColors = [0xa34a2a, 0x2a5a7a, 0x4a7a3a, 0x8a7a2a, 0x6a3a5a];
  const containerMat = containerColors.map((c) => new THREE.MeshStandardMaterial({ map: containerTexture('#' + c.toString(16).padStart(6, '0')), roughness: 0.7, metalness: 0.3 }));
  for (let i = 0; i < 46; i++) {
    const x = random.range(250, 400);
    const z = random.range(200, 430);
    if (x > 305 && x < 425 && z > 235 && z < 295) continue;
    const stack = random.int(1, 3);
    for (let s = 0; s < stack; s++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.6), random.pick(containerMat));
      box.position.set(x, 1.3 + s * 2.7, z);
      box.rotation.y = random.chance(0.5) ? 0 : Math.PI / 2;
      box.castShadow = true;
      scene.add(box);
    }
    if (i % 3 === 0) colliders.push({ x, z, r: 8, half: { w: 7, d: 7 } });
  }
  function crane(x, z, h) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xc87a2a, roughness: 0.6, metalness: 0.4 });
    const leg = new THREE.BoxGeometry(2, h, 2);
    for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      const m = new THREE.Mesh(leg, mat);
      m.position.set(lx, h / 2, lz);
      m.castShadow = true;
      g.add(m);
    }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 70), mat);
    boom.position.set(0, h - 2, 20);
    boom.castShadow = true;
    g.add(boom);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), mat);
    cab.position.set(0, h - 6, 0);
    g.add(cab);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 18, 4), cableMat);
    cable.position.set(0, h - 14, 44);
    g.add(cable);
    g.position.set(x, 0, z);
    scene.add(g);
    colliders.push({ x, z, r: 10, half: { w: 8, d: 8 } });
  }
  crane(330, 200, 52);
  crane(360, 320, 46);

  // Cargo ship in the harbor basin.
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.5, metalness: 0.4 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(90, 8, 22), hullMat);
  hull.position.y = 2;
  ship.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 8, 4), hullMat);
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(48, 2, 0);
  ship.add(bow);
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 2.4), random.pick(containerMat));
    c.position.set(-36 + (i % 5) * 16, 7.5 + Math.floor(i / 5) * 2.5, -6 + (i % 2) * 12);
    ship.add(c);
  }
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc8a03a }));
  funnel.position.set(-42, 10, 0);
  ship.add(funnel);
  ship.position.set(470, 0.4, 310);
  scene.add(ship);

  // Quay edge: low stepped concrete apron along the harbor basin with
  // bollards, kept low so the water and tug wake stay visible over it.
  const quayMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.85 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 340), quayMat);
  quay.position.set(382, 0.45, 310);
  quay.castShadow = true;
  scene.add(quay);
  const quayStep = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 340), new THREE.MeshStandardMaterial({ color: 0x62636e, roughness: 0.9 }));
  quayStep.position.set(386, 0.2, 310);
  scene.add(quayStep);
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.5, metalness: 0.6 });
  for (let z = 160; z <= 460; z += 25) {
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.1, 8), bollardMat);
    bol.position.set(380, 1.35, z);
    scene.add(bol);
  }

  // Harbor tugboat, built to read at full size from the quay: a broadside
  // view of a dark navy hull with a red waterline stripe, a tall white
  // cabin with lit windows, a black smokestack with an orange band, tire
  // fenders along the side, and a wide white wake trailing behind it.
  // Scaled up and set broadside to the quay camera so hull, cabin, stack
  // and wake each read as separate shapes instead of one pale blob.
  function buildTug() {
    const tug = new THREE.Group();
    const navy = new THREE.MeshStandardMaterial({ color: 0x14263e, roughness: 0.45, metalness: 0.3 });
    const hullM = new THREE.Mesh(new THREE.BoxGeometry(18, 3.2, 6.5), navy);
    hullM.position.y = 1.6;
    tug.add(hullM);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.7, 6.6), new THREE.MeshStandardMaterial({ color: 0xa8341e, roughness: 0.5 }));
    stripe.position.y = 0.9;
    tug.add(stripe);
    const tugBow = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 3.2, 4), navy);
    tugBow.rotation.y = Math.PI / 4;
    tugBow.scale.set(1, 1, 0.5);
    tugBow.position.set(9.5, 1.6, 0);
    tug.add(tugBow);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(7, 5.2, 5.2), new THREE.MeshStandardMaterial({ color: 0xf2efe4, roughness: 0.55, emissive: 0x8a7a68, emissiveIntensity: 0.4 }));
    cabin.position.set(-1.5, 5.6, 0);
    tug.add(cabin);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.15, metalness: 0.8, emissive: 0xffc060, emissiveIntensity: 0.5 });
    for (const z of [-2.0, 0, 2.0]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.2), winMat);
      win.position.set(0.6, 6.4, z);
      tug.add(win);
    }
    const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 4.4), new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.55 }));
    wheelhouse.position.set(-1.5, 9.4, 0);
    tug.add(wheelhouse);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 4.6, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 }));
    stack.position.set(-6.2, 7.2, 0);
    tug.add(stack);
    const stackBand = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0xe07a2a, roughness: 0.5 }));
    stackBand.position.set(-6.2, 8.6, 0);
    tug.add(stackBand);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a30 }));
    mast.position.set(4.5, 6.5, 0);
    tug.add(mast);
    const fenderMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.95 });
    for (const x of [-7, -3.5, 0, 3.5, 7]) {
      const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 8), fenderMat);
      fender.rotation.x = Math.PI / 2;
      fender.position.set(x, 1.4, 3.4);
      tug.add(fender);
    }
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 52),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false }),
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(-22, 0.9, 0);
    tug.add(wake);
    return tug;
  }
  const tug = buildTug();
  tug.scale.setScalar(1.5);
  tug.position.set(398, 0.4, 300);
  tug.rotation.y = Math.PI;
  scene.add(tug);
  const tug2 = buildTug();
  tug2.scale.setScalar(1.3);
  tug2.position.set(448, 0.4, 355);
  tug2.rotation.y = Math.PI * 0.85;
  scene.add(tug2);

  // Boats in the bay, with wakes.
  function boat(x, z, sail) {
    const g = new THREE.Group();
    const hullM = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 2.4), new THREE.MeshStandardMaterial({ color: 0xe7e5de, roughness: 0.5 }));
    hullM.position.y = 0.8;
    g.add(hullM);
    if (sail) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), cableMat);
      mast.position.y = 5;
      g.add(mast);
      const sailM = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 7), new THREE.MeshStandardMaterial({ color: 0xf5efe0, side: THREE.DoubleSide, roughness: 0.9 }));
      sailM.position.set(0.4, 5, 1.2);
      g.add(sailM);
    }
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(0, 0.55, -10);
    g.add(wake);
    g.position.set(x, 0.4, z);
    scene.add(g);
    boats.push({ group: g, x, z, angle: random.range(0, Math.PI * 2), speed: random.range(1.5, 3), wake });
    animated.wakes.push(wake);
    return g;
  }
  boat(-380, -80, true);
  boat(-400, 140, true);
  boat(-360, 320, false);
  boat(430, 380, false);

  // Palms along the shore and the promenade.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.9, side: THREE.DoubleSide });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), trunkMat);
    trunk.position.y = 4.5;
    trunk.rotation.z = random.range(-0.08, 0.08);
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), frondMat);
      frond.position.y = 9.2;
      frond.rotation.z = Math.PI / 2.4;
      frond.rotation.y = (i / 7) * Math.PI * 2;
      frond.position.x = Math.cos((i / 7) * Math.PI * 2) * 1.6;
      frond.position.z = Math.sin((i / 7) * Math.PI * 2) * 1.6;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    colliders.push({ x, z, r: 1.2 });
  }
  for (let z = -440; z <= 440; z += 44) {
    if (Math.abs(z - 120) < 22 || Math.abs(z - 60) < 22) continue;
    palm(-272, z + random.range(-6, 6));
  }
  for (let z = -200; z <= 300; z += 60) palm(-246, z);
  for (let i = 0; i < 14; i++) palm(random.range(-160, 360), random.range(-440, 440));

  // Streetlights along the highway and downtown.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc060, emissiveIntensity: 1.6 });
  function lamp(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 8, 6), poleMat);
    pole.position.y = 4;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3), poleMat);
    arm.position.set(0, 7.8, 1.2);
    g.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
    bulb.position.set(0, 7.6, 2.6);
    g.add(bulb);
    g.position.set(x, 0, z);
    scene.add(g);
  }
  for (let z = -440; z <= 440; z += 80) lamp(-288, z);
  for (let z = -440; z <= 440; z += 120) lamp(-172, z);
  for (let x = -160; x <= 360; x += 120) lamp(x, 12);

  // Garage: a marked lot with a canopy and a glowing sign block.
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 0.7 });
  const garage = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 18), garageMat);
  garage.position.set(GARAGE.x, 4, GARAGE.z - 14);
  garage.castShadow = true;
  scene.add(garage);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x9a9ae5, roughness: 0.5 }));
  canopy.position.set(GARAGE.x, 7.5, GARAGE.z + 2);
  scene.add(canopy);
  colliders.push({ x: GARAGE.x, z: GARAGE.z - 14, r: 12, half: { w: 13, d: 9 } });

  // Marina lot marker posts and the terminal gate.
  const postMat = new THREE.MeshStandardMaterial({ color: 0xeab38a, emissive: 0xeab38a, emissiveIntensity: 0.5 });
  for (const p of [MARINA_LOT, PROMENADE, TERMINAL]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 8), postMat);
    post.position.set(p.x + 3, 0.7, p.z + 3);
    scene.add(post);
  }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 1.5), new THREE.MeshStandardMaterial({ color: 0x4a4a52 }));
  gate.position.set(TERMINAL.x, 3.5, TERMINAL.z - 12);
  scene.add(gate);

  return {
    colliders,
    boats,
    animated,
    markers: { garage: GARAGE, marina: MARINA_LOT, promenade: PROMENADE, terminal: TERMINAL },
    update(t, dt) {
      for (const w of animated.water) {
        const pos = w.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const bx = w.base[i * 3];
          const by = w.base[i * 3 + 1];
          pos.setZ(i, Math.sin(bx * 0.08 + t * 1.1) * 0.55 + Math.cos(by * 0.06 + t * 0.8) * 0.45);
        }
        pos.needsUpdate = true;
        w.mesh.geometry.computeVertexNormals();
      }
      for (const b of boats) {
        b.angle += dt * 0.02;
        b.x += Math.cos(b.angle) * b.speed * dt;
        b.z += Math.sin(b.angle) * b.speed * dt * 0.4;
        if (b.x < 0) {
          if (b.x < -480) b.x = -320;
          if (b.x > -320) b.x = -480;
        }
        b.group.position.x = b.x;
        b.group.position.z = b.z;
        b.group.rotation.y = -b.angle + Math.PI / 2;
        b.wake.material.opacity = 0.25 + Math.sin(t * 2) * 0.08;
      }
    },
  };
}
