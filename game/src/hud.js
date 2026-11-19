// HUD: mission panel, PMPD response panel, cash and stars, speedometer,
// center messages and the menu overlays. All DOM, layered over the canvas.
import { CONTROLS } from './config.js';

const STAR_FULL = '\u2605';
const STAR_EMPTY = '\u2606';

export function createHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="logo">SUNDOWN<span>Port Meridian</span></div>
    <div id="mission-panel" class="panel">
      <div class="panel-title" id="mission-title">First Shift</div>
      <div class="objective"><span class="box" id="mission-box"></span><span id="mission-text"></span></div>
      <div class="sub" id="mission-sub"></div>
    </div>
    <div id="police-panel" class="panel">
      <div class="panel-title">PMPD Response <span id="police-count"></span></div>
      <div id="police-units"></div>
      <div class="sub" id="police-state"></div>
    </div>
    <div id="cash-panel"><div id="cash">$250</div><div id="stars"></div></div>
    <div id="speedo"><canvas id="speedo-canvas" width="220" height="220"></canvas></div>
    <div id="message"></div>
    <div id="hint"></div>
    <div id="menu" class="overlay">
      <div class="menu-card">
        <h1>SUNDOWN</h1>
        <p class="tagline">Port Meridian after dark. Drive the score, lose the tail.</p>
        <p id="menu-story">Nico Vale drives for the family marina. The city wants the land, the PMPD wants Nico, and every job moves the shoreline a little further from the people who live on it.</p>
        <div class="menu-buttons">
          <button id="btn-start">Start driving</button>
          <button id="btn-continue">Continue</button>
          <button id="btn-reset">New game</button>
        </div>
        <div class="controls-grid" id="controls-grid"></div>
        <p class="menu-note">Radio: Q to switch. Save: progress stores itself in this browser.</p>
      </div>
    </div>
    <div id="pause" class="overlay hidden">
      <div class="menu-card"><h1>Paused</h1>
        <div class="menu-buttons"><button id="btn-resume">Resume</button><button id="btn-quit">Quit to menu</button></div>
      </div>
    </div>
    <div id="banner" class="hidden"></div>`;

  const grid = document.getElementById('controls-grid');
  grid.innerHTML = CONTROLS.map(([k, v]) => `<div><b>${k}</b> ${v}</div>`).join('');

  const speedoCtx = document.getElementById('speedo-canvas').getContext('2d');
  // Canvas colors come from the same :root tokens as the CSS, so the HUD
  // has one color source of truth.
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const INK = token('--ink', '#e7e5de');
  const SIGNAL = token('--signal', '#9a9ae5');
  const APRICOT = token('--apricot', '#eab38a');
  const HOT = token('--hot', '#e5534b');
  const PANEL = token('--panel', 'rgba(24,25,34,0.78)');

  function drawSpeedo(kmh, gear) {
    const c = speedoCtx;
    const W = 220;
    const H = 220;
    c.clearRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2);
    c.beginPath();
    c.arc(0, 0, 96, 0, Math.PI * 2);
    c.fillStyle = PANEL;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = SIGNAL;
    c.stroke();
    // Ticks 0-240 km/h.
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
      const x1 = Math.cos(a) * 78;
      const y1 = Math.sin(a) * 78;
      const x2 = Math.cos(a) * 88;
      const y2 = Math.sin(a) * 88;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.strokeStyle = i >= 7 ? HOT : INK;
      c.lineWidth = i >= 7 ? 4 : 2;
      c.stroke();
      c.fillStyle = INK;
      c.font = '13px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i * 30), Math.cos(a) * 62, Math.sin(a) * 62);
    }
    const frac = Math.min(kmh / 240, 1);
    const na = Math.PI * 0.75 + frac * Math.PI * 1.5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(na) * 72, Math.sin(na) * 72);
    c.strokeStyle = APRICOT;
    c.lineWidth = 4;
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 7, 0, Math.PI * 2);
    c.fillStyle = APRICOT;
    c.fill();
    c.fillStyle = INK;
    c.font = 'bold 34px system-ui, sans-serif';
    c.fillText(String(Math.round(kmh)), 0, 34);
    c.font = '13px system-ui, sans-serif';
    c.fillStyle = SIGNAL;
    c.fillText('km/h', 0, 56);
    c.fillStyle = INK;
    c.font = 'bold 20px system-ui, sans-serif';
    c.fillText(String(gear), 0, -34);
    c.restore();
  }

  let messageTimer = 0;
  function message(text, seconds = 3) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.style.opacity = '1';
    messageTimer = seconds;
  }

  return {
    update(dt, s) {
      document.getElementById('mission-title').textContent = s.missionTitle;
      document.getElementById('mission-text').textContent = s.objective;
      document.getElementById('mission-sub').textContent = s.missionSub || '';
      document.getElementById('mission-box').textContent = s.missionDone ? '\u2611' : '\u2610';
      const units = s.policeUnits;
      document.getElementById('police-count').textContent = units.length ? `${units.length} unit${units.length > 1 ? 's' : ''} \u00b7 Code ${s.wanted}` : 'No active response';
      document.getElementById('police-units').innerHTML = units.slice(0, 5).map((u) =>
        `<div class="unit"><span class="unit-name">${u.name}</span><span>${u.dist} m</span><span class="unit-status ${u.status === 'Ramming' ? 'hot' : ''}">${u.status}</span></div>`).join('')
        + (units.length > 5 ? `<div class="sub">+${units.length - 5} more units in the search zone</div>` : '');
      document.getElementById('police-state').textContent = s.wanted === 0 ? 'Streets quiet.' : s.policeState === 'search' ? `Searching near last known position. Clear in ${Math.ceil(s.searchTimer)}s.` : 'Active pursuit. Break line of sight to lose them.';
      document.getElementById('cash').textContent = `$${Math.floor(s.cash).toLocaleString('en-US')}`;
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < s.wanted ? STAR_FULL : STAR_EMPTY;
      const starsEl = document.getElementById('stars');
      starsEl.textContent = stars;
      starsEl.classList.toggle('hot', s.wanted >= 3);
      const speedo = document.getElementById('speedo');
      speedo.style.display = s.driving ? 'block' : 'none';
      if (s.driving) drawSpeedo(s.kmh, s.gear);
      document.getElementById('hint').textContent = s.hint || '';
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) document.getElementById('message').style.opacity = '0';
      }
    },
    message,
    showMenu(show) { document.getElementById('menu').classList.toggle('hidden', !show); },
    showPause(show) { document.getElementById('pause').classList.toggle('hidden', !show); },
    banner(text) {
      const b = document.getElementById('banner');
      b.textContent = text;
      b.classList.remove('hidden');
      setTimeout(() => b.classList.add('hidden'), 3200);
    },
    onStart(fn) { document.getElementById('btn-start').addEventListener('click', fn); },
    onContinue(fn) { document.getElementById('btn-continue').addEventListener('click', fn); },
    onReset(fn) { document.getElementById('btn-reset').addEventListener('click', fn); },
    onResume(fn) { document.getElementById('btn-resume').addEventListener('click', fn); },
    onQuit(fn) { document.getElementById('btn-quit').addEventListener('click', fn); },
  };
}
