const API = window.location.origin + '/api/admin';
const adminSocket = io();
let adminToken = localStorage.getItem('adminToken');

const savedUser = localStorage.getItem('pvz_user');
const user = savedUser ? JSON.parse(savedUser) : null;

if (user && user.is_admin) {
  adminToken = 'admin_auto';
  localStorage.setItem('adminToken', adminToken);
  showDashboard();
  loadUsers();
  loadGames();
} else if (adminToken) {
  showDashboard();
  loadUsers();
  loadGames();
}

async function login() {
  const pass = document.getElementById('admin-pass').value;
  const errEl = document.getElementById('login-error');
  try {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();
    if (data.success) {
      adminToken = data.token;
      localStorage.setItem('adminToken', adminToken);
      showDashboard();
      loadUsers();
      loadGames();
    } else {
      errEl.textContent = 'Неверный пароль';
    }
  } catch (e) {
    errEl.textContent = 'Ошибка подключения';
  }
}

document.getElementById('admin-pass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login();
});

function logout() {
  localStorage.removeItem('adminToken');
  adminToken = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('active');
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
}

function headers() {
  return { 'x-admin-token': adminToken };
}

async function loadUsers() {
  try {
    const [statsRes, usersRes] = await Promise.all([
      fetch(API + '/stats', { headers: headers() }),
      fetch(API + '/users', { headers: headers() })
    ]);
    const stats = await statsRes.json();
    const users = await usersRes.json();

    document.getElementById('stat-users').textContent = stats.totalUsers;

    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      let badge = '';
      if (u.is_admin) badge = '<span class="badge badge-admin">Админ</span>';
      else if (u.is_banned) badge = '<span class="badge badge-banned">Забанен</span>';
      else badge = '<span class="badge badge-user">Игрок</span>';

      let actions = '';
      if (!u.is_banned) actions += `<button class="action-btn btn-ban" onclick="banUser('${u.id}')">Бан</button>`;
      else actions += `<button class="action-btn btn-unban" onclick="unbanUser('${u.id}')">Разбан</button>`;
      if (!u.is_admin) actions += `<button class="action-btn btn-admin" onclick="makeAdmin('${u.id}')">Админ</button>`;
      actions += `<button class="action-btn btn-kick" onclick="kickUser('${u.id}')">Кик</button>`;
      actions += `<button class="action-btn btn-reset" onclick="resetStats('${u.id}')">Сброс</button>`;
      actions += `<button class="action-btn btn-admin" onclick="resetPassword('${u.id}')">Пароль</button>`;
      actions += `<button class="action-btn btn-delete" onclick="deleteUser('${u.id}')">Удалить</button>`;

      tr.innerHTML = `
        <td>${u.nickname}</td>
        <td>${u.wins}</td>
        <td>${u.losses}</td>
        <td>${badge}</td>
        <td>${actions}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Failed to load users:', e);
  }
}

function loadGames() {
  adminSocket.emit('admin_list_games', { adminToken });
}

adminSocket.on('admin_games_list', (games) => {
  const tbody = document.getElementById('games-tbody');
  tbody.innerHTML = '';
  if (!games || games.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#888;padding:20px;">Нет активных игр</td></tr>';
    return;
  }
  games.forEach(g => {
    const tr = document.createElement('tr');
    const time = g.timeRemaining ? `${Math.floor(g.timeRemaining / 60)}:${(g.timeRemaining % 60).toString().padStart(2, '0')}` : '—';
    tr.innerHTML = `
      <td>${g.gameId}</td>
      <td>${g.plant}</td>
      <td>${g.zombie}</td>
      <td>${g.plantHP}%</td>
      <td>${time}</td>
      <td>
        <button class="action-btn btn-end" onclick="endGame('${g.gameId}', 'plant')">🌻 Победа</button>
        <button class="action-btn btn-end" onclick="endGame('${g.gameId}', 'zombie')">🧟 Победа</button>
        <button class="action-btn btn-kick" onclick="kickGame('${g.gameId}')">Закрыть</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
});

async function banUser(id) {
  await fetch(API + '/users/' + id + '/ban', { method: 'POST', headers: headers() });
  loadUsers();
}

async function unbanUser(id) {
  await fetch(API + '/users/' + id + '/unban', { method: 'POST', headers: headers() });
  loadUsers();
}

async function makeAdmin(id) {
  if (!confirm('Сделать этого пользователя админом?')) return;
  await fetch(API + '/users/' + id + '/admin', { method: 'POST', headers: headers() });
  loadUsers();
}

function kickUser(id) {
  if (!confirm('Кикнуть игрока из игры?')) return;
  adminSocket.emit('admin_kick', { targetUserId: id, adminToken });
}

async function resetStats(id) {
  if (!confirm('Сбросить статистику?')) return;
  await fetch(API + '/users/' + id + '/reset', { method: 'POST', headers: headers() });
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm('Удалить пользователя навсегда?')) return;
  await fetch(API + '/users/' + id, { method: 'DELETE', headers: headers() });
  loadUsers();
}

function endGame(gameId, winner) {
  if (!confirm(`Завершить игру и присудить победу ${winner === 'plant' ? '🌻 растениям' : '🧟 зомби'}?`)) return;
  adminSocket.emit('admin_end_game', { gameId, winner, adminToken });
  loadGames();
}

function kickGame(gameId) {
  if (!confirm('Закрыть эту игру?')) return;
  adminSocket.emit('admin_end_game', { gameId, winner: 'plant', adminToken });
  loadGames();
}

async function resetPassword(id) {
  const res = await fetch(API + '/users/' + id + '/reset-password', { method: 'POST', headers: headers() });
  const data = await res.json();
  if (data.newPassword) {
    alert('Новый пароль: ' + data.newPassword);
  }
}
