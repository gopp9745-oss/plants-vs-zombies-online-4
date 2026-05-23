const API = window.location.origin + '/api/auth';

function showBoxAnimation(reward) {
  const overlay = document.createElement('div');
  overlay.id = 'reward-overlay';
  overlay.innerHTML = `
    <div class="reward-container">
      <div class="reward-box">🎁</div>
      <div class="reward-result">
        <div class="reward-emoji">${reward.emoji || '?'}</div>
        <div class="reward-label">${reward.name || 'Неизвестно'}</div>
        <div class="reward-subtitle">${reward.type === 'plant' ? '🌱 Растение' : reward.type === 'coins' ? '🪙 +' + reward.amount : '🧟 Зомби'} получено!</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.querySelector('.reward-box').classList.add('shake');
    setTimeout(() => {
      overlay.querySelector('.reward-box').classList.add('open');
      overlay.querySelector('.reward-result').classList.add('show');
      setTimeout(() => {
        overlay.addEventListener('click', () => {
          overlay.classList.add('fade-out');
          setTimeout(() => overlay.remove(), 400);
        });
      }, 200);
    }, 800);
  });
}

async function claimGift(index) {
  try {
    const res = await fetch(API + '/gifts/claim/' + index, {
      method: 'POST',
      headers: { 'x-user-id': currentUser.id }
    });
    const data = await res.json();
    if (res.ok) {
      if (data.reward && data.reward.type === 'plant') {
        // update currentUser in localStorage so game/shop see the new item
        if (window.currentUser) {
          window.currentUser.unlocked_plants = window.currentUser.unlocked_plants || [1,2,3];
          if (!window.currentUser.unlocked_plants.includes(data.reward.id)) {
            window.currentUser.unlocked_plants.push(data.reward.id);
          }
          localStorage.setItem('pvz_user', JSON.stringify(window.currentUser));
        }
      }
      if (data.reward && data.reward.type === 'zombie') {
        if (window.currentUser) {
          window.currentUser.unlocked_zombies = window.currentUser.unlocked_zombies || [1,2,3];
          if (!window.currentUser.unlocked_zombies.includes(data.reward.id)) {
            window.currentUser.unlocked_zombies.push(data.reward.id);
          }
          localStorage.setItem('pvz_user', JSON.stringify(window.currentUser));
        }
      }
      if (data.reward && data.reward.type === 'coins') {
        if (window.currentUser) {
          window.currentUser.coins = (window.currentUser.coins || 0) + (data.reward.amount || 0);
          localStorage.setItem('pvz_user', JSON.stringify(window.currentUser));
        }
      }
      if (data.reward && data.reward.emoji) {
        showBoxAnimation(data.reward);
      } else {
        showToast('✅ Подарок забран!');
      }
      const card = document.querySelector(`.gift-card[data-index="${index}"]`);
      if (card) card.remove();
      if (!document.querySelector('.gift-card')) {
        document.getElementById('gifts-list').innerHTML = '<div class="empty-msg">Пока нет подарков 🎁</div>';
      }
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (e) {
    showToast('❌ Ошибка');
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
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
      div.dataset.index = g.index;
      let detail = '';
      if (g.type === 'coins') detail = `${g.amount} 🪙`;
      else if (g.type === 'role') detail = roleNames[g.itemId] || g.itemId;
      else detail = `ID: ${g.itemId}`;

      const canClaim = ['coins', 'plant', 'zombie', 'box', 'role'].includes(g.type);
      div.innerHTML = `
        <div class="gift-icon">${typeIcons[g.type]}</div>
        <div class="gift-info">
          <div class="gift-type">${typeNames[g.type]} — ${detail}</div>
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