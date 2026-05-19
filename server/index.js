const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initDB, query } = require('./db');
const authRoutes = require('./routes/auth');
const leaderboardRoutes = require('./routes/leaderboard');
const inventoryRoutes = require('./routes/inventory');
const gameManager = require('./game/gameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/inventory', inventoryRoutes);

const readyStates = {};
const GAME_DURATION = 300; // 5 minutes in seconds

function safeEndGame(gameId, winner) {
  try {
    gameManager.endGame(gameId, winner, { query });
  } catch (e) {
    console.error('endGame error:', e.message);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  let currentUserId = null;

  socket.on('join_game', async ({ userId, role, loadout, nickname }) => {
    currentUserId = userId;

    const gameId = gameManager.findMatch(userId, role, loadout, nickname, socket.id);

    if (gameId) {
      const game = gameManager.getGame(gameId);

      io.to(game.plantSocketId).socketsJoin(gameId);
      io.to(game.zombieSocketId).socketsJoin(gameId);
      socket.join(gameId);

      readyStates[gameId] = { plant: false, zombie: false };

      io.to(game.plantSocketId).emit('match_found', {
        gameId, role: 'plant',
        plantNickname: game.plantNickname,
        zombieNickname: game.zombieNickname
      });
      io.to(game.zombieSocketId).emit('match_found', {
        gameId, role: 'zombie',
        plantNickname: game.plantNickname,
        zombieNickname: game.zombieNickname
      });
    } else {
      socket.emit('waiting_for_opponent');
    }
  });

  socket.on('join_game_room', ({ gameId, role }) => {
    const game = gameManager.getGame(gameId);
    if (!game) return;

    socket.join(gameId);
    socket.emit('joined_game_room', { gameId, role });

    const room = io.sockets.adapter.rooms.get(gameId);
    if (room && room.size >= 2) {
      io.to(gameId).emit('both_connected');
    }
  });

  socket.on('player_ready', ({ gameId, role }) => {
    if (readyStates[gameId]) {
      readyStates[gameId][role] = true;
      if (readyStates[gameId].plant && readyStates[gameId].zombie) {
        const game = gameManager.getGame(gameId);
        game.state.gameStartTime = Date.now();
        io.to(gameId).emit('game_start', {
          state: game.state,
          plantNickname: game.plantNickname,
          zombieNickname: game.zombieNickname
        });
      }
    }
  });

  socket.on('cancel_wait', () => {
    if (currentUserId) {
      gameManager.cancelWait(currentUserId);
      socket.emit('wait_cancelled');
    }
  });

  socket.on('game_action', ({ gameId, action, data }) => {
    const game = gameManager.getGame(gameId);
    if (!game || game.finished) return;

    const state = game.state;

    switch (action) {
      case 'place_plant':
        if (data.row >= 0 && data.row < 6 && data.col >= 0 && data.col < 10 && !state.grid[data.row][data.col]) {
          if (state.plantSun >= data.cost) {
            state.grid[data.row][data.col] = { type: data.plantId, hp: 100, lastShot: 0 };
            state.plantSun -= data.cost;
          }
        }
        break;

      case 'spawn_zombie':
        if (state.zombieSun >= data.cost) {
          state.zombies.push({
            id: Date.now(),
            type: data.zombieId,
            row: data.row,
            col: 9,
            hp: data.hp,
            maxHp: data.hp,
            speed: data.speed,
            lastMove: Date.now()
          });
          state.zombieSun -= data.cost;
        }
        break;

      case 'collect_sun':
        state.plantSun += data.amount;
        break;

      case 'zombie_earn_sun':
        state.zombieSun += data.amount;
        break;

      case 'surrender':
        const winner = data.role === 'plant' ? 'zombie' : 'plant';
        state.gameOver = true;
        state.winner = winner;
        safeEndGame(gameId, winner);
        io.to(gameId).emit('game_over', { winner });
        return;
    }

    gameManager.updateGame(gameId, state);
    io.to(gameId).emit('game_state', state);

    if (state.plantHP <= 0 && !state.gameOver) {
      state.gameOver = true;
      state.winner = 'zombie';
      safeEndGame(gameId, 'zombie');
      io.to(gameId).emit('game_over', { winner: 'zombie' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (currentUserId) {
      gameManager.cancelWait(currentUserId);
    }
  });
});

// Game loop
const TICK_RATE = 200;
const SHOT_COOLDOWN = 2000;
const PROJECTILE_SPEED = 3;
const HOUSE_DAMAGE_PER_ZOMBIE = 20;

function gameLoop() {
  const now = Date.now();
  const games = gameManager.getAllGames();

  for (const gameId in games) {
    const game = games[gameId];
    if (game.finished || game.state.gameOver) continue;

    const state = game.state;
    let changed = false;

    // 1. Move zombies left
    for (const z of state.zombies) {
      if (z.frozen) {
        z.frozen -= TICK_RATE;
        if (z.frozen <= 0) { delete z.frozen; }
        continue;
      }
      z.col -= z.speed * (TICK_RATE / 1000);
      changed = true;
    }

    // 2. Zombies reaching the house (col < -0.5)
    const attackers = state.zombies.filter(z => z.col < -0.5);
    if (attackers.length > 0) {
      state.plantHP -= attackers.length * HOUSE_DAMAGE_PER_ZOMBIE;
      if (state.plantHP < 0) state.plantHP = 0;
      state.zombies = state.zombies.filter(z => z.col >= -0.5);
      changed = true;
    }

    // 3. Plant shooting
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 10; col++) {
        const cell = state.grid[row][col];
        if (!cell) continue;
        if (cell.type === 1 || cell.type === 4) continue;
        const hasZombie = state.zombies.some(z => z.row === row);
        if (!hasZombie) continue;
        const cooldown = cell.type === 6 ? SHOT_COOLDOWN / 2 : SHOT_COOLDOWN;
        if (now - (cell.lastShot || 0) < cooldown) continue;
        state.projectiles.push({ row, col: col + 0.6, damage: 20, slow: cell.type === 5 });
        cell.lastShot = now;
        changed = true;
      }
    }

    // 4. Move projectiles & collision
    const aliveProjectiles = [];
    for (const p of state.projectiles) {
      p.col += PROJECTILE_SPEED * (TICK_RATE / 1000);
      let hit = false;
      for (let i = 0; i < state.zombies.length; i++) {
        const z = state.zombies[i];
        if (z.row === p.row && Math.abs(z.col - p.col) < 0.4) {
          z.hp -= p.damage;
          if (p.slow) z.frozen = 3000;
          hit = true;
          if (z.hp <= 0) { state.zombies.splice(i, 1); i--; }
          break;
        }
      }
      if (!hit && p.col < 10) aliveProjectiles.push(p);
    }
    state.projectiles = aliveProjectiles;

    // 5. Time-based win check
    if (state.gameStartTime) {
      const elapsed = (now - state.gameStartTime) / 1000;
      state.timeRemaining = Math.max(0, GAME_DURATION - elapsed);
      changed = true;
      if (state.timeRemaining <= 0 && state.plantHP > 0) {
        state.gameOver = true;
        state.winner = 'plant';
        safeEndGame(gameId, 'plant');
        io.to(gameId).emit('game_over', { winner: 'plant' });
        continue;
      }
    }

    // 6. Plant HP win check
    if (state.plantHP <= 0 && !state.gameOver) {
      state.gameOver = true;
      state.winner = 'zombie';
      safeEndGame(gameId, 'zombie');
      io.to(gameId).emit('game_over', { winner: 'zombie' });
      continue;
    }

    // 7. Broadcast
    if (changed) {
      gameManager.updateGame(gameId, state);
      io.to(gameId).emit('game_state', state);
    }
  }
}

const PORT = process.env.PORT || 3000;

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    setInterval(gameLoop, TICK_RATE);
    console.log(`Game loop started (${TICK_RATE}ms tick)`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
