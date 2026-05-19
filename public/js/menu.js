const socket = io();
let currentRole = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  
  if (screenId === 'main-menu') {
    updateUserInfo();
  }
}

function updateUserInfo() {
  const userInfo = document.getElementById('user-info');
  if (currentUser) {
    userInfo.innerHTML = `
      <div class="user-card">
        <div class="user-avatar">${currentUser.nickname[0].toUpperCase()}</div>
        <div class="user-details">
          <span class="user-nickname">${currentUser.nickname}</span>
          <span class="user-stats">🏆 ${currentUser.wins} / 💀 ${currentUser.losses}</span>
        </div>
      </div>
    `;
  }
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
  try {
    const res = await fetch(`${window.location.origin}/api/leaderboard`);
    const data = await res.json();
    
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    
    data.forEach((player, index) => {
      const row = document.createElement('tr');
      const isMe = currentUser && player.nickname === currentUser.nickname;
      row.className = isMe ? 'my-row' : '';
      row.innerHTML = `
        <td class="rank">${getRankBadge(index + 1)}</td>
        <td>${player.nickname}</td>
        <td class="wins">${player.wins}</td>
        <td class="losses">${player.losses}</td>
        <td>${player.total_games}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
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

socket.on('waiting_for_opponent', () => {
  console.log('Waiting for opponent...');
});

socket.on('wait_cancelled', () => {
  showScreen('role-select');
});

if (currentUser) {
  updateUserInfo();
}
