const API = window.location.origin + '/api/admin';

async function loadGifts() {
  if (!currentUser) return;
  try {
    const res = await fetch(API + '/gifts/' + currentUser.id, {
      headers: { 'x-user-id': currentUser.id }
    });
    const data = await res.json();
    const list = document.getElementById('gifts-list');

    if (!data.gifts || data.gifts.length === 0) {
      list.innerHTML = '<div class="empty-msg">Пока нет подарков </div>';
      return;
    }

    list.innerHTML = '';
    const typeIcons = { coins: '🪙', plant: '🌱', zombie: '', box: '🎁', role: '👑' };
    const typeNames = { coins: 'монеты', plant: 'растение', zombie: 'зомби', box: 'бокс', role: 'роль' };
    const roleNames = { player: 'Игрок', moderator: 'Модератор', super_player: 'Сверх игрок', vip: 'V.I.P' };

    [...data.gifts].reverse().forEach(g => {
      const div = document.createElement('div');
      div.className = 'gift-card';
      let detail = '';
      if (g.type === 'coins') detail = `${g.amount} 🪙`;
      else if (g.type === 'role') detail = roleNames[g.itemId] || g.itemId;
      else detail = `ID: ${g.itemId}`;

      div.innerHTML = `
        <div class="gift-icon">${typeIcons[g.type]}</div>
        <div class="gift-info">
          <div class="gift-type">${typeNames[g.type]} — ${detail}</div>
          <div class="gift-from">От: ${g.from}</div>
          ${g.message ? `<div class="gift-message">"${g.message}"</div>` : ''}
          <div class="gift-date">${new Date(g.date).toLocaleDateString('ru-RU')}</div>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load gifts:', err);
    document.getElementById('gifts-list').innerHTML = '<div class="empty-msg">❌ Ошибка загрузки</div>';
  }
}

loadGifts();
