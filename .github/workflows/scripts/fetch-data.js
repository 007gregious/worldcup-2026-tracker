const fs = require('fs');
const path = require('path');

const RAW_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- Tie‑breaker helpers (FIFA rules) ----------
function getHeadToHeadStats(teams, groupMatches) {
  // returns Map: teamId -> { pts, gd, gf } among the tied subset
  const stats = new Map();
  teams.forEach(t => stats.set(t.id, { pts: 0, gd: 0, gf: 0 }));
  groupMatches.forEach(m => {
    const { team1, team2, score1, score2 } = m;
    if (!teams.some(t => t.id === team1.id) || !teams.some(t => t.id === team2.id)) return;
    const pts1 = score1 > score2 ? 3 : (score1 === score2 ? 1 : 0);
    const pts2 = score2 > score1 ? 3 : (score1 === score2 ? 1 : 0);
    stats.get(team1.id).pts += pts1;
    stats.get(team2.id).pts += pts2;
    stats.get(team1.id).gd += (score1 - score2);
    stats.get(team2.id).gd += (score2 - score1);
    stats.get(team1.id).gf += score1;
    stats.get(team2.id).gf += score2;
  });
  return stats;
}

function getFairPlayPoints(teamId, allEvents) {
  // yellow = -1, second yellow = -3 (counts as red), direct red = -4
  let points = 0;
  allEvents.forEach(ev => {
    if (ev.type === 'yellow' && ev.player.team_id === teamId) points -= 1;
    if (ev.type === 'second_yellow' && ev.player.team_id === teamId) points -= 3;
    if (ev.type === 'red' && ev.player.team_id === teamId) points -= 4;
  });
  return points;
}

function sortGroupTeams(teams, groupMatches, allEvents) {
  // 1) points, 2) GD, 3) GF, 4) head‑to‑head, 5) fair play
  const sorted = [...teams];
  sorted.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.gd !== b.gd) return b.gd - a.gd;
    if (a.gf !== b.gf) return b.gf - a.gf;

    // head‑to‑head among tied teams (only if exactly those two are tied? Actually we need full subset)
    const tiedTeams = sorted.filter(t => t.points === a.points && t.gd === a.gd && t.gf === a.gf);
    if (tiedTeams.length > 1) {
      const h2h = getHeadToHeadStats(tiedTeams, groupMatches);
      const h2hA = h2h.get(a.id);
      const h2hB = h2h.get(b.id);
      if (h2hA.pts !== h2hB.pts) return h2hB.pts - h2hA.pts;
      if (h2hA.gd !== h2hB.gd) return h2hB.gd - h2hA.gd;
      if (h2hA.gf !== h2hB.gf) return h2hB.gf - h2hA.gf;
    }

    // fair play points
    const fpA = getFairPlayPoints(a.id, allEvents);
    const fpB = getFairPlayPoints(b.id, allEvents);
    if (fpA !== fpB) return fpB - fpA;

    // drawing of lots – keep original order
    return 0;
  });
  return sorted;
}

// ---------- Player stats ----------
function extractPlayerStats(matches) {
  const players = new Map(); // key: playerId+name
  matches.forEach(m => {
    (m.events || []).forEach(ev => {
      if (ev.type === 'goal') {
        const scorer = ev.player;
        const key = `${scorer.id}-${scorer.name}`;
        if (!players.has(key)) players.set(key, { ...scorer, goals: 0, assists: 0, yellows: 0 });
        players.get(key).goals++;
        if (ev.assist) {
          const assistKey = `${ev.assist.id}-${ev.assist.name}`;
          if (!players.has(assistKey)) players.set(assistKey, { ...ev.assist, goals: 0, assists: 0, yellows: 0 });
          players.get(assistKey).assists++;
        }
      }
      if (ev.type === 'yellow' || ev.type === 'second_yellow') {
        const key = `${ev.player.id}-${ev.player.name}`;
        if (!players.has(key)) players.set(key, { ...ev.player, goals: 0, assists: 0, yellows: 0 });
        players.get(key).yellows++;
      }
    });
  });
  return Array.from(players.values());
}

// ---------- Main ----------
async function main() {
  console.log('Fetching raw data...');
  const raw = await fetchJSON(RAW_URL);
  const groups = raw.groups || [];
  const allMatches = [];
  const computedGroups = [];

  // Collect all events from all matches
  const allEvents = [];
  groups.forEach(group => {
    (group.matches || []).forEach(m => {
      allMatches.push(m);
      (m.events || []).forEach(ev => allEvents.push(ev));
    });
  });

  // Process each group
  for (const group of groups) {
    const groupMatches = group.matches || [];
    const teams = group.teams.map(t => ({
      id: t.id,
      name: t.name,
      code: t.code,
      flag: t.flag || `https://flagcdn.com/w40/${t.code?.toLowerCase()}.png`,
      played: 0,
      wins: 0, draws: 0, losses: 0,
      gf: 0, ga: 0, gd: 0, points: 0
    }));

    // Calculate stats from matches
    groupMatches.forEach(m => {
      const t1 = teams.find(t => t.id === m.team1.id);
      const t2 = teams.find(t => t.id === m.team2.id);
      if (!t1 || !t2) return;
      t1.played++; t2.played++;
      t1.gf += m.score1; t1.ga += m.score2;
      t2.gf += m.score2; t2.ga += m.score1;
      if (m.score1 > m.score2) {
        t1.wins++; t2.losses++;
        t1.points += 3;
      } else if (m.score1 < m.score2) {
        t2.wins++; t1.losses++;
        t2.points += 3;
      } else {
        t1.draws++; t2.draws++;
        t1.points += 1; t2.points += 1;
      }
      t1.gd = t1.gf - t1.ga;
      t2.gd = t2.gf - t2.ga;
    });

    // Apply tie‑breakers
    const sortedTeams = sortGroupTeams(teams, groupMatches, allEvents);
    computedGroups.push({
      name: group.name,
      teams: sortedTeams.map((t, idx) => ({ ...t, rank: idx + 1 }))
    });
  }

  // Prepare match list (with status, scores, datetime)
  const matches = allMatches.map(m => ({
    id: m.id,
    date: m.date,
    time: m.time,
    status: m.status || (m.score1 !== undefined ? 'finished' : 'scheduled'),
    home: { name: m.team1.name, code: m.team1.code, score: m.score1 },
    away: { name: m.team2.name, code: m.team2.code, score: m.score2 },
    events: (m.events || []).map(ev => ({
      type: ev.type,
      minute: ev.minute,
      player: ev.player.name,
      team: ev.player.team_code || ev.player.team_name
    }))
  }));

  const playerStats = extractPlayerStats(allMatches);
  const topScorers = [...playerStats].sort((a,b) => b.goals - a.goals).slice(0, 10);
  const topAssists = [...playerStats].sort((a,b) => b.assists - a.assists).slice(0, 10);
  const mostCards = [...playerStats].sort((a,b) => b.yellows - a.yellows).slice(0, 10);

  const optimized = {
    lastUpdated: new Date().toISOString(),
    groups: computedGroups,
    matches,
    topScorers,
    topAssists,
    mostCards
  };

  const outPath = path.join(__dirname, '..', 'data', 'optimized.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(optimized, null, 0));
  console.log('✅ Data written to', outPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});