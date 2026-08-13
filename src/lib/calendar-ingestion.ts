// lib/calendar-ingestion.ts
//
// Ingestion for the Economic Calendar module. For each curated
// TRACKED_RELEASES entry, looks up the next upcoming FRED release date
// individually and upserts matched events into calendar_events.
//
// Each tracked release is looked up individually because FRED's
// releases/dates endpoint, when called without a release_id, returns its
// full multi-thousand-entry catalog ordered arbitrarily rather than scoped
// near today — so a targeted per-release call is required for correctness.
// FRED has no importance/category metadata of its own, so that is supplied
// here via TRACKED_RELEASES.
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
import { fetchNextReleaseDate } from './data-sources/fred';
import { TRACKED_RELEASES } from './data-sources/tracked-releases';

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
 * For each TRACKED_RELEASES entry, looks up the next upcoming FRED
 * release date individually and upserts matched events into
 * calendar_events.
 *
 * Per-entry isolation: a null result (no upcoming date found in the
 * recent slice) is a silent skip that is neither counted nor recorded.
 * Any error thrown by an individual lookup is logged, counted, and
 * recorded in `errors`, then processing continues with the next
 * tracked release.
 */
export async function ingestUpcomingCalendarEvents(): Promise<{
  matched: number;
  inserted: number;
  skipped: number;
  errors: string[];
}> {
  const rows: CalendarEventRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const tracked of TRACKED_RELEASES) {
    try {
      const upcoming = await fetchNextReleaseDate(tracked.releaseId);

      if (upcoming === null) {
        continue;
      }

      rows.push({
        fred_release_id: tracked.releaseId,
        release_date: upcoming.date,
        event_name: tracked.primaryName,
        category: tracked.category,
        importance: tracked.importance,
        country: tracked.country,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `calendar-ingestion: error looking up next release date for release ${tracked.releaseId}: ${message}`
      );
      skipped += 1;
      errors.push(message);
    }
  }

  const { inserted } = await upsertCalendarEvents(rows);

  return { matched: rows.length, inserted, skipped, errors };
}
