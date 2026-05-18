class GameManager {
  constructor() {
    this.waitingPlants = [];
    this.waitingZombies = [];
    this.games = {};
    this.gameCounter = 0;
  }

  findMatch(userId, role, loadout, io) {
    if (role === 'plant') {
      if (this.waitingZombies.length > 0) {
        const zombie = this.waitingZombies.shift();
        return this.startGame(zombie.userId, userId, zombie.loadout, loadout, io);
      } else {
        this.waitingPlants.push({ userId, loadout });
        return null;
      }
    } else {
      if (this.waitingPlants.length > 0) {
        const plant = this.waitingPlants.shift();
        return this.startGame(userId, plant.userId, loadout, plant.loadout, io);
      } else {
        this.waitingZombies.push({ userId, loadout });
        return null;
      }
    }
  }

  startGame(zombieId, plantId, zombieLoadout, plantLoadout, io) {
    const gameId = `game_${++this.gameCounter}`;
    this.games[gameId] = {
      id: gameId,
      plantId,
      zombieId,
      plantLoadout,
      zombieLoadout,
      state: this.createInitialState(plantLoadout, zombieLoadout),
      started: Date.now(),
      finished: false
    };
    
    return gameId;
  }

  createInitialState(plantLoadout, zombieLoadout) {
    const grid = Array(5).fill(null).map(() => Array(9).fill(null));
    return {
      grid,
      plantSun: 150,
      zombieSun: 0,
      plantSelectedPlant: null,
      zombieSelectedZombie: null,
      zombies: [],
      projectiles: [],
      explosions: [],
      sunDrops: [],
      plantHP: 100,
      zombieHP: 100,
      turn: 'plant',
      gameOver: false,
      winner: null
    };
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
      db.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [game.plantId]);
      db.query('UPDATE users SET losses = losses + 1 WHERE id = $1', [game.zombieId]);
    } else {
      db.query('UPDATE users SET losses = losses + 1 WHERE id = $1', [game.plantId]);
      db.query('UPDATE users SET wins = wins + 1 WHERE id = $1', [game.zombieId]);
    }
  }

  cancelWait(userId) {
    this.waitingPlants = this.waitingPlants.filter(p => p.userId !== userId);
    this.waitingZombies = this.waitingZombies.filter(z => z.userId !== userId);
  }
}

module.exports = new GameManager();
