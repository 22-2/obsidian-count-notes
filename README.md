# Count Novels Plugin

Count Novels automatically tracks how many characters you write inside Obsidian. Pick a single tag (default: `novel`), keep writing, and the plugin will log daily/hourly progress, refresh a dedicated sidebar view, and show how fresh your latest measurement is via the status bar.

## Features

- **Tag-based collection** – scans every markdown note that carries the configured tracking tag (inline `#tag` or frontmatter `tags`) and counts characters excluding frontmatter.
- **Automated sampling** – runs once during plugin startup and every 10 minutes afterward; you can also trigger “Collect Data Manually (Debug)” from the command palette.
- **Persistent stats** – stores totals, daily deltas, and hourly deltas in IndexedDB (`obsidian-count-novels-db`) while user settings + last view state stay in Obsidian’s `data.json`.
- **Progress view** – adds a ribbon icon (`chart-column-big`) that opens the Count Novels view with tabs for day / week / month / year, summaries (total, averages, streak), and a Chart.js bar chart with an average line.
- **Status bar indicator** – shows `Count Novels: Measured …` based on the last successful collection timestamp so you can confirm sampling is alive.
- **Structured logging** – uses `loglevel`; switch between `debug` and `info` from the plugin settings.

## Quick Start

1. **Install dependencies**

   ```powershell
   pnpm install
   ```

2. **Develop locally** – keep the watcher running during Obsidian development.

   ```powershell
   pnpm dev
   ```

3. **Link into a vault** – copy `manifest.json`, `main.js`, and `styles.css` from the repository root into `Vault/.obsidian/plugins/obsidian-count-novels/`, then reload Obsidian and enable the plugin.

4. **Configure** – open *Settings → Community Plugins → Count Novels Plugin* and set:
   - `Tracking Tag` (defaults to `novel`).
   - `Show Debug Messages` toggle (sets `logLevel` to `debug` or `info`).

5. **Verify data collection** – write in a tagged note, run the “Collect Data Manually (Debug)” command, and watch the status bar change to “Measured just now.”

## Usage Guide

### Collection Schedule
- On plugin load (`onload`): loads settings/data, collects data once, updates the status bar, and refreshes open Count Novels views.
- Every 10 minutes: `DataCollectionService.collectData()` runs via `window.setInterval` and records only positive deltas (negative/zero differences just update the stored total).

### Count Novels View
- Open via the ribbon icon or the “Open Count Novels Home” command.
- Tabs (`TabComponent`) switch between `day`, `week`, `month`, `year`; the selection persists in `data.json`.
- `StatsComponent` shows:
  - Day: today’s total, 4-hour average, streak.
  - Week / Month / Year: period total, daily average (writing days only), streak.
- `ChartComponent` renders a bar chart that matches the selected period and overlays an average annotation line. Hourly charts aggregate 4-hour slots (`00, 04, 08, 12, 16, 20`).

### Status Bar Indicator
- Text appears immediately after the first successful collection.
- Updates every minute; phrases:
  - `Count Novels: No data collected yet` – nothing stored.
  - `Count Novels: Measured just now` – collected within the last minute.
  - `Count Novels: Measured X minutes ago` – simple minute delta.

## Data Model

### `data.json`
```jsonc
{
  "settings": {
    "logLevel": "debug",
    "trackingTag": "novel"
  },
  "lastViewState": {
    "period": "month"
  },
  "lastCollectedAt": "2025-10-02T10:00:00.000Z"
}
```

### `obsidian-count-novels-db` (IndexedDB via idb)

| Table          | Key                               | Value                                  | Notes |
|----------------|-----------------------------------|----------------------------------------|-------|
| `dailyStats`   | `date` (`YYYY-MM-DD`)              | `{ count: number }`                    | Only positive deltas accumulate. |
| `hourlyStats`  | `datetime` (`YYYY-MM-DD-HH`)       | `{ count: number }`                    | **HH is zero-padded** (`00`–`23`) so downstream code and tests can read consistently. |
| `misc`         | `key`                              | `{ value: any }`                       | Currently stores `lastTotalCharacterCount`. |

Keeping the `HH` section zero-padded is critical—`PeriodDataService` and the Vitest suite expect that format. Whenever you write custom fixtures, ensure keys follow `YYYY-MM-DD-08` instead of `YYYY-MM-DD-8`.

## Development

| Script              | Description |
|---------------------|-------------|
| `pnpm dev`          | Builds once and watches via `esbuild.config.mts`. |
| `pnpm build`        | Production build (minified). |
| `pnpm check-types`  | Runs `tsc --noEmit` against `src/`. |
| `pnpm test`         | Executes Vitest (unit tests + idb-backed suites). |
| `pnpm test:watch`   | Watches with Vitest. |
| `pnpm test:coverage`| Collects coverage. |
| `pnpm test:e2e`     | Playwright-based Obsidian E2E tests (needs repo CI permissions; local runs may be blocked per `AGENTS.md`). |

### Key Modules
- `src/main.ts` – plugin entrypoint, service wiring, status bar setup.
- `src/services/dataCollection.ts` – tag filtering, counting, diff computation, and stats persistence.
- `src/services/statsStorage.ts` – idb helpers for daily/hourly stats and the rolling total.
- `src/services/periodDataService.ts` – aggregates data into view-friendly stats + chart series.
- `src/CountNovelView.ts` – Obsidian view that composes tabs, stats, and chart components.

## Testing

Unit tests rely on `fake-indexeddb` and Vitest. Run them whenever you touch storage, aggregation, or view-state logic:

```powershell
pnpm test
```

The repository follows a “black-box-friendly” philosophy: tests operate through public service surfaces (`StatsStorage`, `PeriodDataService`) and validate observable outcomes like aggregated slot totals and streak calculations. For full-stack confidence, push your branch and let the GitHub workflow execute Playwright E2E scenarios (local environments lack the necessary permissions, as noted in `AGENTS.md`).

## Troubleshooting

- **No data appears in the view** – ensure at least one tagged note exists, then trigger manual collection to seed `dailyStats`.
- **Chart slot shows 0 despite recent writing** – confirm hourly documents use zero-padded keys or simply rely on `StatsStorage.updateHourlyStats`, which enforces the format.
- **Status bar stuck on “No data collected yet”** – check the console for `Count Novels: Data collection failed` errors; a malformed tag or empty vault will keep totals at 0.

Stay focused on the core workflow—tagged writing sessions flowing into reliable stats—before layering future ideas like heatmaps or goals (see `AGENTS.md` for the roadmap).
