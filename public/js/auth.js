const API_URL = window.location.origin;

window.currentUser = null;

function checkAuth() {
  const user = localStorage.getItem('pvz_user');
  if (user) {
    currentUser = JSON.parse(user);
    if (window.location.pathname.includes('login.html')) {
      window.location.href = '/';
    }
  } else if (!window.location.pathname.includes('login.html')) {
    window.location.href = '/login.html';
  }
}

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
