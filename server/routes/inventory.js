const express = require('express');
const { query } = require('../db');
const router = express.Router();

const PLANTS = [
  { id: 1, name: 'Подсолнух', type: 'producer', cost: 50, desc: 'Производит солнце' },
  { id: 2, name: 'Горохострел', type: 'shooter', cost: 100, desc: 'Стреляет горохом' },
  { id: 3, name: 'Стена-орех', type: 'wall', cost: 50, desc: 'Блокирует зомби' },
  { id: 4, name: 'Вишня-бомба', type: 'explosive', cost: 150, desc: 'Взрывает область' },
  { id: 5, name: 'Снежный горох', type: 'slow', cost: 175, desc: 'Замедляет зомби' },
  { id: 6, name: 'Повторитель', type: 'repeater', cost: 200, desc: 'Двойной выстрел' },
  { id: 7, name: 'Картофельная мина', type: 'mine', cost: 25, desc: 'Взрывается при контакте' },
  { id: 8, name: 'Двойник', type: 'duplicate', cost: 75, desc: 'Копирует растение' }
];

const ZOMBIES = [
  { id: 1, name: 'Обычный зомби', type: 'basic', hp: 100, speed: 1, desc: 'Стандартный зомби' },
  { id: 2, name: 'Зомби-конус', type: 'cone', hp: 200, speed: 1, desc: 'Зомби с конусом' },
  { id: 3, name: 'Зомби-ведро', type: 'bucket', hp: 350, speed: 1, desc: 'Зомби с ведром' },
  { id: 4, name: 'Бегущий зомби', type: 'runner', hp: 80, speed: 2, desc: 'Быстрый зомби' },
  { id: 5, name: 'Гигант-зомби', type: 'giant', hp: 500, speed: 0.5, desc: 'Огромный зомби' },
  { id: 6, name: 'Зомби-танцор', type: 'dancer', hp: 150, speed: 1.2, desc: 'Призывает других' },
  { id: 7, name: 'Зомби-футболист', type: 'football', hp: 300, speed: 1.5, desc: 'Быстрый и крепкий' },
  { id: 8, name: 'Зомби-рыбак', type: 'fisher', hp: 120, speed: 1, desc: 'Вытаскивает растения' }
];

router.get('/items', (req, res) => {
  res.json({ plants: PLANTS, zombies: ZOMBIES });
});

router.get('/loadout/:userId/:role', async (req, res) => {
  try {
    const { userId, role } = req.params;
    const result = await query('SELECT * FROM loadouts WHERE user_id = $1 AND role = $2', [userId, role]);
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get loadout' });
  }
});

router.post('/loadout/:userId/:role', async (req, res) => {
  try {
    const { userId, role } = req.params;
    const { slot1, slot2, slot3, slot4, slot5, slot6 } = req.body;
    
    const existing = await query('SELECT id FROM loadouts WHERE user_id = $1 AND role = $2', [userId, role]);
    
    if (existing.rows.length > 0) {
      await query(
        'UPDATE loadouts SET slot1=$1, slot2=$2, slot3=$3, slot4=$4, slot5=$5, slot6=$6 WHERE user_id=$7 AND role=$8',
        [slot1, slot2, slot3, slot4, slot5, slot6, userId, role]
      );
    } else {
      await query(
        'INSERT INTO loadouts (user_id, role, slot1, slot2, slot3, slot4, slot5, slot6) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, role, slot1, slot2, slot3, slot4, slot5, slot6]
      );
    }
    
    res.json({ message: 'Loadout saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save loadout' });
  }
});

module.exports = router;
