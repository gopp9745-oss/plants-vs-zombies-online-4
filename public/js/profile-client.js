const API = window.location.origin + '/api/profile';

const AVATAR_CLANS = {
  '🌱': 'Растения', '🌻': 'Растения', '🌵': 'Растения', '🍀': 'Растения',
  '🌲': 'Растения', '🌸': 'Растения', '🌺': 'Растения', '🍄': 'Растения',
  '🧟': 'Нежить', '🧟‍♂️': 'Нежить', '👹': 'Нежить', '💀': 'Нежить',
  '🦇': 'Нежить', '🕷️': 'Нежить', '🐍': 'Нежить', '🦎': 'Нежить',
  '⚔️': 'Воины', '🛡️': 'Воины', '🏹': 'Воины', '🔮': 'Воины',
  '💎': 'Воины', '👑': 'Воины', '🎭': 'Воины', '🎪': 'Воины',
  '🐉': 'Звери', '🦅': 'Звери', '🐺': 'Звери', '🦊': 'Звери',
  '🐻': 'Звери', '🦁': 'Звери', '🐯': 'Звери', '🐲': 'Звери'
};

const AVATARS = Object.keys(AVATAR_CLANS);

function loadProfile() {
  if (!currentUser) return;

  const avatar = currentUser.avatar || '🌱';
  const clan = currentUser.clan || AVATAR_CLANS[avatar] || '';
  const rank = getRank(currentUser.wins || 0);

  document.getElementById('profile-avatar').textContent = avatar;
  document.getElementById('profile-name').textContent = currentUser.nickname;
  document.getElementById('profile-clan').textContent = `🏰 ${clan}`;
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
    div.title = AVATAR_CLANS[a];
    div.onclick = () => selectAvatar(a);
    grid.appendChild(div);
  });
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
      currentUser.clan = data.clan;
      localStorage.setItem('pvz_user', JSON.stringify(currentUser));
      loadProfile();
      showToast(`✅ Аватар и клан "${data.clan}" обновлены!`);
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
