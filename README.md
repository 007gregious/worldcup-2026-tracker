# Premier League Tracker

A lightweight static dashboard for the current Premier League season. It displays a live league table plus fixtures and results from a compact, preprocessed JSON file.

## Features

- **Current-season aware:** the data job automatically selects the Premier League season running from July through June (for example, `2026-27`). If OpenFootball has not published that season's file yet, it uses the newest available prior season instead of failing.
- **League table:** played, wins, draws, losses, goals for/against, goal difference, and points calculated from completed fixtures.
- **Fixtures and results:** clearly labeled upcoming matches and final scores, grouped by match date.
- **Low-data delivery:** the browser loads only static HTML, CSS, JavaScript, and `data/optimized.json`, with a five-minute local cache and a manual refresh option.
- **Automated updates:** GitHub Actions refreshes the data every 30 minutes between 08:00 and 23:59 UTC.

## How it works

`scripts/fetch-data.js` downloads the current Premier League fixture data from the [OpenFootball England dataset](https://github.com/openfootball/england.json), calculates the table from completed matches, and writes `data/optimized.json`. The browser app in `js/app.js` renders the table and fixtures from that optimized file.

The fetch job tries the current season first, then up to four earlier seasons when a source file returns HTTP 404. This keeps scheduled data refreshes working during the gap between a new season beginning and the upstream fixture file being published.

## Getting started

Node.js 20 or newer is required to refresh data. There are no third-party Node dependencies.

```bash
npm run fetch
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Use a web server rather than opening `index.html` directly so the browser can load the data file.

## Data model

`data/optimized.json` contains `league`, `season`, `lastUpdated`, `standings`, and `matches`. The fetch command updates all fields from the upstream season data.

## Deployment

Deploy the repository to any static host. Include `index.html`, `css/style.css`, `js/app.js`, and `data/optimized.json`.

## License

This project is licensed under the [MIT License](LICENSE).
