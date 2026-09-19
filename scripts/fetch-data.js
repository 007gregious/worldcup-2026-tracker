const fs = require('fs');
const path = require('path');

const LEAGUE_NAME = 'Premier League';
const SOURCE_BASE_URL = 'https://raw.githubusercontent.com/openfootball/england.json/master';

function getCurrentSeason(today = new Date()) {
  const year = today.getUTCFullYear();
  const startYear = today.getUTCMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function calculateTable(matches) {
  const table = new Map();
  const addTeam = (name) => {
    if (!table.has(name)) {
      table.set(name, { name, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 });
    }
    return table.get(name);
  };

  matches.forEach(({ home, away }) => {
    const homeTeam = addTeam(home.name);
    const awayTeam = addTeam(away.name);
    if (home.score === null || away.score === null) return;

    homeTeam.played += 1;
    awayTeam.played += 1;
    homeTeam.gf += home.score;
    homeTeam.ga += away.score;
    awayTeam.gf += away.score;
    awayTeam.ga += home.score;
    if (home.score > away.score) {
      homeTeam.wins += 1;
      homeTeam.points += 3;
      awayTeam.losses += 1;
    } else if (home.score < away.score) {
      awayTeam.wins += 1;
      awayTeam.points += 3;
      homeTeam.losses += 1;
    } else {
      homeTeam.draws += 1;
      awayTeam.draws += 1;
      homeTeam.points += 1;
      awayTeam.points += 1;
    }
  });

  return [...table.values()]
    .map((team) => ({ ...team, gd: team.gf - team.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

function formatMatches(rawMatches) {
  return rawMatches.map((match) => {
    const [homeScore, awayScore] = match.score?.ft ?? [null, null];
    return {
      id: `${match.date}-${match.team1}-${match.team2}`,
      date: match.date,
      time: match.time || 'TBD',
      round: match.round || null,
      status: homeScore === null || awayScore === null ? 'scheduled' : 'finished',
      home: { name: match.team1, score: homeScore },
      away: { name: match.team2, score: awayScore },
    };
  });
}

async function main() {
  const season = getCurrentSeason();
  const sourceUrl = `${SOURCE_BASE_URL}/${season}/1-premierleague.json`;
  console.log(`Fetching ${LEAGUE_NAME} ${season} data...`);
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Unable to fetch ${sourceUrl}: HTTP ${response.status}`);
  const raw = await response.json();
  const matches = formatMatches(raw.matches || []);
  if (!matches.length) throw new Error(`The ${season} source contains no Premier League matches.`);

  const optimized = {
    league: LEAGUE_NAME,
    season,
    lastUpdated: new Date().toISOString(),
    standings: calculateTable(matches),
    matches,
  };
  const outPath = path.join(__dirname, '..', 'data', 'optimized.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(optimized, null, 2)}\n`);
  console.log(`✅ Data written to ${outPath}`);
  console.log(`   Teams: ${optimized.standings.length}, Matches: ${matches.length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { calculateTable, formatMatches, getCurrentSeason };
