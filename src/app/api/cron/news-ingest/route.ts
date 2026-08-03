// app/api/cron/news-ingest/route.ts
//
// Cron-triggered endpoint for the News Engine, run every 2-3 hours via
// cron-job.org (see README / PROJECT_CONTEXT.md for the exact schedule).
//
// Runs both phases in sequence, in the same request:
//   1. ingestRawArticles()        -> fetch Marketaux, upsert raw rows
//   2. analyzeUnprocessedArticles() -> find ai_analysis IS NULL rows, call Gemini
//
// Kept as two phases logically (see news-ingestion.ts / news-analysis.ts)
// but triggered from one route on one schedule, so there's only one cron
// job to manage on cron-job.org, not two. A failure in phase 2 never
// blocks phase 1's writes, since phase 1 has already completed and
// returned by the time phase 2 runs.
//
// NOTE on auth: uses a constant-time comparison for the Bearer token,
// unlike the market-snapshot route's current comparison (flagged in the
// Kimi security review as non-constant-time). Fixing that on the
// existing route is a separate, already-tracked task; this new route
// just doesn't introduce the same issue a second time.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ingestRawArticles } from '@/lib/news-ingestion';
import { analyzeUnprocessedArticles } from '@/lib/news-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds; generous headroom for a handful
  // of sequential Gemini calls plus their 2s inter-call delays

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

  let ingestResult: { fetched: number; inserted: number };
  try {
    ingestResult = await ingestRawArticles();
  } catch (err) {
    console.error('news-ingest: phase 1 (ingestRawArticles) failed:', err);
    return NextResponse.json(
      {
        error: 'Ingestion phase failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  let analysisResult: { found: number; analyzed: number; failed: number };
  try {
    analysisResult = await analyzeUnprocessedArticles();
  } catch (err) {
    // Phase 1 already succeeded and committed its writes. Report phase 2's
    // failure but still return the phase 1 result rather than a bare 500,
    // since real data was written and that's useful to know.
    console.error('news-ingest: phase 2 (analyzeUnprocessedArticles) failed:', err);
    return NextResponse.json(
      {
        ingest: ingestResult,
        analysisError: err instanceof Error ? err.message : String(err),
      },
      { status: 207 } // Multi-status: partial success
    );
  }

  const durationMs = Date.now() - startedAt;

  return NextResponse.json({
    ingest: ingestResult,
    analysis: analysisResult,
    durationMs,
  });
}
