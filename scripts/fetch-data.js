const fs = require('fs');
const path = require('path');

const LEAGUE_NAME = 'Premier League';
// The dataset's default branch is `main`. Keep `master` as a fallback because
// older snapshots of OpenFootball used that branch name.
const SOURCE_BASE_URLS = [
  'https://raw.githubusercontent.com/openfootball/england.json/main',
  'https://raw.githubusercontent.com/openfootball/england.json/master',
];
const MAX_SEASONS_TO_TRY = 10;
// OpenFootball names league files after their country and division. The former
// 1-premierleague.json filename is not present in the england.json repository.
const SOURCE_FILE_NAME = 'eng.1.json';

function getCurrentSeason(today = new Date()) {
  const year = today.getUTCFullYear();
  const startYear = today.getUTCMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function getPreviousSeason(season) {
  const startYear = Number(season.slice(0, 4)) - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function getSeasonCandidates(today = new Date(), count = MAX_SEASONS_TO_TRY) {
  const seasons = [];
  let season = getCurrentSeason(today);

  for (let index = 0; index < count; index += 1) {
    seasons.push(season);
    season = getPreviousSeason(season);
  }

  return seasons;
}

async function fetchLatestAvailableSeason(fetchImpl = fetch, today = new Date()) {
  const attemptedUrls = [];

  for (const season of getSeasonCandidates(today)) {
    for (const sourceBaseUrl of SOURCE_BASE_URLS) {
      const sourceUrl = `${sourceBaseUrl}/${season}/${SOURCE_FILE_NAME}`;
      attemptedUrls.push(sourceUrl);
      let response;

      try {
        response = await fetchImpl(sourceUrl);
      } catch (error) {
        throw new Error(`Unable to fetch ${sourceUrl}: ${error.message}`, { cause: error });
      }

      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`Unable to fetch ${sourceUrl}: HTTP ${response.status}`);

      let raw;
      try {
        raw = await response.json();
      } catch (error) {
        throw new Error(`Unable to parse JSON from ${sourceUrl}: ${error.message}`, { cause: error });
      }
      if (raw.matches?.length) return { season, raw, sourceUrl };
    }
  }

  throw new Error(`Unable to find Premier League fixture data. Tried: ${attemptedUrls.join(', ')}`);
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

async function main({ fetchImpl = fetch, today = new Date(), outPath } = {}) {
  const requestedSeason = getCurrentSeason(today);
  const outputPath = outPath || path.join(__dirname, '..', 'data', 'optimized.json');
  console.log(`Fetching ${LEAGUE_NAME} ${requestedSeason} data...`);
  let source;

  try {
    source = await fetchLatestAvailableSeason(fetchImpl, today);
  } catch (error) {
    const isMissingSeason = error.message.startsWith('Unable to find Premier League fixture data.');

    if (isMissingSeason && fs.existsSync(outputPath)) {
      console.warn(
        `⚠️ No published OpenFootball season is available yet. Keeping the existing data in ${outputPath}.`,
      );
      return;
    }

    throw error;
  }

  const { season, raw } = source;
  if (season !== requestedSeason) {
    console.warn(`⚠️ ${requestedSeason} data is not available yet; using ${season} instead.`);
  }
  const matches = formatMatches(raw.matches || []);
  if (!matches.length) throw new Error(`The ${season} source contains no Premier League matches.`);

  const optimized = {
    league: LEAGUE_NAME,
    season,
    lastUpdated: new Date().toISOString(),
    standings: calculateTable(matches),
    matches,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(optimized, null, 2)}\n`);
  console.log(`✅ Data written to ${outputPath}`);
  console.log(`   Teams: ${optimized.standings.length}, Matches: ${matches.length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  calculateTable,
  fetchLatestAvailableSeason,
  formatMatches,
  getCurrentSeason,
  getPreviousSeason,
  getSeasonCandidates,
  main,
  SOURCE_BASE_URLS,
};
