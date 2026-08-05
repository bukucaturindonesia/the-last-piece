(() => {
  'use strict';

  const canvas = document.querySelector('#piece-chain-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreNode = document.querySelector('[data-game-score]');
  const bestNode = document.querySelector('[data-game-best]');
  const waveNode = document.querySelector('[data-game-wave]');
  const comboNode = document.querySelector('[data-game-combo]');
  const startButtons = document.querySelectorAll('[data-game-start], [data-game-overlay-action]');
  const pauseButton = document.querySelector('[data-game-pause]');
  const soundButton = document.querySelector('[data-game-sound]');
  const overlay = document.querySelector('[data-game-overlay]');
  const overlayTitle = document.querySelector('[data-game-overlay-title]');
  const overlayCopy = document.querySelector('[data-game-overlay-copy]');
  const liveNode = document.querySelector('[data-game-live]');

  const WIDTH = 1200;
  const HEIGHT = 720;
  const ORB_RADIUS = 20;
  const ORB_SPACING = 42;
  const PROJECTILE_SPEED = 720;
  const COLOURS = [
    { key: 'gold', base: '#f4b942', light: '#ffe59c', dark: '#8d5c12' },
    { key: 'green', base: '#59b96b', light: '#b8f3c4', dark: '#173d2a' },
    { key: 'blue', base: '#4ba6c8', light: '#bcefff', dark: '#17405b' },
    { key: 'ember', base: '#c94a32', light: '#ffb09f', dark: '#5f1d18' },
    { key: 'bone', base: '#d8d4c8', light: '#ffffff', dark: '#68655d' }
  ];

  const shooter = { x: WIDTH / 2, y: HEIGHT - 68, angle: -Math.PI / 2 };
  const state = {
    phase: 'idle',
    score: 0,
    best: Number(localStorage.getItem('tlp-piece-chain-best') || 0),
    wave: 1,
    combo: 1,
    headDistance: 820,
    speed: 38,
    chain: [],
    projectiles: [],
    particles: [],
    currentColour: 0,
    nextColour: 1,
    lastTime: 0,
    shotCooldown: 0,
    sound: true,
    audio: null,
    aimX: WIDTH / 2,
    aimY: HEIGHT / 2,
    messageTimer: 0
  };

  const logo = new Image();
  logo.src = '/brand/logo-symbol.webp';

  const controlPoints = [
    { x: 1245, y: 110 }, { x: 1020, y: 82 }, { x: 770, y: 152 },
    { x: 925, y: 278 }, { x: 1082, y: 390 }, { x: 900, y: 520 },
    { x: 650, y: 472 }, { x: 405, y: 348 }, { x: 170, y: 474 },
    { x: 360, y: 612 }, { x: 655, y: 548 }, { x: 650, y: 360 }
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomColour = () => Math.floor(Math.random() * COLOURS.length);

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: .5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: .5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  function buildPath() {
    const points = [];
    for (let i = 0; i < controlPoints.length - 1; i += 1) {
      const p0 = controlPoints[Math.max(0, i - 1)];
      const p1 = controlPoints[i];
      const p2 = controlPoints[i + 1];
      const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];
      for (let step = 0; step < 34; step += 1) points.push(catmullRom(p0, p1, p2, p3, step / 34));
    }
    points.push(controlPoints[controlPoints.length - 1]);

    let total = 0;
    const samples = points.map((point, index) => {
      if (index) total += Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y);
      return { ...point, distance: total };
    });
    return { samples, length: total };
  }

  const path = buildPath();

  function pointAt(distance) {
    const d = clamp(distance, 0, path.length);
    let low = 0;
    let high = path.samples.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (path.samples[mid].distance < d) low = mid + 1;
      else high = mid;
    }
    const next = path.samples[low];
    const prev = path.samples[Math.max(0, low - 1)];
    const span = Math.max(1, next.distance - prev.distance);
    const ratio = clamp((d - prev.distance) / span, 0, 1);
    return { x: prev.x + (next.x - prev.x) * ratio, y: prev.y + (next.y - prev.y) * ratio };
  }

  function tangentAt(distance) {
    const a = pointAt(distance - 4);
    const b = pointAt(distance + 4);
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  }

  function updateHud() {
    scoreNode.textContent = state.score.toLocaleString('en-US');
    bestNode.textContent = state.best.toLocaleString('en-US');
    waveNode.textContent = String(state.wave);
    comboNode.textContent = `x${state.combo}`;
  }

  function announce(message) {
    if (liveNode) liveNode.textContent = message;
  }

  function beep(frequency, duration = .07, gain = .035) {
    if (!state.sound) return;
    try {
      state.audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = state.audio.createOscillator();
      const volume = state.audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, state.audio.currentTime);
      volume.gain.exponentialRampToValueAtTime(.0001, state.audio.currentTime + duration);
      oscillator.connect(volume).connect(state.audio.destination);
      oscillator.start();
      oscillator.stop(state.audio.currentTime + duration);
    } catch {
      state.sound = false;
    }
  }

  function createChain(count) {
    const chain = [];
    for (let index = 0; index < count; index += 1) {
      let colour = randomColour();
      while (index > 1 && chain[index - 1] === colour && chain[index - 2] === colour) colour = randomColour();
      chain.push(colour);
    }
    return chain;
  }

  function resetGame() {
    state.phase = 'playing';
    state.score = 0;
    state.wave = 1;
    state.combo = 1;
    state.headDistance = 820;
    state.speed = 38;
    state.chain = createChain(28);
    state.projectiles = [];
    state.particles = [];
    state.currentColour = randomColour();
    state.nextColour = randomColour();
    state.shotCooldown = 0;
    state.lastTime = performance.now();
    overlay?.classList.add('is-hidden');
    pauseButton.disabled = false;
    pauseButton.textContent = 'Pause';
    startButtons.forEach((button) => { button.textContent = 'Restart'; });
    announce('Game started. Break the chain before it reaches the core.');
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function setOverlay(title, copy, action) {
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    const actionButton = overlay?.querySelector('[data-game-overlay-action]');
    if (actionButton) actionButton.textContent = action;
    overlay?.classList.remove('is-hidden');
  }

  function endGame() {
    state.phase = 'gameover';
    pauseButton.disabled = true;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('tlp-piece-chain-best', String(state.best));
    }
    updateHud();
    setOverlay('The core was reached.', `Final score: ${state.score.toLocaleString('en-US')}. The timeline can still be saved.`, 'Try again');
    announce(`Game over. Final score ${state.score}.`);
    beep(100, .45, .06);
  }

  function startNextWave() {
    state.wave += 1;
    state.combo = 1;
    state.speed = Math.min(78, 38 + (state.wave - 1) * 5);
    state.headDistance = 820;
    state.chain = createChain(Math.min(42, 26 + state.wave * 2));
    state.projectiles = [];
    state.score += 500 * state.wave;
    announce(`Wave ${state.wave}. Chain speed increased.`);
    beep(520, .13, .045);
    updateHud();
  }

  function fire() {
    if (state.phase !== 'playing' || state.shotCooldown > 0) return;
    const angle = state.shooterAngle ?? shooter.angle;
    const muzzle = 54;
    state.projectiles.push({
      x: shooter.x + Math.cos(angle) * muzzle,
      y: shooter.y + Math.sin(angle) * muzzle,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      colour: state.currentColour,
      life: 2.2
    });
    state.currentColour = state.nextColour;
    state.nextColour = randomColour();
    state.shotCooldown = .18;
    beep(310, .055, .025);
  }

  function spawnParticles(x, y, colour, count = 16) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 180;
      state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + Math.random() * .45, max: .9, colour });
    }
  }

  function removeMatches(preferredIndex) {
    let removedAny = false;
    let searchNear = preferredIndex;
    let chainReaction = 0;

    while (state.chain.length >= 3) {
      let match = null;
      const startAt = clamp(searchNear - 4, 0, state.chain.length - 1);
      const endAt = clamp(searchNear + 4, 0, state.chain.length - 1);
      for (let index = startAt; index <= endAt; index += 1) {
        let start = index;
        let end = index;
        while (start > 0 && state.chain[start - 1] === state.chain[index]) start -= 1;
        while (end < state.chain.length - 1 && state.chain[end + 1] === state.chain[index]) end += 1;
        if (end - start + 1 >= 3) { match = { start, end, colour: state.chain[index] }; break; }
      }
      if (!match) break;

      const count = match.end - match.start + 1;
      const centreIndex = (match.start + match.end) / 2;
      const distance = state.headDistance - (state.chain.length - 1 - centreIndex) * ORB_SPACING;
      const position = pointAt(distance);
      spawnParticles(position.x, position.y, match.colour, count * 6);
      state.chain.splice(match.start, count);
      chainReaction += 1;
      state.combo = Math.min(9, state.combo + (chainReaction > 1 ? 1 : 0));
      state.score += count * 100 * state.combo;
      searchNear = clamp(match.start, 0, Math.max(0, state.chain.length - 1));
      removedAny = true;
      beep(440 + chainReaction * 75, .09, .045);
    }

    if (!removedAny) state.combo = 1;
    updateHud();
    if (!state.chain.length) window.setTimeout(startNextWave, 450);
  }

  function insertProjectile(projectile, collisionIndex) {
    const chainLength = state.chain.length;
    const distance = state.headDistance - (chainLength - 1 - collisionIndex) * ORB_SPACING;
    const orb = pointAt(distance);
    const tangent = tangentAt(distance);
    const relativeX = projectile.x - orb.x;
    const relativeY = projectile.y - orb.y;
    const insertAfter = relativeX * tangent.x + relativeY * tangent.y > 0;
    const insertIndex = clamp(collisionIndex + (insertAfter ? 1 : 0), 0, state.chain.length);
    state.chain.splice(insertIndex, 0, projectile.colour);
    removeMatches(insertIndex);
  }

  function update(delta) {
    if (state.phase !== 'playing') return;
    state.shotCooldown = Math.max(0, state.shotCooldown - delta);
    state.headDistance += state.speed * delta;

    const headPosition = state.headDistance;
    if (headPosition >= path.length - 24) {
      endGame();
      return;
    }

    for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = state.projectiles[index];
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      projectile.life -= delta;

      let hitIndex = -1;
      for (let orbIndex = 0; orbIndex < state.chain.length; orbIndex += 1) {
        const d = state.headDistance - (state.chain.length - 1 - orbIndex) * ORB_SPACING;
        if (d < -ORB_RADIUS || d > path.length + ORB_RADIUS) continue;
        const orb = pointAt(d);
        if (Math.hypot(projectile.x - orb.x, projectile.y - orb.y) < ORB_RADIUS * 1.75) { hitIndex = orbIndex; break; }
      }

      if (hitIndex >= 0) {
        insertProjectile(projectile, hitIndex);
        state.projectiles.splice(index, 1);
        continue;
      }

      if (projectile.life <= 0 || projectile.x < -60 || projectile.x > WIDTH + 60 || projectile.y < -60 || projectile.y > HEIGHT + 60) state.projectiles.splice(index, 1);
    }

    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 160 * delta;
      particle.life -= delta;
      if (particle.life <= 0) state.particles.splice(index, 1);
    }
  }

  function orbGradient(x, y, colourIndex, radius = ORB_RADIUS) {
    const colour = COLOURS[colourIndex];
    const gradient = ctx.createRadialGradient(x - radius * .34, y - radius * .4, radius * .12, x, y, radius);
    gradient.addColorStop(0, colour.light);
    gradient.addColorStop(.38, colour.base);
    gradient.addColorStop(1, colour.dark);
    return gradient;
  }

  function drawOrb(x, y, colourIndex, radius = ORB_RADIUS, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = COLOURS[colourIndex].base;
    ctx.shadowBlur = 15;
    ctx.fillStyle = orbGradient(x, y, colourIndex, radius);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.beginPath();
    ctx.arc(x - radius * .3, y - radius * .36, radius * .18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground() {
    const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    background.addColorStop(0, '#070a08');
    background.addColorStop(.58, '#0c130e');
    background.addColorStop(1, '#080a09');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = .055;
    ctx.strokeStyle = '#f1efe8';
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y < HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    ctx.restore();

    const glow = ctx.createRadialGradient(WIDTH * .55, HEIGHT * .48, 20, WIDTH * .55, HEIGHT * .48, 480);
    glow.addColorStop(0, 'rgba(89,185,107,.11)');
    glow.addColorStop(.5, 'rgba(244,185,66,.035)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawPath() {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path.samples.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = 'rgba(0,0,0,.72)';
    ctx.lineWidth = 54;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(244,185,66,.12)';
    ctx.lineWidth = 47;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(89,185,107,.13)';
    ctx.lineWidth = 39;
    ctx.stroke();
    ctx.setLineDash([6, 16]);
    ctx.strokeStyle = 'rgba(241,239,232,.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const core = pointAt(path.length);
    const coreGlow = ctx.createRadialGradient(core.x, core.y, 4, core.x, core.y, 75);
    coreGlow.addColorStop(0, 'rgba(244,185,66,.55)');
    coreGlow.addColorStop(.3, 'rgba(89,185,107,.2)');
    coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(core.x, core.y, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f4b942';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(core.x, core.y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#090b0d';
    ctx.fill();
    ctx.fillStyle = '#f4b942';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CORE', core.x, core.y + 4);
  }

  function drawChain() {
    state.chain.forEach((colour, index) => {
      const distance = state.headDistance - (state.chain.length - 1 - index) * ORB_SPACING;
      if (distance < -ORB_RADIUS || distance > path.length + ORB_RADIUS) return;
      const point = pointAt(distance);
      drawOrb(point.x, point.y, colour);
    });
  }

  function drawShooter() {
    const angle = state.shooterAngle ?? shooter.angle;
    ctx.save();
    ctx.translate(shooter.x, shooter.y);

    ctx.strokeStyle = 'rgba(244,185,66,.23)';
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 10]);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 54, Math.sin(angle) * 54);
    ctx.lineTo(Math.cos(angle) * 215, Math.sin(angle) * 215);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(angle + Math.PI / 2);
    const barrel = ctx.createLinearGradient(-14, -56, 14, 22);
    barrel.addColorStop(0, '#f4b942');
    barrel.addColorStop(1, '#6c470d');
    ctx.fillStyle = barrel;
    ctx.beginPath();
    ctx.roundRect(-15, -62, 30, 74, 12);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(89,185,107,.38)';
    ctx.shadowBlur = 26;
    if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, shooter.x - 55, shooter.y - 55, 110, 110);
    else {
      ctx.fillStyle = '#173d2a';
      ctx.beginPath(); ctx.arc(shooter.x, shooter.y, 50, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    drawOrb(shooter.x, shooter.y - 2, state.currentColour, 15);
    ctx.fillStyle = 'rgba(241,239,232,.72)';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', shooter.x + 76, shooter.y - 23);
    drawOrb(shooter.x + 76, shooter.y + 4, state.nextColour, 13);
  }

  function drawProjectiles() {
    state.projectiles.forEach((projectile) => drawOrb(projectile.x, projectile.y, projectile.colour, 16));
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      const alpha = clamp(particle.life / particle.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLOURS[particle.colour].base;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.5 + alpha * 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function render() {
    drawBackground();
    drawPath();
    drawChain();
    drawProjectiles();
    drawShooter();
    drawParticles();
  }

  function frame(time) {
    const delta = clamp((time - (state.lastTime || time)) / 1000, 0, .035);
    state.lastTime = time;
    update(delta);
    render();
    requestAnimationFrame(frame);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * WIDTH / rect.width, y: (event.clientY - rect.top) * HEIGHT / rect.height };
  }

  function setAim(point) {
    state.aimX = point.x;
    state.aimY = point.y;
    const angle = Math.atan2(point.y - shooter.y, point.x - shooter.x);
    state.shooterAngle = clamp(angle, -Math.PI + .12, -.12);
  }

  canvas.addEventListener('pointermove', (event) => setAim(canvasPoint(event)));
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setAim(canvasPoint(event));
    fire();
  });

  canvas.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); fire(); }
    if (event.key.toLowerCase() === 'p') pauseButton?.click();
  });

  startButtons.forEach((button) => button.addEventListener('click', () => {
    if (state.phase === 'paused') pauseButton?.click();
    else resetGame();
  }));

  pauseButton?.addEventListener('click', () => {
    if (state.phase === 'playing') {
      state.phase = 'paused';
      pauseButton.textContent = 'Resume';
      setOverlay('Timeline paused.', 'The chain will wait until you return.', 'Resume game');
      announce('Game paused.');
    } else if (state.phase === 'paused') {
      state.phase = 'playing';
      state.lastTime = performance.now();
      pauseButton.textContent = 'Pause';
      overlay?.classList.add('is-hidden');
      announce('Game resumed.');
    }
  });

  soundButton?.addEventListener('click', () => {
    state.sound = !state.sound;
    soundButton.setAttribute('aria-pressed', String(state.sound));
    soundButton.textContent = state.sound ? 'Sound on' : 'Sound off';
    if (state.sound) beep(440);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.phase === 'playing') pauseButton?.click();
  });

  updateHud();
  render();
  requestAnimationFrame(frame);
})();
