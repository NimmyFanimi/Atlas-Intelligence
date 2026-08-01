# Atlas Intelligence: Project Context

Last updated: 2026-08-01

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
1. **Markets Dashboard**: live and historical prices for a fixed watchlist — **COMPLETE (Week 1)**
2. **News Engine**: pulls financial news, AI-summarizes each article, explains why it matters, tags affected assets — **IN PLANNING/BUILD (Week 2)**
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
- **Finnhub**: quotes, calendar (free tier caps at 60 calls/minute)
- **EIA**: energy data (fundamentals, not yet wired into ingestion)
- **Marketaux** (News Engine, Week 2): see dedicated section below

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

### Cron cadence decision (5 minutes, not 1 minute) — decided during Week 1 dashboard polish

Once the Markets Dashboard was built, the idea of moving to 1-minute cadence for the 14 Finnhub-backed assets came up, specifically to make prices visibly "tick" and flash on the dashboard, which was a real, explicitly stated feature goal. The actual math was worked through properly before deciding:

- Finnhub's 60 calls/minute cap is not the binding constraint either way: even at 1-minute cadence across 14 assets, that's only 14 calls/minute, comfortably under the cap.
- The real constraint is **Supabase's 500MB free-tier storage cap**, given this project is expected to keep running for up to a year (until a job offer lands), not just the 4-week build window.
- At 5-minute cadence: roughly 4,608 rows/day across all 16 assets, roughly 1.15MB/day at a conservative ~250 bytes/row estimate (including index overhead), roughly 420MB/year. Tight but plausible within the 500MB cap across a full year.
- At 1-minute cadence: roughly 20,160 rows/day, roughly 5MB/day, roughly 1.8GB/year, more than 3x over the free tier within a year, would hit the cap in roughly 3-4 months and force either a paid Supabase tier or building a data-retention/pruning system, both real added complexity.

**Decision: stayed at 5-minute cadence.** The "live ticking" effect is a nice-to-have, not essential to the CV story (the dashboard already demonstrates real pipeline/data-engineering thinking regardless of exact refresh interval), and it isn't worth introducing a storage-management problem or a real recurring cost for a solo CV project. If this is ever revisited, the storage math above needs to be redone with then-current Supabase pricing/limits, since those may change.

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

**Backend/ingestion (Week 1):**
- `src/lib/supabase/client.ts` — browser-safe client using `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `src/lib/supabase/admin.ts` — server-only client using `SUPABASE_SERVICE_ROLE_KEY`, session persistence disabled, used only by cron/ingestion
- `src/lib/data-sources/finnhub.ts` — `fetchQuote(symbol)` → typed `QuoteResult`. Explicitly guards against Finnhub's silent `{c:0, d:null}` response for invalid symbols (it returns this instead of a 4xx, so it has to be checked manually)
- `src/lib/data-sources/fred.ts` — `fetchLatestRate(seriesId)` → `{value, date}`. Skips FRED's `"."` missing-value entries automatically. Throws at runtime if `FRED_API_KEY` is empty
- `src/lib/cron/ingest-market-snapshots.ts` — core ingestion logic (see original notes below, unchanged)
- `src/app/api/cron/market-snapshot/route.ts` — cron API route (unchanged)

**Dashboard UI (Week 1, built after initial context file was written):**
- `src/lib/data/markets.ts` — `getMarketsDashboard()`, the main server-side data fetch used by `page.tsx`. Joins `assets` to the latest `market_snapshots` row per asset (two queries: fetch assets, fetch a recent snapshot window, group/reduce in JS rather than a Postgres RPC function). This JS-side join was a deliberate choice over a stored SQL function: at 16 assets the performance difference is unmeasurable, and keeping the logic in TypeScript is easier to read/debug/maintain for a CV project a recruiter might browse on GitHub. Also computes derived summary stats (`biggestMover`, `mostVolatile`, `breadth`, `totalAssets`) for the dashboard's summary row.
  - **Important fixed bug**: originally queried with `.order('timestamp', { ascending: true })` and no explicit `.limit()`. As real data accumulated past 1000 rows, Supabase's default 1000-row cap silently returned only the *oldest* 1000 rows in the requested window, meaning the dashboard was serving prices that were up to a day stale, with no error thrown anywhere. Caught only by manually cross-checking the dashboard's displayed timestamp against Supabase's Table Editor directly. Fixed by switching to descending order with an explicit `.limit(3000)`, then reversing the array in JS before the existing "latest = last element" logic. This is now a standing rule (see Working Habits): any query across `market_snapshots` must set an explicit limit sized to the real expected row count, never rely on the default cap.
- `src/lib/data/marketHistory.ts` — client-side fetch (`fetchMarketHistory`) powering the detail panel's timeframe selector (1H/12H/1D/7D/30D). Uses the anon/public client since it runs in the browser (confirmed RLS allows public read on `market_snapshots`). Downsamples 7D/30D results to ~120 points in JS after fetching, to keep chart rendering fast. Per-timeframe `.limit()` values were tuned twice: an initial pass under-provisioned 7D/30D (only actually covering the most recent ~17 days at a "30D" label, a real bug caught by checking actual chart output against expectations), corrected to 4000 (7D) and 15000 (30D), sized with roughly 1.7-2x headroom over the exact row count expected at 5-minute cadence. **These limits are cadence-dependent and must be recalculated if cron frequency ever changes.**
- `src/components/markets/MarketsDashboard.tsx`, `AssetSparkline.tsx`, `DetailChart.tsx` — the dashboard's UI components (sections grouped by asset class, cards/list view toggle, summary stat row, detail panel with the timeframe selector).

## Environment Variables (in `.env.local`, values filled in manually, never pasted into chat)

- `FINNHUB_API_KEY`
- `FRED_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- **Not yet added, needed for Week 2**: a Marketaux API key, and a key for whichever of Gemini/Groq is chosen for News Engine's AI layer.

## Known Gaps (logged, deliberately deferred, not forgotten)

- **FRED snapshots have null `change_pct`/`change_abs`.** Finnhub provides these natively; FRED doesn't. Handled at the dashboard UI stage with an explicit "n/a" fallback in the formatting layer, not computed by diffing (kept simple deliberately).
- **Retention policy** for `market_snapshots` not yet defined. Indefinite storage for now, revisit if the 5-minute cadence storage math (see above) ever looks tight again.
- Fixed income tools, FX carry calculators, geopolitical map, trade journal, research library, correlations: all out of scope for V1, listed as "planned" in README.
- **News Engine's final AI model is not yet chosen** (Gemini 3 Flash vs Groq/Llama 3.3 70B), pending a live output-quality test. See Week 2 section below for the full reasoning.

## Budget Workarounds (README-tracked, £0-budget-driven architecture decisions)

- **ETF proxies instead of direct index/FX/commodity pricing** on Finnhub, because OANDA/CFD symbols return 403 on the free tier (verified live, see above).
- **Scheduled Supabase caching instead of live polling/direct API calls from the frontend.**
- **External cron via cron-job.org instead of Vercel's native cron**, because Vercel's free (Hobby) tier only allows daily cron schedules; a Next.js API route (`/api/cron/market-snapshot`) does the actual ingestion work and is secured with a Bearer token (`CRON_SECRET`), and cron-job.org (free) hits it on a 5-minute schedule.
- **5-minute cadence chosen over 1-minute**, specifically to stay under Supabase's 500MB free-tier storage cap across the project's expected year-long lifespan. Full math in the dedicated section above. This was a deliberate tradeoff against a "live ticking price" feature the user genuinely wanted, decided against after working through real numbers rather than assumed.
- **FRED calls are gated behind a "did we already fetch today" check** rather than a separate daily cron schedule, since FRED only updates once a day and calling it every 5 minutes would be wasteful/risk rate limits.
- **Marketaux chosen over Finnhub's news endpoint for News Engine**, decided during Week 2 planning. Finnhub's news is per-symbol (one call per ticker, no batch), has no built-in sentiment or entity tagging, meaning that logic would need to be built from scratch. Marketaux's free tier (~100 requests/day) comfortably covers the actual expected usage pattern (news polling every few hours, not every few minutes, since news doesn't need price-like freshness), and its `/news/all` endpoint returns entities/tickers and a sentiment score (-1 to 1) per article already tagged, removing a meaningful chunk of engineering work for a module already flagged as the project's riskiest.
- **Claude's API was considered and ruled out for News Engine's AI layer.** It's the most thematically fitting choice (this is a CV project built by someone deeply familiar with Claude, and "integrated Claude's API" is a strong CV line), but Anthropic's API has no ongoing free tier, only a one-time ~$5 trial credit, which directly conflicts with the project's £0 budget constraint. Gemini 3 Flash (free tier: ~10-15 RPM, 1,500 requests/day, 250K TPM, no card required, tradeoff: free-tier prompts may be used for Google's model training) and Groq running Llama 3.3 70B (free tier: ~30 RPM, ~1,000 requests/day, 6-12K TPM, no card required, no training-data tradeoff) are the two remaining free-tier candidates. Both comfortably exceed the project's actual expected usage (roughly 10-30 AI calls/day).

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
- Accent color: **teal** (locked in), used sparingly for active states, key CTAs, highlighted data points. **Re-confirmed during Week 1 polish**: an externally-sourced design document suggested switching to amber for a "commodities/trading-floor" feel; the user explicitly decided against it, since teal was already fully implemented across every badge, sparkline, and accent throughout the built dashboard, and switching would have been a pure re-theming exercise with no functional benefit this late into the build.
- Semantic up/down colors: **Option B, Sage Green / Dusty Coral** (locked in) — deliberately desaturated, tuned down from an initial too-saturated stoplight-green/bright-red pass after visual review

**Typography:**
- Two-font system: a grotesque/geometric sans for UI chrome, labels, body text; **JetBrains Mono** (committed, not "or similar") for all numerical data (prices, percentages, yields, dates)
- Tight letter-spacing on headers/labels, slightly loosened on body copy
- Real type scale (12/14/16/20/24/32px), not ad hoc
- Uppercase, small, letter-spaced labels for section headers/category tags only, never body text
- **4-tier hierarchy established during Week 1's dedicated typography refinement pass** (this was a real, separate work session, not incidental): Tier 1 hero (prices, `text-2xl font-semibold` mono), Tier 2 primary (names/labels, `text-sm`), Tier 3 metadata (change values, day ranges, timestamps, `text-xs` muted mono, semantic up/down colors preserved), Tier 4 structural label (section/column headers, `text-xs uppercase tracking-widest`, most muted). Any new UI text should be slotted into one of these four tiers using the same values, not given a new one-off size.

**Spacing and density:**
- Compact but not cramped, tighter than typical consumer SaaS
- Consistent spacing scale (4/8/12/16/24/32px)
- Grid-based layout, real column alignment, not flex-wrap cards of inconsistent height
- **Internal dividers softened relative to primary borders** (same refinement pass): row dividers, internal card separators use a reduced-opacity version of the border color (e.g. `/50`), while primary card/section outer borders keep full contrast. This distinction should be maintained in any new component.

**Components:**
- Cards/panels: flat fill, hairline border, no shadow, sharp corners or a small consistent radius (4-6px), never 12-16px
- Charts: thin lines, muted gridlines, no default Recharts styling untouched, tooltips styled to match dark theme. **Sparklines use a flat, low-opacity (~12%) filled area beneath the line**, matching the line's own stroke color, added during Week 1 polish specifically to give thin line charts more visual weight without violating the no-gradient rule (a solid `fillOpacity`, not a `linearGradient`).
- Tables: dense rows, monospace numbers right-aligned, hairline row dividers, hover state = subtle background shift only
- Buttons: flat fill or outline, sharp/minimally rounded, no gradient fills, hover via brightness/opacity shift only
- Icons: consistent set (Lucide) where already in use; raw inline SVG is acceptable for one-off icons (e.g. carousel chevrons) rather than adding the Lucide dependency import just for a single glyph, if Lucide isn't already imported elsewhere in that file
- **Percentage change values render as small filled pill badges** (solid sage/coral/muted-gray background, near-white text), not plain colored text, added during Week 1 polish for stronger visual weight. `change_abs` (the non-percentage value) stays as plain colored text, only the percentage gets the pill treatment. Pill sizing has been a recurring subtlety: the badge component itself is `inline-flex` and correctly sizes to content, but at large parent font sizes (`text-2xl`) its fixed padding can look visually chunky/oversized even though it isn't technically "stretched" in a CSS sense — the working fix is using a slightly smaller size class (`text-lg`) for the badge specifically in large-stat contexts like the detail panel, not necessarily matching the sibling hero numbers' exact size.

**Motion:** minimal and purposeful only, fade/slide on data updates, no bouncy springs, no decorative motion, no confetti anywhere in a finance product. **All interactive elements should carry a consistent `transition-colors duration-150`** (established during the Week 1 polish pass, matching the carousel scroll-arrows' original timing), so hover/active states fade rather than snap.

**A recurring bug worth knowing about**: browser default focus/active outlines (a stark, unstyled white box) have appeared three separate times on different interactive elements during Week 1 — first on clickable list rows, then again on carousel cards (a newer component that hadn't inherited the same fix), then again on the detail chart's own SVG surface (Recharts sets `tabIndex`/`role="application"` on its `<svg class="recharts-surface">` for accessibility, which is focusable and picks up the browser default outline; the fix there was a scoped `.recharts-surface { outline: none; }` CSS rule, since Tailwind classes on parent elements can't reach Recharts' internally-rendered SVG). The general fix pattern: any clickable non-native element needs `tabIndex={0}`, `role="button"`, `focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]`; native `<button>`s need the focus-ring classes but not the `tabIndex`/`role`. Check for this proactively on every new interactive element instead of waiting for it to be visually reported again.

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
10. cron-job.org account created (free), scheduled job configured and verified running every 5 minutes
11. Deployed to Vercel (`atlas-intelligence-six.vercel.app`), all 6 env vars configured
12. Full pipeline verified end-to-end live: 16/16 assets writing real rows to `market_snapshots`
13. **Markets Dashboard UI built**: server-side data fetch (`markets.ts`), asset-class sections, list/carousel toggle view, summary stat row, detail panel
14. **Detail panel timeframe selector built** (1H/12H/1D/7D/30D), client-side fetch (`marketHistory.ts`), with downsampling for longer ranges
15. **Full visual polish pass completed**: typography hierarchy, border/spacing consistency, consistent hover/focus states, filled sparklines, pill badges for percentage changes
16. **Several real bugs found and root-caused during polish**: the 1000-row Supabase cap staleness bug, three rounds of stray browser-default focus outlines, horizontal page overflow, 7D/30D timeframe coverage math, UTC/local timezone axis-formatting
17. **Cron cadence decision made** (staying at 5 minutes, not moving to 1 minute), based on real year-long storage projections
18. **Week 2 planning started**: news source (Marketaux), tagging approach, and AI-model shortlist decided; final AI model pending a live comparison

## Timeline Status

As of 2026-08-01: **Week 1 is complete.** Markets Dashboard is fully built, polished, deployed, and verified working end-to-end, including the timeframe selector and full visual refinement pass. Week 2 (News Engine) planning has started: Marketaux is the locked news source, asset tagging will lean on Marketaux's built-in entity tagging plus separately-surfaced macro news, and the AI model for summarization is narrowed to Gemini 3 Flash vs Groq/Llama 3.3 70B pending a live quality test with a carefully engineered analyst-style prompt. Roughly 3 weeks remain overall.

## Itinerary (remainder of Week 1 through Week 4)

**Week 1: DONE.**
- ~~Deploy to Vercel~~ Done 2026-07-28
- ~~Configure cron-job.org to hit `/api/cron/market-snapshot` every 5 min with `Authorization: Bearer <CRON_SECRET>`~~ Done 2026-07-29
- ~~Verify the full pipeline end-to-end~~ Done 2026-07-29, confirmed live in Supabase
- ~~Build the Markets Dashboard UI~~ Done: sections, cards/list toggle, summary stats, detail panel
- ~~Add a timeframe selector to the detail chart~~ Done: 1H/12H/1D/7D/30D, with correct downsampling and date-aware axis formatting
- ~~Full visual polish pass~~ Done: typography hierarchy, spacing/border consistency, interaction polish

**Week 2 (in progress)**
- News Engine: news ingestion from **Marketaux** (not Finnhub's news endpoint, see Budget Workarounds for why), pulling both watchlist-tagged articles and broader macro/market news
- New Supabase schema for articles (not yet designed, do not fold into `assets`/`market_snapshots`)
- First AI integration: summarization + "why it matters" + trading-implications analysis. Asset tagging comes largely free from Marketaux's own entity tagging. **AI model choice (Gemini 3 Flash vs Groq/Llama 3.3 70B) still needs a live side-by-side test** with a properly engineered analyst-persona system prompt before being locked in; the explicit quality bar is output that reads like a thoughtful junior analyst's genuine analysis (with real trading-strategy and knock-on-effect thinking), not a generic AI-sounding recap, and both candidate free-tier models are a real step down from frontier-tier reasoning models, so this needs real prompt-engineering effort, not just picking whichever model is picked by default.
- News Engine UI: needs the same level of design iteration and scrutiny that the Markets Dashboard required, this should not be treated as a lighter-touch pass just because the Markets Dashboard already established the visual system.
- Goal: News Engine functional, first AI capability shipped
- Note: deliberately scheduled early (not last) since it's the riskiest unbuilt piece, better to hit that risk with time still in reserve

**Week 3**
- Morning Brief: AI-generated daily summary combining overnight moves, main driver, today's key risk events
- Economic Calendar: data source, UI, plain-English explanation per metric, previous/forecast/actual
- Two design ideas from an externally-sourced design document (see Design Language section context) were parked here as relevant rather than built during Week 1: a Palantir-style causal-chain presentation ("Brent Crude ▲2.4% → CAUSES: ... → IMPACT: ...") and an "AI Observation" panel style with short analytical takes and confidence scores. Both map closely to what News Engine/Morning Brief are already trying to do, worth considering here rather than building from scratch.
- Goal: both modules functional

**Week 4**
- Commodities deep-dive: per-commodity pages (overview, price, supply/demand context, news) for top 5-6 commodities
- Full pass: pre-commit bug check across all five modules (per Working Habit on this), cross-browser/mobile check, README finalized, remove or hide dev-only pages (e.g. the design-system test page) before this is shown to recruiters
- Buffer for whatever slipped from earlier weeks

## Coding Setup Note

Primary coding tool through most of Week 1 was **OpenCode** (terminal-based, not Electron), chosen after Google Antigravity IDE ("Anti") hit its free quota limit and Electron-based alternatives (Dyad, Void, NeuralInverse) were ruled out due to stability issues (Dyad caused repeated BSODs on the user's ThinkPad T470) or their own rate-limit failures. OpenCode has no file browser or diff viewer in its desktop app, so every prompt directed at it must reference exact file paths via `@filename` syntax and explicitly ask it to report back precisely what changed, file by file, since the user can't visually inspect a diff inside the tool itself.

**Models used in OpenCode during Week 1**: Kimi K2.7-Code (Hugging Face free tier, primary/reasoning, repeatedly hit account-wide HF credit exhaustion), DeepSeek V4 Flash (Hugging Face, speed/mechanical, also hit shared HF quota limits), Laguna S 2.1 / XS 2.1 (OpenRouter, generally the most reliable fallback, though it has hit provider-side rate limits under sustained heavy use in a single session). When a task requires genuine structural reasoning (not just a mechanical, well-specified fix), prefer Laguna or Kimi (if quota allows) over DeepSeek, and consider enabling a "thinking"/reasoning mode if the tool exposes one for DeepSeek specifically, since it defaults to speed over rigor.

**A real failure pattern worth knowing about**: OpenCode sessions have occasionally gone into a long, unproductive "investigation spiral" on a bug-diagnosis task, at one point spending 30+ minutes building a synthetic Chrome-headless test harness to prove a hypothesis about CSS layout behavior, when the actual fix needed only a few lines of already-visible code once directly inspected. If a session appears to be investigating for an extended period (roughly 15+ minutes) without producing any actual file changes, it's worth interrupting and redirecting it to just show the relevant code directly rather than letting it continue building test infrastructure.

If working in a different tool (Dyad, OpenCode, etc.) during any downtime, this file is the handoff: read it fully before touching code, and keep it updated with the same level of detail as new decisions get made, regardless of which tool is being used.
