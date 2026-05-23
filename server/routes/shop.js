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

const ALL_ZOMBIES = [
  { id: 1, name: 'Обычный', hp: 100, speed: 1, emoji: '🧟', price: 0 },
  { id: 2, name: 'Конус', hp: 200, speed: 1, emoji: '🧟‍♂️', price: 0 },
  { id: 3, name: 'Ведро', hp: 350, speed: 0.8, emoji: '🪖', price: 0 },
  { id: 4, name: 'Футболист', hp: 500, speed: 2, emoji: '🏃', price: 300 },
  { id: 5, name: 'Танцор', hp: 150, speed: 1.5, emoji: '💃', price: 250 },
  { id: 6, name: 'Гаргантюа', hp: 1000, speed: 0.5, emoji: '👹', price: 500 },
  { id: 7, name: 'Имп', hp: 80, speed: 2.5, emoji: '👾', price: 150 },
  { id: 8, name: 'Зомбони', hp: 600, speed: 1.2, emoji: '🏎️', price: 400 }
];

const BOXES = [
  { id: 'plant_basic', name: 'Бокс растений', emoji: '', price: 150, type: 'plant', rarity: 'common' },
  { id: 'plant_rare', name: 'Редкий бокс растений', emoji: '', price: 350, type: 'plant', rarity: 'rare' },
  { id: 'zombie_basic', name: 'Бокс зомби', emoji: '', price: 150, type: 'zombie', rarity: 'common' },
  { id: 'zombie_rare', name: 'Редкий бокс зомби', emoji: '', price: 350, type: 'zombie', rarity: 'rare' },
  { id: 'mega', name: 'Мега бокс', emoji: '', price: 500, type: 'any', rarity: 'legendary' }
];

function getRandomItem(items, unlocked) {
  const locked = items.filter(i => !unlocked.includes(i.id));
  if (locked.length === 0) return items[Math.floor(Math.random() * items.length)];
  return locked[Math.floor(Math.random() * locked.length)];
}

router.get('/plants', async (req, res) => {
  try {
    res.json(ALL_PLANTS);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/zombies', async (req, res) => {
  try {
    res.json(ALL_ZOMBIES);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/boxes', async (req, res) => {
  try {
    res.json(BOXES);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unlocked/:userId', async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const unlockedPlants = (u.unlocked_plants || [1, 2, 3]).map(Number);
    const unlockedZombies = (u.unlocked_zombies || [1, 2, 3]).map(Number);
    const plants = ALL_PLANTS.map(p => ({ ...p, unlocked: unlockedPlants.includes(p.id) }));
    const zombies = ALL_ZOMBIES.map(z => ({ ...z, unlocked: unlockedZombies.includes(z.id) }));
    res.json({ coins: u.coins || 0, plants, zombies });
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

router.post('/buy-zombie/:userId', async (req, res) => {
  try {
    const { zombieId } = req.body;
    const zombie = ALL_ZOMBIES.find(z => z.id === zombieId);
    if (!zombie) return res.status(400).json({ error: 'Zombie not found' });
    if (zombie.price === 0) return res.status(400).json({ error: 'Zombie is free' });

    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const coins = u.coins || 0;
    const unlocked = u.unlocked_zombies || [1, 2, 3];

    if (unlocked.includes(zombieId)) return res.status(400).json({ error: 'Already unlocked' });
    if (coins < zombie.price) return res.status(400).json({ error: 'Not enough coins', need: zombie.price, have: coins });

    await query('UPDATE users SET coins = $1 WHERE id = $2', [coins - zombie.price, req.params.userId]);
    await query('UPDATE users SET unlocked_zombies = $1 WHERE id = $2', [zombieId, req.params.userId]);

    res.json({ message: 'Zombie purchased', remaining: coins - zombie.price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/open-box/:userId', async (req, res) => {
  try {
    const { boxId } = req.body;
    const box = BOXES.find(b => b.id === boxId);
    if (!box) return res.status(400).json({ error: 'Box not found' });

    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    const coins = u.coins || 0;
    const unlockedPlants = (u.unlocked_plants || [1, 2, 3]).map(Number);
    const unlockedZombies = (u.unlocked_zombies || [1, 2, 3]).map(Number);

    if (coins < box.price) return res.status(400).json({ error: 'Not enough coins', need: box.price, have: coins });

    let wonItem;
    let itemType;
    let updateField;

    if (box.type === 'plant') {
      wonItem = getRandomItem(ALL_PLANTS, unlockedPlants);
      itemType = 'plant';
      updateField = 'unlocked_plants';
    } else if (box.type === 'zombie') {
      wonItem = getRandomItem(ALL_ZOMBIES, unlockedZombies);
      itemType = 'zombie';
      updateField = 'unlocked_zombies';
    } else {
      if (Math.random() < 0.5) {
        wonItem = getRandomItem(ALL_PLANTS, unlockedPlants);
        itemType = 'plant';
        updateField = 'unlocked_plants';
      } else {
        wonItem = getRandomItem(ALL_ZOMBIES, unlockedZombies);
        itemType = 'zombie';
        updateField = 'unlocked_zombies';
      }
    }

    await query('UPDATE users SET coins = $1 WHERE id = $2', [coins - box.price, req.params.userId]);
    await query(`UPDATE users SET ${updateField} = $1 WHERE id = $2`, [wonItem.id, req.params.userId]);

    res.json({
      message: 'Box opened',
      remaining: coins - box.price,
      won: { id: wonItem.id, name: wonItem.name, emoji: wonItem.emoji, type: itemType },
      isNew: !(itemType === 'plant' ? unlockedPlants : unlockedZombies).includes(wonItem.id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
