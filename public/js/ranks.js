const RANKS = [
  { wins: 0, name: 'Новичок', emoji: '🌱', color: '#888' },
  { wins: 3, name: 'Боец', emoji: '⚔️', color: '#4CAF50' },
  { wins: 10, name: 'Ветеран', emoji: '🛡️', color: '#2196F3' },
  { wins: 25, name: 'Чемпион', emoji: '👑', color: '#FFD700' },
  { wins: 50, name: 'Легенда', emoji: '🔥', color: '#FF5722' }
];

function getRank(wins) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (wins >= r.wins) rank = r;
  }
  return rank;
}

if (typeof module !== 'undefined') module.exports = { getRank, RANKS };
