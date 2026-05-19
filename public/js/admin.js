const API = window.location.origin + '/api/admin';
let adminToken = localStorage.getItem('adminToken');

if (adminToken) {
  showDashboard();
  loadUsers();
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
      actions += `<button class="action-btn btn-reset" onclick="resetStats('${u.id}')">Сброс</button>`;
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
