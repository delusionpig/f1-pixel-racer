(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.querySelector('.stage');
  const overlay = document.getElementById('overlay');
  const startCard = document.getElementById('startCard');
  const loadingCard = document.getElementById('loadingCard');
  const loadingBackdrop = document.getElementById('loadingBackdrop');
  const loadingFill = document.getElementById('loadingFill');
  const loadingRetry = document.getElementById('loadingRetry');
  const endCard = document.getElementById('endCard');
  const startButton = document.getElementById('startButton');
  const restartButton = document.getElementById('restartButton');
  const birthdayVideo = document.getElementById('birthdayVideo');
  const backgroundMusic = document.getElementById('backgroundMusic');
  const videoTheater = document.getElementById('videoTheater');
  const theaterClose = document.getElementById('theaterClose');
  const signalImage = document.getElementById('signalImage');
  const startHint = document.getElementById('startHint');
  const reactionTime = document.getElementById('reactionTime');
  const coinCount = document.getElementById('coinCount');
  const damageCount = document.getElementById('damageCount');
  const car = new Image();
  const coinSprite = new Image();
  const tireSprite = new Image();
  const paddockFront = new Image();
  const paddockBack = new Image();
  const podiumImage = document.querySelector('#podium img');
  const startLights = Array.from({ length: 6 }, () => new Image());
  const totalAssets = 14;
  let assetsReady = false;
  let completedAssets = 0;
  let videoProgress = 0;
  const assetImages = [
    [car, 'assets/race-car.png', '赛车精灵'],
    [coinSprite, 'assets/coin.png', '金币素材'],
    [tireSprite, 'assets/tires.png', '轮胎素材'],
    [paddockFront, 'assets/paddock-front.jpg', '赛道前景'],
    [paddockBack, 'assets/paddock-back.jpg', '赛道背景'],
    [podiumImage, 'assets/podium.png', '领奖台'],
    ...startLights.map((image, i) => [image, `assets/start-light-${i}.png`, '起步信号灯'])
  ];
  const birthdayVideoUrl = 'assets/birthday-message.mp4';
  const W = 480, H = 800, ROAD_TOP = 184, ROAD_BOTTOM = 632;
  let state = 'ready', last = 0, elapsed = 0, scroll = 0, spawnTimer = 0;
  let coins = 0, hits = 0, playerY = 400, pointerTarget = null, objects = [], particles = [];
  let lightsReadyAt = 0;
  const keys = new Set();
  const lanes = [268, 400, 532];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setLoadingProgress(loaded) {
    const percent = Math.min(100, Math.round((loaded + videoProgress) / totalAssets * 100));
    loadingFill.style.width = `${percent}%`;
  }

  function loadImage(image, src, label) {
    return new Promise((resolve, reject) => {
      const finishLoad = async () => {
        try {
          if (image.decode) await image.decode();
          resolve(label);
        } catch {
          reject(new Error(`${label}解码失败`));
        }
      };
      if (image.complete && image.naturalWidth) {
        finishLoad();
        return;
      }
      image.onload = finishLoad;
      image.onerror = () => reject(new Error(`${label}加载失败`));
      image.src = src;
    });
  }

  function loadAudio(audio, label) {
    return new Promise((resolve, reject) => {
      audio.addEventListener('canplaythrough', () => resolve(label), { once: true });
      audio.addEventListener('error', () => reject(new Error(`${label}加载失败`)), { once: true });
      audio.load();
    });
  }

  async function loadBirthdayVideo() {
    const response = await fetch(birthdayVideoUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error('生日祝福视频加载失败');
    const length = Number(response.headers.get('content-length')) || 0;
    const reader = response.body?.getReader();
    if (reader) {
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        const percent = length ? Math.floor(received / length * 100) : 0;
        videoProgress = Math.min(.99, percent / 100);
        const overall = Math.floor((completedAssets + videoProgress) / totalAssets * 100);
        loadingFill.style.width = `${overall}%`;
      }
    } else {
      videoProgress = .99;
      setLoadingProgress(completedAssets);
    }
    await new Promise((resolve, reject) => {
      birthdayVideo.oncanplaythrough = resolve;
      birthdayVideo.onerror = () => reject(new Error('生日祝福视频解码失败'));
      birthdayVideo.src = birthdayVideoUrl;
      birthdayVideo.load();
    });
    return '生日祝福视频';
  }

  async function loadAllAssets() {
    assetsReady = false;
    completedAssets = 0;
    videoProgress = 0;
    loadingCard.classList.remove('hidden');
    loadingBackdrop.classList.remove('hidden');
    startCard.classList.add('hidden');
    loadingRetry.classList.add('hidden');
    startButton.disabled = true;
    setLoadingProgress(0);
    let loaded = 0;
    try {
      await loadAudio(backgroundMusic, 'BGM');
      loaded++;
      completedAssets = loaded;
      setLoadingProgress(loaded);
      await backgroundMusic.play().catch(() => {});

      const tasks = assetImages.map(([image, src, label]) => loadImage(image, src, label));
      tasks.push(loadBirthdayVideo());
      await Promise.all(tasks.map(task => task.then(() => {
        loaded++;
        completedAssets = loaded;
        setLoadingProgress(loaded);
      })));
      assetsReady = true;
      setLoadingProgress(totalAssets);
    loadingCard.classList.add('hidden');
    loadingBackdrop.classList.add('hidden');
    startBackgroundMusic();
    startCard.classList.remove('hidden');
      startHint.textContent = '所有游戏素材已加载，点击点火开始';
      startButton.disabled = false;
    } catch (error) {
      loadingRetry.title = `${error.message}，点击重试`;
      loadingRetry.classList.remove('hidden');
    }
  }

  function drawPixelRoad(dt) {
    const shift = scroll % 80;
    ctx.fillStyle = '#172514'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#20321c';
    for (let x = -shift; x < W + 80; x += 80) {
      ctx.fillRect(x + 13, 40, 17, 7); ctx.fillRect(x + 48, 103, 10, 12);
      ctx.fillRect(x + 4, 683, 20, 8); ctx.fillRect(x + 56, 730, 14, 6);
    }
    drawPaddockStrip(paddockFront, 0, ROAD_TOP - 12, scroll * .58);
    drawPaddockStrip(paddockBack, ROAD_BOTTOM + 12, H - ROAD_BOTTOM - 12, scroll * .42);
    // Track shoulders and red-white kerbs.
    ctx.fillStyle = '#f1e5ce'; ctx.fillRect(0, ROAD_TOP - 12, W, 12); ctx.fillRect(0, ROAD_BOTTOM, W, 12);
    for (let x = -((scroll * 1.3) % 48); x < W + 48; x += 48) {
      ctx.fillStyle = Math.floor((x + scroll) / 48) % 2 ? '#e8242c' : '#f5f0e6';
      ctx.fillRect(x, ROAD_TOP - 12, 24, 12); ctx.fillRect(x, ROAD_BOTTOM, 24, 12);
    }
    ctx.fillStyle = '#303033'; ctx.fillRect(0, ROAD_TOP, W, ROAD_BOTTOM - ROAD_TOP);
    // Pixel grain and subtle bands make the road feel alive without busy scenery.
    ctx.fillStyle = '#353538';
    for (let x = -((scroll * .4) % 93); x < W + 93; x += 93) ctx.fillRect(x, ROAD_TOP + 20, 42, 3);
    ctx.fillStyle = '#27272a';
    for (let x = -((scroll * .65) % 117); x < W + 117; x += 117) ctx.fillRect(x, ROAD_BOTTOM - 22, 55, 3);
    for (const y of [335, 466]) {
      for (let x = -((scroll * 1.15) % 88); x < W + 88; x += 88) {
        ctx.fillStyle = '#f5f1dc'; ctx.fillRect(x, y, 44, 5);
      }
    }
    // F1 start/finish stripe, seen briefly during each lap.
    const finishX = W - (scroll % 4200);
    if (finishX > -30 && finishX < W + 30 && scroll > 1500) {
      for (let y = ROAD_TOP; y < ROAD_BOTTOM; y += 24) for (let x = 0; x < 24; x += 12) {
        ctx.fillStyle = ((y / 24 + x / 12) % 2) ? '#f2f2ed' : '#181819';
        ctx.fillRect(finishX + x, y, 12, 12);
      }
    }
  }

  function drawPaddockStrip(image, y, height, offset) {
    if (!image.complete || !image.naturalWidth) return;
    const tileWidth = height * image.naturalWidth / image.naturalHeight;
    const shift = offset % tileWidth;
    for (let x = -shift; x < W; x += tileWidth) ctx.drawImage(image, x, y, tileWidth, height);
  }

  function drawCar() {
    const w = 180, h = 74;
    if (car.complete && car.naturalWidth) {
      ctx.drawImage(car, 58, 216, 1420, 560, 30, playerY - h / 2, w, h);
    } else {
      ctx.fillStyle = '#e31b2b'; ctx.fillRect(51, playerY - 24, 135, 48);
      ctx.fillStyle = '#111'; ctx.fillRect(84, playerY - 17, 74, 34);
    }
    // Tiny exhaust pixels trail left as the track scrolls.
    if (state === 'running') {
      ctx.fillStyle = '#ff9d39'; ctx.fillRect(29, playerY - 5 + Math.sin(elapsed * 30) * 3, 8, 4);
      ctx.fillStyle = '#f34228'; ctx.fillRect(20, playerY + 3, 6, 3);
    }
  }

  function drawCoin(o) {
    const bob = Math.sin(o.phase + elapsed * 5) * 3;
    const y = o.y + bob;
    if (coinSprite.complete && coinSprite.naturalWidth) {
      ctx.drawImage(coinSprite, o.x - 26, y - 26, 52, 52);
      return;
    }
    ctx.fillStyle = '#8c5700'; ctx.fillRect(o.x - 13, y - 17, 26, 34);
    ctx.fillStyle = '#f7b928'; ctx.fillRect(o.x - 10, y - 17, 20, 34);
    ctx.fillStyle = '#ffe779'; ctx.fillRect(o.x - 5, y - 12, 10, 24);
    ctx.fillStyle = '#fff2ae'; ctx.fillRect(o.x - 2, y - 9, 4, 18);
  }

  function drawTire(o) {
    if (tireSprite.complete && tireSprite.naturalWidth) {
      ctx.drawImage(tireSprite, o.x - 42, o.y - 39, 84, 78);
      return;
    }
    ctx.fillStyle = '#09090a'; ctx.fillRect(o.x - 23, o.y - 27, 46, 54);
    ctx.fillStyle = '#242426'; ctx.fillRect(o.x - 18, o.y - 23, 36, 46);
    ctx.fillStyle = '#0a0a0b'; ctx.fillRect(o.x - 11, o.y - 17, 22, 34);
    ctx.fillStyle = '#e6232e'; ctx.fillRect(o.x - 19, o.y - 24, 38, 4);
    ctx.fillStyle = '#606064'; ctx.fillRect(o.x - 4, o.y - 10, 8, 20);
  }

  function drawParticles(dt) {
    particles.forEach(p => { p.x -= p.vx * dt; p.y += p.vy * dt; p.life -= dt; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); });
    particles = particles.filter(p => p.life > 0);
  }

  function draw(dt = 0) {
    ctx.clearRect(0, 0, W, H);
    drawPixelRoad(dt);
    for (const o of objects) o.type === 'coin' ? drawCoin(o) : drawTire(o);
    drawCar(); drawParticles(dt);
    if (state !== 'running') drawReadyCarGlow();
  }

  function drawReadyCarGlow() {
    const g = ctx.createRadialGradient(119, playerY, 20, 119, playerY, 115);
    g.addColorStop(0, '#ff172018'); g.addColorStop(1, '#ff172000');
    ctx.fillStyle = g; ctx.fillRect(0, playerY - 115, 250, 230);
  }

  function startBackgroundMusic() {
    if (videoTheater.classList.contains('hidden')) backgroundMusic.play().catch(() => {});
  }

  function stopBackgroundMusic() {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  }

  function reset() {
    state = 'ready'; elapsed = 0; scroll = 0; spawnTimer = .75; coins = 0; hits = 0;
    playerY = 400; pointerTarget = null; objects = []; particles = [];
    coinCount.textContent = '0'; damageCount.textContent = '♥ ♥';
    reactionTime.textContent = '--- ms'; startHint.textContent = '点击“点火出发”开始灯光倒计时';
    restartButton.innerHTML = '再跑一圈 <span>↻</span>';
    endCard.classList.add('hidden'); startCard.classList.remove('hidden'); overlay.classList.remove('hidden');
    stage.classList.remove('running'); signalImage.src = 'assets/start-light-0.png'; draw();
  }

  function startRace() {
    if (!assetsReady || state === 'countdown' || state === 'running') return;
    state = 'countdown'; startButton.disabled = true;
    startHint.textContent = '按空格或点击屏幕起步，五灯未全亮前抢跑将犯规';
    const sequence = [0, 1, 2, 3, 4];
    sequence.forEach((index, i) => setTimeout(() => {
      if (state !== 'countdown') return;
      signalImage.src = `assets/start-light-${index + 1}.png`;
      if (i === sequence.length - 1) {
        state = 'armed'; lightsReadyAt = performance.now();
        startHint.textContent = '五灯全亮！按空格或点击屏幕起步';
      }
    }, i * 1000));
  }

  function falseStart() {
    state = 'falseStart';
    startButton.disabled = false;
    startCard.classList.add('hidden'); endCard.classList.remove('hidden');
    overlay.classList.remove('hidden');
    document.getElementById('endEyebrow').textContent = 'FALSE START';
    document.getElementById('endTitle').textContent = '🚩 抢跑犯规';
    document.getElementById('endCopy').textContent = '五盏灯全亮前不能起步，请重新进行起步信号。';
    document.getElementById('podium').classList.add('hidden');
    document.getElementById('videoPlaceholder').classList.add('hidden');
    restartButton.textContent = '重新起跑 ↻';
  }

  function launch() {
    if (state === 'countdown') { falseStart(); return; }
    if (state !== 'armed') return;
    reactionTime.textContent = `${Math.round(performance.now() - lightsReadyAt)} ms`;
    state = 'running'; elapsed = 0; spawnTimer = .45;
    startButton.disabled = false; overlay.classList.add('hidden'); stage.classList.add('running');
  }

  function spawn() {
    // Keep a clear lane when a pair of tire stacks appears.
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const isCoin = Math.random() < .36;
    objects.push({ type: isCoin ? 'coin' : 'tire', x: W + 45, y: lane, phase: Math.random() * 6 });
    if (!isCoin && Math.random() < .34) {
      const blockedLanes = [lane];
      const other = lanes.filter(y => !blockedLanes.includes(y))[Math.floor(Math.random() * 2)];
      objects.push({ type: 'tire', x: W + 165, y: other, phase: 0 });
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 12; i++) particles.push({ x, y, vx: 30 + Math.random() * 140, vy: (Math.random() - .5) * 190, life: .22 + Math.random() * .35, color });
  }

  function finish(win) {
    state = win ? 'won' : 'lost'; stage.classList.remove('running'); overlay.classList.remove('hidden');
    startCard.classList.add('hidden'); endCard.classList.remove('hidden');
    document.getElementById('endEyebrow').textContent = win ? 'PODIUM FINISH · P1' : 'RACE OVER';
    document.getElementById('endTitle').textContent = win ? '冠军！' : '比赛结束';
    document.getElementById('endCopy').textContent = win ? '漂亮的冲线！你拿下了本场胜利。' : '轮胎墙挡住了你的冲刺，再来一圈吧。';
    document.getElementById('podium').classList.toggle('hidden', !win);
    document.getElementById('videoPlaceholder').classList.toggle('hidden', !win);
  }

  function update(dt) {
    elapsed += dt;
    const speed = Math.min(330, 242 + elapsed * 2.2);
    scroll += speed * dt;
    if (pointerTarget !== null) playerY += (pointerTarget - playerY) * Math.min(1, dt * 11);
    else {
      let dir = 0;
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) dir -= 1;
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) dir += 1;
      playerY += dir * 320 * dt;
    }
    playerY = clamp(playerY, ROAD_TOP + 52, ROAD_BOTTOM - 52);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawn(); spawnTimer = Math.max(.78, .96 - elapsed * .003) + Math.random() * .24; }
    for (const o of objects) {
      o.x -= speed * dt;
      if (!o.done && Math.abs(o.x - 116) < 34 && Math.abs(o.y - playerY) < (o.type === 'coin' ? 48 : 45)) {
        o.done = true;
        if (o.type === 'coin') { coins++; coinCount.textContent = String(coins); burst(o.x, o.y, '#ffd348'); if (coins >= 5) finish(true); }
        else { hits++; damageCount.textContent = hits === 1 ? '♥ ·' : '· ·'; burst(o.x, o.y, '#ff3945'); if (hits >= 2) finish(false); }
      }
      if (state !== 'running') break;
    }
    objects = objects.filter(o => o.x > -50 && !o.done);
  }

  function frame(now) {
    const dt = Math.min(.033, Math.max(0, (now - last) / 1000 || 0)); last = now;
    if (state === 'running') update(dt);
    draw(dt); requestAnimationFrame(frame);
  }

  function pointerMove(event) {
    if (state !== 'running') return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = H / rect.height;
    pointerTarget = clamp((event.clientY - rect.top) * scaleY, ROAD_TOP + 52, ROAD_BOTTOM - 52);
  }
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointerMove(e); });
  canvas.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') pointerMove(e); });
  canvas.addEventListener('pointerup', () => { pointerTarget = null; });
  document.addEventListener('pointerdown', e => {
    startBackgroundMusic();
    if (e.target === startButton || e.target === restartButton) return;
    if (state === 'countdown' || state === 'armed') launch();
  });
  window.addEventListener('keydown', e => {
    startBackgroundMusic();
    if (['ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if (e.code === 'Space' && (state === 'countdown' || state === 'armed')) { launch(); return; }
    if (e.key === 'Enter' && state === 'ready') startRace();
    else if (e.key === 'Enter' && ['lost','won','falseStart'].includes(state)) { reset(); startRace(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.key));
  startButton.addEventListener('click', startRace);
  loadingRetry.addEventListener('click', loadAllAssets);
  restartButton.addEventListener('click', () => { reset(); startRace(); });
  document.getElementById('videoPlaceholder').addEventListener('click', async () => {
    stopBackgroundMusic();
    videoTheater.classList.remove('hidden');
    try {
      await birthdayVideo.play();
      if (matchMedia('(max-width: 700px)').matches && videoTheater.requestFullscreen) {
        await videoTheater.requestFullscreen();
      }
    } catch {
      birthdayVideo.controls = true;
    }
  });
  function closeVideoTheater() {
    birthdayVideo.pause();
    birthdayVideo.currentTime = 0;
    videoTheater.classList.add('hidden');
    startBackgroundMusic();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  theaterClose.addEventListener('click', closeVideoTheater);
  videoTheater.addEventListener('click', e => { if (e.target === videoTheater) closeVideoTheater(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !videoTheater.classList.contains('hidden')) closeVideoTheater(); });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !videoTheater.classList.contains('hidden') && birthdayVideo.paused) videoTheater.classList.add('hidden');
  });
  document.getElementById('endCard').addEventListener('click', e => { if (e.target === document.getElementById('endCard')) { reset(); startRace(); } });
  reset();
  loadAllAssets();
  requestAnimationFrame(frame);
})();
