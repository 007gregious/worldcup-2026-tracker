# FIFA World Cup 2026 Tracker

A lightweight static dashboard for the FIFA World Cup 2026. It displays live group standings plus fixtures and results from a compact, preprocessed JSON file.

## Features

- **World Cup data:** the data job downloads the 2026 tournament schedule and results from the OpenFootball World Cup dataset.
- **Group standings:** played, wins, draws, losses, goals for/against, goal difference, and points calculated from completed group matches.
- **Fixtures and results:** clearly labeled upcoming matches and final scores, grouped by match date.
- **Low-data delivery:** the browser loads only static HTML, CSS, JavaScript, and `data/optimized.json`, with a five-minute local cache and a manual refresh option.
- **Automated updates:** GitHub Actions refreshes the data every 30 minutes between 08:00 and 23:59 UTC.

## How it works

`scripts/fetch-data.js` downloads World Cup 2026 data from the [OpenFootball World Cup dataset](https://github.com/openfootball/worldcup.json), calculates group standings from completed matches, and writes `data/optimized.json`. The browser app in `js/app.js` renders the standings and fixtures from that optimized file.

The fetch job reads OpenFootball's `2026/worldcup.json` file from its current `main` branch, with `master` retained as a compatibility fallback. If neither source is available, the scheduled job preserves the last successfully generated `data/optimized.json` instead of replacing it with an empty dataset.

## Getting started

Node.js 20 or newer is required to refresh data. There are no third-party Node dependencies.

```bash
npm run fetch
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Use a web server rather than opening `index.html` directly so the browser can load the data file.

## Data model

`data/optimized.json` contains `tournament`, `lastUpdated`, `groups`, `matches`, and `topScorers`. The fetch command updates all fields from the upstream tournament data.

## Deployment

Deploy the repository to any static host. Include `index.html`, `css/style.css`, `js/app.js`, and `data/optimized.json`.

## License

This project is licensed under the [MIT License](LICENSE).
