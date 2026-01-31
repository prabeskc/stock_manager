# Hardware Stock Manager – Iron Rod Inventory Dashboard

Modern, responsive inventory dashboard for iron rods by size (8mm, 10mm, 12mm). Frontend-only (localStorage), suitable for daily business use and deployable to Vercel.

## Features

- Add stock and deduct stock (sales) per rod size
- Track CP (weighted average cost), SP (selling price), and auto-calculate profit on sales
- Dashboard KPIs + charts (Recharts) for stock levels and profit trend
- Transactions history and basic settings (low-stock thresholds, reset)
- Persists data locally in the browser (no backend required)

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS
- Zustand (state + localStorage persistence)
- Recharts (charts)

## Local Development

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build
npm run preview
npm run test
```

If you want Google Sheets sync locally (backend + frontend together):

```bash
cp .env.example .env.local
npm run dev:full
```

If `npm`/`node` are not available on your machine, install Node.js LTS. In this workspace a portable Node toolchain is placed under `.tools/` and is ignored by git.

## Deployment (Vercel)

- Import the repository into Vercel
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

`vercel.json` includes an SPA fallback route so dashboard navigation works on refresh.

## Google Sheets Sync (Recommended Secure Approach)

Do not use a `credentials.json` file in the frontend. A service-account private key must stay on the server.

This project includes Vercel Serverless API routes:

- `GET /api/sheets/import`
- `POST /api/sheets/export`
- `GET /api/sheets/meta`
- `GET /api/sheets/health`

Set these environment variables in Vercel (Project Settings → Environment Variables):

- `GOOGLE_SHEET_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (store the full key; if it contains newlines, paste it with literal `\n`)
- `SHEETS_SYNC_TOKEN` (random password you choose; required for Import/Export)

In the app, go to Settings → Google Sheets Sync and enter the same Sync Token before importing/exporting.

For local development, copy `.env.example` → `.env.local` and fill values. Note: Vite `npm run dev` does not automatically run Vercel serverless routes; use a Vercel dev workflow if you want `/api/*` locally.

Alternatively, this repo includes a local Express backend for development that proxies through Vite:

- Start backend: `npm run server` (defaults to `http://localhost:8787`)
- Start both: `npm run dev:full`

### Always-On Sync (Access From Anywhere)

The app supports automatic sync when Auto Sync is enabled:

- On startup: imports the latest data from Google Sheets
- On change: exports updates to Google Sheets (debounced)
- Background: checks a `Meta` sheet timestamp and imports if it changed

This is designed for convenience (last-write-wins). If you edit from two devices at the same time, the most recent export will overwrite previous changes.

### Troubleshooting Sync (Stale Data)

- Open Settings → Google Sheets Sync and check the Sync Status (last import/export, errors, failures).
- Confirm the sheet is shared with your service account email (`GOOGLE_CLIENT_EMAIL`) with Editor access.
- Check the server health endpoint (requires the sync token header):
  - `GET /api/sheets/health` with header `x-sync-token: <your token>`
  - Look at `meta.updatedAt` to confirm the sheet is being updated.

## Security Note

This repo previously contained a service-account `credentials.json` with a private key. If that file was ever committed or pushed, treat it as compromised and rotate/revoke the key in the provider console. Do not store secrets in the frontend or commit them into the repository.
