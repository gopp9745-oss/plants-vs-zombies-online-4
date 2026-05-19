const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, '..', 'game.db');

let db = { users: [], inventories: [], loadouts: [] };

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (_) {}
  }
  if (!db.users) db.users = [];
  if (!db.inventories) db.inventories = [];
  if (!db.loadouts) db.loadouts = [];
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let postgresClient = null;

async function tryPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await pool.query('SELECT 1');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nickname VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loadouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        role VARCHAR(20) NOT NULL,
        slot1 INTEGER, slot2 INTEGER, slot3 INTEGER,
        slot4 INTEGER, slot5 INTEGER, slot6 INTEGER
      )
    `);
    postgresClient = pool;
    console.log('PostgreSQL connected');
    return true;
  } catch (e) {
    console.log('PostgreSQL unavailable, using file-based DB');
    return false;
  }
}

const query = async (sql, params = []) => {
  if (postgresClient) {
    return await postgresClient.query(sql, params);
  }

  loadDB();

  if (sql.startsWith('CREATE TABLE') || sql.includes('RETURNING')) {
    if (sql.includes('INSERT INTO users')) {
      const id = db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
      const user = {
        id, nickname: params[0], password_hash: params[1],
        wins: 0, losses: 0, created_at: new Date().toISOString()
      };
      db.users.push(user); saveDB();
      return { rows: [{ id, nickname: params[0], wins: 0, losses: 0 }] };
    }
    return { rows: [] };
  }

  if (sql.includes('INSERT INTO loadouts (user_id, role)')) {
    const id = db.loadouts.length ? Math.max(...db.loadouts.map(l => l.id)) + 1 : 1;
    db.loadouts.push({ id, user_id: parseInt(params[0]), role: params[1], slot1: null, slot2: null, slot3: null, slot4: null, slot5: null, slot6: null });
    saveDB();
    return { rows: [] };
  }

  if (sql.startsWith('SELECT') && sql.includes('users WHERE nickname')) {
    const found = db.users.filter(u => u.nickname === params[0]);
    return { rows: found };
  }

  if (sql.includes('ORDER BY wins DESC')) {
    const sorted = [...db.users].sort((a, b) => b.wins - a.wins).slice(0, 50);
    return { rows: sorted.map(u => ({ nickname: u.nickname, wins: u.wins, losses: u.losses, total_games: u.wins + u.losses })) };
  }

  if (sql.startsWith('SELECT') && sql.includes('loadouts WHERE user_id')) {
    const found = db.loadouts.filter(l => l.user_id == params[0] && l.role === params[1]);
    return { rows: found };
  }

  if (sql.includes('UPDATE loadouts SET')) {
    const l = db.loadouts.find(l => l.user_id == params[6] && l.role === params[7]);
    if (l) { l.slot1 = params[0]; l.slot2 = params[1]; l.slot3 = params[2]; l.slot4 = params[3]; l.slot5 = params[4]; l.slot6 = params[5]; saveDB(); }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET')) {
    const user = db.users.find(u => u.id == params[0]);
    if (user) {
      if (sql.includes('wins = wins + 1')) user.wins++;
      if (sql.includes('losses = losses + 1')) user.losses++;
      saveDB();
    }
    return { rows: [] };
  }

  return { rows: [] };
};

module.exports = {
  query,
  initDB: tryPostgres
};
