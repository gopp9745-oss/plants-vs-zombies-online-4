const API_URL = window.location.origin;

window.currentUser = null;

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem('pvz_accounts') || '[]');
  } catch {
    return [];
  }
}

function saveAccount(user) {
  let accounts = getAccounts();
  accounts = accounts.filter(a => a.id !== user.id);
  accounts.unshift({ id: user.id, nickname: user.nickname, avatar: user.avatar || '🌱' });
  if (accounts.length > 3) accounts = accounts.slice(0, 3);
  localStorage.setItem('pvz_accounts', JSON.stringify(accounts));
}

function switchAccount(userId) {
  const accounts = getAccounts();
  const account = accounts.find(a => a.id === userId);
  if (!account) return;
  localStorage.setItem('pvz_user', JSON.stringify(account));
  window.location.reload();
}

function removeAccount(userId) {
  let accounts = getAccounts();
  accounts = accounts.filter(a => a.id !== userId);
  localStorage.setItem('pvz_accounts', JSON.stringify(accounts));
}

async function checkAuth() {
  const user = localStorage.getItem('pvz_user');
  if (user) {
    currentUser = JSON.parse(user);
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        const fresh = await res.json();
        currentUser = fresh;
        localStorage.setItem('pvz_user', JSON.stringify(fresh));
        saveAccount(fresh);
        if (fresh.is_banned) {
          localStorage.removeItem('pvz_user');
          currentUser = null;
          window.location.href = '/login.html';
          return;
        }
      }
    } catch (_) {}
    if (window.location.pathname.includes('login.html')) {
      window.location.href = '/';
    }
  } else if (!window.location.pathname.includes('login.html')) {
    window.location.href = '/login.html';
  }
}

checkAuth();

async function login() {
  const nickname = document.getElementById('login-nickname').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!nickname || !password) {
    showMessage('Заполните все поля', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem('pvz_user', JSON.stringify(currentUser));
      saveAccount(currentUser);
      window.location.href = '/';
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Ошибка подключения', 'error');
  }
}

async function register() {
  const nickname = document.getElementById('register-nickname').value.trim();
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-password-confirm').value;
  
  if (!nickname || !password) {
    showMessage('Заполните все поля', 'error');
    return;
  }
  
  if (nickname.length < 3) {
    showMessage('Никнейм минимум 3 символа', 'error');
    return;
  }
  
  if (password.length < 4) {
    showMessage('Пароль минимум 4 символа', 'error');
    return;
  }
  
  if (password !== confirm) {
    showMessage('Пароли не совпадают', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      showMessage('Регистрация успешна! Входим...', 'success');
      setTimeout(async () => {
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname, password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          currentUser = loginData.user;
          localStorage.setItem('pvz_user', JSON.stringify(currentUser));
          saveAccount(currentUser);
          window.location.href = '/';
        }
      }, 1000);
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Ошибка подключения', 'error');
  }
}

function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
}

function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
}

function showMessage(text, type) {
  const msg = document.getElementById('auth-message');
  msg.textContent = text;
  msg.className = `message ${type}`;
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 3000);
}

function logout() {
  localStorage.removeItem('pvz_user');
  currentUser = null;
  window.location.href = '/login.html';
}

checkAuth();
