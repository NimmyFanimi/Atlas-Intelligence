// scripts/check-release-dates.ts
//
// Diagnostic helper for the Economic Calendar module.
//
// FRED's release schedule can lag behind real-world events (e.g. during a
// government shutdown or reporting disruption), so FRED may not yet have
// published a date for a tracked release even though the calendar currently
// shows nothing for it. This script mirrors the real production lookup in
// `fetchNextReleaseDate` (`src/lib/data-sources/fred.ts`) — same endpoint
// (`fred/release/dates`), same `release_id`, same `sort_order=desc&limit=20`,
// and the same "last future-dated entry (date >= today) in a descending list"
// logic — then prints both the next upcoming date it finds and the most recent
// date on record, so a manual check can distinguish "no upcoming date because
// none was published yet" from "no upcoming date found due to a logic issue"
// without touching the app.
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
      // Mirrors fetchNextReleaseDate exactly: descending sort with a small
      // limit so the newest entries (including any future-dated ones near
      // today) are returned first, without needing a limit large enough to
      // walk the release's full history.
      const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${tracked.releaseId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=20`;

      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        console.log(`${tracked.primaryName} (${tracked.releaseId}): ERROR — HTTP ${res.status}`);
        continue;
      }

      const data: { release_dates?: { release_id: number; release_name: string; date: string }[] } =
        await res.json();

      const dates = data.release_dates || [];

      const today = new Date().toISOString().slice(0, 10);

      // Same upcoming logic as fetchNextReleaseDate: filter to future-dated
      // entries (date >= today); the list stays descending, so the LAST entry
      // in the filtered array is the earliest (soonest) future-dated one.
      const upcomingDates = dates.filter(item => item.date >= today);
      const upcoming = upcomingDates.length === 0 ? undefined : upcomingDates[upcomingDates.length - 1];

      // Descending sort => the most recent date on record is the first entry,
      // before any filtering.
      const mostRecent = dates.length === 0 ? null : dates[0].date;

      if (upcoming) {
        console.log(
          `${tracked.primaryName} (${tracked.releaseId}): next upcoming = ${upcoming.date}` +
          (mostRecent ? `, most recent on record = ${mostRecent}` : '')
        );
      } else {
        console.log(
          `${tracked.primaryName} (${tracked.releaseId}): NO UPCOMING DATE FOUND` +
          (mostRecent ? ` (most recent on record: ${mostRecent})` : ' (no dates on record)')
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${tracked.primaryName} (${tracked.releaseId}): ERROR — ${message}`);
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
