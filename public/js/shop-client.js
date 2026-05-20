const API = window.location.origin + '/api/shop';
let shopData = null;
let currentTab = 'plants';

async function loadShop() {
  if (!currentUser) return;
  try {
    const res = await fetch(API + '/unlocked/' + currentUser.id);
    shopData = await res.json();
    document.getElementById('coins-count').textContent = shopData.coins;
    renderTab();
  } catch (err) {
    console.error('Shop load error:', err);
  }
}

function renderTab() {
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';

  if (currentTab === 'plants') {
    shopData.plants.forEach(p => {
      grid.appendChild(createPlantCard(p));
    });
  } else if (currentTab === 'zombies') {
    shopData.zombies.forEach(z => {
      grid.appendChild(createZombieCard(z));
    });
  } else if (currentTab === 'boxes') {
    fetch(API + '/boxes').then(r => r.json()).then(boxes => {
      boxes.forEach(b => {
        grid.appendChild(createBoxCard(b));
      });
    });
  }
}

function createPlantCard(p) {
  const div = document.createElement('div');
  div.className = 'shop-item' + (p.unlocked ? ' owned' : '');
  let btnClass, btnText, btnDisabled;
  if (p.unlocked) {
    btnClass = 'owned-btn'; btnText = '✅ Куплено'; btnDisabled = 'disabled';
  } else if (shopData.coins >= p.price) {
    btnClass = 'available'; btnText = `🪙 ${p.price}`; btnDisabled = '';
  } else {
    btnClass = 'expensive'; btnText = ` ${p.price}`; btnDisabled = 'disabled';
  }
  div.innerHTML = `
    <span class="emoji">${p.emoji}</span>
    <div class="name">${p.name}</div>
    <div class="desc">${p.desc}</div>
    <div class="stats">Стоимость: ☀️${p.cost} | Тип: ${p.type}</div>
    <button class="buy-btn ${btnClass}" ${btnDisabled} onclick="buyPlant(${p.id}, ${p.price})">${btnText}</button>
  `;
  return div;
}

function createZombieCard(z) {
  const div = document.createElement('div');
  div.className = 'shop-item' + (z.unlocked ? ' owned' : '');
  let btnClass, btnText, btnDisabled;
  if (z.unlocked) {
    btnClass = 'owned-btn'; btnText = '✅ Куплено'; btnDisabled = 'disabled';
  } else if (shopData.coins >= z.price) {
    btnClass = 'available'; btnText = `🪙 ${z.price}`; btnDisabled = '';
  } else {
    btnClass = 'expensive'; btnText = `🪙 ${z.price}`; btnDisabled = 'disabled';
  }
  div.innerHTML = `
    <span class="emoji">${z.emoji}</span>
    <div class="name">${z.name}</div>
    <div class="stats">HP: ${z.hp} | Скорость: ${z.speed}</div>
    <button class="buy-btn ${btnClass}" ${btnDisabled} onclick="buyZombie(${z.id}, ${z.price})">${btnText}</button>
  `;
  return div;
}

function createBoxCard(b) {
  const div = document.createElement('div');
  div.className = 'shop-item box-' + b.rarity;
  const canBuy = shopData.coins >= b.price;
  div.innerHTML = `
    <span class="emoji">${b.emoji}</span>
    <div class="name">${b.name}</div>
    <div class="desc">${b.type === 'any' ? 'Растение или зомби' : b.type === 'plant' ? 'Случайное растение' : 'Случайный зомби'}</div>
    <button class="buy-btn ${canBuy ? 'available' : 'expensive'}" ${canBuy ? '' : 'disabled'} onclick="openBox('${b.id}', ${b.price})">🪙 ${b.price}</button>
  `;
  return div;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  renderTab();
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
      shopData.coins = data.remaining;
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

async function buyZombie(zombieId, price) {
  if (!confirm(`Купить зомби за ${price} 🪙?`)) return;
  try {
    const res = await fetch(API + '/buy-zombie/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zombieId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(' Зомби куплен!');
      shopData.coins = data.remaining;
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

async function openBox(boxId, price) {
  if (!confirm(`Открыть бокс за ${price} 🪙?`)) return;
  try {
    const res = await fetch(API + '/open-box/' + currentUser.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boxId })
    });
    const data = await res.json();
    if (res.ok) {
      shopData.coins = data.remaining;
      document.getElementById('coins-count').textContent = data.remaining;
      if (data.isNew) {
        showToast(`🎉 Выпало: ${data.won.emoji} ${data.won.name}!`);
      } else {
        showToast(`😐 Выпало: ${data.won.emoji} ${data.won.name} (уже есть)`);
      }
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
