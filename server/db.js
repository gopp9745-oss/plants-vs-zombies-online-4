const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, '..', 'game.db');

let db = {
  users: [],
  inventories: [],
  loadouts: []
};

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    } catch (err) {
      console.log('Creating new database');
    }
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function ensureTables() {
  loadDB();
  if (!db.users) db.users = [];
  if (!db.inventories) db.inventories = [];
  if (!db.loadouts) db.loadouts = [];
  saveDB();
}

ensureTables();

const query = async (sql, params = []) => {
  loadDB();
  
  if (sql.includes('CREATE TABLE')) {
    return { rows: [] };
  }
  
  if (sql.includes('INSERT INTO users')) {
    const match = sql.match(/VALUES \(\$1, \$2\)/i);
    if (match) {
      const id = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
      const user = {
        id,
        nickname: params[0],
        password_hash: params[1],
        wins: 0,
        losses: 0,
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      saveDB();
      return { rows: [{ id: user.id, nickname: user.nickname, wins: 0, losses: 0 }] };
    }
  }
  
  if (sql.includes('INSERT INTO loadouts')) {
    const valuesMatch = sql.match(/VALUES \(([^)]+)\)/i);
    if (valuesMatch) {
      const placeholders = valuesMatch[1].split(',').map(p => p.trim().replace(/\$/g, ''));
      const id = db.loadouts.length > 0 ? Math.max(...db.loadouts.map(l => l.id)) + 1 : 1;
      const loadout = {
        id,
        user_id: params[0],
        role: params[1],
        slot1: params[2] || null,
        slot2: params[3] || null,
        slot3: params[4] || null,
        slot4: params[5] || null,
        slot5: params[6] || null,
        slot6: params[7] || null
      };
      db.loadouts.push(loadout);
      saveDB();
      return { rows: [] };
    }
  }
  
  if (sql.includes('SELECT * FROM users WHERE nickname')) {
    const users = db.users.filter(u => u.nickname === params[0]);
    return { rows: users };
  }
  
  if (sql.includes('SELECT id FROM users WHERE nickname')) {
    const users = db.users.filter(u => u.nickname === params[0]);
    return { rows: users.map(u => ({ id: u.id })) };
  }
  
  if (sql.includes('SELECT nickname, wins, losses')) {
    const sorted = [...db.users].sort((a, b) => b.wins - a.wins).slice(0, 50);
    return { 
      rows: sorted.map(u => ({
        nickname: u.nickname,
        wins: u.wins,
        losses: u.losses,
        total_games: u.wins + u.losses
      }))
    };
  }
  
  if (sql.includes('SELECT * FROM loadouts WHERE user_id')) {
    const loadouts = db.loadouts.filter(l => l.user_id == params[0] && l.role === params[1]);
    return { rows: loadouts };
  }
  
  if (sql.includes('SELECT id FROM loadouts WHERE user_id')) {
    const loadouts = db.loadouts.filter(l => l.user_id == params[0] && l.role === params[1]);
    return { rows: loadouts };
  }
  
  if (sql.includes('UPDATE loadouts SET')) {
    const loadout = db.loadouts.find(l => l.user_id == params[6] && l.role === params[7]);
    if (loadout) {
      loadout.slot1 = params[0];
      loadout.slot2 = params[1];
      loadout.slot3 = params[2];
      loadout.slot4 = params[3];
      loadout.slot5 = params[4];
      loadout.slot6 = params[5];
      saveDB();
    }
    return { rows: [] };
  }
  
  if (sql.includes('UPDATE users SET wins = wins + 1')) {
    const user = db.users.find(u => u.id == params[0]);
    if (user) {
      user.wins++;
      saveDB();
    }
    return { rows: [] };
  }
  
  if (sql.includes('UPDATE users SET losses = losses + 1')) {
    const user = db.users.find(u => u.id == params[0]);
    if (user) {
      user.losses++;
      saveDB();
    }
    return { rows: [] };
  }
  
  return { rows: [] };
};

module.exports = { 
  query, 
  initDB: async () => {
    ensureTables();
    console.log('SQLite-like database initialized (file-based)');
  }
};
