const API = window.location.origin + '/api/friends';
const socket = io();

let searchResult = null;

async function loadFriends() {
  if (!currentUser) return;
  try {
    const res = await fetch(API + '/list/' + currentUser.id);
    const friends = await res.json();
    const list = document.getElementById('friends-list');
    if (!friends.length) {
      list.innerHTML = '<div class="empty-msg">Пока нет друзей. Найди игрока и добавь в друзья!</div>';
      return;
    }
    list.innerHTML = '';
    friends.forEach(f => {
      const div = document.createElement('div');
      div.className = 'friend-card';
      div.innerHTML = `
        <div class="friend-avatar">${f.avatar}</div>
        <div class="friend-info">
          <div class="friend-name">${f.nickname}</div>
          <div class="friend-clan">🏰 ${f.clan || 'Без клана'}</div>
          <div class="friend-stats">🏆 ${f.wins} / 💀 ${f.losses}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-btn btn-fight" onclick="startFriendly('${f.id}', '${f.nickname}')">⚔️ Бой</button>
          <button class="friend-btn btn-remove" onclick="removeFriend('${f.id}')">✕</button>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load friends:', err);
  }
}

async function searchPlayer() {
  const nickname = document.getElementById('search-input').value.trim();
  if (!nickname) return;
  try {
    const res = await fetch(API + '/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname })
    });
    const data = await res.json();
    if (res.ok) {
      searchResult = data;
      document.getElementById('search-result').innerHTML = `
        <div class="search-result">
          <div class="friend-avatar">${data.avatar}</div>
          <div class="friend-info">
            <div class="friend-name">${data.nickname}</div>
            <div class="friend-clan">🏰 ${data.clan || 'Без клана'}</div>
          </div>
          <button class="friend-btn btn-add" onclick="addFriend('${data.id}')">➕ Добавить</button>
        </div>
      `;
    } else {
      document.getElementById('search-result').innerHTML = `<div class="empty-msg">❌ ${data.error}</div>`;
    }
  } catch (err) {
    showToast('❌ Ошибка');
  }
}

async function addFriend(friendId) {
  try {
    const res = await fetch(API + '/add/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✅ ' + data.friendNickname + ' добавлен в друзья!');
      document.getElementById('search-result').innerHTML = '';
      loadFriends();
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (err) {
    showToast('❌ Ошибка');
  }
}

async function removeFriend(friendId) {
  if (!confirm('Удалить из друзей?')) return;
  try {
    await fetch(API + '/remove/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId })
    });
    showToast('Удалён из друзей');
    loadFriends();
  } catch (err) {
    showToast('❌ Ошибка');
  }
}

function startFriendly(friendId, friendNickname) {
  sessionStorage.setItem('friendlyOpponent', JSON.stringify({ friendId, friendNickname }));
  window.location.href = '/friendly-select.html';
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchPlayer();
});

loadFriends();
