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
2. News Engine: pulls financial news, AI-summarizes each article, explains why it matters, tags affected assets — **DONE**
3. Morning Brief: daily summary of overnight moves, main driver, today's key risk events — **IN PROGRESS (Week 3)**
4. Economic Calendar: upcoming data releases with importance, previous/forecast/actual, plain-English explanation — **IN PROGRESS (Week 3)**
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

**`news_articles` table** (Week 2, time-series, cron-populated): `id` (uuid, PK), `marketaux_uuid` (text, unique, dedup key), `title` (text), `description` (text, nullable), `url` (text), `image_url` (text, nullable — added after initial table creation, existing rows from before this column existed permanently have `image_url = NULL` since upsert uses `ignoreDuplicates: true`), `source` (text, nullable), `published_at` (timestamptz), `sentiment_score` (numeric, nullable — averaged from Marketaux's per-entity scores), `matched_asset_ids` (uuid array, FK-style references into `assets.id`, can be empty), `is_macro` (boolean — independent of `matched_asset_ids`, not mutually exclusive), `ai_analysis` (jsonb: `{what_happened, why_it_matters, trade_read}`, null until phase 2 analysis runs), `ai_model_used` (text, nullable), `created_at`. GIN index on `matched_asset_ids`, partial index on rows where `ai_analysis IS NULL`, public-read RLS matching `assets`/`market_snapshots`. **Note**: this table existed in production before it was correctly tracked in `supabase_schema.sql` (schema drift from initial creation), this has since been fixed retroactively, the file now matches production.

**No SQL/schema changes without explicit permission each time**, even if it seems obviously correct.

## Known Gaps (deliberate, do not silently "fix")

- FRED snapshots have null `change_pct`/`change_abs` by design. Handled in the dashboard UI with an explicit "n/a" fallback, not a bug.
- No retention/cleanup policy yet for `market_snapshots`.
- **Historical fix, resolved but worth knowing:** `markets.ts`'s snapshot query originally used ascending order with no explicit `.limit()`, which silently hit Supabase's 1000-row default cap and served data that was stale by up to a day. Fixed by switching to descending order with an explicit limit, then reversing in JS. Any future query touching `market_snapshots` across multiple assets/a wide time window must set an explicit `.limit()` sized to the actual expected row count, never rely on the default cap.
- **Resolved: News Engine's AI model is Gemini 3.6 Flash**, chosen after a live output-quality comparison against Groq/Llama 3.3 70B. Gemini won clearly on analytical depth (real mechanisms, specific cross-asset trade expressions); Groq was competent but leaned generic/restated the article. Confirmed free-tier rate limit: 5 RPM, 250K TPM, observed peak usage ~3 RPM.
- **Resolved: 30D chart short-window issue was data-maturity, not a bug.** The `market_snapshots` cron only began real production runs ~Aug 4, 2026, so a 30-day query legitimately only had ~4 days of history to return. Resolves itself automatically as history accumulates; revisit only if still truncated by early September 2026.
- 9 backend security gaps flagged by a Kimi K2.7 proof-of-concept review (non-constant-time cron-route secret comparison on `/api/cron/market-snapshot` specifically — the newer `/api/cron/news-ingest` route already uses `timingSafeEqual` correctly, missing `server-only` guard on the Supabase admin client, API keys in URL query strings, no runtime schema validation on Finnhub/FRED responses, no rate limiting on cron endpoints, no HTTP security headers in `next.config.ts`, error responses leaking config state, GET used for a mutating cron route, public RLS read access). Logged as reference only, not yet actioned.

## Budget Workarounds (do not undo these to "simplify")

- ETF proxies instead of direct pricing (see above), forced by Finnhub's free-tier 403 on OANDA symbols.
- Scheduled Supabase caching instead of live polling from the frontend.
- Cron-job.org (external, free) instead of Vercel's native cron, because Vercel's free tier only allows daily cron schedules; a Next.js API route at `/api/cron/market-snapshot` does the actual ingestion, secured with a Bearer token (`CRON_SECRET`), and cron-job.org hits it on a 5-minute schedule.
- FRED calls are gated behind a "already fetched today" check rather than a separate schedule, since FRED only updates once a day.
- **5-minute cron cadence chosen over 1-minute** specifically to stay within Supabase's 500MB free-tier storage cap across the project's expected year-long lifespan (see Data Sources section above for the math).
- **Marketaux chosen over Finnhub's news endpoint** for News Engine: free tier easily covers actual usage (news polling doesn't need high frequency), and its built-in entity-tagging + sentiment scoring removes the need to build that logic from scratch.
- **Claude's API was ruled out for News Engine's AI layer** despite being the most thematically fitting choice, because it has no ongoing free tier (only a one-time ~$5 trial credit), which conflicts with the £0 budget. **Resolved: Gemini 3.6 Flash chosen** over Groq/Llama 3.3 70B after a live output-quality comparison (see Known Gaps).
- **News ingestion capped at `MAX_ARTICLES_PER_RUN=2` with `DELAY_BETWEEN_CALLS_MS=800`**, specifically to fit inside cron-job.org's hard 30-second free-tier timeout, after real production timeout failures at higher throughput. News cron runs every 2 hours, not 5 minutes like market snapshots, since news doesn't need price-like freshness and Marketaux's free tier is ~100 requests/day.

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

**News Engine detail view uses a full-screen modal overlay (page blurred + dimmed behind it), not a side panel — this is intentional and permanent, do not "fix" it to match the Markets Dashboard.** The two modules deliberately use different detail-view interaction patterns: Markets Dashboard keeps its right-column side panel because cross-referencing a chart against the watchlist benefits from staying visible; News Engine uses a modal because reading an analyst note is a focused single-item task that benefits from full attention. Do not unify these without being explicitly asked.

**The News Engine's sentiment gauge is officially named the "Sentimeter"** (needle-and-arc gauge, -1 to +1 scale, exact numeric readout centered beneath the needle). Use this name in code, UI copy, and docs, not generic terms like "sentiment gauge." It only appears in the News Engine modal, not on the smaller card (removed from the card, illegible at that size). Teal only for the arc fill (dim-to-bright gradient), never sage/coral, never a traffic-light gradient.

**News card/modal image fallback (when `image_url` is null) uses a 5-color palette keyed to asset class**, not a flat teal-only fill: teal=indices, purple=FX, pink=rates, coral=commodities, gray=macro-only/no matched asset. Same family as existing design tokens, no clashing new hues.

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

As of 2026-08-08: **Week 1 and Week 2 are both complete.** Markets Dashboard: fully built, polished, deployed, and its one parked bug (30D chart duplicate/missing axis labels) fixed and verified in-browser. News Engine: backend, full UI build, and a full visual redesign pass (modal detail view, Sentimeter, asset-class fallback palette, chevron navigation) all done and verified in-browser. Week 3 (Morning Brief + Economic Calendar) starting now.

## Itinerary (current source of truth, supersedes any flat list)

**Week 1: DONE.** Markets Dashboard fully working, polished, and deployed. Parked 30D chart bug resolved (see Known Gaps).

**Week 2: DONE.** News Engine fully built and redesigned.
- Backend: Marketaux ingestion, Gemini 3.6 Flash analysis, two-phase cron pipeline, all verified live in production.
- UI: card, modal detail view (converted from an initial side-panel build to a full-screen blurred/dimmed modal overlay after in-browser review), Sentimeter (renamed from "sentiment gauge," needle-and-arc redesign), 5-color asset-class fallback palette, Unified/Split feed views, prev/next chevron navigation between articles. See Design Language section for the permanent modal-vs-side-panel design fork and Sentimeter naming rule.
- Workflow established here, worth reusing for future significant UI work: build an interactive HTML mockup with real Atlas tokens first, iterate directly with the user, get sign-off, then translate into a detailed OpenCode prompt with the mockup attached, rather than describing target visuals in prose alone.

**Week 3 (starting now):** Morning Brief (AI-generated daily summary). Economic Calendar (data, UI, plain-English explanations). Not yet scoped in detail as of this update, scoping is the first task. Note: a Palantir-style causal-chain presentation idea and an "AI Observation" panel style (short analytical takes with confidence scores) were suggested externally during Week 1 and parked as relevant to News Engine/this module, worth revisiting here rather than building from scratch.

**Week 4:** Commodities deep-dive (per-commodity pages, top 5-6) → full pre-commit bug pass → cross-browser/mobile check → README finalized → remove dev-only pages before recruiter visibility → buffer.
