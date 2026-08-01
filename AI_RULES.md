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
1. Markets Dashboard: live and historical prices for a fixed watchlist — **DONE**
2. News Engine: pulls financial news, AI-summarizes each article, explains why it matters, tags affected assets — **IN PROGRESS (Week 2)**
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

## Data Sources and Critical Technical Constraints

- FRED: macro/rates data, end-of-day only
- Finnhub: quotes, calendar, free tier caps at 60 calls/minute
- EIA: energy fundamentals (not yet wired in)
- **Marketaux**: News Engine's news source (locked in Week 2 planning). Free tier ~100 requests/day. Provides built-in entity/ticker tagging and sentiment scoring per article, ingestion should query `/news/all` filtered by watchlist symbols AND separately pull broader macro/market news even without a direct ticker match (Fed decisions, geopolitical events often explain multi-asset moves and must not be filtered out).

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

**Cron cadence is 5 minutes, deliberately not 1 minute.** At 1-minute cadence, projected storage growth exceeds Supabase's 500MB free-tier cap within roughly 3-4 months given this project's expected year-long lifespan; 5-minute cadence stays just under that cap across a full year. Do not change cadence without redoing this storage math.

## Environment Variables (in `.env.local`, already exist, never invent new names or paste real values into chat)

`FINNHUB_API_KEY`, `FRED_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. If a new one is genuinely needed (e.g. `MARKETAUX_API_KEY`, a Gemini or Groq key for News Engine), add a placeholder line to `.env.local` and tell the user to fill in the real value themselves, don't ask for it in chat.

## Existing File Structure (check before creating new files, don't duplicate)

- `src/lib/data-sources/` — one file per external API: `finnhub.ts` (`fetchQuote`), `fred.ts` (`fetchLatestRate`)
- `src/lib/supabase/` — `client.ts` (anon key, browser-safe, use for all frontend/UI reads) and `admin.ts` (service role key, server-only, use only in cron/ingestion code, must never be imported into client-side/browser code)
- `src/lib/cron/` — `ingest-market-snapshots.ts`, the core ingestion loop
- `src/app/api/cron/market-snapshot/route.ts` — the API route wrapping ingestion, checks `CRON_SECRET`
- `src/lib/data/markets.ts` — server-side dashboard data fetch (`getMarketsDashboard`), used by `page.tsx`. Uses `.order('timestamp', { ascending: false })` with an explicit `.limit(3000)`, then reverses in JS. **Do not remove the explicit descending order + limit + reverse pattern**: an earlier ascending-order fetch with no limit silently hit Supabase's 1000-row default cap and served stale data for hours before being caught. See Known Gaps.
- `src/lib/data/marketHistory.ts` — client-side timeframe-selector fetch (`fetchMarketHistory`), uses the anon/public Supabase client (not admin). Has its own explicit per-timeframe `.limit()` values (7D: 4000, 30D: 15000), sized to safely cover the full requested window at current 5-minute cadence before JS-side downsampling to ~120 points. If cron cadence ever changes, these limits must be recalculated, they are not automatically safe at a different write frequency.
- `src/components/markets/` — `MarketsDashboard.tsx` (main client component: sections, summary row, cards/list toggle, detail panel, timeframe selector), `AssetSparkline.tsx`, `DetailChart.tsx`

**Preserve existing patterns in the ingestion file**, don't "clean up" during unrelated edits: the 100ms defensive delay between Finnhub calls, and per-asset try/catch isolation (one failure must not abort the whole run).

## Database Schema (already built and executed, treat as fixed unless told otherwise)

**`assets` table** (pre-seeded, 16 rows):
`id` (uuid, PK), `symbol` (text, unique, clean internal symbol like `SPX`/`EURUSD`/`WTI`, NOT a provider symbol), `name` (text), `asset_class` (`index`|`fx`|`rate`|`commodity`), `finnhub_symbol` (text, nullable), `fred_series_id` (text, nullable), `eia_series_id` (text, nullable), `created_at`.

**`market_snapshots` table** (time-series, cron-populated):
`id` (uuid, PK), `asset_id` (uuid, FK, ON DELETE CASCADE), `timestamp` (timestamptz), `price` (numeric), `change_pct` (numeric, nullable, null for FRED rows), `change_abs` (numeric, nullable, null for FRED rows), `metadata` (jsonb).

Composite index on `(asset_id, timestamp DESC)`. RLS enabled: public read-only, no public write. This schema is strictly for market price data; News Engine and Morning Brief get their own tables later, not folded into these two.

**No SQL/schema changes without explicit permission each time**, even if it seems obviously correct.

## Known Gaps (deliberate, do not silently "fix")

- FRED snapshots have null `change_pct`/`change_abs` by design. Handled in the dashboard UI with an explicit "n/a" fallback, not a bug.
- No retention/cleanup policy yet for `market_snapshots`.
- **Historical fix, resolved but worth knowing:** `markets.ts`'s snapshot query originally used ascending order with no explicit `.limit()`, which silently hit Supabase's 1000-row default cap and served data that was stale by up to a day. Fixed by switching to descending order with an explicit limit, then reversing in JS. Any future query touching `market_snapshots` across multiple assets/a wide time window must set an explicit `.limit()` sized to the actual expected row count, never rely on the default cap.
- News Engine's AI model choice (Gemini 3 Flash vs Groq/Llama 3.3 70B) is not yet locked in as of Week 2 start, pending a live output-quality comparison. See Week 2 itinerary.

## Budget Workarounds (do not undo these to "simplify")

- ETF proxies instead of direct pricing (see above), forced by Finnhub's free-tier 403 on OANDA symbols.
- Scheduled Supabase caching instead of live polling from the frontend.
- Cron-job.org (external, free) instead of Vercel's native cron, because Vercel's free tier only allows daily cron schedules; a Next.js API route at `/api/cron/market-snapshot` does the actual ingestion, secured with a Bearer token (`CRON_SECRET`), and cron-job.org hits it on a 5-minute schedule.
- FRED calls are gated behind a "already fetched today" check rather than a separate schedule, since FRED only updates once a day.
- **5-minute cron cadence chosen over 1-minute** specifically to stay within Supabase's 500MB free-tier storage cap across the project's expected year-long lifespan (see Data Sources section above for the math).
- **Marketaux chosen over Finnhub's news endpoint** for News Engine: free tier easily covers actual usage (news polling doesn't need high frequency), and its built-in entity-tagging + sentiment scoring removes the need to build that logic from scratch.
- **Claude's API was ruled out for News Engine's AI layer** despite being the most thematically fitting choice, because it has no ongoing free tier (only a one-time ~$5 trial credit), which conflicts with the £0 budget. Gemini 3 Flash and Groq (Llama 3.3 70B) are the two free-tier candidates under live evaluation instead.

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
- Accent: teal, used sparingly. **Explicitly reconsidered and reconfirmed during Week 1 polish** (an amber alternative was suggested externally and rejected, teal stays since it's already implemented everywhere and a switch had zero functional payoff).
- Up/down: Sage Green / Dusty Coral (deliberately desaturated, not stoplight colors).

**Typography:** two-font system, geometric sans for UI/labels/body, **JetBrains Mono** (not "or similar") for all numbers, prices, percentages, yields, dates. Real type scale (12/14/16/20/24/32px). Uppercase letter-spaced labels for section headers only, never body text.

A 4-tier text hierarchy is established and should be followed for any new UI: **Tier 1 hero** (prices, `text-2xl font-semibold` mono) → **Tier 2 primary** (names/labels, `text-sm`) → **Tier 3 metadata** (change values, ranges, timestamps, `text-xs` muted mono) → **Tier 4 structural label** (section/column headers, `text-xs uppercase tracking-widest`, most muted). Don't introduce a new one-off size for something that's conceptually one of these four tiers.

**Spacing:** consistent scale (4/8/12/16/24/32px), grid-based layout, compact but not cramped. Internal card dividers should be visually softer than primary card/section borders (reduced opacity), not the same full-strength border color.

**Components:** flat cards with hairline borders, no shadow, sharp or small radius (4-6px max). Charts: thin lines, muted gridlines, dark-themed tooltips, filled area under sparklines at low opacity (~12%) for visual weight, matching the line's own color, no gradients. Tables: dense, monospace numbers right-aligned. Buttons: flat/outline, hover via brightness shift only. Icons: Lucide, consistent stroke (raw inline SVG is acceptable where a component needs a specific icon and the library isn't already imported for it, don't add the dependency just for one icon).

**Motion:** minimal, fade/slide only, no bounce, no decorative animation. All interactive elements (buttons, toggles, rows, cards) should use a consistent `transition-colors duration-150`.

**Interactive elements must never show the browser's default focus/active outline.** Every clickable non-`<button>` element (divs acting as rows/cards) needs `tabIndex={0}`, `role="button"`, and `focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]`. Native `<button>` elements need the focus-ring classes but not the `tabIndex`/`role` (already implicit). This bug has recurred three times across different components (list rows, carousel cards, a chart's own SVG surface), check for it proactively on any new interactive element rather than waiting for it to be reported.

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
10. **When any query touches `market_snapshots` (or any table expected to grow large) across multiple rows/a time range, always set an explicit `.limit()` sized to the actual expected row count at current write frequency. Never rely on Supabase's default 1000-row cap.** This is not a style preference, it caused a real, hours-long silent data-staleness bug once already.
11. When diagnosing a visual/rendering bug, investigate the actual root cause (read the library's source if needed, check compiled CSS output, trace the actual DOM/component tree) rather than guessing at a plausible-sounding fix and moving on. A guessed fix that happens to look right in one screenshot has previously turned out to be wrong in a different context (e.g. a badge-sizing fix that worked in one card but not in the detail panel, because the actual cause was different in each location).

## Timeline

As of 2026-08-01: **Week 1 is complete.** Markets Dashboard is fully built, polished, and deployed: watchlist sections, list/carousel toggle, summary stats row, detail panel with a working 1H/12H/1D/7D/30D timeframe selector, full typography/spacing/interaction polish pass done. Week 2 (News Engine) has started planning: news source, tagging approach, and the general AI-model shortlist are decided, final AI model pending a live quality comparison.

## Itinerary (current source of truth, supersedes any flat list)

**Week 1: DONE.** Markets Dashboard fully working, polished, and deployed.

**Week 2 (in progress):** News Engine.
- News source: Marketaux (locked in), not Finnhub's news endpoint. Ingest both watchlist-tagged articles and broader macro/market news.
- AI summarization/"why it matters"/asset tagging: asset tagging comes largely for free from Marketaux's entity tagging. AI model for summarization is undecided between Gemini 3 Flash and Groq's Llama 3.3 70B, pending a live side-by-side test with a carefully engineered analyst-style prompt (requirement: output must read like a thoughtful junior analyst's genuine analysis, not a generic AI recap; this is a hard quality bar and both candidate models are a real step down from frontier-tier reasoning, so prompt engineering effort matters here).
- UI: needs the same level of aesthetic care and iteration as Week 1's Markets Dashboard required, budget real design-review time, don't treat visual polish as a final pass tacked on at the end.
- This is the first AI integration, scheduled early deliberately since it's the riskiest unbuilt piece.

**Week 3:** Morning Brief (AI-generated daily summary). Economic Calendar (data, UI, plain-English explanations). Note: a Palantir-style causal-chain presentation idea and an "AI Observation" panel style (short analytical takes with confidence scores) were suggested externally during Week 1 and parked as relevant to News Engine/this module, worth revisiting here rather than building from scratch.

**Week 4:** Commodities deep-dive (per-commodity pages, top 5-6) → full pre-commit bug pass → cross-browser/mobile check → README finalized → remove dev-only pages before recruiter visibility → buffer.
