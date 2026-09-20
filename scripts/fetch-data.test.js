const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { calculateGroups, fetchTournament, formatMatches, main } = require('./fetch-data');

const rawMatches = [{
  date: '2026-06-11', time: '13:00 UTC-6', group: 'Group A', team1: 'Mexico', team2: 'South Africa',
  score: { ft: [2, 0] }, goals1: [{ name: 'Player One', minute: 10 }], cards2: [{ name: 'Player Two', minute: 20 }],
}, {
  date: '2026-06-12', group: 'Group A', team1: 'South Africa', team2: 'Korea Republic',
}];

test('formatMatches preserves World Cup metadata and distinguishes scheduled matches', () => {
  const [finished, scheduled] = formatMatches(rawMatches);
  assert.equal(finished.group, 'Group A');
  assert.equal(finished.status, 'finished');
  assert.deepEqual(finished.home, { name: 'Mexico', score: 2 });
  assert.equal(finished.events.length, 2);
  assert.equal(scheduled.status, 'scheduled');
  assert.equal(scheduled.home.score, null);
});

test('calculateGroups includes scheduled teams without awarding them points', () => {
  const [group] = calculateGroups(formatMatches(rawMatches));
  assert.equal(group.name, 'Group A');
  assert.deepEqual(group.teams.map(({ name, points, played }) => ({ name, points, played })), [
    { name: 'Mexico', points: 3, played: 1 },
    { name: 'Korea Republic', points: 0, played: 0 },
    { name: 'South Africa', points: 0, played: 1 },
  ]);
});

test('fetchTournament falls back to the legacy branch when main is unavailable', async () => {
  const urls = [];
  const result = await fetchTournament(async (url) => {
    urls.push(url);
    return url.includes('/main/') ? { ok: false } : { ok: true, json: async () => ({ matches: rawMatches }) };
  });
  assert.match(result.sourceUrl, /master\/2026\/worldcup\.json$/);
  assert.equal(urls.length, 2);
});

test('main keeps the last good dataset when both providers fail', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-data-'));
  const outPath = path.join(directory, 'optimized.json');
  const existingData = '{"matches":["last-good"]}\n';
  fs.writeFileSync(outPath, existingData);
  try {
    await main({ fetchImpl: async () => ({ ok: false }), outPath });
    assert.equal(fs.readFileSync(outPath, 'utf8'), existingData);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
