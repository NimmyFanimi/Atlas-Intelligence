# AI Rules: Atlas Intelligence

Read this before making any change. This is a solo, 4-week, £0-budget CV project (Sales & Trading / Commodities / Capital Markets recruiting). Treat every rule below as binding, not a suggestion.

A fuller reference file, `PROJECT_CONTEXT.md`, also exists in the project root with the reasoning behind these rules. You may not have it open automatically, if you have file access and it's there, read it too; if not, proceed on this file alone and flag that you couldn't check it.

## Keep This File Updated

This file is loaded automatically into every chat, so it is the single source of truth for scope, schema, and rules across sessions and across coding tools. Whenever a message in this chat results in one of the following, update the relevant section of this file as part of that same response, don't wait to be asked separately:

- A schema change (new table, new column, changed field)
- A new or changed data-source workaround (new API limitation discovered, new proxy symbol, new caching approach)
- A scope change (a module added, removed, or explicitly deferred)
- A design rule being locked in or changed (color, font, spacing decision)
- A new "Known Gap" being deliberately deferred
- Progress on "Next Steps" (mark completed items, add the new next step)

When editing, make the smallest change that keeps the file accurate, don't rewrite unrelated sections.

**If `PROJECT_CONTEXT.md` exists in this project and is accessible to you right now, update it too, in the same response**, adding a short note on *why* the decision was made, not just what changed, since that's the file's job (this one stays intentionally short). Don't just flag that it needs updating, actually make the edit.

**If `PROJECT_CONTEXT.md` is not accessible to you in this session** (for example, if you only have this file loaded and can't open others in the project), say so explicitly in your response and give the user the exact text to paste into `PROJECT_CONTEXT.md` themselves, so nothing gets lost to a sync gap between tools.

**Also update `README.md` in the same response** whenever the change is one a repo visitor should see: a new entry in the "Budget Workarounds" section for any £0-budget-driven architectural decision, or a roadmap update for scope/module changes. Don't fold README updates into "later," do them as the decision is made.

## Scope (V1, do not expand without asking)

Five modules only:
1. Markets Dashboard: live and historical prices for a fixed watchlist
2. News Engine: pulls financial news, AI-summarizes each article, explains why it matters, tags affected assets
3. Morning Brief: daily summary of overnight moves, main driver, today's key risk events
4. Economic Calendar: upcoming data releases with importance, previous/forecast/actual, plain-English explanation
5. Commodities deep-dive: overview, price, supply/demand context, news, for top 5-6 commodities

Everything else (fixed income tools, FX carry calculators, geopolitical map, trade journal, research library, correlations) is OUT OF SCOPE for V1. If a request would expand beyond these five modules, say so explicitly and ask first.

## Fixed Watchlist (16 assets, do not add instruments without asking)

- Indices: S&P 500, Nasdaq 100, Dow Jones, FTSE 100, Euro Stoxx 50
- FX: EUR/USD, GBP/USD, USD/JPY, DXY
- Rates: US 10Y Treasury yield, US 2Y Treasury yield
- Commodities: WTI Crude, Brent Crude, Gold, Natural Gas, Copper

## Tech Stack

- Next.js (App Router), TypeScript, Tailwind CSS v4
- Supabase (database only, no auth)
- Recharts for charting
- Python only if scheduled ingestion genuinely needs it, otherwise stay in Next.js/TypeScript
- Vercel for deployment
- `src/` directory structure, config files at root

## Data Sources and Critical Technical Constraint

- FRED: macro/rates data, end-of-day only
- Finnhub: quotes, news, calendar, free tier caps at 60 calls/minute
- EIA: energy fundamentals (not yet wired in)

**Caching approach: scheduled refresh, not on-demand.** A scheduled job writes snapshots into Supabase. The frontend only ever reads from Supabase, never calls these APIs directly.

**Finnhub's free tier returns HTTP 403 on OANDA/CFD symbols.** Do not use OANDA symbols for indices, FX, or commodity spot prices, they will fail. This was verified live against the real API. Instead, use liquid US ETF proxies:

| Internal symbol | Asset | Finnhub proxy |
|---|---|---|
| SPX | S&P 500 | SPY |
| NDX | Nasdaq 100 | QQQ |
| DJI | Dow Jones | DIA |
| FTSE | FTSE 100 | EWU |
| STOXX50 | Euro Stoxx 50 | FEZ |
| EURUSD | EUR/USD | FXE |
| GBPUSD | GBP/USD | FXB |
| USDJPY | USD/JPY | FXY |
| DXY | US Dollar Index | UUP |
| WTI | WTI Crude | USO |
| BRENT | Brent Crude | BNO |
| GOLD | Gold | GLD |
| NATGAS | Natural Gas | UNG |
| COPPER | Copper | CPER |

Rates (US10Y, US2Y) use FRED directly (`DGS10`, `DGS2`), since bond ETF prices don't reflect yields.

## Environment Variables (in `.env.local`, already exist, never invent new names or paste real values into chat)

`FINNHUB_API_KEY`, `FRED_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. If a new one is genuinely needed, add a placeholder line to `.env.local` and tell the user to fill in the real value themselves, don't ask for it in chat.

## Existing File Structure (check before creating new files, don't duplicate)

- `src/lib/data-sources/` — one file per external API: `finnhub.ts` (`fetchQuote`), `fred.ts` (`fetchLatestRate`)
- `src/lib/supabase/` — `client.ts` (anon key, browser-safe, use for all frontend/UI reads) and `admin.ts` (service role key, server-only, use only in cron/ingestion code, must never be imported into client-side/browser code)
- `src/lib/cron/` — `ingest-market-snapshots.ts`, the core ingestion loop
- `src/app/api/cron/market-snapshot/route.ts` — the API route wrapping ingestion, checks `CRON_SECRET`

**Preserve existing patterns in the ingestion file**, don't "clean up" during unrelated edits: the 100ms defensive delay between Finnhub calls, and per-asset try/catch isolation (one failure must not abort the whole run).

## Database Schema (already built and executed, treat as fixed unless told otherwise)

**`assets` table** (pre-seeded, 16 rows):
`id` (uuid, PK), `symbol` (text, unique, clean internal symbol like `SPX`/`EURUSD`/`WTI`, NOT a provider symbol), `name` (text), `asset_class` (`index`|`fx`|`rate`|`commodity`), `finnhub_symbol` (text, nullable), `fred_series_id` (text, nullable), `eia_series_id` (text, nullable), `created_at`.

**`market_snapshots` table** (time-series, cron-populated):
`id` (uuid, PK), `asset_id` (uuid, FK, ON DELETE CASCADE), `timestamp` (timestamptz), `price` (numeric), `change_pct` (numeric, nullable, null for FRED rows), `change_abs` (numeric, nullable, null for FRED rows), `metadata` (jsonb).

Composite index on `(asset_id, timestamp DESC)`. RLS enabled: public read-only, no public write. This schema is strictly for market price data; News Engine and Morning Brief get their own tables later, not folded into these two.

**No SQL/schema changes without explicit permission each time**, even if it seems obviously correct.

## Known Gaps (deliberate, do not silently "fix")

- FRED snapshots have null `change_pct`/`change_abs` by design. This is deferred to the dashboard UI stage, not the ingestion layer.
- No retention/cleanup policy yet for `market_snapshots`.

## Budget Workarounds (do not undo these to "simplify")

- ETF proxies instead of direct pricing (see above), forced by Finnhub's free-tier 403 on OANDA symbols.
- Scheduled Supabase caching instead of live polling from the frontend.
- Cron-job.org (external, free) instead of Vercel's native cron, because Vercel's free tier only allows daily cron schedules; a Next.js API route at `/api/cron/market-snapshot` does the actual ingestion, secured with a Bearer token (`CRON_SECRET`), and cron-job.org hits it on a 5-10 min schedule.
- FRED calls are gated behind a "already fetched today" check rather than a separate schedule, since FRED only updates once a day.

## Design Language (hard rules, violating these means starting over)

Reference point: a modern fintech studio's take on a trading terminal, closer to Linear/Vercel dashboard/Koyfin than literal Bloomberg Terminal.

- No gradients, anywhere, ever
- No drop shadows on cards/panels, use borders instead
- No glassmorphism, no blur, no "frosted" panels
- No generic rounded-corner SaaS cards on a light-gray background
- No purple-to-blue gradient buttons, no generic unstyled Inter/shadcn look
- No excessive whitespace or airy centered marketing-page layouts

**Colors (locked in):**
- Background: `#0A0B0D`. Surface: `#14161A`. Borders: `#2A2D33` or low-opacity white.
- Primary text: `#E8E9EB`. Secondary text: `#8B8F98`.
- Accent: teal, used sparingly.
- Up/down: Sage Green / Dusty Coral (deliberately desaturated, not stoplight colors).

**Typography:** two-font system, geometric sans for UI/labels/body, **JetBrains Mono** (not "or similar") for all numbers, prices, percentages, yields, dates. Real type scale (12/14/16/20/24/32px). Uppercase letter-spaced labels for section headers only, never body text.

**Spacing:** consistent scale (4/8/12/16/24/32px), grid-based layout, compact but not cramped.

**Components:** flat cards with hairline borders, no shadow, sharp or small radius (4-6px max). Charts: thin lines, muted gridlines, dark-themed tooltips. Tables: dense, monospace numbers right-aligned. Buttons: flat/outline, hover via brightness shift only. Icons: Lucide, consistent stroke.

**Motion:** minimal, fade/slide only, no bounce, no decorative animation.

**Tailwind v4 note:** no `tailwind.config.ts`, tokens live in CSS via `@theme`. No global `background-image: none` CSS lock, gradient avoidance is enforced through code discipline instead.

## Working Habits

1. Verify technical claims against the real API/service before locking anything in, don't trust a confident-sounding claim at face value.
2. Before any new external API integration is treated as final (new endpoint, new symbol/series, new provider), write and run a small live test script against the real API/key first, and show the actual response. Don't assume a call will work based on documentation or a model's training data alone. This is the same standard that caught Finnhub's OANDA 403 issue before it was baked into the schema.
3. Before any commit that's presented as "done" or a milestone, or before any push that could be the final state a recruiter sees, actively look for bugs rather than assuming the code works because it compiled: check edge cases (empty API responses, a failed fetch, a missing env var), re-read the diff for the specific change requested, and flag anything uncertain instead of staying silent. This project is a recruiting artifact, quiet bugs at the end cost more here than in a typical side project.
4. Break work into small, reviewable steps, one file or small group at a time. Explain approach and tradeoffs before writing code, wait for confirmation.
5. Flag technical debt as it's introduced.
6. Never touch more than a handful of files in one action without checking first.
7. Never put real API keys/secrets directly in chat or in generated code; reference `.env.local` variable names only.
8. Explain new setup steps in small, literal, click-by-click terms.
9. Assume frequent commits; suggest a natural commit point and a concise commit message at each logical stopping point.

## Next Steps (in order)

1. Deploy to Vercel (not yet done)
2. Configure cron-job.org to hit `/api/cron/market-snapshot` every 5-10 min with `Authorization: Bearer <CRON_SECRET>`
3. Verify the full pipeline end-to-end
4. Build the Markets Dashboard UI (currently only a design-system test page exists)
5. Then News Engine, Economic Calendar, Morning Brief, Commodities deep-dive
