const express = require('express');
const { query } = require('../db');
const router = express.Router();

const PLANTS = [
  { id: 1, name: 'Подсолнух', type: 'producer', cost: 50, desc: 'Производит солнце', emoji: '🌻' },
  { id: 2, name: 'Горохострел', type: 'shooter', cost: 100, desc: 'Стреляет горохом', emoji: '🌱' },
  { id: 3, name: 'Стена-орех', type: 'wall', cost: 50, desc: 'Блокирует зомби', emoji: '🥜' },
  { id: 4, name: 'Вишня-бомба', type: 'explosive', cost: 150, desc: 'Взрывает область 3x3', emoji: '🍒' },
  { id: 5, name: 'Снежный горох', type: 'slow', cost: 175, desc: 'Замедляет зомби', emoji: '❄️' },
  { id: 6, name: 'Повторитель', type: 'repeater', cost: 200, desc: 'Двойной выстрел', emoji: '🔁' },
  { id: 7, name: 'Кактус', type: 'shooter', cost: 125, desc: 'Стреляет шипами', emoji: '🌵' },
  { id: 8, name: 'Тыква', type: 'armor', cost: 75, desc: 'Защитная оболочка', emoji: '🎃' },
  { id: 9, name: 'Магнит', type: 'utility', cost: 100, desc: 'Забирает предметы зомби', emoji: '🧲' },
  { id: 10, name: 'Гриб-взрыв', type: 'explosive', cost: 25, desc: 'Дешёвый взрыв', emoji: '🍄' },
  { id: 11, name: 'Зонт', type: 'utility', cost: 50, desc: 'Защита от воздушных', emoji: '☂️' },
  { id: 12, name: 'Кофе', type: 'buff', cost: 75, desc: 'Ускоряет растения', emoji: '☕' }
];

const ZOMBIES = [
  { id: 1, name: 'Обычный', type: 'basic', hp: 100, speed: 1, cost: 50, desc: 'Стандартный зомби', emoji: '🧟' },
  { id: 2, name: 'Конус', type: 'cone', hp: 200, speed: 1, cost: 75, desc: 'Зомби с конусом', emoji: '🧟‍♂️' },
  { id: 3, name: 'Ведро', type: 'bucket', hp: 350, speed: 0.8, cost: 100, desc: 'Зомби с ведром', emoji: '🪖' },
  { id: 4, name: 'Футболист', type: 'football', hp: 500, speed: 2, cost: 200, desc: 'Быстрый и крепкий', emoji: '🏃' },
  { id: 5, name: 'Танцор', type: 'dancer', hp: 150, speed: 1.5, cost: 125, desc: 'Призывает других', emoji: '💃' },
  { id: 6, name: 'Гаргантюа', type: 'giant', hp: 1000, speed: 0.5, cost: 300, desc: 'Огромный зомби', emoji: '👹' },
  { id: 7, name: 'Имп', type: 'imp', hp: 80, speed: 2.5, cost: 80, desc: 'Маленький быстрый зомби', emoji: '👾' },
  { id: 8, name: 'Зомбони', type: 'bonie', hp: 600, speed: 1.2, cost: 200, desc: 'Зомби на коньках', emoji: '🏎️' }
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