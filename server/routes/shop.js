const express = require('express');
const { query } = require('../db');
const router = express.Router();

const ALL_PLANTS = [
  { id: 1, name: 'Подсолнух', cost: 50, emoji: '🌻', type: 'producer', desc: 'Производит солнце', price: 0 },
  { id: 2, name: 'Горохострел', cost: 100, emoji: '🌱', type: 'shooter', desc: 'Стреляет горохом', price: 0 },
  { id: 3, name: 'Стена-орех', cost: 50, emoji: '🥜', type: 'wall', desc: 'Блокирует зомби', price: 0 },
  { id: 4, name: 'Вишня-бомба', cost: 150, emoji: '🍒', type: 'explosive', desc: 'Взрывает область 3x3', price: 200 },
  { id: 5, name: 'Снежный горох', cost: 175, emoji: '❄️', type: 'slow', desc: 'Замедляет зомби', price: 300 },
  { id: 6, name: 'Повторитель', cost: 200, emoji: '🔁', type: 'repeater', desc: 'Двойной выстрел', price: 400 },
  { id: 7, name: 'Кактус', cost: 125, emoji: '🌵', type: 'shooter', desc: 'Стреляет шипами', price: 250 },
  { id: 8, name: 'Тыква', cost: 75, emoji: '🎃', type: 'armor', desc: 'Защитная оболочка', price: 150 },
  { id: 9, name: 'Магнит', cost: 100, emoji: '🧲', type: 'utility', desc: 'Забирает предметы зомби', price: 350 },
  { id: 10, name: 'Гриб-взрыв', cost: 25, emoji: '🍄', type: 'explosive', desc: 'Дешёвый взрыв', price: 100 },
  { id: 11, name: 'Зонт', cost: 50, emoji: '☂️', type: 'utility', desc: 'Защита от воздушных', price: 200 },
  { id: 12, name: 'Кофе', cost: 75, emoji: '☕', type: 'buff', desc: 'Ускоряет растения', price: 300 }
];

router.get('/plants', async (req, res) => {
  try {
    res.json(ALL_PLANTS);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unlocked/:userId', async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const unlocked = u.unlocked_plants || [1, 2, 3];
    const plants = ALL_PLANTS.map(p => ({
      ...p,
      unlocked: unlocked.includes(p.id)
    }));
    res.json({ coins: u.coins || 0, plants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/buy/:userId', async (req, res) => {
  try {
    const { plantId } = req.body;
    const plant = ALL_PLANTS.find(p => p.id === plantId);
    if (!plant) return res.status(400).json({ error: 'Plant not found' });
    if (plant.price === 0) return res.status(400).json({ error: 'Plant is free' });

    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const coins = u.coins || 0;
    const unlocked = u.unlocked_plants || [1, 2, 3];

    if (unlocked.includes(plantId)) return res.status(400).json({ error: 'Already unlocked' });
    if (coins < plant.price) return res.status(400).json({ error: 'Not enough coins', need: plant.price, have: coins });

    await query('UPDATE users SET coins = $1 WHERE id = $2', [coins - plant.price, req.params.userId]);
    await query('UPDATE users SET unlocked_plants = $1 WHERE id = $2', [plantId, req.params.userId]);

    res.json({ message: 'Plant purchased', remaining: coins - plant.price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
