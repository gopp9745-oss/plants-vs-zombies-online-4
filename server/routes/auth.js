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
    res.json({ message: 'Registered successfully', user: { ...user, is_admin: false } });
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
        is_admin: user.is_admin || false,
        is_banned: user.is_banned || false,
        unlocked_plants: user.unlocked_plants || [1, 2, 3]
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
      avatar: u.avatar || '🌱',
      clan: u.clan || '',
      is_admin: u.is_admin || false,
      is_banned: u.is_banned || false,
      unlocked_plants: u.unlocked_plants || [1, 2, 3]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
