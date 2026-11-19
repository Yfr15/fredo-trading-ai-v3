# Fredo Trading AI — Autonomous Conservative Profile

Status: development specification only. Live execution is DISABLED.

## User-selected operating profile

- Broker target: Pocket Option
- Client interface: iPhone Safari
- Intended instrument set: existing OTC watchlist
- Analysis interval: completed 5-second candles
- Decision output: UP / DOWN / WAIT
- Risk posture: conservative
- Intended destination: live account eventually
- Current operating mode: simulation and research only

## Current verified project capabilities

The main branch already contains:
- Node.js server and mobile dashboard
- 5-second candle handling and indicator calculations (MACD 12/26, Momentum 10, OsMA)
- UP/DOWN/WAIT signals with a stale-feed WAIT guard
- An autonomous simulated-trade engine with virtual stakes, expiry, daily loss cap, consecutive-loss shutdown, open-position cap, trade cap, and cooldown
- A strategy backtest module
- A read-only data-provider adapter contract
- A separate Binance Spot reference-data option; this is not Pocket Option OTC pricing

The default synthetic feed is for software/UI testing only. It must never be described as real market data or used to claim strategy profitability. Provider mode currently refuses to open simulated trades unless a separately validated data path is implemented.

## Conservative default policy for subsequent implementation

- Live execution: hard disabled
- Broker credentials/session tokens: never requested, stored, logged, or exposed to browser code
- Synthetic data: simulation only, visibly labeled
- Provider data: accept only documented, permitted, authenticated HTTPS sources; validate schema, symbol mapping, timestamp units, candle completion, ordering, and freshness
- Missing, stale, malformed, or mismatched data: WAIT and block entries
- No martingale, loss-chasing, stake escalation, or automatic deposits
- One position per symbol; global open-position cap remains enforced
- Keep daily loss, consecutive-loss, trade-count, and cooldown stops enabled
- Every decision and simulated fill must be auditable
- Stop automatically on feed disconnect, clock anomaly, duplicate/out-of-order candles, risk-limit breach, or unexpected server restart

## Required validation gates before any live consideration

1. **Data integrity:** prove the feed represents the exact instrument and quote stream used by the broker. Third-party reference prices are not interchangeable with Pocket Option OTC quotes.
2. **Strategy validation:** walk-forward and out-of-sample testing on sufficient, correctly timestamped data; include realistic payout, latency, and rejected-entry assumptions. Report confidence intervals, drawdown, expectancy, and sample size.
3. **Forward simulation:** run unattended simulated decisions for at least 20 trading days, review logs daily, and require stable operation across multiple market conditions. This is a minimum engineering gate, not evidence of future profit.
4. **Broker authorization:** obtain written confirmation of the exact automated execution method and account/region eligibility from Pocket Option. The public offer reserves rights where trades use unauthorized bot software. Pocket Option's own educational material describes MT5 Expert Advisors as its automated strategy route; this project currently targets the web platform and does not use MT5.
5. **Separate execution service:** only after gates 1–4, design a separately isolated execution adapter with explicit broker authorization, bounded permissions, idempotency, order reconciliation, kill switch, and human-visible audit trail. No session scraping, reverse-engineered endpoints, browser clicking, or credential-sharing workaround.

## Current blocker

The current repository is a read-only research dashboard with synthetic autonomous simulation. It does not have an authorized Pocket Option web-terminal order API. Do not turn on live trading or add an unofficial session-control integration. The official public offer and regional availability must be checked against the user's actual account before any execution work.

## Next implementation tasks

- Add a dashboard mode banner that clearly distinguishes SYNTHETIC SIMULATION, VERIFIED PROVIDER DATA, and LIVE EXECUTION DISABLED.
- Add a provider certification check that refuses strategy simulation until data provenance, symbol mapping, completed-candle semantics, and freshness are explicitly verified.
- Add durable server-side audit logging and restart-safe risk-state handling for the simulator.
- Add walk-forward test reports and a minimum-sample guard; never present synthetic performance as evidence.
- Keep all execution endpoints absent until written broker authorization and a supported interface are established.
