# Atlas Intelligence: Project Context

Last updated: 2026-07-27

This file exists so any coding tool (Antigravity, Dyad, OpenCode, whatever's available at the time) can pick up this project with full context, without needing the raw chat history. Read this in full before doing any work.

## Keep This File Updated

This is the master reference, the one place that holds not just the current rules but the reasoning behind them. Whenever a session results in a real decision (a schema change, a new workaround, a scope change, a design lock-in, a known gap being deferred, a step being completed), update the relevant section of this file as part of that same response, including a short note on *why*, not just *what*. Don't wait to be asked separately.

**If `AI_RULES.md` also exists in this project and is accessible to you right now, update it too, in the same response**, keeping that version short (rule only, drop the backstory). Don't just flag that it needs syncing, actually make the edit.

**If `AI_RULES.md` is not accessible to you in this session**, say so explicitly and give the user the exact short-form text to paste into `AI_RULES.md` themselves. This matters especially because tools like Dyad only ever read `AI_RULES.md` automatically and have no visibility into this file unless it's manually shared, so a decision made here can silently never reach Dyad if the sync doesn't happen deliberately.

**Also update `README.md`** whenever the change is one a repo visitor should see: a new "Budget Workarounds" entry for any £0-budget-driven architectural decision, or a roadmap update for scope/module changes. Do this as the decision is made, not retroactively.

## What This Project Is

Atlas Intelligence is an institutional-grade market intelligence platform, built solo as a CV project for Sales & Trading / Commodities / Capital Markets recruiting. 4-week timeline, £0 budget, roughly 10-15 hrs/week.

Not "another finance dashboard." The platform is meant to answer four questions:
1. What happened in the markets?
2. Why did it happen?
3. Why does it matter?
4. What should traders watch next?

## Scope (V1, do not expand beyond this without asking)

Five modules only:
1. **Markets Dashboard**: live and historical prices for a fixed watchlist
2. **News Engine**: pulls financial news, AI-summarizes each article, explains why it matters, tags affected assets
3. **Morning Brief**: generated daily summary combining overnight moves, main driver, today's key risk events
4. **Economic Calendar**: upcoming data releases with importance, previous/forecast/actual, plain-English explanation of what each metric measures and why traders watch it
5. **Commodities deep-dive**: overview, price, supply/demand context, news, per top 5-6 commodities

Everything else from the original brainstorm (fixed income tools, FX carry calculators, geopolitical map, trade journal, research library, correlations) is explicitly OUT OF SCOPE for V1. These are logged as "planned" in the README roadmap, not built.

**If a request would expand scope beyond these five modules, say so explicitly and ask before building it.**

## Fixed Watchlist (16 assets, do not add instruments without asking)

- Indices: S&P 500, Nasdaq 100, Dow Jones, FTSE 100, Euro Stoxx 50
- FX: EUR/USD, GBP/USD, USD/JPY, DXY (US Dollar Index)
- Rates: US 10Y Treasury yield, US 2Y Treasury yield
- Commodities: WTI Crude, Brent Crude, Gold, Natural Gas, Copper

(Commodities list intentionally matches the top 5-6 used in the deep-dive module.)

## Tech Stack

- Next.js (App Router), TypeScript, Tailwind CSS v4
- Supabase (database, not using auth)
- Recharts for charting
- Python only if a scheduled ingestion job genuinely needs it, otherwise everything stays in the Next.js/TypeScript codebase
- Vercel for deployment
- `src/` directory structure (`/src/app`, `/src/components`, etc.), config files at root

## Data Sources and Caching Strategy

- **FRED**: macro data (rates, end-of-day only, no live price)
- **Finnhub**: quotes, news, calendar (free tier caps at 60 calls/minute)
- **EIA**: energy data (fundamentals, not yet wired into ingestion)

**Caching approach: scheduled refresh, not on-demand TTL.** A scheduled job pulls from Finnhub/FRED/EIA and writes snapshots into Supabase. The frontend always reads from Supabase, never calls these APIs directly. This keeps calls comfortably under rate limits, keeps dashboard loads fast, and gives historical data as a side effect of snapshotting.

### Critical technical finding (verified live, not assumed)

Finnhub's free tier **returns HTTP 403 on OANDA/CFD symbols** (used for indices, FX, and true commodity spot prices). This was caught by insisting on a live API test before locking in the schema, rather than trusting the coding agent's initial confident assumption that OANDA symbols would work.

**Workaround**: equities/commodities/FX use liquid US ETF proxies on Finnhub's free tier instead, chosen specifically because they give live, flickering price updates (matching the terminal aesthetic), unlike FRED which is end-of-day only:

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

Rates (US10Y, US2Y) use **FRED directly** (series `DGS10`, `DGS2`), since bond ETF prices don't reflect yields.

All 14 ETF proxies were tested live against the real Finnhub key with a 100% success rate before the schema was locked in.

## Database Schema (Supabase, executed and verified)

**`assets` table** (pre-seeded with all 16 assets):
- `id` (uuid, PK)
- `symbol` (text, unique) — clean internal symbol, e.g. `SPX`, `EURUSD`, `WTI` (NOT a provider-specific symbol)
- `name` (text) — human readable, e.g. "S&P 500"
- `asset_class` (text) — `index` | `fx` | `rate` | `commodity`
- `finnhub_symbol` (text, nullable) — provider-specific ID for Finnhub calls
- `fred_series_id` (text, nullable) — provider-specific ID for FRED calls
- `eia_series_id` (text, nullable) — provider-specific ID for EIA calls (not yet used)
- `created_at` (timestamptz)

**`market_snapshots` table** (time-series, populated by cron):
- `id` (uuid, PK)
- `asset_id` (uuid, FK to `assets`, ON DELETE CASCADE)
- `timestamp` (timestamptz)
- `price` (numeric)
- `change_pct` (numeric, nullable — null for FRED-sourced rows, see Known Gaps)
- `change_abs` (numeric, nullable — null for FRED-sourced rows, see Known Gaps)
- `metadata` (jsonb) — provider-specific extras (previous close, volume, etc.), useful for debugging bad data

Composite index on `(asset_id, timestamp DESC)` for fast "latest snapshot per asset" queries.

RLS enabled: public read-only policies, no public write policy. Anonymous write access confirmed blocked via test script.

This schema is strictly for market price data. News Engine and Morning Brief will get their own tables in a later step, not folded into these two.

Retention: no cleanup job yet, snapshots kept indefinitely. Logged in README roadmap as "will need a retention policy eventually."

## Files Built So Far

- `src/lib/supabase/client.ts` — browser-safe client using `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `src/lib/supabase/admin.ts` — server-only client using `SUPABASE_SERVICE_ROLE_KEY`, session persistence disabled, used only by cron/ingestion
- `src/lib/data-sources/finnhub.ts` — `fetchQuote(symbol)` → typed `QuoteResult`. Explicitly guards against Finnhub's silent `{c:0, d:null}` response for invalid symbols (it returns this instead of a 4xx, so it has to be checked manually)
- `src/lib/data-sources/fred.ts` — `fetchLatestRate(seriesId)` → `{value, date}`. Skips FRED's `"."` missing-value entries automatically. Throws at runtime if `FRED_API_KEY` is empty
- `src/lib/cron/ingest-market-snapshots.ts` — core ingestion logic:
  - Single loop over all 16 assets
  - Branches per-asset on `finnhub_symbol` vs `fred_series_id` (one clean loop, two code paths inside, not separate loops/files)
  - Per-asset try/catch isolation: one failure doesn't abort the whole run
  - FRED calls check `market_snapshots` first and skip if a FRED snapshot already exists for today's date (UTC) — avoids hammering FRED for data that only updates once a day. Uses Supabase's `PGRST116` "no rows found" code as a non-error signal for "not yet fetched today"
  - 100ms defensive delay between Finnhub calls (14 calls is comfortably under the 60/min limit, this is just a burst-detection safety margin)
  - Returns an array of `{symbol, status, message}` results for the caller to tally
  - All provider metadata stored in the `metadata` jsonb field for traceability
- `src/app/api/cron/market-snapshot/route.ts` — Next.js API route:
  - Verifies a Bearer token against `CRON_SECRET` env var
  - Calls the ingestion function
  - Tallies succeeded/skipped/failed from the results array
  - Returns structured JSON with 200/401/500 status codes
  - Logs failures via `console.error()` for visibility in Vercel's Function Logs (Dashboard → Functions tab)

## Environment Variables (in `.env.local`, values filled in manually, never pasted into chat)

- `FINNHUB_API_KEY`
- `FRED_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` — generated and saved, used to secure the cron API route

## Known Gaps (logged, deliberately deferred, not forgotten)

- **FRED snapshots have null `change_pct`/`change_abs`.** Finnhub provides these natively; FRED doesn't. Deferred to the dashboard UI stage: either compute by diffing the previous snapshot, or design the UI to handle rate assets without a change column. Explicitly scoped out of the ingestion file to avoid scope creep there.
- **Retention policy** for `market_snapshots` not yet defined. Indefinite storage for now.
- Fixed income tools, FX carry calculators, geopolitical map, trade journal, research library, correlations: all out of scope for V1, listed as "planned" in README.

## Budget Workarounds (README-tracked, £0-budget-driven architecture decisions)

- **ETF proxies instead of direct index/FX/commodity pricing** on Finnhub, because OANDA/CFD symbols return 403 on the free tier (verified live, see above).
- **Scheduled Supabase caching instead of live polling/direct API calls from the frontend.**
- **External cron via cron-job.org instead of Vercel's native cron**, because Vercel's free (Hobby) tier only allows daily cron schedules (`"0 0 * * *"` minimum interval); a 5-10 minute refresh needs Vercel Pro ($20/month), which is out of budget. Instead, a Next.js API route (`/api/cron/market-snapshot`) does the actual ingestion work and is secured with a Bearer token (`CRON_SECRET`), and cron-job.org (free) hits it on a 5-10 minute schedule. Vercel has no opinion on how often its API routes are invoked, only on its own internal cron trigger frequency.
- **Live data freshness now depends on cron-job.org's uptime, not just Vercel's.** This is a real external dependency worth being explicit about, and is noted in the README.
- **FRED calls are gated behind a "did we already fetch today" check** rather than a separate daily cron schedule, since FRED only updates once a day and calling it every 5 minutes would be wasteful/risk rate limits.

## Working Habits To Maintain

1. When pasting a coding agent's ("Anti," i.e. Google Antigravity IDE) response to Claude for review, Claude should always draft a reply to send back, not just give analysis.
2. Verify technical claims before approving them, don't trust an agent's confident-sounding claim at face value. (Precedent: an unverified assumption that Finnhub's OANDA symbols would work was wrong; caught only by insisting on a live API test before locking in the schema.)
3. Before any new external API integration is treated as final (new endpoint, new symbol/series ID, new provider), write and run a small live test script against the real API/key first, and show the actual response, not a documented or assumed one. This is the standing rule that caught the Finnhub 403 issue, and it applies to every future integration the same way.
4. Before any commit presented as "done" or a milestone, and especially before anything that could be the final state a recruiter sees, actively look for bugs rather than assuming the code works because it compiled or ran once: check edge cases (empty API responses, failed fetches, a missing env var), re-read the diff against what was actually requested, and surface anything uncertain instead of staying silent about it. This project is a recruiting artifact first; quiet bugs at the end are more costly here than in a typical side project, so this check is not optional busywork.
5. Keep the README's "Budget Workarounds" section updated with every £0-budget-driven architectural decision, as they happen, not retroactively.
6. Explain new IDE/terminal/dashboard steps in small, literal, click-by-click instructions (limited technical background).
7. Never put real API keys/secrets directly in chat. Guide the user to add them to `.env.local` themselves, referencing exact variable names.
8. Break work into small, reviewable steps, one file or one small group of related files at a time. Explain approach and tradeoffs before writing code, then wait for confirmation. Don't proceed autonomously through multiple features in one run.
9. Flag technical debt as it's introduced, don't let it go unmentioned.
10. If ever about to touch more than a handful of files in one action, stop and check first.
11. Assume frequent commits. Suggest natural commit points and concise commit messages.
12. No SQL/schema changes without explicit permission each time (this was violated once when a coding agent generated a SQL file without being asked; the file was removed and the rule was made explicit).

## Design Language

Reference point: "what if a modern fintech studio redesigned a trading terminal in 2026," closer to Linear, Vercel's dashboard, or Koyfin than literal Bloomberg Terminal. Borrow the terminal's information density and seriousness, not its literal chrome.

**Hard rules (violating these means starting over):**
- No gradients, anywhere, ever
- No drop shadows on cards/panels, use borders instead
- No glassmorphism, no blur, no "frosted" panels
- No generic rounded-corner SaaS cards floating on a light-gray background ("AI slop")
- No purple-to-blue gradient buttons, no generic Inter-everywhere typography, no default shadcn look left unstyled
- No excessive whitespace or airy centered marketing-page layouts, this is a data product

**Color system (locked in, verified against the dark background before approval):**
- Base background: near-black, `#0A0B0D` (not pure black)
- Secondary surface (cards, panels): `#14161A`
- Borders/dividers: hairline, low-opacity white or `#2A2D33`
- Primary text: off-white `#E8E9EB`
- Secondary/muted text: mid gray `#8B8F98`
- Accent color: **teal** (locked in), used sparingly for active states, key CTAs, highlighted data points
- Semantic up/down colors: **Option B, Sage Green / Dusty Coral** (locked in) — deliberately desaturated, tuned down from an initial too-saturated stoplight-green/bright-red pass after visual review

**Typography:**
- Two-font system: a grotesque/geometric sans for UI chrome, labels, body text; **JetBrains Mono** (committed, not "or similar") for all numerical data (prices, percentages, yields, dates)
- Tight letter-spacing on headers/labels, slightly loosened on body copy
- Real type scale (12/14/16/20/24/32px), not ad hoc
- Uppercase, small, letter-spaced labels for section headers/category tags only, never body text

**Spacing and density:**
- Compact but not cramped, tighter than typical consumer SaaS
- Consistent spacing scale (4/8/12/16/24/32px)
- Grid-based layout, real column alignment, not flex-wrap cards of inconsistent height

**Components:**
- Cards/panels: flat fill, hairline border, no shadow, sharp corners or a small consistent radius (4-6px), never 12-16px
- Charts: thin lines, muted gridlines, no default Recharts styling untouched, tooltips styled to match dark theme
- Tables: dense rows, monospace numbers right-aligned, hairline row dividers, hover state = subtle background shift only
- Buttons: flat fill or outline, sharp/minimally rounded, no gradient fills, hover via brightness/opacity shift only
- Icons: consistent set (Lucide), consistent stroke width

**Motion:** minimal and purposeful only, fade/slide on data updates, no bouncy springs, no decorative motion, no confetti anywhere in a finance product.

**Implementation notes:**
- Tailwind v4 is in use, which eliminates `tailwind.config.ts` by default in favor of CSS variables and the `@theme` directive in the main CSS file. Design tokens (colors, shadows set to `none`, radii capped at 2-4px) live there.
- An earlier global CSS rule (`* { background-image: none !important; }`) was deliberately removed: too blunt, would block legitimate future use (chart fills, patterns). No-gradients is enforced through code discipline during build instead, not a hard CSS lock.

## Progress So Far (in order completed)

1. Project scaffolded (`src/` layout), Tailwind v4 theme configured and visually verified against the design brief on localhost
2. Design tokens locked in: teal accent, JetBrains Mono, Sage Green/Dusty Coral semantic colors, shadows/radii constrained
3. Supabase schema built, reviewed field-by-field, and executed manually via Supabase SQL Editor: `assets` (16-asset watchlist, pre-seeded) and `market_snapshots` (time-series), composite index, RLS enabled with public read-only policies, anonymous writes confirmed blocked via test script
4. Asset mapping finalized and verified live against the real Finnhub API (100% success across all 14 ETF proxy symbols) before being locked into the schema
5. Supabase client files written: `client.ts` (anon key, browser-safe), `admin.ts` (service role key, server-only, session persistence disabled)
6. Data-source wrapper functions written: `finnhub.ts`, `fred.ts`
7. Core ingestion function written: `ingest-market-snapshots.ts`
8. Cron API route written: `src/app/api/cron/market-snapshot/route.ts`
9. `CRON_SECRET` generated and saved to `.env.local`
10. cron-job.org account created (free), scheduled job not yet configured (needs a live Vercel URL first)

## Timeline Status

As of 2026-07-29: Vercel deployment, cron-job.org scheduling, and full pipeline verification are all confirmed working (16/16 assets succeeding, real rows in `market_snapshots`, FRED rows correctly showing null change_pct/change_abs as designed). Only the Markets Dashboard UI remains for Week 1. Roughly 3.5 weeks remain overall; nothing in News Engine, Morning Brief, Economic Calendar, or Commodities deep-dive has started yet.

## Itinerary (remainder of Week 1 through Week 4)

**Rest of Week 1 (this week)**
- ~~Deploy to Vercel~~ Done 2026-07-28
- ~~Configure cron-job.org to hit `/api/cron/market-snapshot` every 5 min with `Authorization: Bearer <CRON_SECRET>`~~ Done 2026-07-29
- ~~Verify the full pipeline end-to-end~~ Done 2026-07-29, confirmed live in Supabase
- Build the Markets Dashboard UI (currently only a design-system test page exists, no real dashboard UI yet): watchlist table/cards, live prices, basic charts
- Goal: Markets Dashboard fully working and deployed

**Week 2**
- News Engine: news ingestion (Finnhub news endpoint), Supabase schema for articles
- First AI integration: summarization + "why it matters" + asset tagging
- Basic News Engine UI
- Goal: News Engine functional, first AI capability shipped
- Note: deliberately scheduled early (not last) since it's the riskiest unbuilt piece, better to hit that risk with time still in reserve

**Week 3**
- Morning Brief: AI-generated daily summary combining overnight moves, main driver, today's key risk events
- Economic Calendar: data source, UI, plain-English explanation per metric, previous/forecast/actual
- Goal: both modules functional

**Week 4**
- Commodities deep-dive: per-commodity pages (overview, price, supply/demand context, news) for top 5-6 commodities
- Full pass: pre-commit bug check across all five modules (per Working Habit on this), cross-browser/mobile check, README finalized, remove or hide dev-only pages (e.g. the design-system test page) before this is shown to recruiters
- Buffer for whatever slipped from earlier weeks

## Coding Setup Note

Primary coding tool has been Google Antigravity IDE ("Anti"), an agent-based VS Code fork, splitting work between a stronger model for architecture/tricky logic and a faster/lighter model for mechanical execution once a plan is clear. If working in a different tool (Dyad, OpenCode, etc.) during any downtime, this file is the handoff: read it fully before touching code, and keep it updated with the same level of detail as new decisions get made, regardless of which tool is being used.