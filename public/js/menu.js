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
    const adminBadge = currentUser.is_admin ? '<span class="admin-badge">🛡️ Админ</span>' : '';
    el.innerHTML = `
      <div class="user-card">
        <div class="user-avatar">${currentUser.nickname[0].toUpperCase()}</div>
        <div class="user-details">
          <span class="user-nickname">${currentUser.nickname} <span class="rank-badge" style="color:${rank.color}">${rank.emoji} ${rank.name}</span> ${adminBadge}</span>
          <span class="user-stats">🏆 ${currentUser.wins} / 💀 ${currentUser.losses}</span>
        </div>
      </div>
    `;
  }
  const adminBtn = document.getElementById('admin-menu-btn');
  if (adminBtn) adminBtn.style.display = currentUser && currentUser.is_admin ? 'block' : 'none';
}

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
      const isMe = currentUser && String(player.nickname) === String(currentUser.nickname);
      if (isMe) row.className = 'my-row';
      const rank = getRank(player.wins || 0);
      row.innerHTML = `
        <td class="rank">${getRankBadge(index + 1)}</td>
        <td>${player.nickname || '???'} <span class="rank-badge" style="color:${rank.color}">${rank.emoji} ${rank.name}</span></td>
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

if (currentUser) updateUserInfo();

function openAdminPanel() {
  if (currentUser && currentUser.is_admin) {
    window.location.href = '/admin.html';
  }
}
