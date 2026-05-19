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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  let currentUserId = null;

  socket.on('join_game', async ({ userId, role, loadout, nickname }) => {
    currentUserId = userId;

    const gameId = gameManager.findMatch(userId, role, loadout, nickname, socket.id);

    if (gameId) {
      const game = gameManager.getGame(gameId);

      // join both sockets to room
      io.to(game.plantSocketId).socketsJoin(gameId);
      io.to(game.zombieSocketId).socketsJoin(gameId);
      socket.join(gameId);

      readyStates[gameId] = { plant: false, zombie: false };

      // send correct role to each player
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

  /* New socket from game.html reconnects to existing game */
  socket.on('join_game_room', ({ gameId, role }) => {
    const game = gameManager.getGame(gameId);
    if (!game) return;

    socket.join(gameId);
    socket.emit('joined_game_room', { gameId, role });

    // check if both players reconnected
    const room = io.sockets.adapter.rooms.get(gameId);
    if (room && room.size >= 2) {
      // both are in the room, send game start or ready check
      io.to(gameId).emit('both_connected');
    }
  });

  socket.on('player_ready', ({ gameId, role }) => {
    if (readyStates[gameId]) {
      readyStates[gameId][role] = true;
      if (readyStates[gameId].plant && readyStates[gameId].zombie) {
        const game = gameManager.getGame(gameId);
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
        if (data.row >= 0 && data.row < 5 && data.col >= 0 && data.col < 9 && !state.grid[data.row][data.col]) {
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
            col: 8,
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
        gameManager.endGame(gameId, winner, { query });
        io.to(gameId).emit('game_over', { winner });
        return;
    }

    gameManager.updateGame(gameId, state);
    io.to(gameId).emit('game_state', state);

    if (state.plantHP <= 0 || state.zombieHP <= 0) {
      const winner = state.plantHP <= 0 ? 'zombie' : 'plant';
      state.gameOver = true;
      state.winner = winner;
      gameManager.endGame(gameId, winner, { query });
      io.to(gameId).emit('game_over', { winner });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (currentUserId) {
      gameManager.cancelWait(currentUserId);
    }
  });
});

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
