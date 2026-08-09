// lib/calendar-ingestion.ts
//
// Ingestion for the Economic Calendar module. Pulls the FRED release
// schedule over the next 14 days, filters it down to the curated
// TRACKED_RELEASES allowlist (FRED has no importance/category metadata
// of its own, so it is supplied here), and upserts the matched events
// into calendar_events.
//
// Only identity/scheduling fields are populated on insert — actual_value,
// previous_value, estimated_consensus, estimate_rationale,
// estimate_generated_at, estimate_model_used, and period_covered are left
// to their table defaults (null), and status stays at its 'scheduled'
// default. A later estimate step fills those in. Re-running this function
// is safe: the (fred_release_id, release_date) unique constraint plus
// ignoreDuplicates: true means existing rows are silently skipped.
//
// IMPORTANT: reuses the existing supabaseAdmin client, the same one the
// market-snapshot cron route already uses. Do not create a second one.

import { supabaseAdmin } from './supabase/admin';
import { fetchUpcomingReleases } from './data-sources/fred';
import { TRACKED_RELEASES } from './data-sources/tracked-releases';

const CALENDAR_WINDOW_DAYS = 14;

interface CalendarEventRow {
  fred_release_id: string;
  release_date: string;
  event_name: string;
  category: string;
  importance: string;
  country: string;
}

/**
 * Upserts a batch of calendar events into calendar_events, keyed on the
 * (fred_release_id, release_date) unique constraint. Existing rows are
 * left alone on conflict — a scheduled release's source data doesn't
 * change, only its estimate/actual values do, and those are populated
 * by a separate step.
 */
async function upsertCalendarEvents(rows: CalendarEventRow[]): Promise<{ inserted: number }> {
  if (rows.length === 0) {
    return { inserted: 0 };
  }

  const { data, error } = await supabaseAdmin
    .from('calendar_events')
    .upsert(rows, {
      onConflict: 'fred_release_id,release_date',
      ignoreDuplicates: true, // don't overwrite existing rows, estimates may
        // already be populated on a previously-seen event
    })
    .select('id');

  if (error) {
    throw new Error(`Failed to upsert calendar_events: ${error.message}`);
  }

  return { inserted: (data || []).length };
}

/**
 * Fetches the FRED release schedule for the next 14 days, filters it to
 * the TRACKED_RELEASES allowlist, and upserts matched events into
 * calendar_events.
 *
 * Per-entry failures are isolated: one entry failing to build is logged
 * and skipped rather than aborting the run. A failure in the single
 * fetchUpcomingReleases call itself propagates as a thrown error, since
 * without that call succeeding there is nothing to process.
 */
export async function ingestUpcomingCalendarEvents(): Promise<{
  matched: number;
  inserted: number;
  skipped: number;
  errors: string[];
}> {
  const trackedById = new Map(TRACKED_RELEASES.map(r => [r.releaseId, r]));

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const endDate = new Date(today.getTime() + CALENDAR_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // A failure here is a hard failure — nothing to process without it.
  const releases = await fetchUpcomingReleases(startDate, endDate);

  const matchedReleases = releases.filter(r => trackedById.has(r.releaseId));

  const rows: CalendarEventRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const release of matchedReleases) {
    try {
      const tracked = trackedById.get(release.releaseId);
      if (!tracked) {
        throw new Error(`No TRACKED_RELEASES entry for releaseId ${release.releaseId}`);
      }
      if (!release.date) {
        throw new Error(`Missing release date for ${release.releaseId}`);
      }

      rows.push({
        fred_release_id: release.releaseId,
        release_date: release.date,
        event_name: tracked.eventName,
        category: tracked.category,
        importance: tracked.importance,
        country: tracked.country,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `calendar-ingestion: skipping entry for release ${release.releaseId}: ${message}`
      );
      skipped += 1;
      errors.push(message);
    }
  }

  const { inserted } = await upsertCalendarEvents(rows);

  return { matched: matchedReleases.length, inserted, skipped, errors };
}