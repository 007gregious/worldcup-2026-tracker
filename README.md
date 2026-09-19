# FIFA World Cup 2026 Tracker

A lightweight static dashboard for following the FIFA World Cup 2026. It presents group standings, match results and schedules, plus available player leaderboards from a compact, preprocessed JSON file.

## Features

- **Group standings** with played, wins, draws, losses, goals for and against, goal difference, and points.
- **Matches grouped by date**, with finished matches shown before upcoming fixtures, together with kickoff time, score/status, and available goal or card events.
- **Player statistics** for leading scorers, assists, and cards when the upstream data includes them.
- **Low-data delivery**: the browser only needs static HTML, CSS, JavaScript, and `data/optimized.json`.
- **Five-minute client cache** in `localStorage`, plus a manual refresh button that bypasses that cache.
- **Automated data updates** through GitHub Actions every 30 minutes between 08:00 and 23:59 UTC, with manual workflow dispatch also supported.

## How It Works

`scripts/fetch-data.js` downloads the World Cup 2026 dataset from the [OpenFootball World Cup repository](https://github.com/openfootball/worldcup.json), transforms it into the shape consumed by the browser, and writes `data/optimized.json`.

The browser app in `js/app.js` loads that optimized file, reuses a fresh cached copy when available, and renders three tabs:

- **Standings**
- **Matches**
- **Player Stats**

If a data request fails, the header reports an offline/error state and the app retains any data already loaded during the session.

## Tech Stack

- HTML5 and vanilla JavaScript
- Tailwind CSS via CDN, with small custom CSS overrides
- Node.js 20+ for the data transformation script
- GitHub Actions for scheduled data refreshes

## Project Structure

```text
.
├── .github/workflows/
│   └── update-data.yml   # Scheduled and manual data-update workflow
├── css/
│   └── style.css         # Small custom CSS overrides
├── data/
│   └── optimized.json    # Frontend-ready tournament data
├── js/
│   └── app.js            # Browser app logic and rendering
├── scripts/
│   └── fetch-data.js     # Fetches and transforms OpenFootball data
├── index.html            # Static application entry point
├── LICENSE               # MIT license
├── package.json          # Project metadata and npm scripts
└── README.md             # Project documentation
```

## Requirements

- **Node.js 20 or newer** to refresh tournament data.
- A static file server for local browser testing. Opening `index.html` directly may prevent the browser from fetching `data/optimized.json`.

There are no third-party Node dependencies to install.

## Getting Started

1. Clone the repository and enter it:

   ```bash
   git clone <repository-url>
   cd worldcup-2026-tracker
   ```

2. Start a static server. For example:

   ```bash
   python3 -m http.server 8000
   ```

3. Open <http://localhost:8000> in a browser.

## Refreshing Tournament Data

Regenerate `data/optimized.json` locally with:

```bash
npm run fetch
```

The script fetches the configured OpenFootball source, computes standings from completed group matches, extracts available scorer and card leaderboards, formats match events, and writes the optimized payload. It requires network access.

On GitHub, `.github/workflows/update-data.yml` runs the same script on its schedule, on pushes to `main`, or when started manually. When the data file changes, the workflow commits the update automatically.

## Data Model

`data/optimized.json` has these top-level fields:

| Field | Description |
| --- | --- |
| `lastUpdated` | ISO timestamp for when the optimized file was generated. |
| `groups` | Ranked group standings and team table statistics. |
| `matches` | Date, time, status, teams, scores, and available events for each match. |
| `topScorers` | Goal leaders derived from available goal event data. |
| `topAssists` | Assist leaders; empty if the upstream source does not provide assists. |
| `mostCards` | Card leaders derived from available card event data. |

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run fetch` | Fetches upstream tournament data and writes `data/optimized.json`. |

## Deployment

Deploy the repository to any static host, such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or object storage. Ensure the deployment includes `index.html`, `css/style.css`, `js/app.js`, and `data/optimized.json`.

## Troubleshooting

### The page says “Offline / error”

Serve the project through a web server and verify that `data/optimized.json` is available relative to `index.html`.

### Styles look incomplete

Tailwind is loaded from a CDN, so verify the browser can reach it. The custom stylesheet contains Tailwind `@apply` rules; these need Tailwind processing to take effect in a standalone stylesheet. Replace them with plain CSS or add a Tailwind build step if those rules are needed without processing.

### `npm run fetch` fails

Verify Node.js 20+ is installed and the machine can reach GitHub's raw-content endpoint.

## License

This project is licensed under the [MIT License](LICENSE).
