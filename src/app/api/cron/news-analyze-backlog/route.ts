// app/api/cron/news-analyze-backlog/route.ts
//
// Hourly backlog-only analysis cron for the News Engine. Analysis only:
// no Marketaux fetch, no ingestRawArticles call. Drains rows where
// ai_analysis IS NULL, oldest first, up to 6 per run behind the same
// elapsed-time guard as the main cron.
//
// Ordering inside GET matters and is load-bearing:
//   1. Presence check (hasUnanalyzedArticles) FIRST. When the backlog is
//      empty this returns 200 immediately with found 0 and reason
//      'no backlog', making no Gemini call and not even a budget-table
//      read. An empty result set short-circuits before any call to
//      callGeminiWithRetry or the Phase 1 budget check.
//   2. Otherwise analyzeBacklogArticles(), which enforces the shared
//      daily budget before each Gemini call, exactly as the main cron.
//   3. Quota exhaustion is a 200 with reason 'quota near cap' and
//      0 analyzed, never an error throw. Only unexpected failures
//      (presence-check DB error, batch fetch error) return 500.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { analyzeBacklogArticles, hasUnanalyzedArticles } from '@/lib/news-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds; same ceiling as the main cron route

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
  // must be equal length for timingSafeEqual, so reject mismatched
  // lengths before comparing rather than letting it throw.
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();

    let backlogExists: boolean;
    try {
      backlogExists = await hasUnanalyzedArticles();
    } catch (err) {
      console.error('[news-analyze-backlog] presence check failed:', err);
      return NextResponse.json(
        {
          error: 'Backlog presence check failed',
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    if (!backlogExists) {
      return NextResponse.json({
        found: 0,
        analyzed: 0,
        failed: 0,
        skipped: 0,
        reason: 'no backlog',
        durationMs: Date.now() - startedAt,
      });
    }

    let result: Awaited<ReturnType<typeof analyzeBacklogArticles>>;
    try {
      result = await analyzeBacklogArticles();
    } catch (err) {
      console.error('[news-analyze-backlog] batch failed:', err);
      return NextResponse.json(
        {
          error: 'Backlog analysis failed',
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...result,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[news-analyze-backlog] unhandled error:', err);
    return NextResponse.json(
      {
        error: 'Unhandled news-analyze-backlog error',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
