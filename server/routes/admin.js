const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const router = express.Router();

async function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    if (!result.rows[0].is_admin) return res.status(403).json({ error: 'Admin access required' });
    req.adminUser = result.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ success: true, user: { id: req.adminUser.id, nickname: req.adminUser.nickname } });
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
