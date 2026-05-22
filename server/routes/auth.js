const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { nickname, password } = req.body;

    if (!nickname || !password) {
      return res.status(400).json({ error: 'Nickname and password required' });
    }

    if (nickname.length < 3 || password.length < 4) {
      return res.status(400).json({ error: 'Nickname min 3 chars, password min 4 chars' });
    }

    const existing = await query('SELECT id FROM users WHERE nickname = $1', [nickname]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Nickname already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    console.log('[REGISTER] nickname:', nickname, 'hash length:', passwordHash.length);

    const result = await query(
      'INSERT INTO users (nickname, password_hash) VALUES ($1, $2) RETURNING id, nickname, wins, losses',
      [nickname, passwordHash]
    );

    const user = result.rows[0];
    await query('INSERT INTO loadouts (user_id, role) VALUES ($1, $2)', [user.id, 'plant']);
    await query('INSERT INTO loadouts (user_id, role) VALUES ($1, $2)', [user.id, 'zombie']);

    console.log('[REGISTER] success, user id:', user.id);
    res.json({ message: 'Registered successfully', user: { ...user, is_admin: false, role: 'player' } });
  } catch (err) {
    console.error('[REGISTER] error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    console.log('[LOGIN] attempt for:', nickname);

    const result = await query('SELECT * FROM users WHERE nickname = $1', [nickname]);

    if (result.rows.length === 0) {
      console.log('[LOGIN] FAIL: user not found:', nickname);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('[LOGIN] found user, hash:', user.password_hash ? user.password_hash.substring(0, 20) + '...' : 'MISSING');

    if (!user.password_hash) {
      console.log('[LOGIN] FAIL: password_hash is missing');
      return res.status(500).json({ error: 'Internal error' });
    }

    if (user.is_banned) {
      console.log('[LOGIN] FAIL: user banned:', nickname);
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log('[LOGIN] FAIL: wrong password for:', nickname);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('[LOGIN] success:', nickname);
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        nickname: user.nickname,
        wins: user.wins,
        losses: user.losses,
        coins: user.coins || 0,
        avatar: user.avatar || '🌱',
        clan: user.clan || '',
        friends: user.friends || [],
        is_admin: user.is_admin || false,
        is_banned: user.is_banned || false,
        unlocked_plants: user.unlocked_plants || [1, 2, 3],
        unlocked_zombies: user.unlocked_zombies || [1, 2, 3],
        role: user.role || 'player'
      }
    });
  } catch (err) {
    console.error('[LOGIN] error:', err.message, err.stack);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      nickname: u.nickname,
      wins: u.wins,
      losses: u.losses,
      coins: u.coins || 0,
      avatar: u.avatar || '',
      clan: u.clan || '',
      friends: u.friends || [],
      is_admin: u.is_admin || false,
      is_banned: u.is_banned || false,
      unlocked_plants: u.unlocked_plants || [1, 2, 3],
      unlocked_zombies: u.unlocked_zombies || [1, 2, 3],
      role: u.role || 'player'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/gifts/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const gifts = (u.gifts || []).map((g, i) => ({ ...g, index: i }));
    res.json({ gifts, coins: u.coins || 0, unlocked_plants: u.unlocked_plants || [1, 2, 3], unlocked_zombies: u.unlocked_zombies || [1, 2, 3] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/gifts/claim/:giftIndex', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const giftIndex = parseInt(req.params.giftIndex);
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const gifts = u.gifts || [];

    if (giftIndex < 0 || giftIndex >= gifts.length) return res.status(400).json({ error: 'Invalid gift index' });
    const gift = gifts[giftIndex];
    if (gift.claimed) return res.status(400).json({ error: 'Gift already claimed' });

    const PLANTS = [
      { id: 1, name: 'Подсолнух', emoji: '🌻' },
      { id: 2, name: 'Горохострел', emoji: '🌱' },
      { id: 3, name: 'Стена-орех', emoji: '🥜' },
      { id: 4, name: 'Вишня-бомба', emoji: '🍒' },
      { id: 5, name: 'Снежный горох', emoji: '❄️' },
      { id: 6, name: 'Повторитель', emoji: '🔁' },
      { id: 7, name: 'Кактус', emoji: '🌵' },
      { id: 8, name: 'Тыква', emoji: '🎃' },
      { id: 9, name: 'Магнит', emoji: '🧲' },
      { id: 10, name: 'Гриб-взрыв', emoji: '🍄' },
      { id: 11, name: 'Зонт', emoji: '☂️' },
      { id: 12, name: 'Кофе', emoji: '☕' },
    ];
    const ZOMBIES = [
      { id: 1, name: 'Обычный', emoji: '🧟' },
      { id: 2, name: 'Конус', emoji: '🧟‍♂️' },
      { id: 3, name: 'Ведро', emoji: '🪖' },
      { id: 4, name: 'Футболист', emoji: '🏃' },
      { id: 5, name: 'Танцор', emoji: '💃' },
      { id: 6, name: 'Гаргантюа', emoji: '👹' },
      { id: 7, name: 'Имп', emoji: '👾' },
      { id: 8, name: 'Зомбони', emoji: '🏎️' },
    ];

    function getItemInfo(id, list) {
      return list.find(i => i.id === id) || { name: 'Неизвестно', emoji: '❓' };
    }

    const unlockedPlants = (u.unlocked_plants || [1, 2, 3]).map(Number);
    const unlockedZombies = (u.unlocked_zombies || [1, 2, 3]).map(Number);
    let reward = null;

    if (gift.type === 'box') {
      const BOX_REWARDS = [
        { type: 'plant', ids: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { type: 'zombie', ids: [2, 3, 4, 5, 6, 7, 8] },
      ];
      const pool = Math.random() < 0.5 ? BOX_REWARDS[0] : BOX_REWARDS[1];
      const unlocked = pool.type === 'plant' ? unlockedPlants : unlockedZombies;
      const available = pool.ids.filter(id => !unlocked.includes(id));
      if (available.length === 0) {
        const consolation = 50;
        await query('UPDATE users SET coins = $1 WHERE id = $2', [(u.coins || 0) + consolation, userId]);
        reward = { type: 'coins', amount: consolation, name: 'Утешительный приз', emoji: '🪙' };
      } else {
        const wonId = available[Math.floor(Math.random() * available.length)];
        const updateField = pool.type === 'plant' ? 'unlocked_plants' : 'unlocked_zombies';
        await query(`UPDATE users SET ${updateField} = $1 WHERE id = $2`, [wonId, userId]);
        const info = getItemInfo(wonId, pool.type === 'plant' ? PLANTS : ZOMBIES);
        reward = { type: pool.type, id: wonId, name: info.name, emoji: info.emoji };
      }
    } else if (gift.type === 'coins') {
      const amount = gift.amount || 0;
      const currentCoins = u.coins || 0;
      await query('UPDATE users SET coins = $1 WHERE id = $2', [currentCoins + amount, userId]);
      reward = { type: 'coins', amount };
    } else if (gift.type === 'plant') {
      if (!unlockedPlants.includes(Number(gift.itemId))) {
        await query('UPDATE users SET unlocked_plants = $1 WHERE id = $2', [Number(gift.itemId), userId]);
      }
      const info = getItemInfo(Number(gift.itemId), PLANTS);
      reward = { type: 'plant', id: Number(gift.itemId), name: info.name, emoji: info.emoji };
    } else if (gift.type === 'zombie') {
      if (!unlockedZombies.includes(Number(gift.itemId))) {
        await query('UPDATE users SET unlocked_zombies = $1 WHERE id = $2', [Number(gift.itemId), userId]);
      }
      const info = getItemInfo(Number(gift.itemId), ZOMBIES);
      reward = { type: 'zombie', id: Number(gift.itemId), name: info.name, emoji: info.emoji };
    } else if (gift.type === 'role') {
      const validRoles = ['player', 'moderator', 'super_player', 'vip'];
      if (validRoles.includes(gift.itemId)) {
        await query('UPDATE users SET role = $1 WHERE id = $2', [gift.itemId, userId]);
      }
      reward = { type: 'role', id: gift.itemId };
    }

    gifts[giftIndex].claimed = true;
    await query('UPDATE users SET gifts = $1 WHERE id = $2', [gifts, userId]);

    res.json({ message: 'Gift claimed', reward });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
