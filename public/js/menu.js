const socket = io();
let currentRole = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(screenId);
  if (el) el.classList.add('active');
  if (screenId === 'main-menu') updateUserInfo();
}

function updateUserInfo() {
  const el = document.getElementById('user-info');
  if (currentUser && el) {
    const rank = getRank(currentUser.wins || 0);
    const adminBadge = currentUser.nickname === 'admin' ? '<span class="admin-badge">🛡️ Админ</span>' : '';
    const roleNames = { player: '', moderator: '🔷 Модератор', super_player: '⭐ Сверх игрок', vip: '👑 V.I.P' };
    const roleBadge = currentUser.role && currentUser.role !== 'player' ? `<span class="rank-badge" style="color:#FFD700">${roleNames[currentUser.role]}</span>` : '';
    const avatar = currentUser.avatar || '';
    const clan = currentUser.clan ? ` <span class="clan-tag">🏰 ${currentUser.clan}</span>` : '';
    el.innerHTML = `
      <div class="user-card">
        <div class="user-avatar">${avatar}</div>
        <div class="user-details">
          <span class="user-nickname">${currentUser.nickname}${roleBadge}<span class="rank-badge" style="color:${rank.color}">${rank.emoji} ${rank.name}</span> ${clan} ${adminBadge}</span>
          <span class="user-stats">🏆 ${currentUser.wins} / 💀 ${currentUser.losses}</span>
        </div>
      </div>
    `;
  }
  const adminBtn = document.getElementById('admin-menu-btn');
  if (adminBtn) adminBtn.style.display = currentUser && currentUser.nickname === 'admin' ? 'block' : 'none';
  renderAccountSwitcher();
}

function renderAccountSwitcher() {
  const container = document.getElementById('account-switcher');
  if (!container) return;
  const accounts = getAccounts();
  if (!accounts.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = accounts.map(a => {
    const isActive = currentUser && a.id === currentUser.id;
    return `
      <div class="account-chip ${isActive ? 'active' : ''}" onclick="switchAccount('${a.id}')">
        <span class="chip-avatar">${a.avatar}</span>
        <span class="chip-name">${a.nickname}</span>
        ${!isActive ? `<span class="chip-remove" onclick="event.stopPropagation(); removeAccount('${a.id}'); renderAccountSwitcher();">✕</span>` : ''}
      </div>
    `;
  }).join('') + `<div class="add-account-chip" onclick="logout()">+ Войти</div>`;
}

window.renderAccountSwitcher = renderAccountSwitcher;

async function showInventory() {
  showScreen('inventory');
  await loadInventory();
}

async function showLeaderboard() {
  showScreen('leaderboard');
  await loadLeaderboard();
}

async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="color:#888;padding:20px;">Загрузка...</td></tr>';

  try {
    const res = await fetch(`${window.location.origin}/api/leaderboard`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#888;padding:20px;">Пока нет игроков 🎮</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.forEach((player, index) => {
      const row = document.createElement('tr');
      row.dataset.playerId = player.id;
      const isMe = currentUser && String(player.nickname) === String(currentUser.nickname);
      if (isMe) row.className = 'my-row';
      const rank = getRank(player.wins || 0);
      const avatar = player.avatar || '🌱';
      const isOnline = onlineUserIds.includes(String(player.id));
      const clanTag = player.clan ? ` <span class="clan-tag">🏰 ${player.clan}</span>` : '';
      row.innerHTML = `
        <td class="rank">${getRankBadge(index + 1)}</td>
        <td><span class="lb-player"><span class="lb-avatar">${avatar}</span><span class="online-dot ${isOnline ? 'online' : ''}"></span>${player.nickname || '???'}<span class="rank-badge" style="color:${rank.color}">${rank.emoji} ${rank.name}</span>${clanTag}</span></td>
        <td class="wins">${player.wins ?? 0}</td>
        <td class="losses">${player.losses ?? 0}</td>
        <td>${player.total_games ?? 0}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    tbody.innerHTML = '<tr><td colspan="5" style="color:#f44336;padding:20px;">Ошибка загрузки 😕</td></tr>';
  }
}

function getRankBadge(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function startMatchmaking(role) {
  currentRole = role;
  showScreen('waiting');
  socket.emit('join_game', {
    userId: currentUser.id,
    role,
    loadout: window.currentLoadout || [],
    nickname: currentUser.nickname
  });
}

function cancelMatchmaking() {
  socket.emit('cancel_wait');
  showScreen('role-select');
}

socket.on('match_found', ({ gameId, role, plantNickname, zombieNickname }) => {
  sessionStorage.setItem('gameRole', role);
  sessionStorage.setItem('plantNickname', plantNickname);
  sessionStorage.setItem('zombieNickname', zombieNickname);
  window.location.href = `/game.html?gameId=${gameId}`;
});

socket.on('waiting_for_opponent', () => console.log('Waiting...'));
socket.on('wait_cancelled', () => showScreen('role-select'));

let onlineUserIds = [];

socket.on('online_users', (ids) => {
  onlineUserIds = ids || [];
  updateLeaderboardOnlineStatus();
  if (typeof renderAccountSwitcher === 'function') renderAccountSwitcher();
});

function updateLeaderboardOnlineStatus() {
  document.querySelectorAll('#leaderboard-body tr').forEach(row => {
    if (!row.dataset.playerId) return;
    const dot = row.querySelector('.online-dot');
    if (!dot) return;
    const isOnline = onlineUserIds.includes(row.dataset.playerId);
    dot.className = `online-dot ${isOnline ? 'online' : ''}`;
    dot.title = isOnline ? 'В сети' : 'Не в сети';
  });
}

window.authReady.then(() => {
  if (currentUser) {
    socket.emit('user_online', currentUser.id);
    updateUserInfo();
  }
  else renderAccountSwitcher();
});

function openAdminPanel() {
  if (currentUser && currentUser.is_admin) {
    window.location.href = '/admin.html';
  }
}
