const CACHE_KEY = 'premier_league_data';
const CACHE_TTL = 5 * 60 * 1000;

let currentData = null;

async function fetchData(force = false) {
  if (!force) {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(`${CACHE_KEY}_time`);
    if (cached && cachedTime && Date.now() - Number(cachedTime) < CACHE_TTL) {
      currentData = JSON.parse(cached);
      renderAll();
      return;
    }
  }

  try {
    const response = await fetch(`./data/optimized.json?updated=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    currentData = await response.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(currentData));
    localStorage.setItem(`${CACHE_KEY}_time`, String(Date.now()));
    renderAll();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    document.getElementById('last-updated').textContent = '⚠️ Offline / error';
    if (currentData) renderAll();
  }
}

function renderAll() {
  if (!currentData) return;
  document.getElementById('season-label').textContent = `${currentData.league} ${currentData.season}`;
  document.getElementById('last-updated').textContent = `Updated: ${new Date(currentData.lastUpdated).toLocaleString()}`;
  renderStandings();
  renderMatches();
}

function renderStandings() {
  const body = document.getElementById('standings-body');
  const standings = currentData.standings || [];
  body.innerHTML = standings.length ? standings.map((team) => `
    <tr class="border-b border-gray-100">
      <td class="font-medium">${team.rank}</td><td class="font-semibold">${team.name}</td>
      <td>${team.played}</td><td>${team.wins}</td><td>${team.draws}</td><td>${team.losses}</td>
      <td>${team.gf}</td><td>${team.ga}</td><td>${team.gd}</td><td class="font-bold">${team.points}</td>
    </tr>`).join('') : '<tr><td colspan="10" class="py-8 text-center text-gray-500">League table will appear when the season data is available.</td></tr>';
}

function renderMatches() {
  const container = document.getElementById('matches-view');
  const matches = [...(currentData.matches || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!matches.length) {
    container.innerHTML = '<p class="py-8 text-center text-gray-500">No fixtures are available yet.</p>';
    return;
  }

  const byDate = matches.reduce((groups, match) => {
    (groups[match.date] ||= []).push(match);
    return groups;
  }, {});
  container.innerHTML = Object.entries(byDate).map(([date, dayMatches]) => {
    const title = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `<section class="mb-6"><h2 class="mb-3 border-b pb-1 text-lg font-bold text-gray-700">${title}</h2>
      <div class="space-y-3">${dayMatches.map((match) => {
        const finished = match.status === 'finished';
        const score = finished ? `${match.home.score} – ${match.away.score}` : 'vs';
        return `<article class="match-card rounded-lg bg-white p-4 shadow">
          <div class="flex items-center justify-between text-xs text-gray-500"><span>${match.round || 'Premier League'} · ${match.time}</span><span class="font-semibold ${finished ? 'text-green-700' : 'text-amber-700'}">${finished ? 'Final' : 'Upcoming'}</span></div>
          <div class="mt-2 flex items-center justify-between"><span class="flex-1 text-right font-medium">${match.home.name}</span><strong class="mx-4 font-mono text-xl">${score}</strong><span class="flex-1 font-medium">${match.away.name}</span></div>
        </article>`;
      }).join('')}</div></section>`;
  }).join('');
}

document.querySelectorAll('.tab-btn').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((item) => item.classList.remove('active', 'border-green-700', 'text-green-700', 'border-b-2'));
    button.classList.add('active', 'border-green-700', 'text-green-700', 'border-b-2');
    document.querySelectorAll('.tab-content').forEach((view) => view.classList.add('hidden'));
    document.getElementById(`${button.dataset.tab}-view`).classList.remove('hidden');
  });
});

document.getElementById('refresh-btn').addEventListener('click', () => fetchData(true));
fetchData();
