// app/api/cron/calendar-ingest/route.ts
//
// Cron-triggered endpoint for the Economic Calendar module, run on a
// schedule via cron-job.org (see README / PROJECT_CONTEXT.md for the
// exact schedule).
//
// Calls ingestUpcomingCalendarEvents(), which fetches the FRED release
// schedule for the next 14 days, filters it to the TRACKED_RELEASES
// allowlist, and upserts matched events into calendar_events. Re-running
// is safe: duplicate (fred_release_id, release_date) rows are silently
// skipped via ignoreDuplicates.
//
// NOTE on auth: uses the same constant-time comparison for the Bearer
// token as the news-ingest route. Do not weaken this check.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ingestUpcomingCalendarEvents } from '@/lib/calendar-ingestion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds; generous headroom for the fetch
  // and upsert of a handful of tracked releases

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    // Fail closed: if the secret isn't configured, no request is valid.
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const provided = authHeader.slice('Bearer '.length);

  // Constant-time comparison to avoid a timing side-channel. Both buffers
  // must be equal length for timingSafeEqual, so pad/reject mismatched
  // lengths before comparing rather than letting it throw.
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  let ingestResult: {
    matched: number;
    inserted: number;
    skipped: number;
    errors: string[];
  };
  try {
    ingestResult = await ingestUpcomingCalendarEvents();
  } catch (err) {
    console.error('calendar-ingest: ingestUpcomingCalendarEvents failed:', err);
    return NextResponse.json(
      {
        error: 'Ingestion failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  const durationMs = Date.now() - startedAt;

  return NextResponse.json({
    ...ingestResult,
    durationMs,
  });
}