const socket = io();
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 580;

const COLS = 10;
const ROWS = 6;
const CELL_WIDTH = 80;
const CELL_HEIGHT = 80;

const params = new URLSearchParams(window.location.search);
const gameId = params.get('gameId');
const role = sessionStorage.getItem('gameRole');
const plantNickname = sessionStorage.getItem('plantNickname');
const zombieNickname = sessionStorage.getItem('zombieNickname');

let gameState = null;
let prevGameState = null;
let stateTimestamp = 0;
let selectedAction = null;
let itemsList = [];
let sunInterval = null;
let zombieSunInterval = null;
let timerInterval = null;
let readySent = false;
let animFrameId = null;
const GAME_DURATION = 300;
const INTERPOLATION_DELAY = 100;

let playerStatus = { plant: 'online', zombie: 'online' };



const PLANTS = {
  1: { name: 'Подсолнух', cost: 50, emoji: '🌻', type: 'producer' },
  2: { name: 'Горохострел', cost: 100, emoji: '🌱', type: 'shooter' },
  3: { name: 'Стена-орех', cost: 50, emoji: '🥜', type: 'wall' },
  4: { name: 'Вишня-бомба', cost: 150, emoji: '🍒', type: 'explosive' },
  5: { name: 'Снежный горох', cost: 175, emoji: '❄️', type: 'slow' },
  6: { name: 'Повторитель', cost: 200, emoji: '🔁', type: 'repeater' }
};

const ZOMBIES = {
  1: { name: 'Обычный', cost: 50, hp: 100, speed: 1, emoji: '🧟' },
  2: { name: 'Конус', cost: 75, hp: 200, speed: 1, emoji: '🧟‍♂️' },
  3: { name: 'Ведро', cost: 100, hp: 350, speed: 0.8, emoji: '🪖' },
  4: { name: 'Футболист', cost: 200, hp: 500, speed: 2, emoji: '🏃' },
  5: { name: 'Танцор', cost: 125, hp: 150, speed: 1.5, emoji: '💃' },
  6: { name: 'Гаргантюа', cost: 300, hp: 1000, speed: 0.5, emoji: '👹' },
  7: { name: 'Имп', cost: 80, hp: 80, speed: 2.5, emoji: '👾' },
  8: { name: 'Зомбони', cost: 200, hp: 600, speed: 1.2, emoji: '🏎️' },
};

function getInterpolationFactor() {
  const now = performance.now();
  const elapsed = now - stateTimestamp;
  const t = Math.max(0, Math.min(1, (elapsed - INTERPOLATION_DELAY) / 400));
  return t;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getInterpolatedZombie(z) {
  if (!prevGameState || !prevGameState.zombies) return z;
  const prev = prevGameState.zombies.find(pz => pz.id === z.id);
  if (!prev) return z;
  const t = getInterpolationFactor();
  return {
    ...z,
    col: lerp(prev.col, z.col, t),
    hp: Math.round(lerp(prev.hp, z.hp, t))
  };
}

function getInterpolatedProjectile(p) {
  if (!prevGameState || !prevGameState.projectiles) return p;
  const prev = prevGameState.projectiles.find(pp => pp.row === p.row && pp.col === p.col);
  if (!prev) return p;
  const t = getInterpolationFactor();
  return {
    ...p,
    col: lerp(prev.col, p.col, t)
  };
}

function getInterpolatedHP() {
  if (!prevGameState) return gameState.plantHP;
  const t = getInterpolationFactor();
  return lerp(prevGameState.plantHP, gameState.plantHP, t);
}

function init() {
  const indicator = document.getElementById('role-indicator');
  indicator.textContent = role === 'plant' ? '🌻 Растение' : '🧟 Зомби';
  indicator.className = role;

  document.getElementById('opponent-info').textContent = 
    role === 'plant' ? `🧟 Противник: ${zombieNickname}` : `🌻 Противник: ${plantNickname}`;

  if (currentUser) {
    socket.emit('user_online', currentUser.id);
  }

  loadItems();
  setupEventListeners();
  updatePlayerStatus();

  socket.emit('join_game_room', { gameId, role });
}

socket.on('joined_game_room', () => {
  showReadyScreen();
});

socket.on('both_connected', () => {
  if (!readySent) showReadyScreen();
});

function showReadyScreen() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const message = document.getElementById('overlay-message');
  const btn = document.getElementById('overlay-btn');

  title.textContent = '🌻 vs 🧟';
  title.style.color = '#FFD700';
  message.innerHTML = `
    <div class="ready-players">
      <div class="ready-player ${role === 'plant' ? 'highlight' : ''}">
        <span class="player-emoji">🌻</span>
        <span>${plantNickname}</span>
      </div>
      <div class="vs-text">VS</div>
      <div class="ready-player ${role === 'zombie' ? 'highlight' : ''}">
        <span class="player-emoji">🧟</span>
        <span>${zombieNickname}</span>
      </div>
    </div>
    <p style="margin-top:20px">Вы играете за: <strong>${role === 'plant' ? '🌻 Растения' : '🧟 Зомби'}</strong></p>
  `;
  btn.textContent = '✅ Готов!';
  btn.onclick = () => {
    overlay.classList.add('hidden');
    readySent = true;
    socket.emit('player_ready', { gameId, role });
    startGameLoops();
  };
  overlay.classList.remove('hidden');
}

async function loadItems() {
  try {
    if (!currentUser) return;
    const [itemsRes, unlockedRes] = await Promise.all([
      fetch(`${window.location.origin}/api/inventory/items`),
      fetch(`${window.location.origin}/api/shop/unlocked/${currentUser.id}`)
    ]);
    const data = await itemsRes.json();
    const unlockedData = await unlockedRes.json();
    const unlocked = (unlockedData.unlocked_plants || [1, 2, 3]).map(Number);
    data.plants = data.plants.filter(p => unlocked.includes(p.id));
    itemsList = role === 'plant' ? data.plants.slice(0, 6) : data.zombies.slice(0, 6);
    renderActionBar();
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

function renderActionBar() {
  const bar = document.getElementById('items-bar');
  bar.innerHTML = '';

  itemsList.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'action-item';
    const emoji = role === 'plant' ? (PLANTS[item.id]?.emoji || item.emoji || '🌱') : (ZOMBIES[item.id]?.emoji || item.emoji || '🧟');
    const cost = role === 'plant' ? `☀️${item.cost}` : `❤️${item.hp}`;
    div.innerHTML = `<div class="emoji">${emoji}</div><div class="name">${item.name}</div><div class="cost">${cost}</div>`;
    div.onclick = () => {
      selectedAction = item;
      document.querySelectorAll('.action-item').forEach(i => i.classList.remove('selected'));
      div.classList.add('selected');
    };
    bar.appendChild(div);
  });
}

function setupEventListeners() {
  canvas.addEventListener('click', handleCanvasClick);
}

function handleCanvasClick(e) {
  if (!gameState || gameState.gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  const col = Math.floor((x - 160) / CELL_WIDTH);
  const row = Math.floor((y - 40) / CELL_HEIGHT);

  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  if (role === 'plant' && selectedAction) {
    placePlant(row, col);
  } else if (role === 'zombie' && selectedAction) {
    spawnZombie(row);
  }
}

function placePlant(row, col) {
  if (gameState.grid[row][col]) return;
  if (gameState.plantSun < selectedAction.cost) return;
  socket.emit('game_action', { gameId, action: 'place_plant', data: { row, col, plantId: selectedAction.id, cost: selectedAction.cost } });
}

function spawnZombie(row) {
  if (gameState.zombieSun < selectedAction.cost) return;
  socket.emit('game_action', { gameId, action: 'spawn_zombie', data: { row, zombieId: selectedAction.id, cost: selectedAction.cost, hp: selectedAction.hp, speed: selectedAction.speed } });
}

function startGameLoops() {
  if (role === 'plant') {
    sunInterval = setInterval(() => {
      socket.emit('game_action', { gameId, action: 'collect_sun', data: { amount: 25 } });
    }, 5000);
  } else {
    zombieSunInterval = setInterval(() => {
      socket.emit('game_action', { gameId, action: 'zombie_earn_sun', data: { amount: 25 } });
    }, 6000);
  }
}

socket.on('game_start', ({ state }) => {
  prevGameState = null;
  gameState = state;
  stateTimestamp = performance.now();
  updateSunDisplay();
  updateTimerDisplay();
  startLocalTimer();
  startAnimationLoop();
});

socket.on('game_state', (state) => {
  prevGameState = gameState ? JSON.parse(JSON.stringify(gameState)) : null;
  gameState = state;
  stateTimestamp = performance.now();
  updateSunDisplay();
  updateTimerDisplay();
});

socket.on('player_status_change', ({ userId, online }) => {
  if (userId === plantNickname || userId === zombieNickname) {
    const playerRole = userId === plantNickname ? 'plant' : 'zombie';
    playerStatus[playerRole] = online ? 'online' : 'offline';
    updatePlayerStatus();
  }
});

function updatePlayerStatus() {
  const p1Dot = document.getElementById('player1-status');
  const p2Dot = document.getElementById('player2-status');
  if (p1Dot && p2Dot) {
    p1Dot.className = `status-dot ${playerStatus.plant}`;
    p2Dot.className = `status-dot ${playerStatus.zombie}`;
  }
}

socket.on('game_over', ({ winner, admin }) => {
  clearInterval(sunInterval);
  clearInterval(zombieSunInterval);
  clearInterval(timerInterval);
  if (animFrameId) cancelAnimationFrame(animFrameId);
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const message = document.getElementById('overlay-message');
  const btn = document.getElementById('overlay-btn');
  overlay.classList.remove('hidden');
  if (admin) {
    title.textContent = '🛡️ Игра завершена админом';
    title.style.color = '#FF5722';
    message.textContent = winner === role ? '🎉 Вам засчитана победа!' : '💀 Вам засчитано поражение';
  } else if (winner === role) {
    title.textContent = '🎉 Победа!'; title.style.color = '#4CAF50';
    message.textContent = 'Отлично сыграно!';
  } else {
    title.textContent = '💀 Поражение'; title.style.color = '#f44336';
    message.textContent = 'В следующий раз повезёт!';
  }
  btn.textContent = '🏠 В меню';
  btn.onclick = returnToMenu;
});

socket.on('admin_kicked', () => {
  clearInterval(sunInterval);
  clearInterval(zombieSunInterval);
  clearInterval(timerInterval);
  if (animFrameId) cancelAnimationFrame(animFrameId);
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const message = document.getElementById('overlay-message');
  const btn = document.getElementById('overlay-btn');
  title.textContent = '🛡️ Кикнут админом';
  title.style.color = '#FF5722';
  message.textContent = 'Админ завершил вашу игру';
  btn.textContent = '🏠 В меню';
  btn.onclick = returnToMenu;
  overlay.classList.remove('hidden');
});

function startAnimationLoop() {
  function loop() {
    if (!gameState || gameState.gameOver) return;
    render();
    animFrameId = requestAnimationFrame(loop);
  }
  animFrameId = requestAnimationFrame(loop);
}

function updateSunDisplay() {
  if (!gameState) return;
  document.getElementById('sun-count').textContent = role === 'plant' ? gameState.plantSun : gameState.zombieSun;
  document.getElementById('resource-icon').textContent = role === 'plant' ? '☀️' : '❤️';
}

function updateTimerDisplay() {
  if (!gameState || !gameState.gameStartTime) return;
  const elapsed = (Date.now() - gameState.gameStartTime) / 1000;
  const remaining = Math.max(0, GAME_DURATION - elapsed);
  const sec = Math.ceil(remaining);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  document.getElementById('timer-display').textContent = `⏱️ ${m}:${s.toString().padStart(2, '0')}`;
}

function startLocalTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function render() {
  if (!gameState) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawHouse();
  drawGrid();
  drawLawnDecor();
  drawPaths();
  drawNicknames();
  drawPlants();
  drawZombies();
  drawProjectiles();
  drawHPBars();
}

function drawHouse() {
  const x = 0, y = 40, w = 160, h = CELL_HEIGHT * ROWS;
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
  ctx.fillStyle = '#FFD700';
  ctx.font = '35px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏠', w / 2, y + h / 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Arial';
  ctx.textBaseline = 'top';
  ctx.fillText('ВАШ ДОМ', w / 2, y + h - 25);
}

function drawGrid() {
  const gx = 160, gy = 40;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = gx + col * CELL_WIDTH;
      const y = gy + row * CELL_HEIGHT;
      ctx.fillStyle = (row + col) % 2 === 0 ? '#3a8c2a' : '#4ca832';
      ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);
      ctx.strokeStyle = 'rgba(0,40,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);
    }
  }
}

function drawLawnDecor() {
  const gx = 160, gy = 40;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = gx + col * CELL_WIDTH;
      const y = gy + row * CELL_HEIGHT;
      ctx.fillStyle = (row + col) % 2 === 0 ? 'rgba(0,80,0,0.2)' : 'rgba(0,60,0,0.15)';
      for (let i = 0; i < 3; i++) {
        const gx2 = x + 15 + (i * 25) + (row % 2) * 10;
        const gy2 = y + 20 + (i * 20) + (col % 2) * 8;
        ctx.beginPath();
        ctx.arc(gx2, gy2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPaths() {
  const gx = 160, gy = 40;
  ctx.strokeStyle = 'rgba(139,69,19,0.2)';
  ctx.lineWidth = 2;
  for (let row = 0; row < ROWS; row++) {
    const y = gy + row * CELL_HEIGHT + CELL_HEIGHT / 2;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + COLS * CELL_WIDTH, y);
    ctx.stroke();
  }
}

function drawNicknames() {
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(5, canvas.height - 28, 220, 24);
  ctx.fillStyle = '#4CAF50';
  ctx.fillText(`🌻 ${plantNickname || 'Растение'}`, 10, canvas.height - 24);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(canvas.width - 225, canvas.height - 28, 220, 24);
  ctx.fillStyle = '#9C27B0';
  ctx.textAlign = 'right';
  ctx.fillText(`${zombieNickname || 'Зомби'} 🧟`, canvas.width - 10, canvas.height - 24);
  ctx.textAlign = 'left';
}

function drawPlants() {
  if (!gameState.grid) return;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = gameState.grid[row][col];
      if (cell) {
        const x = 160 + col * CELL_WIDTH + CELL_WIDTH / 2;
        const y = 40 + row * CELL_HEIGHT + CELL_HEIGHT / 2;
        const plant = PLANTS[cell.type];
        if (plant) {
          ctx.font = '44px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(plant.emoji, x, y);
          if (cell.hp < 100) drawMiniHPBar(x, y - 32, cell.hp, 100);
        }
      }
    }
  }
}

function drawZombies() {
  if (!gameState.zombies) return;
  gameState.zombies.forEach(z => {
    const iz = getInterpolatedZombie(z);
    const x = 160 + iz.col * CELL_WIDTH + CELL_WIDTH / 2;
    const y = 40 + z.row * CELL_HEIGHT + CELL_HEIGHT / 2;
    const zd = ZOMBIES[z.type];
    if (zd) {
      ctx.font = '44px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zd.emoji, x, y);
      drawMiniHPBar(x, y - 32, iz.hp, z.maxHp);
    }
  });
}

function drawProjectiles() {
  if (!gameState.projectiles) return;
  gameState.projectiles.forEach(p => {
    const ip = getInterpolatedProjectile(p);
    const x = 160 + ip.col * CELL_WIDTH + CELL_WIDTH / 2;
    const y = 40 + p.row * CELL_HEIGHT + CELL_HEIGHT / 2;
    ctx.fillStyle = '#00FF00';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHPBars() {
  if (!gameState) return;
  const bw = 180, bh = 20;
  const gx = 10, gy = 5;
  const hp = getInterpolatedHP();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(gx, gy, bw, bh);
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(gx, gy, bw * (hp / 100), bh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`🏠 Дом: ${Math.round(hp)}%`, gx + bw / 2, gy + 14);
}

function drawMiniHPBar(x, y, hp, maxHp) {
  const w = 40, h = 5;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = hp > maxHp * 0.5 ? '#4CAF50' : hp > maxHp * 0.25 ? '#FF9800' : '#f44336';
  ctx.fillRect(x - w / 2, y, w * (hp / maxHp), h);
}

function surrender() {
  if (confirm('Вы уверены что хотите сдаться?')) {
    socket.emit('game_action', { gameId, action: 'surrender', data: { role } });
  }
}

function returnToMenu() {
  clearInterval(sunInterval);
  clearInterval(zombieSunInterval);
  socket.disconnect();
  sessionStorage.removeItem('gameRole');
  sessionStorage.removeItem('plantNickname');
  sessionStorage.removeItem('zombieNickname');
  window.location.href = '/';
}

if (!gameId || !role) {
  window.location.href = '/';
} else {
  init();
}
