const API = window.location.origin + '/api/admin';
const adminSocket = io();

const savedUser = localStorage.getItem('pvz_user');
const currentUser = savedUser ? JSON.parse(savedUser) : null;

if (!currentUser) {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('active');
  document.getElementById('login-error').textContent = 'Сначала войдите в аккаунт';
} else if (currentUser.nickname !== 'admin') {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('active');
  document.getElementById('login-error').textContent = 'Доступ только для аккаунта "admin"';
} else {
  adminSocket.emit('user_online', currentUser.id);
  verifyAdmin();
}

async function verifyAdmin() {
  try {
    const res = await fetch(API + '/verify', {
      headers: { 'x-user-id': currentUser.id }
    });
    if (res.ok) {
      showDashboard();
      loadUsers();
      loadGames();
    } else {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('dashboard').classList.remove('active');
      document.getElementById('login-error').textContent = 'Доступ запрещён';
    }
  } catch (e) {
    document.getElementById('login-error').textContent = 'Ошибка подключения';
  }
}

function headers() {
  return { 'x-user-id': currentUser.id };
}

function logout() {
  window.location.href = '/';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  loadGiftUsers();
  loadShopItems();
  addGiftRow();
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
      const roleNames = { player: 'Игрок', moderator: 'Модератор', super_player: 'Сверх игрок', vip: 'V.I.P' };
      const roleKey = u.role || 'player';
      let badge = '';
      if (u.nickname === 'admin') badge = '<span class="badge badge-admin">Админ</span>';
      else if (u.is_banned) badge = '<span class="badge badge-banned">Забанен</span>';
      else badge = `<span class="badge badge-${roleKey}">${roleNames[roleKey]}</span>`;

      let actions = '';
      if (!u.is_banned) actions += `<button class="action-btn btn-ban" onclick="banUser('${u.id}')">Бан</button>`;
      else actions += `<button class="action-btn btn-unban" onclick="unbanUser('${u.id}')">Разбан</button>`;
      if (u.nickname !== 'admin') {
        actions += `<select class="role-select" onchange="setRole('${u.id}', this.value)">
          <option value="player" ${roleKey === 'player' ? 'selected' : ''}>Игрок</option>
          <option value="moderator" ${roleKey === 'moderator' ? 'selected' : ''}>Модератор</option>
          <option value="super_player" ${roleKey === 'super_player' ? 'selected' : ''}>Сверх игрок</option>
          <option value="vip" ${roleKey === 'vip' ? 'selected' : ''}>V.I.P</option>
        </select>`;
      }
      actions += `<button class="action-btn btn-kick" onclick="kickUser('${u.id}')">Кик</button>`;
      actions += `<button class="action-btn btn-reset" onclick="resetStats('${u.id}')">Сброс</button>`;
      actions += `<button class="action-btn btn-admin" onclick="resetPassword('${u.id}')">Пароль</button>`;
      actions += `<button class="action-btn btn-gift" onclick="quickGift('${u.id}', '${u.nickname.replace(/'/g, "\\'")}')">🎁</button>`;
      if (u.gifts && u.gifts.length > 0) actions += `<button class="action-btn" onclick="manageGifts('${u.id}', '${u.nickname.replace(/'/g, "\\'")}')">📦</button>`;
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
  adminSocket.emit('admin_list_games', { userId: currentUser.id });
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
        <button class="action-btn btn-end" onclick="endGame('${g.gameId}', 'plant')"> Победа</button>
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

async function setRole(id, role) {
  const roleNames = { player: 'Игрок', moderator: 'Модератор', super_player: 'Сверх игрок', vip: 'V.I.P' };
  if (!confirm(`Назначить роль "${roleNames[role]}"?`)) {
    loadUsers();
    return;
  }
  await fetch(API + '/users/' + id + '/role', {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
  loadUsers();
}

async function unbanUser(id) {
  await fetch(API + '/users/' + id + '/unban', { method: 'POST', headers: headers() });
  loadUsers();
}

async function kickUser(id) {
  if (!confirm('Кикнуть игрока из игры?')) return;
  adminSocket.emit('admin_kick', { targetUserId: id, userId: currentUser.id });
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
  if (!confirm(`Завершить игру и присудить победу ${winner === 'plant' ? '🌻 растениям' : ' зомби'}?`)) return;
  adminSocket.emit('admin_end_game', { gameId, winner, userId: currentUser.id });
  loadGames();
}

function kickGame(gameId) {
  if (!confirm('Закрыть эту игру?')) return;
  adminSocket.emit('admin_end_game', { gameId, winner: 'plant', userId: currentUser.id });
  loadGames();
}

async function resetPassword(id) {
  const res = await fetch(API + '/users/' + id + '/reset-password', { method: 'POST', headers: headers() });
  const data = await res.json();
  if (data.newPassword) {
    alert('Новый пароль: ' + data.newPassword);
  }
}

async function loadGiftUsers() {
  try {
    const res = await fetch(API + '/users', { headers: headers() });
    const users = await res.json();
    const select = document.getElementById('gift-user');
    select.innerHTML = '<option value="">Выберите игрока</option>';
    users.forEach(u => {
      if (u.nickname !== 'admin') {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.nickname} (${u.coins || 0} 🪙)`;
        select.appendChild(opt);
      }
    });
  } catch (e) {
    console.error('Failed to load users for gifts:', e);
  }
}

let shopItems = { plants: [], zombies: [], boxes: [] };
let giftRowCounter = 0;

async function loadShopItems() {
  try {
    const [plantsRes, zombiesRes, boxesRes] = await Promise.all([
      fetch(window.location.origin + '/api/shop/plants'),
      fetch(window.location.origin + '/api/shop/zombies'),
      fetch(window.location.origin + '/api/shop/boxes')
    ]);
    shopItems.plants = await plantsRes.json();
    shopItems.zombies = await zombiesRes.json();
    shopItems.boxes = await boxesRes.json();
  } catch (e) {
    console.error('Failed to load shop items:', e);
  }
}

function addGiftRow() {
  const id = ++giftRowCounter;
  const container = document.getElementById('gift-rows');
  const row = document.createElement('div');
  row.className = 'gift-form';
  row.id = 'gift-row-' + id;
  row.style.marginBottom = '8px';
  row.innerHTML = `
    <select class="gift-select gift-type" onchange="onGiftRowTypeChange(${id})" data-row="${id}">
      <option value="coins">🪙 Монеты</option>
      <option value="plant">🌱 Растение</option>
      <option value="zombie">🧟 Зомби</option>
      <option value="box">🎁 Бокс</option>
      <option value="role">👑 Роль</option>
    </select>
    <div class="gift-item-wrapper" id="gift-item-wrapper-${id}" style="display:none;">
      <select class="gift-select gift-item-select" id="gift-item-select-${id}">
        <option value="">Выберите...</option>
      </select>
    </div>
    <input type="number" class="gift-input gift-amount" id="gift-amount-${id}" placeholder="Кол-во" />
    <button class="action-btn btn-ban" onclick="removeGiftRow(${id})" style="font-size:14px;">✕</button>
  `;
  container.appendChild(row);
  onGiftRowTypeChange(id);
  if (container.children.length === 1) {
    // first row — also show by default
  }
}

function removeGiftRow(id) {
  const row = document.getElementById('gift-row-' + id);
  if (row) row.remove();
}

function onGiftRowTypeChange(id) {
  const type = document.querySelector(`#gift-row-${id} .gift-type`).value;
  const wrapper = document.getElementById('gift-item-wrapper-' + id);
  const itemSelect = document.getElementById('gift-item-select-' + id);
  const amountInput = document.getElementById('gift-amount-' + id);

  itemSelect.innerHTML = '<option value="">Выберите...</option>';

  if (type === 'box') {
    wrapper.style.display = 'block';
    amountInput.style.display = 'none';
    shopItems.boxes.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.emoji} ${b.name} (${b.price})`;
      itemSelect.appendChild(opt);
    });
  } else if (type === 'role') {
    wrapper.style.display = 'block';
    amountInput.style.display = 'none';
    const roles = [
      { id: 'player', name: 'Игрок' },
      { id: 'moderator', name: 'Модератор' },
      { id: 'super_player', name: 'Сверх игрок' },
      { id: 'vip', name: 'V.I.P' }
    ];
    roles.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      itemSelect.appendChild(opt);
    });
  } else if (type === 'plant') {
    wrapper.style.display = 'block';
    amountInput.style.display = 'none';
    shopItems.plants.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.emoji} ${p.name}`;
      itemSelect.appendChild(opt);
    });
  } else if (type === 'zombie') {
    wrapper.style.display = 'block';
    amountInput.style.display = 'none';
    shopItems.zombies.forEach(z => {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = `${z.emoji} ${z.name}`;
      itemSelect.appendChild(opt);
    });
  } else {
    wrapper.style.display = 'none';
    amountInput.style.display = 'block';
  }
}

function collectGiftRows() {
  const rows = document.querySelectorAll('#gift-rows .gift-form');
  const gifts = [];
  rows.forEach(row => {
    const type = row.querySelector('.gift-type').value;
    const itemSelect = row.querySelector('.gift-item-select');
    const amountInput = row.querySelector('.gift-amount');
    const itemId = itemSelect ? itemSelect.value : '';
    const amount = parseInt(amountInput ? amountInput.value : '0') || 0;

    let finalItemId = null;
    let finalAmount = 0;
    if (type === 'coins') {
      if (amount <= 0) return;
      finalAmount = amount;
    } else {
      if (!itemId) return;
      finalItemId = type === 'role' ? itemId : parseInt(itemId);
    }
    gifts.push({ type, amount: finalAmount, itemId: finalItemId });
  });
  return gifts;
}

async function sendGift() {
  const userId = document.getElementById('gift-user').value;
  const message = document.getElementById('gift-message').value.trim();
  const resultEl = document.getElementById('gift-result');

  if (!userId) {
    resultEl.className = 'error';
    resultEl.textContent = 'Выберите игрока';
    return;
  }

  const gifts = collectGiftRows();
  if (gifts.length === 0) {
    resultEl.className = 'error';
    resultEl.textContent = 'Добавьте хотя бы один подарок';
    return;
  }

  try {
    const res = await fetch(API + '/gift/' + userId, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifts, message })
    });
    const data = await res.json();
    if (res.ok) {
      resultEl.className = 'success';
      resultEl.textContent = '✅ ' + data.message;
      document.getElementById('gift-message').value = '';
      document.getElementById('gift-rows').innerHTML = '';
      giftRowCounter = 0;
      addGiftRow();
      loadUsers();
      loadGiftUsers();
    } else {
      resultEl.className = 'error';
      resultEl.textContent = '❌ ' + data.error;
    }
  } catch (e) {
    resultEl.className = 'error';
    resultEl.textContent = '❌ Ошибка подключения';
  }
}

async function sendGiftAll() {
  const message = document.getElementById('gift-message').value.trim();
  const resultEl = document.getElementById('gift-result');

  const gifts = collectGiftRows();
  if (gifts.length === 0) {
    resultEl.className = 'error';
    resultEl.textContent = 'Добавьте хотя бы один подарок';
    return;
  }

  if (!confirm(`Отправить ${gifts.length} подарков всем игрокам?`)) return;

  try {
    const res = await fetch(API + '/gift-all', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifts, message })
    });
    const data = await res.json();
    if (res.ok) {
      resultEl.className = 'success';
      resultEl.textContent = '✅ ' + data.message;
      document.getElementById('gift-message').value = '';
      document.getElementById('gift-rows').innerHTML = '';
      giftRowCounter = 0;
      addGiftRow();
      loadUsers();
      loadGiftUsers();
    } else {
      resultEl.className = 'error';
      resultEl.textContent = '❌ ' + data.error;
    }
  } catch (e) {
    resultEl.className = 'error';
    resultEl.textContent = '❌ Ошибка подключения';
  }
}

function quickGift(userId, nickname) {
  document.getElementById('gift-user').value = userId;
  document.querySelector('.gifts-section').scrollIntoView({ behavior: 'smooth' });
  showToast('Выбран: ' + nickname);
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);color:#fff;padding:12px 24px;border-radius:10px;border:1px solid rgba(255,215,0,0.3);font-size:14px;z-index:9999;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function manageGifts(userId, nickname) {
  try {
    const res = await fetch(API + '/users', { headers: headers() });
    const users = await res.json();
    const u = users.find(x => x.id === userId);
    if (!u || !u.gifts || u.gifts.length === 0) {
      showToast('Нет подарков у ' + nickname);
      return;
    }
    const typeNames = { coins: 'Монеты', plant: 'Растение', zombie: 'Зомби', box: 'Бокс', role: 'Роль' };
    let msg = 'Подарки ' + nickname + ':\n';
    u.gifts.forEach((g, i) => {
      msg += '\n' + (i+1) + '. ' + (typeNames[g.type] || g.type) + ' | от: ' + (g.from || '?') + ' | ' + new Date(g.date).toLocaleDateString('ru-RU');
    });
    msg += '\n\nВведите номер подарка для удаления (0 = отмена):';
    const choice = prompt(msg);
    if (!choice || choice === '0') return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= u.gifts.length) {
      showToast('Неверный номер');
      return;
    }
    const delRes = await fetch(API + '/gifts/' + userId + '/remove/' + idx, { method: 'DELETE', headers: headers() });
    const data = await delRes.json();
    if (delRes.ok) {
      showToast('✅ Подарок удалён');
      loadUsers();
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (e) {
    showToast('❌ Ошибка');
  }
}
