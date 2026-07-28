import { NextRequest, NextResponse } from 'next/server';
import { ingestMarketSnapshots } from '@/lib/cron/ingest-market-snapshots';

export const dynamic = 'force-dynamic'; // never cache this route
export const maxDuration = 60; // allow up to 60s for the full ingestion run

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('CRON_SECRET is not set in environment variables');
        return NextResponse.json(
            { error: 'Server misconfiguration: CRON_SECRET not set' },
            { status: 500 }
        );
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const results = await ingestMarketSnapshots();

        const succeeded = results.filter(r => r.status === 'ok').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const failed = results.filter(r => r.status === 'error');

        if (failed.length > 0) {
            console.error(
                'Market snapshot ingestion had failures:',
                failed.map(f => `${f.symbol}: ${f.message}`).join(', ')
            );
        }

        return NextResponse.json(
            {
                status: 'ok',
                succeeded,
                skipped,
                failed: failed.length,
                failedDetails: failed.map(f => ({ symbol: f.symbol, message: f.message })),
                timestamp: new Date().toISOString(),
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Market snapshot ingestion failed:', error);

        return NextResponse.json(
            {
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}