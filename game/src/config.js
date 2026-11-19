// SUNDOWN: Port Meridian — tuning, places, and the road graph in one file.
// The world is a flat XZ plane, 1000 m across. The bay sits west of x=-315,
// the coastal highway runs north-south along the shore, downtown fills the
// middle, the harbor fills the south-east, and a bridge crosses the channel
// at the north end to Crown Coast.

export const STEP = 1 / 60;
export const SAVE_KEY = 'sundown.port-meridian.save.v1';
export const SAVE_VERSION = 1;

export const WORLD = {
  half: 500,
  shoreX: -260,
  waterLevel: 0.4,
  sunDir: { x: -0.55, y: 0.26, z: -0.62 },
};

export const PALETTE = {
  ground: '#33343c',
  ink: '#e7e5de',
  signal: '#9a9ae5',
  apricot: '#eab38a',
  skyTop: '#2e2a55',
  skyMid: '#e0784a',
  skyLow: '#f7b267',
  sea: '#1d3a4d',
  asphalt: '#40414c',
  lane: '#d8c26a',
  curb: '#3a3b44',
};

export const DISTRICTS = [
  { name: 'Crown Coast', cx: -120, cz: -380, r: 150 },
  { name: 'Palmetto Heights', cx: -40, cz: -180, r: 170 },
  { name: 'Glasswater', cx: 180, cz: -60, r: 160 },
  { name: 'Old Quay', cx: -60, cz: 180, r: 150 },
  { name: 'Meridian Port', cx: 240, cz: 300, r: 190 },
];

// Road graph: nodes are {x, z}, edges join node indices. Traffic, police,
// the minimap and mission routing all read this one graph.
export const ROAD_NODES = [
  { x: -300, z: -460 }, { x: -300, z: -300 }, { x: -300, z: -140 }, { x: -300, z: 20 },
  { x: -300, z: 180 }, { x: -300, z: 340 }, { x: -300, z: 460 },
  { x: -180, z: -460 }, { x: -180, z: -300 }, { x: -180, z: -140 }, { x: -180, z: 20 },
  { x: -180, z: 180 }, { x: -180, z: 340 },
  { x: -40, z: -460 }, { x: -40, z: -300 }, { x: -40, z: -140 }, { x: -40, z: 20 },
  { x: -40, z: 180 }, { x: -40, z: 340 }, { x: -40, z: 460 },
  { x: 100, z: -460 }, { x: 100, z: -300 }, { x: 100, z: -140 }, { x: 100, z: 20 },
  { x: 100, z: 180 }, { x: 100, z: 340 },
  { x: 240, z: -300 }, { x: 240, z: -140 }, { x: 240, z: 20 }, { x: 240, z: 180 },
  { x: 240, z: 340 }, { x: 240, z: 460 },
  { x: 380, z: -140 }, { x: 380, z: 20 }, { x: 380, z: 180 }, { x: 380, z: 340 },
];
export const ROAD_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19],
  [20, 21], [21, 22], [22, 23], [23, 24], [24, 25],
  [26, 27], [27, 28], [28, 29], [29, 30], [30, 31],
  [32, 33], [33, 34], [34, 35],
  [0, 7], [7, 13], [13, 20], [20, 26],
  [1, 8], [8, 14], [14, 21], [21, 27],
  [2, 9], [9, 15], [15, 22], [22, 28], [28, 32],
  [3, 10], [10, 16], [16, 23], [23, 29], [29, 33],
  [4, 11], [11, 17], [17, 24], [24, 30], [30, 34],
  [5, 12], [12, 18], [18, 25], [25, 31], [31, 35],
  [6, 19], [19, 25],
  [1, 7], [13, 7],
];

export const PLAYER_CAR = {
  accel: 26, brake: 42, reverseAccel: 14, maxSpeed: 62, maxReverse: 12,
  steerMax: 0.55, grip: 6.5, drag: 0.35, handbrakeGrip: 1.6,
};

export const WANTED = {
  // Units on the road at each star level, and whether the heli and roadblocks join.
  levels: [
    { units: 0, heli: false, roadblock: false },
    { units: 1, heli: false, roadblock: false },
    { units: 2, heli: false, roadblock: false },
    { units: 3, heli: false, roadblock: true },
    { units: 4, heli: true, roadblock: true },
    { units: 5, heli: true, roadblock: true },
  ],
  clearTime: 12,
  searchTime: 20,
};

export const MISSIONS = [
  { id: 1, title: 'First Shift', cash: 800, brief: 'Recover the blue Vela Mariner from the marina lot and bring it to the starter garage in Palmetto Heights.' },
  { id: 2, title: 'Low Tide', cash: 1200, brief: 'Meet Tide on foot along the marina promenade and carry the package back to the car.' },
  { id: 3, title: 'Across the Span', cash: 1500, brief: 'Tail the harbor courier over the north bridge. Stay close enough to see him, far enough that he never spots you.' },
  { id: 4, title: 'Borrowed Wheels', cash: 1800, brief: 'Take the marked Rook Vantage coupe from traffic and deliver it intact to the garage.' },
  { id: 5, title: 'Gate Receipt', cash: 2400, brief: 'Enter the port terminal on foot, recover the manifest, and cross the quay to the extraction car.' },
  { id: 6, title: 'Closed Ramp', cash: 2600, brief: 'Move the manifest to the second contact while a PMPD roadblock shuts the direct route. Find another way round.' },
  { id: 7, title: 'Searchlight', cash: 3200, brief: 'Leave the exposed waterfront, lose helicopter contact, and reach the garage once the search clears.' },
  { id: 8, title: 'Last Crossing', cash: 6000, brief: 'Deliver the final cargo across the harbor at five stars, then shake the pursuit before the handoff.' },
];

export const GARAGE = { x: -40, z: -140, r: 16 };
export const MARINA_LOT = { x: -290, z: 60, r: 14 };
export const PROMENADE = { x: -272, z: 120, r: 10 };
export const TERMINAL = { x: 300, z: 260, r: 16 };
export const BRIDGE_MID = { x: -240, z: -460, r: 20 };

export const CONTROLS = [
  ['W / S', 'Throttle / brake and reverse'],
  ['A / D', 'Steer'],
  ['Space', 'Handbrake'],
  ['E', 'Enter or exit a vehicle'],
  ['Shift', 'Sprint on foot'],
  ['Mouse', 'Aim on foot, click to fire'],
  ['R', 'Reload'],
  ['C', 'Change camera'],
  ['Q', 'Switch radio station'],
  ['M', 'Next mission'],
  ['P / Esc', 'Pause'],
  ['H', 'Headlights'],
];
