# Fredo Trading AI v3 — read-only OTC research dashboard

A responsive iPhone Safari dashboard with a **Node.js 18+ backend**. It displays five separate OTC instruments, 5-second candles, MACD (12/26), Momentum (10), OsMA (MACD minus 9-period signal EMA), and UP/DOWN/WAIT research signals. No Pocket Option credentials, order placement, broker login, or trading automation.

## Run locally

1. Install Node.js 18+ on a computer or hosting platform.
2. From this folder run `npm start` (no npm packages to install).
3. Open `http://127.0.0.1:3000` on that computer. For iPhone Safari, deploy the app to a trusted HTTPS host; `127.0.0.1` on the phone refers to the phone itself.
4. `npm test` validates the signal engine and candle ordering.

**Default mode is SIMULATED DEMO**, with synthetic prices for UI and indicator testing. The UI labels this prominently. Never treat simulated signals as market signals.

## Optional provider mode — not preconnected

The server has a generic read-only HTTPS JSON adapter interface. You must first obtain explicit permission and accurate documentation for your intended provider (e.g. OTCharts), implement/host a compatible adapter, verify symbol mapping and timestamp units, and confirm the data is legitimately accessible. This project **does not include a verified OTCharts endpoint or claim Pocket Option authorization**.

Set environment variables on the server (never in browser code):

- `DATA_MODE=provider`
- `PROVIDER_CANDLES_URL=https://YOUR_AUTHORIZED_ADAPTER/api/candles?symbol={symbol}`
- `PROVIDER_API_KEY=...`

Expected response: `{"candles":[{"time":1760000000000,"open":100.0,"high":100.2,"low":99.9,"close":100.1}]}`. Time is Unix milliseconds aligned to a 5-second boundary. Each record represents a **completed** 5-second candle. The backend polls each instrument every 5 seconds and never sends the key to Safari. Actual provider schemas, streaming capabilities, symbol identifiers, rate limits and licensing must be confirmed before wiring them up. Do not connect to unauthorized or undocumented endpoints.

## Safety and data integrity

- 12-second stale-data threshold forces WAIT.
- No signal before 40 completed candles.
- Rejects invalid OHLC data and out-of-order timestamps.
- Indicators must agree to display UP or DOWN; otherwise WAIT.
- Feed errors force WAIT. A server-side provider error may be displayed as a stale feed.
- Read-only GET endpoints; no order execution.
- Never publish an API key in HTML or JavaScript.
- For a public deployment, add HTTPS, access control, request limits, monitoring, and appropriate provider compliance checks.
- Safari can suspend background tabs; continuous background alerts would require an additional permitted push notification service.
- Signals are not a validated predictive model. Binary-option payouts and latency can make apparently accurate signals unprofitable.

## Project layout

`server.js` backend + indicator engine + SSE stream; `public/index.html` interface; `public/app.js` browser client; `public/style.css` mobile design; `test.js` basic smoke tests.
