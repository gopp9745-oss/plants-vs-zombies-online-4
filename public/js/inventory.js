let inventoryTab = 'plant';
let selectedItem = null;
let currentLoadout = [null, null, null, null, null, null];
let itemsData = { plants: [], zombies: [] };

const plantEmojis = ['🌻', '🌱', '🥜', '🍒', '❄️', '🔁', '💣', '👯'];
const zombieEmojis = ['🧟', '🧟‍♂️', '🪖', '🏃', '👹', '💃', '🏈', '🎣'];

async function loadInventory() {
  try {
    const res = await fetch(`${window.location.origin}/api/inventory/items`);
    itemsData = await res.json();
    
    const loadoutRes = await fetch(`${window.location.origin}/api/inventory/loadout/${currentUser.id}/${inventoryTab}`);
    const loadoutData = await loadoutRes.json();
    
    if (loadoutData) {
      currentLoadout = [
        loadoutData.slot1,
        loadoutData.slot2,
        loadoutData.slot3,
        loadoutData.slot4,
        loadoutData.slot5,
        loadoutData.slot6
      ];
    }
    
    const unlockedPlants = currentUser.unlocked_plants || [1, 2, 3];
    const unlockedZombies = currentUser.unlocked_zombies || [1, 2, 3];
    itemsData.plants = itemsData.plants.filter(p => unlockedPlants.includes(p.id));
    itemsData.zombies = itemsData.zombies.filter(z => unlockedZombies.includes(z.id));
    
    renderItems();
    renderLoadout();
  } catch (err) {
    console.error('Failed to load inventory:', err);
  }
}

function switchInventoryTab(tab, el) {
  inventoryTab = tab;
  selectedItem = null;
  currentLoadout = [null, null, null, null, null, null];
  
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  el.classList.add('active');
  
  loadInventory();
}

function renderItems() {
  const grid = document.getElementById('items-grid');
  grid.innerHTML = '';
  
  const items = inventoryTab === 'plant' ? itemsData.plants : itemsData.zombies;
  const emojis = inventoryTab === 'plant' ? plantEmojis : zombieEmojis;
  
  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.onclick = () => selectItem(item);
    
    const costText = inventoryTab === 'plant' ? `☀️ ${item.cost}` : `💰 ${item.hp} HP`;
    
    card.innerHTML = `
      <div class="emoji">${emojis[index]}</div>
      <div class="name">${item.name}</div>
      <div class="desc">${item.desc}</div>
      <div class="cost">${costText}</div>
    `;
    
    grid.appendChild(card);
  });
}

function selectItem(item) {
  selectedItem = item;
  
  const emptySlot = currentLoadout.indexOf(null);
  if (emptySlot !== -1) {
    currentLoadout[emptySlot] = item.id;
    renderLoadout();
  } else {
    alert('Все слоты заполнены! Нажмите на слот чтобы убрать предмет.');
  }
}

function renderLoadout() {
  const slots = document.getElementById('loadout-slots');
  slots.innerHTML = '';
  
  const items = inventoryTab === 'plant' ? itemsData.plants : itemsData.zombies;
  const emojis = inventoryTab === 'plant' ? plantEmojis : zombieEmojis;
  
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = `loadout-slot ${currentLoadout[i] ? 'filled' : ''}`;
    
    if (currentLoadout[i]) {
      const item = items.find(it => it.id === currentLoadout[i]);
      const index = items.indexOf(item);
      slot.innerHTML = emojis[index];
      slot.onclick = () => {
        currentLoadout[i] = null;
        renderLoadout();
      };
    } else {
      slot.innerHTML = '+';
    }
    
    slots.appendChild(slot);
  }
}

async function saveLoadout() {
  try {
    const res = await fetch(`${window.location.origin}/api/inventory/loadout/${currentUser.id}/${inventoryTab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot1: currentLoadout[0],
        slot2: currentLoadout[1],
        slot3: currentLoadout[2],
        slot4: currentLoadout[3],
        slot5: currentLoadout[4],
        slot6: currentLoadout[5]
      })
    });
    
    if (res.ok) {
      alert('Загрузка сохранена!');
      window.currentLoadout = currentLoadout;
    } else {
      alert('Ошибка сохранения');
    }
  } catch (err) {
    console.error('Failed to save loadout:', err);
    alert('Ошибка подключения');
  }
}
