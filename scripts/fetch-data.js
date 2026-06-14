const fs = require('fs');
const path = require('path');

const RAW_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// ---------- Helper: compute group standings from matches ----------
function computeStandings(matches) {
  const groups = {};

  matches.forEach(m => {
    const groupName = m.group;
    if (!groupName) return;
    if (!groups[groupName]) groups[groupName] = {};

    const t1 = m.team1;
    const t2 = m.team2;
    const score1 = m.score?.ft?.[0];
    const score2 = m.score?.ft?.[1];
    const isFinished = (score1 !== undefined && score2 !== undefined);

    if (!groups[groupName][t1]) {
      groups[groupName][t1] = { played:0, wins:0, draws:0, losses:0, gf:0, ga:0, points:0 };
    }
    if (!groups[groupName][t2]) {
      groups[groupName][t2] = { played:0, wins:0, draws:0, losses:0, gf:0, ga:0, points:0 };
    }

    if (isFinished) {
      groups[groupName][t1].played++;
      groups[groupName][t2].played++;
      groups[groupName][t1].gf += score1;
      groups[groupName][t1].ga += score2;
      groups[groupName][t2].gf += score2;
      groups[groupName][t2].ga += score1;

      if (score1 > score2) {
        groups[groupName][t1].wins++;
        groups[groupName][t1].points += 3;
        groups[groupName][t2].losses++;
      } else if (score1 < score2) {
        groups[groupName][t2].wins++;
        groups[groupName][t2].points += 3;
        groups[groupName][t1].losses++;
      } else {
        groups[groupName][t1].draws++;
        groups[groupName][t1].points += 1;
        groups[groupName][t2].draws++;
        groups[groupName][t2].points += 1;
      }
    }
  });

  // Convert to array and sort
  const result = [];
  for (const [groupName, teams] of Object.entries(groups)) {
    const teamArray = Object.entries(teams).map(([teamName, stats]) => ({
      name: teamName,
      ...stats,
      gd: stats.gf - stats.ga
    }));
    teamArray.sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    result.push({
      name: groupName,
      teams: teamArray.map((t, idx) => ({ ...t, rank: idx+1 }))
    });
  }
  return result;
}

// ---------- Extract top scorers ----------
function getTopScorers(matches) {
  const scorers = {};
  matches.forEach(m => {
    (m.goals1 || []).forEach(g => {
      const name = g.name;
      scorers[name] = (scorers[name] || 0) + 1;
    });
    (m.goals2 || []).forEach(g => {
      const name = g.name;
      scorers[name] = (scorers[name] || 0) + 1;
    });
  });
  return Object.entries(scorers)
    .map(([name, goals]) => ({ name, goals }))
    .sort((a,b) => b.goals - a.goals)
    .slice(0,10);
}

// ---------- Extract yellow/red cards (if available) ----------
function getCardLeaders(matches) {
  const cards = {};
  matches.forEach(m => {
    (m.cards1 || []).forEach(c => {
      const name = c.name;
      cards[name] = (cards[name] || 0) + 1;
    });
    (m.cards2 || []).forEach(c => {
      const name = c.name;
      cards[name] = (cards[name] || 0) + 1;
    });
  });
  return Object.entries(cards)
    .map(([name, yellows]) => ({ name, yellows }))
    .sort((a,b) => b.yellows - a.yellows)
    .slice(0,10);
}

// ---------- Main ----------
async function main() {
  console.log('Fetching live World Cup 2026 data...');
  const res = await fetch(RAW_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
  const raw = await res.json();

  const matches = raw.matches || [];
  console.log(`Fetched ${matches.length} matches.`);

  const groups = computeStandings(matches);
  const topScorers = getTopScorers(matches);
  const mostCards = getCardLeaders(matches);

  // Prepare matches for frontend
  const formattedMatches = matches.map(m => ({
    id: `${m.date}-${m.team1}-${m.team2}`,
    date: m.date,
    time: m.time || 'TBD',
    status: m.score?.ft ? 'finished' : 'scheduled',
    home: { name: m.team1, score: m.score?.ft?.[0] ?? null },
    away: { name: m.team2, score: m.score?.ft?.[1] ?? null },
    events: [
      ...(m.goals1 || []).map(g => ({ type: 'goal', minute: g.minute, player: g.name, team: m.team1 })),
      ...(m.goals2 || []).map(g => ({ type: 'goal', minute: g.minute, player: g.name, team: m.team2 })),
      ...(m.cards1 || []).map(c => ({ type: 'yellow', minute: c.minute, player: c.name, team: m.team1 })),
      ...(m.cards2 || []).map(c => ({ type: 'yellow', minute: c.minute, player: c.name, team: m.team2 }))
    ]
  }));

  const optimized = {
    lastUpdated: new Date().toISOString(),
    groups,
    matches: formattedMatches,
    topScorers,
    topAssists: [],   // OpenFootball may not provide assists – can be added later
    mostCards
  };

  const outPath = path.join(__dirname, '..', 'data', 'optimized.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(optimized, null, 2));
  console.log(`✅ Data written to ${outPath}`);
  console.log(`   Groups: ${groups.length}, Matches: ${matches.length}, Top scorers: ${topScorers.length}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});