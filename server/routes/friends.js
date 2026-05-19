const express = require('express');
const { query } = require('../db');
const router = express.Router();

router.get('/list/:userId', async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    const friendIds = user.friends || [];
    if (friendIds.length === 0) return res.json([]);
    const friends = [];
    for (const fid of friendIds) {
      const fr = await query('SELECT * FROM users WHERE id = $1', [fid]);
      if (fr.rows.length > 0) {
        const f = fr.rows[0];
        friends.push({ id: f.id, nickname: f.nickname, avatar: f.avatar || '🌱', clan: f.clan || '', wins: f.wins, losses: f.losses });
      }
    }
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/add/:userId', async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'friendId required' });
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    let friends = user.friends || [];
    if (friends.includes(friendId)) return res.status(400).json({ error: 'Already friends' });
    if (friendId === req.params.userId) return res.status(400).json({ error: 'Cannot add yourself' });
    friends.push(friendId);
    await query('UPDATE users SET friends = $1 WHERE id = $2', [friends, req.params.userId]);
    const friendResult = await query('SELECT * FROM users WHERE id = $1', [friendId]);
    let friendNickname = 'Unknown';
    if (friendResult.rows.length > 0) {
      friendNickname = friendResult.rows[0].nickname;
      let friendFriends = friendResult.rows[0].friends || [];
      if (!friendFriends.includes(req.params.userId)) {
        friendFriends.push(req.params.userId);
        await query('UPDATE users SET friends = $1 WHERE id = $2', [friendFriends, friendId]);
      }
    }
    res.json({ message: 'Friend added', friendNickname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/remove/:userId', async (req, res) => {
  try {
    const { friendId } = req.body;
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    let friends = (user.friends || []).filter(f => f !== friendId);
    await query('UPDATE users SET friends = $1 WHERE id = $2', [friends, req.params.userId]);
    const friendResult = await query('SELECT * FROM users WHERE id = $1', [friendId]);
    if (friendResult.rows.length > 0) {
      let friendFriends = (friendResult.rows[0].friends || []).filter(f => f !== req.params.userId);
      await query('UPDATE users SET friends = $1 WHERE id = $2', [friendFriends, friendId]);
    }
    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname) return res.status(400).json({ error: 'nickname required' });
    const result = await query('SELECT * FROM users WHERE nickname = $1', [nickname]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: u.id, nickname: u.nickname, avatar: u.avatar || '🌱', clan: u.clan || '', wins: u.wins, losses: u.losses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
