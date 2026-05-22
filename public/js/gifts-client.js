const API = window.location.origin + '/api/auth';

async function claimGift(index) {
  try {
    const res = await fetch(API + '/gifts/claim/' + index, {
      method: 'POST',
      headers: { 'x-user-id': currentUser.id }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✅ ' + (data.reward ? 'Награда получена!' : 'Подарок забран'));
      loadGifts();
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (e) {
    showToast('❌ Ошибка');
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);color:#fff;padding:12px 24px;border-radius:10px;border:1px solid rgba(255,215,0,0.3);font-size:14px;z-index:9999;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function loadGifts() {
  if (!currentUser) return;
  try {
    const res = await fetch(API + '/gifts/me', {
      headers: { 'x-user-id': currentUser.id }
    });
    const data = await res.json();
    const list = document.getElementById('gifts-list');

    if (!data.gifts || data.gifts.length === 0) {
      list.innerHTML = '<div class="empty-msg">Пока нет подарков 🎁</div>';
      return;
    }

    list.innerHTML = '';
    const typeIcons = { coins: '🪙', plant: '🌱', zombie: '🧟', box: '🎁', role: '👑' };
    const typeNames = { coins: 'Монеты', plant: 'Растение', zombie: 'Зомби', box: 'Бокс', role: 'Роль' };
    const roleNames = { player: 'Игрок', moderator: 'Модератор', super_player: 'Сверх игрок', vip: 'V.I.P' };

    [...data.gifts].reverse().forEach(g => {
      const div = document.createElement('div');
      div.className = 'gift-card';
      let detail = '';
      if (g.type === 'coins') detail = `${g.amount} 🪙`;
      else if (g.type === 'role') detail = roleNames[g.itemId] || g.itemId;
      else detail = `ID: ${g.itemId}`;

      const canClaim = !g.claimed && ['coins', 'plant', 'zombie', 'box', 'role'].includes(g.type);
      div.innerHTML = `
        <div class="gift-icon">${typeIcons[g.type]}</div>
        <div class="gift-info">
          <div class="gift-type">${typeNames[g.type]} — ${detail} ${g.claimed ? '<span style="color:#4CAF50;font-size:12px;">✅ Забрано</span>' : ''}</div>
          <div class="gift-from">От: ${g.from}</div>
          ${g.message ? `<div class="gift-message">"${g.message}"</div>` : ''}
          <div class="gift-date">${new Date(g.date).toLocaleDateString('ru-RU')}</div>
        </div>
        ${canClaim ? `<button class="gift-claim-btn" onclick="claimGift(${g.index})">Забрать</button>` : ''}
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load gifts:', err);
    document.getElementById('gifts-list').innerHTML = '<div class="empty-msg">❌ Ошибка загрузки</div>';
  }
}

loadGifts();