// scripts/check-release-dates.ts
//
// Diagnostic helper for the Economic Calendar module.
//
// FRED's release schedule can lag behind real-world events (e.g. during a
// government shutdown or reporting disruption), so FRED may not yet have
// published a date for a tracked release even though the calendar currently
// shows nothing for it. This script checks FRED's `fred/release/dates`
// endpoint for each TRACKED_RELEASES entry and prints the most recent date
// found (or "NO DATES FOUND"), so a manual check can distinguish "real
// ingestion bug" from "FRED hasn't published a date yet" without touching
// the app.
//
// Run: npx tsx scripts/check-release-dates.ts
// (Reads FRED_API_KEY from the environment, sourced from .env.local via
// the dotenv import below — .env.local is loaded explicitly, NOT the
// default .env, since that's this project's actual environment file and
// plain `import 'dotenv/config'` would silently read only .env.)

import { config } from 'dotenv';
config({ path: '.env.local' });
import { TRACKED_RELEASES } from '../src/lib/data-sources/tracked-releases';

async function main() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.error('FRED_API_KEY is not set');
    process.exit(1);
  }

  for (const tracked of TRACKED_RELEASES) {
    try {
      const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${tracked.releaseId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=3`;

      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        console.log(`${tracked.eventName} (${tracked.releaseId}): ERROR — HTTP ${res.status}`);
        continue;
      }

      const data: { release_dates?: { release_id: number; release_name: string; date: string }[] } =
        await res.json();

      const dates = data.release_dates || [];

      // sort_order=desc => most recent date is first
      const label = dates.length === 0 ? 'NO DATES FOUND' : dates[0].date;

      console.log(`${tracked.eventName} (${tracked.releaseId}): ${label}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${tracked.eventName} (${tracked.releaseId}): ERROR — ${message}`);
    }

    // Courtesy delay between calls (not driven by a known rate limit)
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
