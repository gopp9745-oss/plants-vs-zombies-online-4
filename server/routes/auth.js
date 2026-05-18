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
    const result = await query(
      'INSERT INTO users (nickname, password_hash) VALUES ($1, $2) RETURNING id, nickname, wins, losses',
      [nickname, passwordHash]
    );
    
    const user = result.rows[0];
    await query('INSERT INTO loadouts (user_id, role) VALUES ($1, $2)', [user.id, 'plant']);
    await query('INSERT INTO loadouts (user_id, role) VALUES ($1, $2)', [user.id, 'zombie']);
    
    res.json({ message: 'Registered successfully', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    
    const result = await query('SELECT * FROM users WHERE nickname = $1', [nickname]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        nickname: user.nickname,
        wins: user.wins,
        losses: user.losses
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
