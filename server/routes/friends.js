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
        friends.push({ id: f.id, nickname: f.nickname, avatar: f.avatar || '', clan: f.clan || '', wins: f.wins, losses: f.losses, is_banned: f.is_banned || false });
      }
    }
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests/:userId', async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    const requestIds = user.friend_requests || [];
    if (requestIds.length === 0) return res.json([]);
    const requests = [];
    for (const rid of requestIds) {
      const rr = await query('SELECT * FROM users WHERE id = $1', [rid]);
      if (rr.rows.length > 0) {
        const r = rr.rows[0];
        requests.push({ id: r.id, nickname: r.nickname, avatar: r.avatar || '', clan: r.clan || '', wins: r.wins, losses: r.losses });
      }
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-request/:userId', async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'friendId required' });
    if (friendId === req.params.userId) return res.status(400).json({ error: 'Cannot add yourself' });
    
    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const friendResult = await query('SELECT * FROM users WHERE id = $1', [friendId]);
    if (friendResult.rows.length === 0) return res.status(404).json({ error: 'Friend not found' });
    
    const user = userResult.rows[0];
    const friend = friendResult.rows[0];
    
    let userFriends = user.friends || [];
    if (userFriends.includes(friendId)) return res.status(400).json({ error: 'Already friends' });
    
    let friendRequests = friend.friend_requests || [];
    if (friendRequests.includes(req.params.userId)) return res.status(400).json({ error: 'Request already sent' });
    
    friendRequests.push(req.params.userId);
    await query('UPDATE users SET friend_requests = $1 WHERE id = $2', [friendRequests, friendId]);
    
    res.json({ message: 'Request sent', friendNickname: friend.nickname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accept-request/:userId', async (req, res) => {
  try {
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: 'requesterId required' });
    
    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const requesterResult = await query('SELECT * FROM users WHERE id = $1', [requesterId]);
    if (requesterResult.rows.length === 0) return res.status(404).json({ error: 'Requester not found' });
    
    const user = userResult.rows[0];
    const requester = requesterResult.rows[0];
    
    let userFriends = user.friends || [];
    let requesterFriends = requester.friends || [];
    
    if (!userFriends.includes(requesterId)) userFriends.push(requesterId);
    if (!requesterFriends.includes(req.params.userId)) requesterFriends.push(req.params.userId);
    
    await query('UPDATE users SET friends = $1 WHERE id = $2', [userFriends, req.params.userId]);
    await query('UPDATE users SET friends = $1 WHERE id = $2', [requesterFriends, requesterId]);
    
    let userRequests = (user.friend_requests || []).filter(r => r !== requesterId);
    await query('UPDATE users SET friend_requests = $1 WHERE id = $2', [userRequests, req.params.userId]);
    
    res.json({ message: 'Friend added', friendNickname: requester.nickname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/decline-request/:userId', async (req, res) => {
  try {
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: 'requesterId required' });
    
    const userResult = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const user = userResult.rows[0];
    let userRequests = (user.friend_requests || []).filter(r => r !== requesterId);
    await query('UPDATE users SET friend_requests = $1 WHERE id = $2', [userRequests, req.params.userId]);
    
    res.json({ message: 'Request declined' });
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

router.post('/search/partial', async (req, res) => {
  try {
    const { query: q } = req.body;
    console.log('[FRIENDS PARTIAL] searching for:', q);
    if (!q || q.length < 2) return res.json([]);
    
    const allResult = await query('SELECT * FROM users ORDER BY wins DESC');
    console.log('[FRIENDS PARTIAL] got', allResult.rows.length, 'users from DB');
    
    const matches = (allResult.rows || []).filter(u => {
      const nick = (u.nickname || '').toLowerCase();
      const search = q.toLowerCase();
      return nick.includes(search);
    }).slice(0, 5);
    
    console.log('[FRIENDS PARTIAL] found', matches.length, 'matches');
    
    res.json(matches.map(u => ({ id: u.id, nickname: u.nickname, avatar: u.avatar || '🌱', clan: u.clan || '', wins: u.wins, losses: u.losses })));
  } catch (err) {
    console.error('[FRIENDS PARTIAL] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/search', async (req, res) => {
  console.log('[FRIENDS SEARCH ROUTE HIT]');
  try {
    const { nickname } = req.body;
    console.log('[FRIENDS SEARCH] searching for:', nickname);
    if (!nickname) return res.status(400).json({ error: 'nickname required' });
    
    const allResult = await query('SELECT * FROM users ORDER BY wins DESC');
    console.log('[FRIENDS SEARCH] total users:', allResult.rows.length);
    const found = (allResult.rows || []).find(u => u.nickname.toLowerCase() === nickname.toLowerCase());
    
    if (!found) return res.status(404).json({ error: 'User not found' });
    
    console.log('[FRIENDS SEARCH] found:', found.nickname);
    res.json({ id: found.id, nickname: found.nickname, avatar: found.avatar || '🌱', clan: found.clan || '', wins: found.wins, losses: found.losses });
  } catch (err) {
    console.error('[FRIENDS SEARCH] error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
