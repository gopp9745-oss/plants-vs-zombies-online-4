const express = require('express');
const { query } = require('../db');
const router = express.Router();

const AVATARS = [
  '🌱', '🌻', '🌵', '🍀', '🌲', '🌸', '🌺', '🍄',
  '🧟', '🧟‍♂️', '👹', '💀', '🦇', '🕷️', '🐍', '🦎',
  '⚔️', '🛡️', '🏹', '🔮', '💎', '👑', '🎭', '🎪',
  '🐉', '🦅', '🐺', '🦊', '🐻', '🦁', '🐯', '🐲'
];

router.get('/avatars', (req, res) => {
  res.json(AVATARS);
});

router.post('/avatar/:userId', async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!AVATARS.includes(avatar)) return res.status(400).json({ error: 'Invalid avatar' });
    await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.params.userId]);
    res.json({ message: 'Avatar updated', avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/clan/:userId', async (req, res) => {
  try {
    let { clan } = req.body;
    clan = (clan || '').trim();
    if (clan.length > 20) return res.status(400).json({ error: 'Clan name too long (max 20 chars)' });
    if (clan.length < 2 && clan.length > 0) return res.status(400).json({ error: 'Clan name too short (min 2 chars)' });
    await query('UPDATE users SET clan = $1 WHERE id = $2', [clan, req.params.userId]);
    res.json({ message: 'Clan updated', clan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
