// app/api/cron/morning-brief/route.ts
//
// Cron-triggered endpoint for the Morning Brief module, run on a
// schedule via cron-job.org (see README / PROJECT_CONTEXT.md for the
// exact schedule).
//
// Calls generateMorningBrief(), which gathers the markets dashboard,
// recent macro news, and the upcoming calendar window, then asks
// Gemini to write the narrative and upserts the result into
// morning_briefs. Re-running is safe: rows are upserted on brief_date.
//
// NOTE on auth: uses the same constant-time comparison for the Bearer
// token as the news-ingest route. Do not weaken this check.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { generateMorningBrief } from '@/lib/morning-brief-generation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds; generous headroom for the fetch
  // and generation of the daily brief

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

  let briefResult: {
    success: boolean;
    briefDate: string;
    error?: string;
  };
  try {
    briefResult = await generateMorningBrief();
  } catch (err) {
    console.error('morning-brief: generateMorningBrief failed:', err);
    return NextResponse.json(
      {
        error: 'Brief generation failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  const durationMs = Date.now() - startedAt;

  return NextResponse.json({
    ...briefResult,
    durationMs,
  });
}
