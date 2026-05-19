class GameManager {
  constructor() {
    this.waitingPlants = [];
    this.waitingZombies = [];
    this.games = {};
    this.gameCounter = 0;
  }

  findMatch(userId, role, loadout, nickname, socketId) {
    if (role === 'plant') {
      if (this.waitingZombies.length > 0) {
        const zombie = this.waitingZombies.shift();
        return this.startGame(zombie, { userId, role, loadout, nickname, socketId });
      } else {
        this.waitingPlants.push({ userId, role, loadout, nickname, socketId });
        return null;
      }
    } else {
      if (this.waitingPlants.length > 0) {
        const plant = this.waitingPlants.shift();
        return this.startGame({ userId, role, loadout, nickname, socketId }, plant);
      } else {
        this.waitingZombies.push({ userId, role, loadout, nickname, socketId });
        return null;
      }
    }
  }

  startGame(zombie, plant) {
    const gameId = `game_${++this.gameCounter}`;
    this.games[gameId] = {
      id: gameId,
      plantId: plant.userId,
      zombieId: zombie.userId,
      plantNickname: plant.nickname,
      zombieNickname: zombie.nickname,
      plantSocketId: plant.socketId,
      zombieSocketId: zombie.socketId,
      plantLoadout: plant.loadout,
      zombieLoadout: zombie.loadout,
      state: this.createInitialState(),
      started: Date.now(),
      finished: false
    };
    return gameId;
  }

  createInitialState() {
    const grid = Array(6).fill(null).map(() => Array(10).fill(null));
    return {
      grid,
      plantSun: 150,
      zombieSun: 0,
      zombies: [],
      projectiles: [],
      explosions: [],
      sunDrops: [],
      plantHP: 100,
      gameStartTime: null,
      gameOver: false,
      winner: null
    };
  }

  getAllGames() {
    return this.games;
  }

  getGame(gameId) {
    return this.games[gameId];
  }

  updateGame(gameId, state) {
    if (this.games[gameId]) {
      this.games[gameId].state = state;
    }
  }

  endGame(gameId, winner, db) {
    const game = this.games[gameId];
    if (!game || game.finished) return;
    game.finished = true;
    
    if (winner === 'plant') {
      db.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [game.plantId]).catch(() => {});
      db.query('UPDATE users SET losses = losses + 1 WHERE id = $1', [game.zombieId]).catch(() => {});
    } else {
      db.query('UPDATE users SET losses = losses + 1 WHERE id = $1', [game.plantId]).catch(() => {});
      db.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [game.zombieId]).catch(() => {});
    }
  }

  cancelWait(userId) {
    this.waitingPlants = this.waitingPlants.filter(p => p.userId !== userId);
    this.waitingZombies = this.waitingZombies.filter(z => z.userId !== userId);
  }
}

module.exports = new GameManager();
