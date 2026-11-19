// Renderer: one WebGL renderer, a sunset sky dome, a low sun with shadows,
// warm fog, and the render loop entry. No gameplay logic lives here.
import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe08a5a, 520, 1100);
  scene.background = new THREE.Color(0x3a2b4d);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
  camera.position.set(-280, 26, 120);

  // Low amber sun from the north-west, over the bay.
  const sun = new THREE.DirectionalLight(0xffb36b, 2.8);
  sun.position.set(WORLD.sunDir.x * 400, WORLD.sunDir.y * 400, WORLD.sunDir.z * 400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  // Fill lights are the readability fix: the sun sits north-west
  // behind the chase camera's subjects, so south-facing paint, livery
  // and clothing fell to near-black. Hemisphere + ambient + two warm
  // fills from the south-east lift roads, quay and two-tone cruisers
  // into midtone while the sunset stays orange.
  scene.add(new THREE.HemisphereLight(0xffb080, 0x5a4636, 2.6));
  scene.add(new THREE.AmbientLight(0x805038, 0.9));
  const fill = new THREE.DirectionalLight(0xffd0a0, 2.6);
  fill.position.set(200, 120, 300);
  scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xffe0b8, 2.0);
  bounce.position.set(160, 90, 420);
  scene.add(bounce);

  // Sky dome: gradient shader, amber at the horizon, violet overhead, with
  // a small hard sun core and a soft halo. The halo stays modest so the
  // glare never washes out the blue paint or the dark tires below it.
  const skyGeo = new THREE.SphereGeometry(1600, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
      sunDir: { value: new THREE.Vector3(WORLD.sunDir.x, WORLD.sunDir.y, WORLD.sunDir.z).normalize() },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir; uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 col = mix(low, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.65, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.75, 0.45) * pow(s, 350.0) * 0.85;
        col += vec3(1.0, 0.75, 0.45) * pow(s, 90.0) * 0.22;
        col += vec3(1.0, 0.55, 0.25) * pow(s, 8.0) * 0.12;
        if (h > 0.02 && h < 0.55) {
          vec2 cuv = vec2(atan(vDir.z, vDir.x) * 2.2, vDir.y * 6.0);
          float cl = noise(cuv * 1.6) * 0.6 + noise(cuv * 3.7) * 0.4;
          float band = smoothstep(0.55, 0.85, cl) * smoothstep(0.55, 0.25, h) * smoothstep(0.02, 0.12, h);
          vec3 cloudCol = mix(vec3(0.98, 0.55, 0.35), vec3(1.0, 0.82, 0.6), clamp(s * 1.4, 0.0, 1.0));
          col = mix(col, cloudCol, band * 0.75);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Sun disc sprite: kept small and soft so it reads as a low sun without
  // dominating the frame or bleaching the car. Halved from the old 90-unit
  // disc, which owned the whole cover sky.
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = 128;
  sunCanvas.height = 128;
  const sctx = sunCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,236,180,1)');
  grad.addColorStop(0.22, 'rgba(255,180,90,0.8)');
  grad.addColorStop(0.5, 'rgba(255,140,60,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(sunCanvas);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
  sunSprite.position.set(WORLD.sunDir.x * 1300, WORLD.sunDir.y * 1300 + 40, WORLD.sunDir.z * 1300);
  sunSprite.scale.set(46, 46, 1);
  scene.add(sunSprite);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return {
    renderer, scene, camera, sun,
    resize,
    render() { renderer.render(scene, camera); },
  };
}
