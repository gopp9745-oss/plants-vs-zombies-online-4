const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, '..', 'game.db');
let fileDb = { users: [], loadouts: [] };
let isMongo = false;
let dbWarned = false;

function warnDb() {
  if (!dbWarned && !isMongo) {
    console.warn('\n⚠️  ВНИМАНИЕ: Используется файловая БД (game.db).');
    console.warn('   На Render данные пропадут после перезапуска!');
    console.warn('   Настрой MONGO_URI в переменных окружения Render.\n');
    dbWarned = true;
  }
}

function loadFileDb() {
  if (fs.existsSync(DB_FILE)) {
    try { fileDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) {}
  }
  if (!fileDb.users) fileDb.users = [];
  if (!fileDb.loadouts) fileDb.loadouts = [];
  if (!fileDb.unlocked) fileDb.unlocked = {};
}
function saveFileDb() { fs.writeFileSync(DB_FILE, JSON.stringify(fileDb, null, 2)); }

/* Mongoose Schemas */
const userSchema = new mongoose.Schema({
  nickname: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  avatar: { type: String, default: '🌱' },
  clan: { type: String, default: '' },
  friends: { type: [String], default: [] },
  friend_requests: { type: [String], default: [] },
  is_admin: { type: Boolean, default: false },
  is_banned: { type: Boolean, default: false },
  unlocked_plants: { type: [Number], default: [1, 2, 3] }
}, { timestamps: true });

const loadoutSchema = new mongoose.Schema({
  userId: { type: String, required: true },
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
    const user = await User.create({ nickname: params[0], password_hash: params[1], unlocked_plants: [1, 2, 3], avatar: '🌱', friends: [] });
    return { rows: [{ id: user._id.toString(), nickname: user.nickname, wins: user.wins, losses: user.losses, coins: user.coins || 0, avatar: user.avatar || '🌱', clan: user.clan || '', friends: user.friends || [], unlocked_plants: user.unlocked_plants || [1, 2, 3] }] };
  }

  if (sql.startsWith('SELECT') && sql.includes('users WHERE nickname')) {
    const user = await User.findOne({ nickname: new RegExp('^' + params[0] + '$', 'i') });
    if (!user) { console.log('Mongo: user not found:', params[0]); return { rows: [] }; }
    return { rows: [{ id: user._id.toString(), nickname: user.nickname, password_hash: user.password_hash, wins: user.wins, losses: user.losses, coins: user.coins || 0, avatar: user.avatar || '🌱', clan: user.clan || '', friends: user.friends || [], friend_requests: user.friend_requests || [], is_admin: user.is_admin || false, is_banned: user.is_banned || false, unlocked_plants: user.unlocked_plants || [1, 2, 3] }] };
  }

  if (sql.startsWith('SELECT') && sql.includes('id FROM users WHERE nickname')) {
    const user = await User.findOne({ nickname: params[0] });
    return { rows: user ? [{ id: user._id.toString() }] : [] };
  }

  if (sql.startsWith('SELECT') && sql.includes('FROM users WHERE id')) {
    const user = await User.findById(params[0]);
    if (!user) return { rows: [] };
    return { rows: [{ id: user._id.toString(), nickname: user.nickname, wins: user.wins, losses: user.losses, coins: user.coins || 0, avatar: user.avatar || '🌱', clan: user.clan || '', friends: user.friends || [], friend_requests: user.friend_requests || [], is_admin: user.is_admin || false, is_banned: user.is_banned || false, unlocked_plants: user.unlocked_plants || [1, 2, 3] }] };
  }

  if (sql.includes('ORDER BY wins DESC')) {
    const users = await User.find().sort({ wins: -1 }).limit(50).lean();
    return { rows: users.map(u => ({ id: u._id.toString(), nickname: u.nickname, wins: u.wins, losses: u.losses, total_games: u.wins + u.losses, avatar: u.avatar || '🌱', clan: u.clan || '', friends: u.friends || [] })) };
  }

  if (sql.includes('INSERT INTO loadouts')) {
    const id = params[0];
    await Loadout.create({ userId: id, role: params[1], slot1: params[2] || null, slot2: params[3] || null, slot3: params[4] || null, slot4: params[5] || null, slot5: params[6] || null, slot6: params[7] || null });
    return { rows: [] };
  }

  if (sql.startsWith('SELECT') && sql.includes('loadouts WHERE user_id')) {
    const loadouts = await Loadout.find({ userId: String(params[0]), role: params[1] }).lean();
    return { rows: loadouts.map(l => ({ id: l._id.toString(), ...l })) };
  }

  if (sql.includes('UPDATE loadouts SET')) {
    await Loadout.findOneAndUpdate(
      { userId: String(params[6]), role: params[7] },
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

  if (sql.includes('SELECT') && sql.includes('FROM users') && sql.includes('ORDER BY')) {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    return { rows: users.map(u => ({ id: u._id.toString(), nickname: u.nickname, wins: u.wins, losses: u.losses, is_admin: u.is_admin || false, is_banned: u.is_banned || false, created_at: u.createdAt })) };
  }

  if (sql.includes('UPDATE users SET is_admin')) {
    await User.findByIdAndUpdate(params[1], { is_admin: params[0] === 1 });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET is_banned')) {
    await User.findByIdAndUpdate(params[1], { is_banned: params[0] === 1 });
    return { rows: [] };
  }

  if (sql.includes('DELETE FROM users')) {
    await User.findByIdAndDelete(params[0]);
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET wins = 0') && sql.includes('losses = 0')) {
    await User.findByIdAndUpdate(params[0], { wins: 0, losses: 0 });
    return { rows: [] };
  }

  if (sql.includes('SELECT COUNT(*)')) {
    const count = await User.countDocuments();
    return { rows: [{ count }] };
  }

  if (sql.includes('UPDATE users SET password_hash')) {
    await User.findByIdAndUpdate(params[1], { password_hash: params[0] });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET unlocked_plants')) {
    await User.findByIdAndUpdate(params[1], { $addToSet: { unlocked_plants: params[0] } });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET coins')) {
    await User.findByIdAndUpdate(params[1], { coins: params[0] });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET avatar')) {
    await User.findByIdAndUpdate(params[1], { avatar: params[0] });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET clan')) {
    await User.findByIdAndUpdate(params[1], { clan: params[0] });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET friends')) {
    await User.findByIdAndUpdate(params[1], { friends: params[0] });
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET friend_requests')) {
    await User.findByIdAndUpdate(params[1], { friend_requests: params[0] });
    return { rows: [] };
  }

  if (sql.includes('SELECT') && sql.includes('FROM users WHERE id')) {
    const user = await User.findById(params[0]);
    if (!user) return { rows: [] };
    return { rows: [{ id: user._id.toString(), nickname: user.nickname, wins: user.wins, losses: user.losses, coins: user.coins || 0, avatar: user.avatar || '🌱', clan: user.clan || '', is_admin: user.is_admin || false, is_banned: user.is_banned || false, unlocked_plants: user.unlocked_plants || [1, 2, 3] }] };
  }

  return { rows: [] };
}

/* File-based queries (fallback) */
function fileQuery(sql, params) {
  warnDb();
  loadFileDb();

  if (sql.includes('INSERT INTO users')) {
    const id = fileDb.users.length ? Math.max(...fileDb.users.map(u => u.id)) + 1 : 1;
    fileDb.users.push({ id, nickname: params[0], password_hash: params[1], wins: 0, losses: 0, coins: 0, avatar: '', clan: '', friends: [], friend_requests: [], is_admin: false, is_banned: false, unlocked_plants: [1, 2, 3], created_at: new Date().toISOString() });
    saveFileDb();
    return { rows: [{ id, nickname: params[0], wins: 0, losses: 0, coins: 0, avatar: '', clan: '', friends: [], friend_requests: [], is_admin: false, is_banned: false, unlocked_plants: [1, 2, 3] }] };
  }

  if (sql.includes('INSERT INTO loadouts')) {
    const id = fileDb.loadouts.length ? Math.max(...fileDb.loadouts.map(l => l.id)) + 1 : 1;
    fileDb.loadouts.push({ id, user_id: Number(params[0]), role: params[1], slot1: params[2] || null, slot2: params[3] || null, slot3: params[4] || null, slot4: params[5] || null, slot5: params[6] || null, slot6: params[7] || null });
    saveFileDb();
    return { rows: [] };
  }

  if (sql.includes('users WHERE nickname')) {
    return { rows: fileDb.users.filter(u => u.nickname.toLowerCase() === params[0].toLowerCase()) };
  }

  if (sql.includes('FROM users WHERE id')) {
    return { rows: fileDb.users.filter(u => u.id == params[0]) };
  }

  if (sql.includes('UPDATE users SET unlocked_plants')) {
    const u = fileDb.users.find(u => u.id == params[1]);
    if (u) {
      if (!u.unlocked_plants) u.unlocked_plants = [1, 2, 3];
      if (!u.unlocked_plants.includes(params[0])) u.unlocked_plants.push(params[0]);
      saveFileDb();
    }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET coins')) {
    const u = fileDb.users.find(u => u.id == params[1]);
    if (u) { u.coins = params[0]; saveFileDb(); }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET avatar')) {
    const u = fileDb.users.find(u => u.id == params[1]);
    if (u) { u.avatar = params[0]; saveFileDb(); }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET clan')) {
    const u = fileDb.users.find(u => u.id == params[1]);
    if (u) { u.clan = params[0]; saveFileDb(); }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET friends')) {
    const u = fileDb.users.find(u => u.id == params[1]);
    if (u) { u.friends = params[0]; saveFileDb(); }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET friend_requests')) {
    const u = fileDb.users.find(u => u.id == params[1]);
    if (u) { u.friend_requests = params[0]; saveFileDb(); }
    return { rows: [] };
  }

  if (sql.includes('ORDER BY wins DESC')) {
    return { rows: [...fileDb.users].sort((a, b) => b.wins - a.wins).slice(0, 50).map(u => ({ id: u.id, nickname: u.nickname, wins: u.wins, losses: u.losses, total_games: u.wins + u.losses, avatar: u.avatar || '🌱', clan: u.clan || '', friends: u.friends || [] })) };
  }

  if (sql.includes('loadouts WHERE user_id')) {
    return { rows: fileDb.loadouts.filter(l => Number(l.user_id) === Number(params[0]) && l.role === params[1]) };
  }

  if (sql.includes('UPDATE loadouts SET')) {
    const l = fileDb.loadouts.find(l => Number(l.user_id) === Number(params[6]) && l.role === params[7]);
    if (l) { l.slot1 = params[0]; l.slot2 = params[1]; l.slot3 = params[2]; l.slot4 = params[3]; l.slot5 = params[4]; l.slot6 = params[5]; saveFileDb(); }
    return { rows: [] };
  }

  if (sql.includes('UPDATE users SET')) {
    const u = fileDb.users.find(u => u.id == params[0]);
    if (u) {
      if (sql.includes('wins = wins + 1')) u.wins++;
      else if (sql.includes('losses = losses + 1')) u.losses++;
      else if (sql.includes('is_admin')) u.is_admin = params[1] === 1;
      else if (sql.includes('is_banned')) u.is_banned = params[1] === 1;
      else if (sql.includes('wins = 0') && sql.includes('losses = 0')) { u.wins = 0; u.losses = 0; }
      saveFileDb();
    }
    return { rows: [] };
  }

  if (sql.includes('SELECT') && sql.includes('FROM users') && sql.includes('ORDER BY')) {
    return { rows: fileDb.users.map(u => ({ id: u.id, nickname: u.nickname, wins: u.wins, losses: u.losses, is_admin: u.is_admin || false, is_banned: u.is_banned || false, created_at: u.created_at })) };
  }

  if (sql.includes('DELETE FROM users')) {
    fileDb.users = fileDb.users.filter(u => u.id != params[0]);
    saveFileDb();
    return { rows: [] };
  }

  if (sql.includes('SELECT COUNT(*)')) {
    return { rows: [{ count: fileDb.users.length }] };
  }

  if (sql.includes('UPDATE users SET password_hash')) {
    const u = fileDb.users.find(u => u.id == params[1]);
    if (u) { u.password_hash = params[0]; saveFileDb(); }
    return { rows: [] };
  }

  return { rows: [] };
}

module.exports = { query, initDB };
