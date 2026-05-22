const API = window.location.origin + '/api/friends';
const socket = io();

var searchResult = null;
var searchTimeout = null;
var onlineUserIds = [];

socket.on('online_users', (ids) => {
  onlineUserIds = ids || [];
  updateFriendsOnlineStatus();
});

function updateFriendsOnlineStatus() {
  document.querySelectorAll('.friend-card').forEach(card => {
    const friendId = card.dataset.friendId;
    if (!friendId) return;
    const dot = card.querySelector('.online-dot');
    if (!dot) return;
    const isOnline = onlineUserIds.includes(friendId);
    dot.className = `online-dot ${isOnline ? 'online' : ''}`;
    dot.title = isOnline ? 'В сети' : 'Не в сети';
  });
}

async function loadFriends() {
  if (!currentUser) return;
  try {
    const res = await fetch(API + '/list/' + currentUser.id);
    const friends = await res.json();
    const list = document.getElementById('friends-list');
    if (!friends.length) {
      list.innerHTML = '<div class="empty-msg">Пока нет друзей. Найди игрока и отправь заявку!</div>';
      return;
    }
    list.innerHTML = '';
    friends.forEach(f => {
      const div = document.createElement('div');
      div.className = 'friend-card';
      div.dataset.friendId = f.id;
      if (f.is_banned) {
        div.innerHTML = `
          <div class="friend-avatar banned">✕</div>
          <div class="friend-info">
            <div class="friend-name">${f.nickname}</div>
            <div class="friend-clan" style="color:#f44336;">🚫 Заблокирован</div>
          </div>
          <div class="friend-actions">
            <button class="friend-btn btn-remove" onclick="removeFriend('${f.id}')">✕</button>
          </div>
        `;
      } else {
        const isOnline = onlineUserIds.includes(f.id);
        div.innerHTML = `
          <div class="friend-avatar">${f.avatar}</div>
          <div class="friend-info">
            <div class="friend-name">${f.nickname} <span class="online-dot ${isOnline ? 'online' : ''}" title="${isOnline ? 'В сети' : 'Не в сети'}"></span></div>
            <div class="friend-clan">🏰 ${f.clan || 'Без клана'}</div>
            <div class="friend-stats">🏆 ${f.wins} / 💀 ${f.losses}</div>
          </div>
          <div class="friend-actions">
            <button class="friend-btn btn-fight" onclick="startFriendly('${f.id}', '${f.nickname.replace(/'/g, "\\'")}')">️ Бой</button>
            <button class="friend-btn btn-remove" onclick="removeFriend('${f.id}')">✕</button>
          </div>
        `;
      }
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load friends:', err);
  }
}

async function loadRequests() {
  if (!currentUser) return;
  try {
    const res = await fetch(API + '/requests/' + currentUser.id);
    const requests = await res.json();
    const list = document.getElementById('requests-list');
    if (!requests.length) {
      list.innerHTML = '<div class="empty-msg">Нет входящих заявок</div>';
      return;
    }
    list.innerHTML = '';
    requests.forEach(r => {
      const div = document.createElement('div');
      div.className = 'request-card';
      div.innerHTML = `
        <div class="friend-avatar">${r.avatar}</div>
        <div class="friend-info">
          <div class="friend-name">${r.nickname}</div>
          <div class="friend-clan"> ${r.clan || 'Без клана'}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-btn btn-accept" onclick="acceptRequest('${r.id}')">✓</button>
          <button class="friend-btn btn-decline" onclick="declineRequest('${r.id}')">✕</button>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load requests:', err);
  }
}

async function searchPartial(q) {
  if (!q || q.length < 2) {
    document.getElementById('search-suggestions').innerHTML = '';
    return;
  }
  try {
    console.log('[PARTIAL] searching for:', q);
    const res = await fetch(API + '/search/partial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });
    console.log('[PARTIAL] response status:', res.status);
    if (!res.ok) {
      console.error('Partial search HTTP error:', res.status);
      return;
    }
    const suggestions = await res.json();
    console.log('[PARTIAL] suggestions:', suggestions.length);
    const container = document.getElementById('search-suggestions');
    if (!suggestions.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = '<div class="suggestions-dropdown">' +
      suggestions.map(s => `
        <div class="suggestion-item" onclick="selectSuggestion('${s.id}', '${s.nickname.replace(/'/g, "\\'")}', '${s.avatar}', '${(s.clan || '').replace(/'/g, "\\'")}')">
          <span class="emoji">${s.avatar}</span>
          <div>
            <div class="name">${s.nickname}</div>
            <div class="clan">🏰 ${s.clan || 'Без клана'} · 🏆 ${s.wins}</div>
          </div>
        </div>
      `).join('') + '</div>';
  } catch (err) {
    console.error('Partial search error:', err);
  }
}

function selectSuggestion(id, nickname, avatar, clan) {
  document.getElementById('search-input').value = nickname;
  document.getElementById('search-suggestions').innerHTML = '';
  searchResult = { id, nickname, avatar, clan };
  showSearchResult(searchResult);
}

function showSearchResult(data) {
  document.getElementById('search-result').innerHTML = `
    <div class="search-result">
      <div class="friend-avatar">${data.avatar}</div>
      <div class="friend-info">
        <div class="friend-name">${data.nickname}</div>
        <div class="friend-clan">🏰 ${data.clan || 'Без клана'}</div>
      </div>
      <button class="friend-btn btn-add" onclick="sendRequest('${data.id}')"> Отправить заявку</button>
    </div>
  `;
}

async function searchPlayer() {
  const nickname = document.getElementById('search-input').value.trim();
  if (!nickname) return;
  document.getElementById('search-suggestions').innerHTML = '';
  try {
    const res = await fetch(API + '/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname })
    });
    const data = await res.json();
    if (res.ok) {
      searchResult = data;
      showSearchResult(data);
    } else {
      document.getElementById('search-result').innerHTML = `<div class="empty-msg">❌ ${data.error || 'Не найден'}</div>`;
    }
  } catch (err) {
    showToast('❌ ' + (err.message || 'Ошибка сети'));
  }
}

async function sendRequest(friendId) {
  try {
    const res = await fetch(API + '/send-request/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✅ Заявка отправлена ' + data.friendNickname);
      document.getElementById('search-result').innerHTML = '';
      document.getElementById('search-input').value = '';
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (err) {
    showToast('❌ Ошибка');
  }
}

async function acceptRequest(requesterId) {
  try {
    const res = await fetch(API + '/accept-request/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✅ ' + data.friendNickname + ' добавлен в друзья!');
      loadFriends();
      loadRequests();
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (err) {
    showToast('❌ Ошибка');
  }
}

async function declineRequest(requesterId) {
  try {
    await fetch(API + '/decline-request/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId })
    });
    showToast('Заявка отклонена');
    loadRequests();
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

function initFriendsPage() {
  const input = document.getElementById('search-input');
  if (!input) {
    console.error('search-input not found');
    return;
  }
  console.log('Friends page initialized');

  input.addEventListener('input', (e) => {
    console.log('Input event, value:', e.target.value);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchPartial(e.target.value.trim()), 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      document.getElementById('search-suggestions').innerHTML = '';
      searchPlayer();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-group') && !e.target.closest('.suggestions-dropdown')) {
      document.getElementById('search-suggestions').innerHTML = '';
    }
  });

  loadFriends();
  loadRequests();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFriendsPage);
} else {
  initFriendsPage();
}
