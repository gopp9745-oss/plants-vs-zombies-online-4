const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, '..', 'game.db');
let fileDb = { users: [], loadouts: [] };
let isMongo = false;

function loadFileDb() {
  if (fs.existsSync(DB_FILE)) {
    try { fileDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) {}
  }
  if (!fileDb.users) fileDb.users = [];
  if (!fileDb.loadouts) fileDb.loadouts = [];
}
function saveFileDb() { fs.writeFileSync(DB_FILE, JSON.stringify(fileDb, null, 2)); }

/* Mongoose Schemas */
const userSchema = new mongoose.Schema({
  nickname: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 }
}, { timestamps: true });

const loadoutSchema = new mongoose.Schema({
  userId: { type: Number, ref: 'User', required: true },
  role: { type: String, enum: ['plant', 'zombie'], required: true },
  slot1: Number, slot2: Number, slot3: Number,
  slot4: Number, slot5: Number, slot6: Number
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Loadout = mongoose.models.Loadout || mongoose.model('Loadout', loadoutSchema);

const initDB = async () => {
  const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
  if (uri) {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB connected');
      isMongo = true;
      return;
    } catch (e) {
      console.log('MongoDB unavailable:', e.message);
    }
  }
  console.log('Using file-based DB');
  loadFileDb();
};

const query = async (sql, params = []) => {
  if (isMongo) return mongoQuery(sql, params);
  return fileQuery(sql, params);
};

/* MongoDB queries */
async function mongoQuery(sql, params) {
  if (sql.includes('INSERT INTO users')) {
    const exists = await User.findOne({ nickname: params[0] });
    if (exists) return { rows: [] };
    const user = await User.create({ nickname: params[0], password_hash: params[1] });
    return { rows: [{ id: user._id.toString(), nickname: user.nickname, wins: user.wins, losses: user.losses }] };
  }

  if (sql.startsWith('SELECT') && sql.includes('users WHERE nickname')) {
    const user = await User.findOne({ nickname: params[0] });
    return { rows: user ? [{ id: user._id.toString(), nickname: user.nickname, password_hash: user.password_hash, wins: user.wins, losses: user.losses }] : [] };
  }

  if (sql.startsWith('SELECT') && sql.includes('id FROM users WHERE nickname')) {
    const user = await User.findOne({ nickname: params[0] });
    return { rows: user ? [{ id: user._id.toString() }] : [] };
  }

  if (sql.includes('ORDER BY wins DESC')) {
    const users = await User.find().sort({ wins: -1 }).limit(50).lean();
    return { rows: users.map(u => ({ nickname: u.nickname, wins: u.wins, losses: u.losses, total_games: u.wins + u.losses })) };
  }

  if (sql.includes('INSERT INTO loadouts (user_id, role)')) {
    await Loadout.create({ userId: parseInt(params[0]), role: params[1] });
    return { rows: [] };
  }

  if (sql.startsWith('SELECT') && sql.includes('loadouts WHERE user_id')) {
    const loadouts = await Loadout.find({ userId: parseInt(params[0]), role: params[1] }).lean();
    return { rows: loadouts.map(l => ({ id: l._id, ...l })) };
  }

  if (sql.includes('UPDATE loadouts SET')) {
    await Loadout.findOneAndUpdate(
      { userId: parseInt(params[6]), role: params[7] },
      { slot1: params[0], slot2: params[1], slot3: params[2], slot4: params[3], slot5: params[4], slot6: params[5] }
    );
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET wins = wins + 1')) {
    await User.findByIdAndUpdate(params[0], { $inc: { wins: 1 } });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET losses = losses + 1')) {
    await User.findByIdAndUpdate(params[0], { $inc: { losses: 1 } });
    return { rows: [] };
  }

  return { rows: [] };
}

/* File-based queries (fallback) */
function fileQuery(sql, params) {
  loadFileDb();

  if (sql.includes('INSERT INTO users')) {
    const id = fileDb.users.length ? Math.max(...fileDb.users.map(u => u.id)) + 1 : 1;
    fileDb.users.push({ id, nickname: params[0], password_hash: params[1], wins: 0, losses: 0, created_at: new Date().toISOString() });
    saveFileDb();
    return { rows: [{ id, nickname: params[0], wins: 0, losses: 0 }] };
  }

  if (sql.includes('INSERT INTO loadouts (user_id, role)')) {
    const id = fileDb.loadouts.length ? Math.max(...fileDb.loadouts.map(l => l.id)) + 1 : 1;
    fileDb.loadouts.push({ id, user_id: params[0], role: params[1], slot1: null, slot2: null, slot3: null, slot4: null, slot5: null, slot6: null });
    saveFileDb();
    return { rows: [] };
  }

  if (sql.includes('users WHERE nickname')) {
    return { rows: fileDb.users.filter(u => u.nickname === params[0]) };
  }

  if (sql.includes('ORDER BY wins DESC')) {
    return { rows: [...fileDb.users].sort((a, b) => b.wins - a.wins).slice(0, 50).map(u => ({ nickname: u.nickname, wins: u.wins, losses: u.losses, total_games: u.wins + u.losses })) };
  }

  if (sql.includes('loadouts WHERE user_id')) {
    return { rows: fileDb.loadouts.filter(l => l.user_id == params[0] && l.role === params[1]) };
  }

  if (sql.includes('UPDATE loadouts SET')) {
    const l = fileDb.loadouts.find(l => l.user_id == params[6] && l.role === params[7]);
    if (l) { l.slot1 = params[0]; l.slot2 = params[1]; l.slot3 = params[2]; l.slot4 = params[3]; l.slot5 = params[4]; l.slot6 = params[5]; saveFileDb(); }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET')) {
    const u = fileDb.users.find(u => u.id == params[0]);
    if (u) { sql.includes('wins = wins + 1') ? u.wins++ : u.losses++; saveFileDb(); }
    return { rows: [] };
  }

  return { rows: [] };
}

module.exports = { query, initDB };
