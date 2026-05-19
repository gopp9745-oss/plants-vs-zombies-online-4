const API = window.location.origin + '/api/profile';
const AVATARS = [
  '🌱', '🌻', '🌵', '🍀', '🌲', '🌸', '🌺', '🍄',
  '🧟', '🧟‍♂️', '👹', '💀', '🦇', '🕷️', '🐍', '🦎',
  '⚔️', '🛡️', '🏹', '🔮', '💎', '👑', '🎭', '🎪',
  '🐉', '🦅', '🐺', '🦊', '🐻', '🦁', '🐯', '🐲'
];

function loadProfile() {
  if (!currentUser) return;

  const avatar = currentUser.avatar || '🌱';
  const clan = currentUser.clan || '';
  const rank = getRank(currentUser.wins || 0);

  document.getElementById('profile-avatar').textContent = avatar;
  document.getElementById('profile-name').textContent = currentUser.nickname;
  document.getElementById('profile-clan').textContent = clan ? `🏰 ${clan}` : '';
  document.getElementById('stat-wins').textContent = currentUser.wins || 0;
  document.getElementById('stat-losses').textContent = currentUser.losses || 0;
  document.getElementById('stat-coins').textContent = currentUser.coins || 0;

  const rankEl = document.getElementById('profile-rank');
  rankEl.textContent = `${rank.emoji} ${rank.name}`;
  rankEl.style.color = rank.color;
  rankEl.style.background = `${rank.color}22`;
  rankEl.style.border = `1px solid ${rank.color}44`;

  const grid = document.getElementById('avatar-grid');
  grid.innerHTML = '';
  AVATARS.forEach(a => {
    const div = document.createElement('div');
    div.className = 'avatar-option' + (a === avatar ? ' selected' : '');
    div.textContent = a;
    div.onclick = () => selectAvatar(a);
    grid.appendChild(div);
  });

  document.getElementById('clan-input').value = clan;
}

async function selectAvatar(avatar) {
  try {
    const res = await fetch(API + '/avatar/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser.avatar = data.avatar;
      localStorage.setItem('pvz_user', JSON.stringify(currentUser));
      loadProfile();
      showToast('✅ Аватар обновлён!');
    }
  } catch (err) {
    showToast('❌ Ошибка');
  }
}

async function saveClan() {
  const clan = document.getElementById('clan-input').value.trim();
  try {
    const res = await fetch(API + '/clan/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clan })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser.clan = data.clan;
      localStorage.setItem('pvz_user', JSON.stringify(currentUser));
      loadProfile();
      showToast('✅ Клан обновлён!');
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (err) {
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

loadProfile();
