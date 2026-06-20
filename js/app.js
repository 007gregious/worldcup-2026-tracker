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
                <td class="flex items-center gap-2">${t.name}</td>
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
  
  const isFinished = (m) => m.status === 'finished' || (m.home.score !== null && m.away.score !== null);
  
  const sortedMatches = [...matches].sort((a, b) => {
    const aFinished = isFinished(a);
    const bFinished = isFinished(b);
    if (aFinished !== bFinished) return aFinished ? -1 : 1;
    return new Date(a.date) - new Date(b.date);
  });
  
  const grouped = {};
  sortedMatches.forEach(m => {
    const dateKey = m.date;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(m);
  });
  
  let html = '';
  for (const [date, matchesOnDate] of Object.entries(grouped)) {
    const formattedDate = new Date(date).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    html += `<div class="mb-6">`;
    html += `<h3 class="text-lg font-bold text-gray-700 border-b pb-1 mb-3">${formattedDate}</h3>`;
    html += `<div class="space-y-3">`;
    matchesOnDate.forEach(m => {
      const scoreDisplay = (m.home.score !== null && m.away.score !== null) 
        ? `${m.home.score} - ${m.away.score}` 
        : 'vs';
      const statusClass = isFinished(m) ? 'text-green-600' : 'text-yellow-600';
      html += `
        <div class="match-card bg-white rounded-lg shadow p-4 hover:shadow-md transition">
          <div class="flex justify-between items-center flex-wrap gap-2">
            <div class="text-sm text-gray-500">${m.time || 'TBD'}</div>
            <div class="text-xs font-semibold ${statusClass}">${isFinished(m) ? '✓ Finished' : '⌛ Upcoming'}</div>
          </div>
          <div class="flex justify-between items-center mt-2">
            <span class="flex-1 text-right font-medium">${m.home.name}</span>
            <span class="mx-4 text-xl font-mono font-bold">${scoreDisplay}</span>
            <span class="flex-1 text-left font-medium">${m.away.name}</span>
          </div>
          ${m.events && m.events.length ? `
            <div class="mt-2 text-xs text-gray-600 border-t pt-2">
              ${m.events.map(e => `${e.minute}' ${e.type === 'goal' ? '⚽' : '🟨'} ${e.player} (${e.team})`).join(' · ')}
            </div>
          ` : ''}
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  if (sortedMatches.length === 0) {
    html = '<div class="text-center text-gray-500 py-8">No matches available.</div>';
  }
  
  container.innerHTML = html;
}

function renderStats() {
  const scorerEl = document.getElementById('top-scorers');
  const assistEl = document.getElementById('top-assists');
  const cardEl = document.getElementById('most-cards');
  
  if (scorerEl) {
    scorerEl.innerHTML = currentData.topScorers.map(p => 
      `<li class="flex justify-between"><span>${p.name}</span><span class="font-bold">${p.goals} ⚽</span></li>`
    ).join('');
  }
  
  if (assistEl) {
    assistEl.innerHTML = currentData.topAssists.map(p => 
      `<li class="flex justify-between"><span>${p.name}</span><span class="font-bold">${p.assists} 🎯</span></li>`
    ).join('');
  }
  
  if (cardEl) {
    cardEl.innerHTML = currentData.mostCards.map(p => 
      `<li class="flex justify-between"><span>${p.name}</span><span class="font-bold">${p.yellows} 🟨</span></li>`
    ).join('');
  }
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