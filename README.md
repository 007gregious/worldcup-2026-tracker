# FIFA World Cup 2026 Tracker

A lightweight, low-data web dashboard for following the FIFA World Cup 2026. The app displays group standings, match schedules/results, and player stat leaderboards from a preprocessed JSON data file.

## Features

- **Group standings** with played, wins, draws, losses, goals for/against, goal difference, and points.
- **Match list** grouped by date with kickoff time, score/status, and available goal/card events.
- **Player stats** for top scorers, assists, and cards.
- **Low-data frontend** that serves static HTML, CSS, JavaScript, and a compact `data/optimized.json` payload.
- **Client-side caching** via `localStorage` with a five-minute TTL to avoid unnecessary data reloads.
- **Manual refresh** button to force a fresh read of the local optimized data file.
- **Data refresh script** that fetches source tournament data from the OpenFootball World Cup JSON repository and converts it into the frontend-friendly format.

## Tech Stack

- **HTML5** for the single-page app shell.
- **Tailwind CSS CDN** for utility styling.
- **Custom CSS** for small component overrides.
- **Vanilla JavaScript** for fetching, caching, rendering, and tab navigation.
- **Node.js 20+** for the data preprocessing script.

## Project Structure

```text
.
├── css/
│   └── style.css          # Small custom CSS overrides
├── data/
│   └── optimized.json     # Frontend-ready tournament data
├── js/
│   └── app.js             # Browser app logic and rendering
├── scripts/
│   └── fetch-data.js      # Node.js data fetch/transform script
├── index.html             # Static application entry point
├── package.json           # Project metadata and npm scripts
└── README.md              # Project documentation
```

## Requirements

- **Node.js 20 or newer** for running the data refresh script.
- A static file server for local browser testing. This is recommended because browser `fetch()` calls to `./data/optimized.json` may be blocked when opening `index.html` directly from the filesystem.

No npm package installation is currently required because the project has no third-party Node dependencies.

## Getting Started

1. Clone the repository and enter the project directory:

   ```bash
   git clone <repository-url>
   cd worldcup-2026-tracker
   ```

2. Serve the project with any static web server. For example, with Python:

   ```bash
   python3 -m http.server 8000
   ```

3. Open the app in your browser:

   ```text
   http://localhost:8000
   ```

## Refreshing Tournament Data

The app reads from `data/optimized.json`. To regenerate that file from the configured upstream source, run:

```bash
npm run fetch
```

This executes `scripts/fetch-data.js`, which:

1. Downloads raw World Cup 2026 JSON data from OpenFootball.
2. Computes group standings from finished group-stage matches.
3. Extracts top scorer and card leaderboards when those fields are present in the source data.
4. Converts matches into the simplified shape used by the frontend.
5. Writes the resulting payload to `data/optimized.json`.

> Note: the script requires network access. If the upstream data shape changes, the transformation logic in `scripts/fetch-data.js` may need to be updated.

## Data Model

`data/optimized.json` contains the following top-level fields:

| Field | Type | Description |
| --- | --- | --- |
| `lastUpdated` | string | ISO timestamp for when the optimized file was generated. |
| `groups` | array | Group standings with ranked teams and table statistics. |
| `matches` | array | Match cards with date, time, status, teams, scores, and events. |
| `topScorers` | array | Top goal scorers derived from available goal event data. |
| `topAssists` | array | Assist leaders. Currently empty when the upstream source does not provide assists. |
| `mostCards` | array | Card leaders derived from available card event data. |

## Frontend Behavior

- On initial load, `js/app.js` checks `localStorage` for cached data.
- Cached data is reused for up to five minutes.
- If no fresh cache exists, the app fetches `./data/optimized.json`.
- The app renders all three tabs after data is loaded:
  - **Standings**
  - **Matches**
  - **Player Stats**
- The refresh button bypasses the cache and reloads `data/optimized.json`.
- If loading fails, the header displays an offline/error state and the app keeps showing any already-loaded in-memory data.

## Development Notes

- The app is intentionally dependency-light and does not use a build step.
- Tailwind is loaded from the CDN in `index.html`, so internet access is required for Tailwind styles unless you replace it with a local build.
- Custom CSS uses Tailwind `@apply` directives in `css/style.css`. If serving the file directly without a Tailwind build step, consider replacing those `@apply` rules with regular CSS declarations for full browser compatibility.
- The favicon is embedded as a data URI in `index.html`, so no separate icon asset is needed.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run fetch` | Fetches upstream tournament data and writes `data/optimized.json`. |

## Deployment

Because this is a static application, it can be deployed to any static hosting provider, such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or an object-storage-backed static site.

Ensure the deployed output includes:

- `index.html`
- `css/style.css`
- `js/app.js`
- `data/optimized.json`

## Troubleshooting

### The page says “Offline / error”

Make sure you are serving the project through a web server and that `data/optimized.json` is available at `./data/optimized.json` relative to `index.html`.

### Styles look incomplete

Tailwind is loaded from the CDN. Check your network connection and browser console for blocked CDN requests. Also note that raw `@apply` rules in `css/style.css` are not processed by browsers unless a Tailwind build step is added.

### `npm run fetch` fails

Confirm that you are using Node.js 20 or newer and that the machine has network access to GitHub raw content.

## License

No license file is currently included. Add a license before distributing or accepting external contributions.
