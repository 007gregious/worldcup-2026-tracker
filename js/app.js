const CACHE_KEY = 'wc2026_data';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let currentData = null;

async function fetchData(force = false) {
  if (!force) {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(`${CACHE_KEY}_time`);
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime) < CACHE_TTL)) {
      currentData = JSON.parse(cached);
      renderAll();
      return;
    }
  }

  try {
    const res = await fetch('/data/optimized.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(`${CACHE_KEY}_time`, Date.now());
    currentData = data;
    renderAll();
  } catch (err) {
    console.error('Failed to fetch data:', err);
    document.getElementById('last-updated').innerText = '⚠️ Offline / error';
    if (currentData) renderAll(); // fallback to stale data
  }
}

function renderAll() {
  if (!currentData) return;
  document.getElementById('last-updated').innerHTML = `📅 Updated: ${new Date(currentData.lastUpdated).toLocaleString()}`;
  renderStandings();
  renderMatches();
  renderStats();
}

function renderStandings() {
  const container = document.querySelector('#standings-view .grid');
  if (!container) return;
  container.innerHTML = '';
  currentData.groups.forEach(group => {
    const groupCard = document.createElement('div');
    groupCard.className = 'bg-white rounded-lg shadow overflow-hidden';
    groupCard.innerHTML = `
      <div class="bg-green-100 px-4 py-2 font-bold text-green-800">${group.name}</div>
      <div class="overflow-x-auto">
        <table class="group-table w-full text-sm">
          <thead class="bg-gray-50 text-gray-600">
            <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
          </thead>
          <tbody>
            ${group.teams.map(t => `
              <tr class="border-b">
                <td class="font-medium">${t.rank}</td>
                <td class="flex items-center gap-2"><img src="${t.flag || ''}" class="w-5 h-4 object-cover" onerror="this.style.display='none'"> ${t.name}</td>
                <td>${t.played}</td><td>${t.wins}</td><td>${t.draws}</td><td>${t.losses}</td>
                <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd}</td><td class="font-bold">${t.points}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.appendChild(groupCard);
  });
}

function renderMatches() {
  const container = document.getElementById('matches-view');
  if (!container) return;
  const matches = currentData.matches || [];
  container.innerHTML = `<div class="space-y-4">${matches.map(m => `
    <div class="match-card bg-white rounded-lg shadow p-4">
      <div class="text-xs text-gray-500 mb-1">${m.date} ${m.time || ''} · ${m.status}</div>
      <div class="flex justify-between items-center text-lg font-semibold">
        <span class="flex-1 text-right">${m.home.name}</span>
        <span class="mx-4 text-xl font-mono">${m.home.score ?? '?'} - ${m.away.score ?? '?'}</span>
        <span class="flex-1 text-left">${m.away.name}</span>
      </div>
      ${m.events && m.events.length ? `<div class="mt-2 text-xs text-gray-600 border-t pt-2">${m.events.map(e => `${e.minute}' ${e.type === 'goal' ? '⚽' : '🟨'} ${e.player} (${e.team})`).join(' · ')}</div>` : ''}
    </div>
  `).join('')}</div>`;
}

function renderStats() {
  const scorerEl = document.getElementById('top-scorers');
  const assistEl = document.getElementById('top-assists');
  const cardEl = document.getElementById('most-cards');
  if (scorerEl) scorerEl.innerHTML = currentData.topScorers.map(p => `<li class="flex justify-between"><span>${p.name}</span><span class="font-bold">${p.goals} ⚽</span></li>`).join('');
  if (assistEl) assistEl.innerHTML = currentData.topAssists.map(p => `<li class="flex justify-between"><span>${p.name}</span><span class="font-bold">${p.assists} 🎯</span></li>`).join('');
  if (cardEl) cardEl.innerHTML = currentData.mostCards.map(p => `<li class="flex justify-between"><span>${p.name}</span><span class="font-bold">${p.yellows} 🟨</span></li>`).join('');
}

// Tabs handling
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'border-green-700', 'text-green-700', 'border-b-2'));
    btn.classList.add('active', 'border-green-700', 'text-green-700', 'border-b-2');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${tab}-view`).classList.remove('hidden');
  });
});

document.getElementById('refresh-btn').addEventListener('click', () => fetchData(true));

// Initial load
fetchData();