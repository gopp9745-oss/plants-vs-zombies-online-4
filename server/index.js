const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initDB, query } = require('./db');
const authRoutes = require('./routes/auth');
const leaderboardRoutes = require('./routes/leaderboard');
const inventoryRoutes = require('./routes/inventory');
const adminRoutes = require('./routes/admin')(io);
const shopRoutes = require('./routes/shop');
const profileRoutes = require('./routes/profile');
const friendsRoutes = require('./routes/friends');
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
app.use('/api/admin', adminRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/friends', friendsRoutes);

const readyStates = {};
const GAME_DURATION = 300;
const userSockets = {};
const onlineUsers = {};
const ONLINE_TIMEOUT = 60000;

function broadcastOnlineUsers() {
  io.emit('online_users', Object.keys(onlineUsers));
}

function addOnlineUser(userId, socketId) {
  const key = String(userId);
  onlineUsers[key] = (onlineUsers[key] || 0) + 1;
  userSockets[key] = socketId;
  broadcastOnlineUsers();
}

function removeOnlineUser(userId) {
  const key = String(userId);
  if (onlineUsers[key]) {
    onlineUsers[key]--;
    if (onlineUsers[key] <= 0) {
      delete onlineUsers[key];
    }
  }
  delete userSockets[key];
  broadcastOnlineUsers();
}

function safeEndGame(gameId, winner) {
  try {
    gameManager.endGame(gameId, winner, { query });
  } catch (e) {
    console.error('endGame error:', e.message);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('online_users', Object.keys(onlineUsers));

  let currentUserId = null;

  socket.on('user_online', (userId) => {
    currentUserId = userId;
    addOnlineUser(userId, socket.id);
  });

  socket.on('join_game', async ({ userId, role, loadout, nickname }) => {
    currentUserId = userId;
    addOnlineUser(userId, socket.id);

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
            state.grid[data.row][data.col] = { type: data.plantId, hp: 100, lastShot: 0, lastSun: Date.now() };
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
      removeOnlineUser(currentUserId);
      gameManager.cancelWait(currentUserId);

      for (const gameId in gameManager.games) {
        const game = gameManager.games[gameId];
        if (!game.finished && (game.plantId === currentUserId || game.zombieId === currentUserId)) {
          io.to(gameId).emit('player_status_change', { userId: currentUserId, online: false });
        }
      }
    }
  });

  socket.on('admin_kick', async ({ targetUserId, userId }) => {
    const adminCheck = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!adminCheck.rows.length || adminCheck.rows[0].nickname !== 'admin') return;
    const targetSocketId = userSockets[targetUserId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('admin_kicked');
      io.sockets.sockets.get(targetSocketId)?.disconnect(true);
      console.log('Admin kicked user:', targetUserId);
    }
  });

  socket.on('admin_end_game', async ({ gameId, winner, userId }) => {
    const adminCheck = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!adminCheck.rows.length || adminCheck.rows[0].nickname !== 'admin') return;
    const game = gameManager.getGame(gameId);
    if (!game || game.finished) return;
    game.state.gameOver = true;
    game.state.winner = winner;
    safeEndGame(gameId, winner);
    io.to(gameId).emit('game_over', { winner, admin: true });
    console.log('Admin ended game:', gameId, 'winner:', winner);
  });

  socket.on('admin_list_games', async ({ userId }) => {
    const adminCheck = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!adminCheck.rows.length || adminCheck.rows[0].nickname !== 'admin') return;
    const games = gameManager.getAllGames();
    const active = Object.values(games).filter(g => !g.finished).map(g => ({
      gameId: g.id,
      plant: g.plantNickname,
      zombie: g.zombieNickname,
      plantHP: g.state.plantHP,
      timeRemaining: g.state.timeRemaining ? Math.ceil(g.state.timeRemaining) : null
    }));
    socket.emit('admin_games_list', active);
  });

  socket.on('friendly_match', ({ userId, role, loadout, nickname, friendId }) => {
    currentUserId = userId;
    addOnlineUser(userId, socket.id);
    const gameId = `friendly_${Date.now()}`;
    gameManager.games[gameId] = {
      id: gameId,
      plantId: role === 'plant' ? userId : friendId,
      zombieId: role === 'zombie' ? userId : friendId,
      plantNickname: role === 'plant' ? nickname : 'Friend',
      zombieNickname: role === 'zombie' ? nickname : 'Friend',
      plantSocketId: role === 'plant' ? socket.id : '',
      zombieSocketId: role === 'zombie' ? socket.id : '',
      plantLoadout: loadout,
      zombieLoadout: [],
      state: gameManager.createInitialState(),
      started: Date.now(),
      finished: false,
      friendly: true,
      hostUserId: userId
    };
    socket.join(gameId);
    readyStates[gameId] = { plant: false, zombie: false };
    socket.emit('waiting_for_friend', { gameId, friendId });
  });

  socket.on('friend_join_match', ({ userId, role, loadout, nickname, gameId, friendId }) => {
    currentUserId = userId;
    addOnlineUser(userId, socket.id);
    const game = gameManager.games[gameId];
    if (!game) return;
    game[role === 'plant' ? 'plantId' : 'zombieId'] = userId;
    game[role === 'plant' ? 'plantNickname' : 'zombieNickname'] = nickname;
    game[role === 'plant' ? 'plantSocketId' : 'zombieSocketId'] = socket.id;
    game[role === 'plant' ? 'plantLoadout' : 'zombieLoadout'] = loadout;
    socket.join(gameId);

    const hostSocketId = game.hostUserId ? userSockets[game.hostUserId] : null;
    if (hostSocketId) {
      io.to(hostSocketId).emit('match_found', {
        gameId, role: game.hostUserId === game.plantId ? 'plant' : 'zombie',
        plantNickname: game.plantNickname,
        zombieNickname: game.zombieNickname,
        friendly: true
      });
    }
    socket.emit('match_found', {
      gameId, role,
      plantNickname: game.plantNickname,
      zombieNickname: game.zombieNickname,
      friendly: true
    });
  });
});

// Game loop
const TICK_RATE = 200;
const BROADCAST_RATE = 500;
const SHOT_COOLDOWN = 2500;
const PROJECTILE_SPEED = 4;
const SUNFLOWER_INTERVAL = 5000;
let lastBroadcast = 0;

function getZombieDamage(speed) {
  if (speed >= 2) return 8;
  if (speed >= 1.5) return 12;
  if (speed >= 1.2) return 15;
  if (speed >= 1) return 20;
  return 25;
}

function gameLoop() {
  const now = Date.now();
  const games = gameManager.getAllGames();
  let shouldBroadcast = false;

  for (const gameId in games) {
    const game = games[gameId];
    if (game.finished || game.state.gameOver) continue;

    const state = game.state;
    let changed = false;

    // 1. Move zombies (slower)
    for (const z of state.zombies) {
      if (z.frozen) {
        z.frozen -= TICK_RATE;
        if (z.frozen <= 0) { delete z.frozen; }
        continue;
      }
      z.col -= z.speed * 0.4 * (TICK_RATE / 1000);
      changed = true;
    }

    // 2. Zombies reaching the house
    const attackers = state.zombies.filter(z => z.col < -0.5);
    if (attackers.length > 0) {
      for (const z of attackers) {
        state.plantHP -= getZombieDamage(z.speed);
      }
      if (state.plantHP < 0) state.plantHP = 0;
      state.zombies = state.zombies.filter(z => z.col >= -0.5);
      changed = true;
    }

    // 3. Sunflower production
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 10; col++) {
        const cell = state.grid[row][col];
        if (cell && cell.type === 1 && now - (cell.lastSun || 0) >= SUNFLOWER_INTERVAL) {
          state.plantSun += 25;
          cell.lastSun = now;
          changed = true;
        }
      }
    }

    // 4. Plant shooting
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

    // 5. Move projectiles & collision
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

    // 6. Time-based win check
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

    // 7. Plant HP win check
    if (state.plantHP <= 0 && !state.gameOver) {
      state.gameOver = true;
      state.winner = 'zombie';
      safeEndGame(gameId, 'zombie');
      io.to(gameId).emit('game_over', { winner: 'zombie' });
      continue;
    }

    if (changed) shouldBroadcast = true;
  }

  // Broadcast at limited rate to prevent lag
  if (shouldBroadcast && now - lastBroadcast >= BROADCAST_RATE) {
    lastBroadcast = now;
    for (const gameId in games) {
      const game = games[gameId];
      if (!game.finished && !game.state.gameOver) {
        gameManager.updateGame(gameId, game.state);
        io.to(gameId).emit('game_state', game.state);
      }
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
