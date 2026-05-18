const socket = io();
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = 900;
canvas.height = 500;

const COLS = 9;
const ROWS = 5;
const CELL_WIDTH = canvas.width / COLS;
const CELL_HEIGHT = canvas.height / ROWS;

const params = new URLSearchParams(window.location.search);
const gameId = params.get('gameId');
const role = params.get('role');

let gameState = null;
let selectedAction = null;
let itemsList = [];
let sunInterval = null;
let zombieSunInterval = null;

const plantEmojis = ['🌻', '🌱', '🥜', '🍒', '❄️', '🔁', '💣', '👯'];
const zombieEmojis = ['🧟', '🧟‍♂️', '🪖', '🏃', '👹', '💃', '🏈', '🎣'];

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
  3: { name: 'Ведро', cost: 100, hp: 350, speed: 1, emoji: '🪖' },
  4: { name: 'Бегун', cost: 60, hp: 80, speed: 2, emoji: '🏃' },
  5: { name: 'Гигант', cost: 150, hp: 500, speed: 0.5, emoji: '👹' },
  6: { name: 'Танцор', cost: 125, hp: 150, speed: 1.2, emoji: '💃' }
};

function init() {
  const roleIndicator = document.getElementById('role-indicator');
  roleIndicator.textContent = role === 'plant' ? '🌻 Растение' : '🧟 Зомби';
  roleIndicator.className = role;
  
  loadItems();
  setupEventListeners();
  startGameLoops();
}

async function loadItems() {
  try {
    const res = await fetch(`${window.location.origin}/api/inventory/items`);
    const data = await res.json();
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
    
    const emoji = role === 'plant' ? plantEmojis[index] : zombieEmojis[index];
    const cost = role === 'plant' ? `☀️${item.cost}` : `💰${item.cost}`;
    
    div.innerHTML = `
      <div class="emoji">${emoji}</div>
      <div class="name">${item.name}</div>
      <div class="cost">${cost}</div>
    `;
    
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
  
  const col = Math.floor(x / CELL_WIDTH);
  const row = Math.floor(y / CELL_HEIGHT);
  
  if (role === 'plant' && selectedAction) {
    placePlant(row, col);
  } else if (role === 'zombie' && selectedAction) {
    spawnZombie(row);
  }
}

function placePlant(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
  if (gameState.grid[row][col]) return;
  if (gameState.plantSun < selectedAction.cost) return;
  
  socket.emit('game_action', {
    gameId,
    action: 'place_plant',
    data: {
      row,
      col,
      plantId: selectedAction.id,
      cost: selectedAction.cost
    }
  });
}

function spawnZombie(row) {
  if (row < 0 || row >= ROWS) return;
  if (gameState.zombieSun < selectedAction.cost) return;
  
  socket.emit('game_action', {
    gameId,
    action: 'spawn_zombie',
    data: {
      row,
      zombieId: selectedAction.id,
      cost: selectedAction.cost,
      hp: selectedAction.hp,
      speed: selectedAction.speed
    }
  });
}

function startGameLoops() {
  if (role === 'plant') {
    sunInterval = setInterval(() => {
      socket.emit('game_action', {
        gameId,
        action: 'collect_sun',
        data: { amount: 25 }
      });
    }, 5000);
  } else {
    zombieSunInterval = setInterval(() => {
      socket.emit('game_action', {
        gameId,
        action: 'zombie_earn_sun',
        data: { amount: 25 }
      });
    }, 6000);
  }
}

socket.on('game_state', (state) => {
  gameState = state;
  updateSunDisplay();
  render();
});

socket.on('game_over', ({ winner }) => {
  clearInterval(sunInterval);
  clearInterval(zombieSunInterval);
  
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const message = document.getElementById('overlay-message');
  
  overlay.classList.remove('hidden');
  
  if (winner === role) {
    title.textContent = '🎉 Победа!';
    title.style.color = '#4CAF50';
    message.textContent = 'Поздравляем! Вы победили!';
  } else {
    title.textContent = '💀 Поражение';
    title.style.color = '#f44336';
    message.textContent = 'В следующий раз повезёт!';
  }
});

function updateSunDisplay() {
  if (!gameState) return;
  const sun = role === 'plant' ? gameState.plantSun : gameState.zombieSun;
  document.getElementById('sun-count').textContent = sun;
}

function render() {
  if (!gameState) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPlants();
  drawZombies();
  drawProjectiles();
  drawHPBars();
}

function drawGrid() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * CELL_WIDTH;
      const y = row * CELL_HEIGHT;
      
      ctx.fillStyle = (row + col) % 2 === 0 ? '#228B22' : '#32CD32';
      ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);
    }
  }
}

function drawPlants() {
  if (!gameState.grid) return;
  
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = gameState.grid[row][col];
      if (cell) {
        const x = col * CELL_WIDTH + CELL_WIDTH / 2;
        const y = row * CELL_HEIGHT + CELL_HEIGHT / 2;
        
        const plant = PLANTS[cell.type];
        if (plant) {
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(plant.emoji, x, y);
          
          if (cell.hp < 100) {
            drawMiniHPBar(x, y - 30, cell.hp, 100);
          }
        }
      }
    }
  }
}

function drawZombies() {
  if (!gameState.zombies) return;
  
  gameState.zombies.forEach(zombie => {
    const x = zombie.col * CELL_WIDTH + CELL_WIDTH / 2;
    const y = zombie.row * CELL_HEIGHT + CELL_HEIGHT / 2;
    
    const zombieData = ZOMBIES[zombie.type];
    if (zombieData) {
      ctx.font = '40px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zombieData.emoji, x, y);
      
      drawMiniHPBar(x, y - 30, zombie.hp, zombie.maxHp);
    }
  });
}

function drawProjectiles() {
  if (!gameState.projectiles) return;
  
  gameState.projectiles.forEach(proj => {
    ctx.fillStyle = proj.slow ? '#00FFFF' : '#00FF00';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHPBars() {
  if (!gameState) return;
  
  const barWidth = 200;
  const barHeight = 20;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(10, 10, barWidth, barHeight);
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(10, 10, barWidth * (gameState.plantHP / 100), barHeight);
  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Дом: ${gameState.plantHP}%`, 10 + barWidth / 2, 24);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(canvas.width - 10 - barWidth, 10, barWidth, barHeight);
  ctx.fillStyle = '#9C27B0';
  ctx.fillRect(canvas.width - 10 - barWidth, 10, barWidth * (gameState.zombieHP / 100), barHeight);
  ctx.fillStyle = '#fff';
  ctx.fillText(`Зомби-база: ${gameState.zombieHP}%`, canvas.width - 10 - barWidth / 2, 24);
}

function drawMiniHPBar(x, y, hp, maxHp) {
  const width = 40;
  const height = 5;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x - width / 2, y, width, height);
  ctx.fillStyle = hp > maxHp * 0.5 ? '#4CAF50' : hp > maxHp * 0.25 ? '#FF9800' : '#f44336';
  ctx.fillRect(x - width / 2, y, width * (hp / maxHp), height);
}

function surrender() {
  if (confirm('Вы уверены что хотите сдаться?')) {
    const winner = role === 'plant' ? 'zombie' : 'plant';
    socket.emit('game_action', {
      gameId,
      action: winner === 'plant' ? 'surrender_plant' : 'surrender_zombie',
      data: {}
    });
  }
}

function returnToMenu() {
  window.location.href = '/';
}

init();
