const express = require('express');
const { query } = require('../db');
const router = express.Router();

const AVATAR_CLANS = {
  '🌱': 'Растения', '🌻': 'Растения', '🌵': 'Растения', '🍀': 'Растения',
  '🌲': 'Растения', '🌸': 'Растения', '🌺': 'Растения', '🍄': 'Растения',
  '🧟': 'Нежить', '🧟‍♂️': 'Нежить', '👹': 'Нежить', '💀': 'Нежить',
  '🦇': 'Нежить', '🕷️': 'Нежить', '🐍': 'Нежить', '🦎': 'Нежить',
  '⚔️': 'Воины', '🛡️': 'Воины', '🏹': 'Воины', '🔮': 'Воины',
  '💎': 'Воины', '👑': 'Воины', '🎭': 'Воины', '🎪': 'Воины',
  '🐉': 'Звери', '🦅': 'Звери', '🐺': 'Звери', '🦊': 'Звери',
  '🐻': 'Звери', '🦁': 'Звери', '🐯': 'Звери', '🐲': 'Звери'
};

const AVATARS = Object.keys(AVATAR_CLANS);

router.get('/avatars', (req, res) => {
  res.json(AVATARS.map(a => ({ emoji: a, clan: AVATAR_CLANS[a] })));
});

router.post('/avatar/:userId', async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!AVATARS.includes(avatar)) return res.status(400).json({ error: 'Invalid avatar' });
    const clan = AVATAR_CLANS[avatar];
    await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.params.userId]);
    await query('UPDATE users SET clan = $1 WHERE id = $2', [clan, req.params.userId]);
    res.json({ message: 'Avatar updated', avatar, clan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
