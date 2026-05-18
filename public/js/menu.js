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
      <h3>👤 ${currentUser.nickname}</h3>
      <p>Победы: ${currentUser.wins} | Поражения: ${currentUser.losses}</p>
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
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${player.nickname}</td>
        <td>${player.wins}</td>
        <td>${player.losses}</td>
        <td>${player.total_games}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
  }
}

function startMatchmaking(role) {
  currentRole = role;
  const loadout = window.currentLoadout || [];
  
  socket.emit('join_game', {
    userId: currentUser.id,
    role,
    loadout
  });
  
  showScreen('waiting');
}

function cancelMatchmaking() {
  socket.emit('cancel_wait');
  showScreen('role-select');
}

socket.on('match_found', ({ gameId }) => {
  window.location.href = `/game.html?gameId=${gameId}&role=${currentRole}`;
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
