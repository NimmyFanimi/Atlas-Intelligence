# Atlas Intelligence

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**[Live Demo](https://atlas-intelligence-six.vercel.app)** · **[Documentation](https://atlas-intelligence-six.vercel.app/docs)**

An institutional-grade market intelligence platform, built for Sales & Trading, Commodities, and Capital Markets workflows.

## Overview
Atlas Intelligence is a modern finance dashboard that answers four core questions:
1. What happened in the markets?
2. Why did it happen?
3. Why does it matter?
4. What should traders watch next?

### V1 Scope
- **Markets Dashboard:** Live and historical prices for a fixed 16-asset watchlist (Indices, FX, Rates, Commodities).
- **News Engine:** AI-summarized financial news with asset tagging and sentiment scoring.
- **Morning Brief:** Generated daily summary of overnight moves and risk events.
- **Economic Calendar:** Upcoming macro releases with plain-English explanations.
- **Commodities Intelligence:** Deep-dive module for WTI, Brent, Natural Gas, Gold, and Copper, with real spot/LME pricing, historical charts, and asset-tagged related news.

## Architecture
- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS v4, Supabase (PostgreSQL), Recharts.
- **Data Ingestion:** Cron jobs fetch data from Finnhub, FRED, EIA, and Metals.dev, saving snapshots to Supabase. The frontend strictly reads from Supabase to stay well under API rate limits.
  - Indices and FX use liquid US ETF proxies on Finnhub for live, flickering price updates (see Budget Workarounds).
  - Commodities do **not** use ETF proxies. WTI, Brent, and Natural Gas are sourced directly from the EIA; Gold and Copper are sourced from Metals.dev (LME benchmark for Copper). This was a deliberate mid-project change from the original ETF-proxy plan, see Data Sourcing below.
- **Design System:** Strict adherence to a high-density, modern-fintech aesthetic. No gradients, no shadows, sharp corners, and specifically curated typography (Inter + JetBrains Mono) with a Teal accent.

## Data Sourcing

Atlas is built on a "no fabricated data" principle: if a real number isn't available, the UI shows an honest null or caveat rather than a plausible-looking guess. This section documents where each module's data actually comes from, including the tradeoffs.

### Commodities: EIA + Metals.dev
WTI, Brent, and Natural Gas prices come from the U.S. Energy Information Administration (EIA). Gold and Copper come from Metals.dev (Copper uses the LME 3-month benchmark). This replaced an earlier plan to use ETF proxies (e.g. USO for WTI) for these five assets. ETF share prices don't track 1:1 with real spot commodity prices, so real sourcing was worth the added integration effort for a Commodities-focused portfolio piece.

**Known, accepted limitation:** EIA's daily petroleum spot price table only updates weekly (Wednesdays). WTI and Brent prices shown can be up to ~8 days old at any given time. This is normal EIA publication behavior, not an ingestion bug.

Each commodity's deep-dive page shows a **"Range Since Tracking Began"** stat instead of a conventional 52-week high/low, since Atlas doesn't have a full year of real-source price history yet, and showing a fabricated or extrapolated 52-week range would violate the no-fabricated-data principle. The range shown is honest: the actual min/max recorded since real sourcing began, with the start date shown as a caveat.

### Economic Calendar: FRED + an unofficial FOMC source
CPI, NFP, GDP, and PCE release dates come from FRED's `release/dates` endpoint. FOMC meeting dates do **not** come from FRED, since FRED has no genuine FOMC meeting-calendar API. FRED's release ID commonly assumed to represent "FOMC Press Release" data is actually a daily-updating interest rate series, not a meeting calendar, and using it for calendar events was an early bug in this project (it silently inserted a false "FOMC event" for every single day). FOMC meeting dates are instead sourced from [the-calendar.net](https://the-calendar.net)'s free JSON API, a third-party, **unofficial** mirror of the Fed's published schedule. This is clearly labeled "Unofficial source" in the UI wherever it appears, since it isn't a first-party government feed.

### News Engine: the Sentimeter
Each news item's sentiment gauge (the "Sentimeter") reflects Marketaux's per-entity `sentiment_score` values, averaged across the entities tagged in that article. Marketaux doesn't provide a single article-level sentiment score, so Atlas computes one by averaging the entity-level scores it does provide.

### Rates: FRED (not ETF proxies)
Unlike other assets, US 10Y and US 2Y Rates don't use ETF proxies. Bond ETFs track *prices*, not yields (showing e.g. $96.50 instead of 4.25%), which breaks the expected UX for a rates-focused audience. Rates are pulled directly from FRED. Since FRED is an end-of-day API, Rates update daily rather than ticking live like the rest of the dashboard.

## Known Limitations & Honest Caveats

- **EIA data lag:** WTI/Brent prices can be up to ~8 days old (see Data Sourcing above). Confirmed as expected EIA behavior via three independent sources, not a bug.
- **Rate change (%, $) shows "n/a" for US 10Y / US 2Y:** FRED doesn't provide an intraday or day-over-day change figure for these series, so the change columns are honestly left blank rather than showing a fabricated or misleading number. Computing a real change (e.g. by diffing the previous day's stored snapshot) is a legitimate future enhancement, not a defect in the current build.
- **FOMC dates are sourced from an unofficial third-party mirror**, not FRED or the Federal Reserve directly, since no official free API for FOMC meeting dates exists. Clearly labeled in the UI.
- **Desktop-first by design:** Atlas is deliberately optimized for desktop, since that's how recruiters review portfolio projects. A dedicated mobile-responsive pass is planned for a future version rather than V1.
- **Cross-browser testing:** Verified working in Chrome, Firefox, and Edge. Not yet tested in Safari.

## Roadmap (Post-V1)
- [ ] **Data Retention Policy:** Implement a scheduled cleanup job to prune old `market_snapshots` rows, keeping the database lean as snapshots accumulate indefinitely.
- [ ] **Real Rate Change Calculation:** Compute `change_pct`/`change_abs` for US 10Y and US 2Y by diffing the previous day's FRED snapshot at read time, rather than showing "n/a."
- [ ] **Mobile-Responsive Pass:** Full mobile layout and interaction design (deferred from V1 by design decision, see Known Limitations).
- [ ] **Fixed Income Tools:** Add advanced bond yield and duration analytics.
- [ ] **FX Carry Calculators:** Tools for calculating forward points and carry trade returns.
- [ ] **Geopolitical Map:** Visualizing regional risks and overlapping market impacts.
- [ ] **Trade Journal & Research Library:** Persistent user state and personalized tracking.
- [ ] **Correlations Matrix:** Real-time cross-asset correlation analysis.

## Budget Workarounds (£0 API Strategy)
This project operates on a strict £0 budget for APIs and data sources. To achieve institutional-grade features on free tiers, I maintained the following architectural workarounds:

1. **Supabase Caching for Rate Limits:** The frontend never calls external APIs directly. Instead, scheduled cron jobs fetch data and write snapshots to Supabase. The frontend reads exclusively from Supabase, ensuring we never breach free-tier rate limits (e.g., Finnhub's 60 calls/min) regardless of user traffic.
2. **External Cron via cron-job.org:** Vercel's Hobby (free) tier only allows 2 total cron jobs and a once-daily minimum frequency. High-frequency ingestion routes (market snapshots, calendar, news) run on [cron-job.org](https://cron-job.org)'s free tier instead. Morning Brief, which only needs to run once daily, was migrated to Vercel's own native Cron Jobs after its Gemini generation time grew past cron-job.org's hard 30-second external timeout. Vercel's own function timeout (60s) had headroom the external watchdog didn't. **Implication:** live data freshness for the remaining routes depends on cron-job.org's uptime as a real external dependency, not just Vercel's.
3. **ETF Proxies for Indices & FX:** Finnhub's free tier restricts real-time OANDA (Forex/CFD) data on their `/quote` endpoint (returning 403 Forbidden). To achieve live, flickering price updates for Indices and FX without paying for a premium feed, internal symbols are mapped to highly liquid US ETF proxies (e.g., `SPY` for S&P 500, `FXE` for EUR/USD). **Commodities no longer use this approach**, see Data Sourcing above.
4. **Metals.dev Free-Tier Quota Management:** Metals.dev's free tier allows 100 requests/month. Gold and Copper prices are fetched together in a single batched call to conserve quota, gated behind a daily-fetch guard (mirroring the existing FRED guard pattern) so the ingestion cron, which runs every 5 minutes, only makes a real API call once per day rather than on every tick. A second free-tier API key is configured as an automatic fallback: if the primary key's monthly quota is exhausted, the ingestion logic detects the specific quota-exhaustion error and retries with the fallback key, logging when this happens so it stays visible rather than silent.
5. **Rates vs. Yields (FRED):** Unlike other assets, US 10Y and US 2Y Rates don't use ETF proxies. Bond ETFs track *prices*, not yields, which breaks the expected UX. Rates are pulled directly from FRED instead.

## Scripts & Tooling

- **`scripts/check-release-dates.ts`**: Diagnostic script that checks FRED's `release/dates` endpoint for each tracked release to confirm whether a date has been published yet. Useful for distinguishing a real ingestion bug from "FRED hasn't published a date yet" (e.g. during a government shutdown or reporting disruption). Run with: `npx tsx scripts/check-release-dates.ts`
- **`scripts/run-ingest-now.ts`**: Manually triggers a full market snapshot ingestion run outside the cron schedule. Useful for verifying ingestion logic changes live against production data without waiting for the next scheduled tick. Run with: `npx tsx scripts/run-ingest-now.ts`
- **`scripts/cleanup-bad-change-pct.ts`**: One-time cleanup utility for removing historical `market_snapshots` rows with corrupted `change_pct`/`change_abs` values from earlier cross-source comparison bugs (since fixed at the ingestion level). Kept for reference; not part of the regular operational flow.
