const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const users = await query('SELECT COUNT(*) FROM users');
    const totalUsers = users.rows[0]?.count || 0;
    res.json({ totalUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/ban', authMiddleware, async (req, res) => {
  try {
    await query('UPDATE users SET is_banned = $1 WHERE id = $2', [1, req.params.id]);
    res.json({ message: 'User banned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/unban', authMiddleware, async (req, res) => {
  try {
    await query('UPDATE users SET is_banned = $1 WHERE id = $2', [0, req.params.id]);
    res.json({ message: 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/admin', authMiddleware, async (req, res) => {
  try {
    await query('UPDATE users SET is_admin = $1 WHERE id = $2', [1, req.params.id]);
    res.json({ message: 'User promoted to admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/reset', authMiddleware, async (req, res) => {
  try {
    await query('UPDATE users SET wins = 0, losses = 0 WHERE id = $1', [req.params.id]);
    res.json({ message: 'Stats reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/reset-password', authMiddleware, async (req, res) => {
  try {
    const newPassword = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    res.json({ message: 'Password reset', newPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
