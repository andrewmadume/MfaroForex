# MfaroForex

A React + TypeScript trading PWA using Vite/Vinext, a Cloudflare Worker API, Drizzle, and durable D1 storage. This is a controlled demo, not a live trading service. The supplied brief had no logo image; the included symbol and wordmark are temporary brand assets.

The default market view now displays real published daily ECB reference prices and historical observations. Intraday provider integration is optional; all order execution remains simulated. See the real-market-data section below for source, timing and configuration.

## Local development

Requires Node 22.13+, npm, Git. Run `npm ci`, `npm run db:generate` only after schema edits, then `npm run build`. Apply the checked-in D1 migration once:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fat_chimera.sql
```

Use the actual migration filename under drizzle if different. Run `npm run dev` and open its localhost URL. The starter's local-only authentication emulator is available at `/signin-with-chatgpt?return_to=/`. Hosted identity is managed by ChatGPT, never by this emulator. `npm start` previews the production Worker; hosted sign-in is not emulated there.

`node --experimental-strip-types --test tests/trading.test.ts` runs financial and PWA tests. `npx tsc --noEmit` typechecks. The API integration test requires an authenticated local preview; see tests/api-smoke.mjs.

## Routes and implementation

- `/welcome`: public product introduction and risk warning.
- `/login`: real provider-managed sign-in, account creation, verification, recovery, and MFA. Dedicated password forms are deliberately delegated to the identity provider.
- `/`: responsive workspace with Overview, Markets, Trade, Positions, History, Settings.
- `/api/terminal`: authenticated GET state and POST order/close/modify/watchlist/preferences operations.
- `/manifest.webmanifest`, `/sw.js`, `/offline.html`: install metadata and safe offline fallback.

The optional synthetic practice chart offers candles, UTC timeframes, zoom, pan, crosshair, synthetic volume, SMA20, RSI14, MACD12/26 and Bollinger Bands. This is an exploratory demo implementation, not a certified analytical or execution engine. Rates and candles in that optional practice view are deterministic synthetic examples, not historical observations or a live feed. Pending orders and protective levels are stored but never triggered automatically. All demo commission and swap are zero and identified as such.

## Persistence and authentication

Hosted Sites uses D1, an SQLite database. PostgreSQL is not connected. The optional `database/postgres.sql` describes a future PostgreSQL schema with ownership policies; it is not an applied production migration or a working PostgreSQL driver. A single versioned JSON ledger per provider-scoped user isolates demo account state. Optimistic compare-and-swap prevents concurrent mutations from silently overwriting an account. Successful events and idempotency results persist with the ledger. Request limits persist independently, including rejected attempts. Duplicate orders reuse their submission key. Conflicts and ambiguous network failures are not shown as executions; retry the same key and refresh state.

Provider authentication is enforced server-side. Hosted dispatch injects verified identity headers. Never expose the Worker origin as an independently accessible deployment that trusts arbitrary identity headers. All data access uses the provider user ID, parameterized SQL, same-origin JSON mutation requests, and no-store responses. Secrets are not sent to the frontend.

## Demo trading lifecycle

Sign in, choose a pair, set direction and volume (0.01–10 lots), optionally set protective levels, review, then confirm. The server validates direction, size, prices, free margin, and duplicate keys before a demo execution is persisted. Closing a position realizes its spread-inclusive result in ZAR. Pending orders reserve margin; cancellation releases it. The demo uses 1:100 leverage and fixed conversion rates, with no funding, deposits, or withdrawals.

## Deployment

The tracked `.openai/hosting.json` contains the existing Site identity and DB binding. Do not recreate the Site. Use the Sites source workflow to push the exact source, build the Worker, apply generated D1 migrations, save the artifact version, and deploy privately. Use `node <Sites plugin>/scripts/build-site.mjs` for the supported build. Hosting must provide HTTPS, the verified identity gateway, and D1. Keep private access until controlled acceptance testing is complete. The service worker caches only its explicit public offline assets, never authenticated HTML, account JSON, tokens, or POST requests.

## Broker integration and live release prerequisites

`lib/trading.ts` defines `BrokerAdapter` and the only enabled implementation, `DemoBroker`. No live provider SDK or credentials are included. Implement a separate asynchronous broker adapter and server-side order orchestration before any live release; do not replace demo balances with guessed live values. Resolve broker/account support and permissions with the selected provider. Add market-data streaming with timestamps, stale-feed cutoffs, market sessions, and provider precision/volume/stop constraints. Fetch authoritative balances, fills, margin, fees, swaps, partial fills, and history. Persist broker order IDs and reconcile delayed acknowledgements before retrying. Exercise insufficient margin, timeout, rejection, partial execution, disconnection, duplicate, and close/modify behavior against the provider's demo account.

Before live activation: select a licensed provider and legal operator; obtain legal review of applicable South African financial-services/FSCA, AML/KYC, and POPIA obligations; establish terms, privacy controller, retention and incident policies; configure secret storage and rotation; add explicit per-account permissions, live risk limits, step-up confirmation and emergency disable; validate backups and recovery; run independent security review and broker acceptance tests. Do not accept client funds or provide deposits, withdrawals, custody, or financial advice without appropriate integrations and permissions.

## Security checklist and known limits

Implemented: provider-owned identity; server authorization; origin checks; JSON-only mutations; bounded body size; persisted per-user write limits; parameterized SQL; optimistic concurrency; idempotent submission keys; validated demo orders; server confirmations; audit events; no private SW caching; offline trade disable; accessible dialogs and focus trapping.

Before production: independently verify deployment identity isolation and headers; configure CSP/security headers appropriate to hosting; audit dependencies; set edge-level anonymous and volumetric rate limits; separate immutable audit storage; encrypt any future broker secrets; apply retention/export/delete workflows; add monitoring, backups and alerts; verify mobile installability on real Android/desktop devices. The demo JSON ledger is intended for controlled testing and needs normalized storage and archival before large-scale usage. Preferences record notification opt-in only; no email/push delivery is configured. Public launch, email-password authentication, a live data feed, live adapter, automatic pending/stop execution, and production PostgreSQL remain unimplemented.

On restricted Windows sessions, scripts/windows-profile.mjs supplies a tool-cache naming fallback if os.userInfo() is unavailable. It does not modify OS permissions or application identity.


## Verification record (28 October 2026)

The initial production build and typecheck passed. The nine Node unit tests pass, and the local database-backed API test covers authenticated persistence, spoofed-header denial, origin/content-type protection, rejected orders, idempotency, modifications, and closures. Production dependencies were patched after the starter audit; `npm audit --omit=dev --audit-level=high` reports zero known vulnerabilities. This does not substitute for a full application security review. The final source includes `npm test`, `npm run test:api`, and `npm run typecheck` commands.

## Vercel deployment (29 October 2026)

The repository supports two separate runtimes. `npm run build` retains the existing Sites/Vinext Cloudflare Worker output in `dist/`. Vercel must use `npm run build:vercel`, which invokes native Next.js and generates `.next/routes-manifest.json`. The checked-in `vercel.json` selects the Next.js framework, that build command, `.next` output, and `npm ci --include=dev --include=optional`. Use repository root `./`; do not set the output to `dist`, `public`, or `out`. The missing routes-manifest error was caused by running the Worker build under Vercel's Next.js preset.

For local Vercel-equivalent verification, run `npm run build:vercel`, then `npm run start:vercel -- --port 3100`. Use `npm run dev:vercel` for native Next development. The existing `npm run dev` and `npm start` remain Cloudflare-specific. Vercel does not require the Sites publishing helper or a Cloudflare Worker build.

The public demo preview and charts render without external credentials. To enable authenticated demo accounts on Vercel, create a GitHub OAuth application and set the following Vercel server environment variables, then redeploy:

- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: OAuth app credentials, not a personal access token. Register `https://YOUR-PRODUCTION-DOMAIN/auth/callback` as the callback.
- `MFARO_PUBLIC_URL`: exact HTTPS production origin (no path). Keep preview deployments unconfigured or use a separate OAuth app matching the preview origin.
- `MFARO_SESSION_SECRET`: independently generated random secret of at least 32 characters. Rotate to invalidate all Vercel sessions.
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_API_TOKEN`: an existing D1 database and server-only API token with D1 permissions. Apply the checked-in SQL migration once to a NEW database; do not replay it against the already-migrated Sites database. The Sites-managed database credentials are not automatically available to Vercel. A separately provisioned D1 database can be used.

GitHub sign-in uses OAuth state validation and an eight-hour HMAC-signed HttpOnly/Secure/SameSite=Lax cookie. Tokens are used only during the callback and are not persisted. Identity headers supplied by visitors are ignored on Vercel. The Sites Worker establishes request-local trusted context and retains its provider-managed ChatGPT identity and native D1 binding. GitHub user IDs use a separate namespace; accounts are not silently linked or migrated between identity providers.

Missing configuration fails closed: sign-in returns a clear configuration error, protected account APIs reject anonymous access, and an unavailable database never produces a successful trade. Vercel filesystem/in-memory storage is not used for financial state. No real broker keys are needed for this demo and live execution remains disabled. Real GitHub OAuth and remote D1 integration need acceptance testing with the operator's credentials before wider use.

## Real forex prices and charts (29 October 2026)

Market data is now separate from the simulated broker ledger. The default `FOREX_PROVIDER=frankfurter` uses Frankfurter v2's European Central Bank provider endpoint over HTTPS. It needs no key. All seven supported pairs are derived from matching-date EUR reference observations, including USD/ZAR and EUR/ZAR. The market list, watchlist prices, and default chart display actual published observations with source and price date. Daily percentage change compares the last two published observations. Reference data is delayed daily data, not live trading prices, executable bid/ask, or spreads. The reference chart is a line chart; OHLC candles and volume are never invented from daily reference values. Observations older than five calendar days are flagged stale.

For intraday indicative quotes and genuine OHLC candles, set `FOREX_PROVIDER=twelvedata` and `TWELVE_DATA_API_KEY` as a server-only Vercel environment variable, then redeploy. Your provider plan must cover the requested currency pairs and intervals, credits, and any public display/redistribution rights. Coverage, delay and permitted usage must be verified with the provider. The app supports 1m, 5m, 15m, 30m, 1h, 4h, 1D and 1W when that provider is selected. Quotes and history are polled once per minute; this is not a tick stream. The quote endpoint supplies indicative last prices, not executable broker bid/ask. No paid plan is purchased or provisioned by this source change. The Twelve Data integration has fixture-based tests; acceptance with a real API key remains necessary.

Public endpoints: `GET /api/markets` returns real quote metadata; `GET /api/markets/history?symbol=EUR%2FUSD&interval=1D` returns timestamped history. Requests are bounded to the instrument/interval allowlist. Public market results are cached for up to 60 seconds; account and order responses remain no-store. Provider outages, quota errors, plan rejection and malformed data produce explicit errors with no synthetic fallback. The UI preserves a previously fetched chart only with a connection-error notice; it does not relabel that chart as fresh.

The separate synthetic practice chart remains available through an explicit toggle. Demo ticket quotes, balances, margin, conversion rates and position P&L remain the original fixed training model. The ticket warns that these quotes are unrelated to real market observations. Orders never execute against the public data feed. Real-money execution remains disabled.

Verification: `npm test` includes provider normalization, cross-rate calculation, stale timestamps, missing credentials, quota errors, invalid OHLC and refusal to fabricate fallback prices. With the native Next server running, `node tests/market-live-smoke.mjs` verifies the actual public API connection and history. The production build is `npm run build:vercel` for Vercel. When switching between native Next and Vinext locally, regenerate native route types with `node node_modules/next/dist/bin/next typegen` before a standalone TypeScript check; their generated `.next/types` files differ.

Provider references: https://frankfurter.dev/ and https://twelvedata.com/docs .
