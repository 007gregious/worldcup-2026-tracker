const fs = require('node:fs');
const path = require('node:path');

const TOURNAMENT_NAME = 'FIFA World Cup 2026';
// OpenFootball publishes the tournament schedule and results as a compact JSON
// document. Try both branch names so a branch rename does not blank the site.
const SOURCE_URLS = [
  'https://raw.githubusercontent.com/openfootball/worldcup.json/main/2026/worldcup.json',
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
];

function scoreFor(match, index) {
  const score = match.score?.ft?.[index];
  return Number.isFinite(score) ? score : null;
}

function formatMatches(rawMatches) {
  return rawMatches.map((match) => {
    const homeScore = scoreFor(match, 0);
    const awayScore = scoreFor(match, 1);

    return {
      id: `${match.date}-${match.team1}-${match.team2}`,
      date: match.date,
      time: match.time || 'TBD',
      group: match.group || null,
      round: match.round || null,
      status: homeScore === null || awayScore === null ? 'scheduled' : 'finished',
      home: { name: match.team1, score: homeScore },
      away: { name: match.team2, score: awayScore },
      events: [
        ...(match.goals1 || []).map((goal) => ({ type: 'goal', minute: goal.minute, player: goal.name, team: match.team1 })),
        ...(match.goals2 || []).map((goal) => ({ type: 'goal', minute: goal.minute, player: goal.name, team: match.team2 })),
        ...(match.cards1 || []).map((card) => ({ type: 'yellow', minute: card.minute, player: card.name, team: match.team1 })),
        ...(match.cards2 || []).map((card) => ({ type: 'yellow', minute: card.minute, player: card.name, team: match.team2 })),
      ],
    };
  });
}

function calculateGroups(matches) {
  const groups = new Map();
  const addTeam = (group, name) => {
    if (!group.has(name)) {
      group.set(name, { name, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 });
    }
    return group.get(name);
  };

  matches.forEach((match) => {
    if (!match.group) return;
    if (!groups.has(match.group)) groups.set(match.group, new Map());
    const group = groups.get(match.group);
    const home = addTeam(group, match.home.name);
    const away = addTeam(group, match.away.name);
    if (match.home.score === null || match.away.score === null) return;

    home.played += 1;
    away.played += 1;
    home.gf += match.home.score;
    home.ga += match.away.score;
    away.gf += match.away.score;
    away.ga += match.home.score;
    if (match.home.score > match.away.score) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (match.home.score < match.away.score) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return [...groups.entries()].map(([name, teams]) => ({
    name,
    teams: [...teams.values()]
      .map((team) => ({ ...team, gd: team.gf - team.ga }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
      .map((team, index) => ({ ...team, rank: index + 1 })),
  }));
}

function getTopScorers(matches) {
  const goals = new Map();
  matches.flatMap((match) => match.events.filter((event) => event.type === 'goal')).forEach((event) => {
    if (event.player) goals.set(event.player, (goals.get(event.player) || 0) + 1);
  });
  return [...goals.entries()]
    .map(([name, total]) => ({ name, goals: total }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, 10);
}

async function fetchTournament(fetchImpl = fetch) {
  const attemptedUrls = [];
  for (const sourceUrl of SOURCE_URLS) {
    attemptedUrls.push(sourceUrl);
    let response;
    try {
      response = await fetchImpl(sourceUrl);
    } catch (error) {
      continue;
    }
    if (!response.ok) continue;
    let raw;
    try {
      raw = await response.json();
    } catch (error) {
      continue;
    }
    if (raw.matches?.length) return { raw, sourceUrl };
  }
  throw new Error(`No World Cup match data was returned. Tried: ${attemptedUrls.join(', ')}`);
}

async function main({ fetchImpl = fetch, outPath } = {}) {
  const outputPath = outPath || path.join(__dirname, '..', 'data', 'optimized.json');
  console.log(`Fetching ${TOURNAMENT_NAME} data...`);
  let source;
  try {
    source = await fetchTournament(fetchImpl);
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      console.warn(`⚠️ ${error.message} Keeping existing data in ${outputPath}.`);
      return;
    }
    throw error;
  }

  const matches = formatMatches(source.raw.matches);
  const optimized = {
    tournament: TOURNAMENT_NAME,
    lastUpdated: new Date().toISOString(),
    groups: calculateGroups(matches),
    matches,
    topScorers: getTopScorers(matches),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(optimized, null, 2)}\n`);
  console.log(`✅ Data written to ${outputPath}`);
  console.log(`   Groups: ${optimized.groups.length}, Matches: ${matches.length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { SOURCE_URLS, calculateGroups, fetchTournament, formatMatches, getTopScorers, main };
