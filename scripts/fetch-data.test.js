const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  fetchLatestAvailableSeason,
  getCurrentSeason,
  getSeasonCandidates,
  main,
} = require('./fetch-data');

test('getCurrentSeason uses the season that starts in July', () => {
  assert.equal(getCurrentSeason(new Date('2026-06-30T12:00:00Z')), '2025-26');
  assert.equal(getCurrentSeason(new Date('2026-07-01T00:00:00Z')), '2026-27');
});

test('getSeasonCandidates starts with the requested season and works backwards', () => {
  assert.deepEqual(
    getSeasonCandidates(new Date('2026-09-19T00:00:00Z'), 3),
    ['2026-27', '2025-26', '2024-25'],
  );
});

test('getSeasonCandidates searches ten seasons by default', () => {
  const seasons = getSeasonCandidates(new Date('2026-09-19T00:00:00Z'));

  assert.equal(seasons.length, 10);
  assert.equal(seasons.at(-1), '2017-18');
});

test('fetchLatestAvailableSeason falls back when the current season file is not published', async () => {
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(url);
    if (url.includes('/2026-27/') || url.includes('/main/')) return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      json: async () => ({ matches: [{ team1: 'Arsenal', team2: 'Chelsea' }] }),
    };
  };

  const result = await fetchLatestAvailableSeason(fetchImpl, new Date('2026-09-19T00:00:00Z'));

  assert.equal(result.season, '2025-26');
  assert.match(result.sourceUrl, /2025-26\/eng\.1\.json$/);
  assert.equal(requestedUrls.length, 4);
});

test('fetchLatestAvailableSeason prefers OpenFootball’s main branch and country-and-division filename', async () => {
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ matches: [{ team1: 'Arsenal', team2: 'Chelsea' }] }),
    };
  };

  await fetchLatestAvailableSeason(fetchImpl, new Date('2026-09-19T00:00:00Z'));

  assert.deepEqual(requestedUrls, [
    'https://raw.githubusercontent.com/openfootball/england.json/main/2026-27/eng.1.json',
  ]);
});

test('fetchLatestAvailableSeason retries master when main does not contain the data', async () => {
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(url);
    if (url.includes('/main/')) return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      json: async () => ({ matches: [{ team1: 'Arsenal', team2: 'Chelsea' }] }),
    };
  };

  const result = await fetchLatestAvailableSeason(fetchImpl, new Date('2026-09-19T00:00:00Z'));

  assert.match(result.sourceUrl, /master\/2026-27\/eng\.1\.json$/);
  assert.equal(requestedUrls.length, 2);
});

test('fetchLatestAvailableSeason reports an upstream error without masking it as missing data', async () => {
  await assert.rejects(
    fetchLatestAvailableSeason(
      async () => ({ ok: false, status: 500 }),
      new Date('2026-09-19T00:00:00Z'),
    ),
    /HTTP 500/,
  );
});

test('main preserves existing data when no published season contains matches', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-data-'));
  const outPath = path.join(directory, 'optimized.json');
  const existingData = '{"season":"2025-26"}\n';
  fs.writeFileSync(outPath, existingData);

  try {
    await main({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ matches: [] }),
      }),
      today: new Date('2026-09-19T00:00:00Z'),
      outPath,
    });

    assert.equal(fs.readFileSync(outPath, 'utf8'), existingData);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
