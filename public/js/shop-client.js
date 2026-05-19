const API = window.location.origin + '/api/shop';

async function loadShop() {
  if (!currentUser) return;
  try {
    const res = await fetch(API + '/unlocked/' + currentUser.id);
    const data = await res.json();

    document.getElementById('coins-count').textContent = data.coins;

    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';

    data.plants.forEach(p => {
      const div = document.createElement('div');
      div.className = 'shop-item' + (p.unlocked ? ' owned' : '');

      let btnClass, btnText, btnDisabled;
      if (p.unlocked) {
        btnClass = 'owned-btn';
        btnText = '✅ Куплено';
        btnDisabled = 'disabled';
      } else if (data.coins >= p.price) {
        btnClass = 'available';
        btnText = `🪙 ${p.price}`;
        btnDisabled = '';
      } else {
        btnClass = 'expensive';
        btnText = `🪙 ${p.price}`;
        btnDisabled = 'disabled';
      }

      div.innerHTML = `
        <span class="emoji">${p.emoji}</span>
        <div class="name">${p.name}</div>
        <div class="desc">${p.desc}</div>
        <div class="stats">Стоимость: ☀️${p.cost} | Тип: ${p.type}</div>
        <button class="buy-btn ${btnClass}" ${btnDisabled} onclick="buyPlant(${p.id}, ${p.price})">${btnText}</button>
      `;
      grid.appendChild(div);
    });
  } catch (err) {
    console.error('Shop load error:', err);
  }
}

async function buyPlant(plantId, price) {
  if (!confirm(`Купить растение за ${price} 🪙?`)) return;
  try {
    const res = await fetch(API + '/buy/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('🎉 Растение куплено!');
      document.getElementById('coins-count').textContent = data.remaining;
      loadShop();
      refreshUser();
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (err) {
    showToast('❌ Ошибка подключения');
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function refreshUser() {
  if (!currentUser) return;
  try {
    const res = await fetch(window.location.origin + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
    if (res.ok) {
      currentUser = await res.json();
      localStorage.setItem('pvz_user', JSON.stringify(currentUser));
    }
  } catch (_) {}
}

loadShop();
