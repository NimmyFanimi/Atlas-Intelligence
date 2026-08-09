# Atlas Intelligence

An institutional-grade market intelligence platform, built for Sales & Trading, Commodities, and Capital Markets workflows.

## Overview
Atlas Intelligence is a modern finance dashboard that answers four core questions:
1. What happened in the markets?
2. Why did it happen?
3. Why does it matter?
4. What should traders watch next?

### V1 Scope
- **Markets Dashboard:** Live and historical prices for a fixed 16-asset watchlist (Indices, FX, Rates, Commodities).
- **News Engine:** AI-summarized financial news with asset tagging.
- **Morning Brief:** Generated daily summary of overnight moves and risk events.
- **Economic Calendar:** Upcoming macro releases with plain-English explanations.
- **Commodities Intelligence:** Deep-dive module for the top 5-6 commodities.

## Architecture
- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS v4, Supabase (PostgreSQL), Recharts.
- **Data Ingestion:** Cron jobs fetch data from Finnhub, FRED, and EIA, saving snapshots to Supabase. The frontend strictly reads from Supabase to stay well under API rate limits. *(Note: To maintain a zero-cost API footprint while enabling live, flickering price updates, Indices, FX, and Commodities use liquid US ETF proxies on Finnhub for real-time pricing).*
- **Design System:** Strict adherence to a high-density, modern-fintech aesthetic. No gradients, no shadows, sharp corners, and specifically curated typography (Inter + JetBrains Mono) with a Teal accent.

## Roadmap (Post-V1)
- [ ] **Data Retention Policy:** Implement a scheduled cleanup job to prune old `market_snapshots` rows, keeping the database lean as snapshots accumulate indefinitely.
- [ ] **FRED Rate Change Display:** `change_pct` and `change_abs` are stored as `null` for US 10Y and US 2Y rate assets because FRED does not provide intraday change data. The dashboard UI will need to either display rates without a change column, or compute the change by diffing the previous day's FRED snapshot at read time.
- [ ] **Fixed Income Tools:** Add advanced bond yield and duration analytics.
- [ ] **FX Carry Calculators:** Tools for calculating forward points and carry trade returns.
- [ ] **Geopolitical Map:** Visualizing regional risks and overlapping market impacts.
- [ ] **Trade Journal & Research Library:** Persistent user state and personalized tracking.
- [ ] **Correlations Matrix:** Real-time cross-asset correlation analysis.

## Budget Workarounds (£0 API Strategy)
This project operates on a strict £0 budget for APIs and data sources. To achieve institutional-grade features on free tiers, I maintained the following architectural workarounds:

1. **Supabase Caching for Rate Limits:** The frontend never calls external APIs directly. Instead, scheduled cron jobs fetch data (every 5-15 minutes) and write snapshots to Supabase. The frontend reads exclusively from Supabase, ensuring we never breach free-tier rate limits (e.g., Finnhub's 60 calls/min) regardless of user traffic.
4. **External Cron via cron-job.org:** Vercel's Hobby (free) tier only allows cron jobs to fire once per day, which is too infrequent for live price updates. Instead, a Next.js API route (`/api/cron/market-snapshot`) handles ingestion and is triggered every 5 minutes by [cron-job.org](https://cron-job.org) (free tier). **Implication:** live data freshness now depends on cron-job.org's uptime as a real external dependency, not just Vercel's. If cron-job.org is down, snapshots go stale until it recovers.
2. **ETF Proxies for Live Pricing:** Finnhub's free tier restricts real-time OANDA (Forex/CFD) data on their `/quote` endpoint (returning 403 Forbidden). To achieve live, flickering price updates for Indices, FX, and Commodities without paying for a premium feed, I mapped the internal symbols to highly liquid US ETF proxies (e.g., `SPY` for S&P 500, `FXE` for EUR/USD, `USO` for WTI Crude).
3. **Rates vs. Yields (FRED):** Unlike other assets, this doesn't not use ETF proxies for US 10Y and US 2Y Rates. Bond ETFs track *prices*, not yields (showing e.g., $96.50 instead of 4.25%), which breaks the expected UX. Therefore, Rates are pulled directly from FRED. Since FRED is an end-of-day API, Rates update daily rather than ticking live like the rest of the dashboard.

## Scripts & Tooling

- **`scripts/check-release-dates.ts`** — Diagnostic script that checks FRED's `release/dates` endpoint for each tracked release to confirm whether a date has been published yet. Useful for distinguishing a real ingestion bug from "FRED hasn't published a date yet" (e.g. during a government shutdown or reporting disruption). Run with: `npx tsx scripts/check-release-dates.ts`
