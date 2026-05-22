const API = window.location.origin + '/api/auth';

const PLANT_EMOJIS = { 1: '🌻', 2: '🌱', 3: '🥜', 4: '🍒', 5: '❄️', 6: '🔁', 7: '💣', 8: '👯' };
const ZOMBIE_EMOJIS = { 1: '🧟', 2: '🧟‍♂️', 3: '🪖', 4: '🏃', 5: '👹', 6: '💃', 7: '🏈', 8: '🎣' };

function showBoxAnimation(reward) {
  const overlay = document.createElement('div');
  overlay.id = 'reward-overlay';
  overlay.innerHTML = `
    <div class="reward-container">
      <div class="reward-box">🎁</div>
      <div class="reward-result">
        <div class="reward-emoji">${reward.type === 'plant' ? (PLANT_EMOJIS[reward.id] || '🌱') : (ZOMBIE_EMOJIS[reward.id] || '🧟')}</div>
        <div class="reward-label">${reward.type === 'plant' ? '🌱 Растение' : '🧟 Зомби'} #${reward.id}</div>
        <div class="reward-subtitle">${reward.type === 'coins' ? '🪙 +' + reward.amount : 'Получено из бокса!'}</div>
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
      if (data.reward && data.reward.type !== 'coins' && data.reward.type !== 'role') {
        showBoxAnimation(data.reward);
      } else {
        showToast('✅ Подарок забран!');
      }
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