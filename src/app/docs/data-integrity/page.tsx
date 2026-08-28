import Link from 'next/link';
import Toc from '@/components/docs/Toc';

const tocItems = [
  { id: 'sec-eia', label: 'The EIA key that wasn’t there' },
  { id: 'sec-fomc', label: 'The FOMC event that fired every day' },
  { id: 'sec-copper', label: 'Copper up 35,000%' },
  { id: 'sec-postgrest', label: 'The assets that went missing' },
];

export default function DataIntegrityPage() {
  return (
    <>
      <div
        id="scroll-content"
        className="flex-1 py-10 px-5 md:px-12 overflow-y-auto h-full"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-strong) transparent' }}
      >
        <div className="breadcrumb text-[13px] text-[var(--text-muted)] mb-7">
          <Link href="/docs" className="hover:text-[var(--teal-light)] transition-colors">
            Atlas Docs
          </Link>{' '}
          / <span className="current text-[var(--text-secondary)]">Data Integrity</span>
        </div>
        <div className="page-title text-[30px] font-semibold tracking-[-0.02em] mb-[10px]">Data Integrity</div>
        <div className="page-sub text-[15px] text-[var(--text-secondary)] mb-11 max-w-[560px]">
          Building the features was the easy part. Making sure the data behind them was actually correct turned out to be harder, and more interesting.
        </div>

        <section id="sec-eia" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Case study</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">The EIA key that wasn&apos;t there</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Problem:</strong> {` `}WTI, Brent, and Natural Gas were supposed to be pulling from the EIA. A
            production check found they were still silently coming from Finnhub, with ETF proxies (USO, BNO, UNG) the commodities module had supposedly moved away from.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Root cause:</strong> {` `}<span className="font-mono text-[13px] text-[var(--text-primary)]">EIA_API_KEY</span>{' '}looked correctly saved
            in Vercel&apos;s dashboard. It just was not actually there at runtime, so the service role ingest was reading{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">undefined</span> and the Finnhub fallback ran without an error, by design. No
            exception, no log, just wrong source with plausible numbers.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Fix:</strong> {` `}Deleted and re-added the key in Vercel, redeployed, and confirmed the source
            column in <span className="font-mono text-[13px] text-[var(--text-primary)]">market_snapshots.metadata</span> switched to{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">eia</span>. The fallback path now logs a warning when it activates, so a silent
            fallback never looks correct again.
          </p>
        </section>

        <section id="sec-fomc" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Case study</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">The FOMC event that fired every day</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Problem:</strong> {` `}Every single day, the Economic Calendar inserted a phantom &quot;FOMC Press
            Release&quot; event. On a 7 day window it looked like the Fed was meeting continuously. That was clearly wrong, but the row had a real FRED release_id.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Root cause:</strong> {` `}FRED&apos;s release_id 101 looked, by name, like it tracked FOMC
            meetings. It is actually a daily updating rate series (about 3,748 dated entries) whose{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">fred/release/dates</span> response always has a date greater than or equal to today, so the
            &quot;next date&quot; helper genuinely believed there was always a meeting tomorrow. The calendar shipped with this because no live check against a
            high frequency release had been run, only low frequency CPI and NFP.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Fix:</strong> {` `}Removed release_id 101 from{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">TRACKED_RELEASES</span> entirely and added the-calendar.net as a clearly labeled
            unofficial source (with an &quot;Unofficial source&quot; pill and tooltip in the UI), plus isolated error handling so a failure there never blocks CPI, NFP, GDP, or PCE.
          </p>
        </section>

        <section id="sec-copper" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Case study</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">The chart that showed copper up 35,000%</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Problem:</strong> {` `}The 30 day chart and range stats were badly wrong, most visibly Copper,
            with a 35,000 percent move and a chart that jumped like a cliff. Other assets were subtly off too, just not absurdly.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Root cause:</strong> {` `}The source switch from Finnhub ETF proxies to real sources (EIA,
            Metals.dev) left old rows in <span className="font-mono text-[13px] text-[var(--text-primary)]">market_snapshots</span> at the wrong scale, for example CPER
            ETF dollars versus LME copper dollars. Every history query was reading both scales together without filtering on{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">metadata.source</span>, so the range math mixed incompatible histories.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Fix:</strong> {` `}Filtered every query to the asset&apos;s current real source, deleted 31,957
            stale rows in a one off cleanup script, and documented the headroom on per timeframe limits so the 7D and 30D windows stay correct at 5 minute cadence.
            The &quot;Range Since Tracking Began&quot; copy was kept honest about the short history rather than extrapolated to a fake 52 week range.
          </p>
        </section>

        <section id="sec-postgrest" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Case study</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">The assets that silently went missing</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Problem:</strong> {` `}Gold, Copper, US10Y and USD2Y showed as unavailable on the dashboard,
            with no error anywhere, not in Supabase, not in the API route, not in the UI. The assets existed, the rows existed, the page just did not see
            them.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Root cause:</strong> {` `}A single global query was hitting PostgREST&apos;s default 1,000 row cap.
            With 16 assets at 5 minute cadence the window was briefly fine, but as history grew it started returning only the oldest 1,000 rows in the
            requested range. That meant stale data for some assets and no row at all for others, both silent. It was caught only by manually cross checking the dashboard timestamp
            against Supabase Table Editor.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] leading-7">
            <strong className="text-[var(--text-primary)] font-medium">Fix:</strong> {` `}Replaced the single global query with per asset parallel queries (explicit{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">.limit()</span> sized to real expected row counts) and reversed the array in JS
            before the &quot;latest is last element&quot; logic. This is now a standing rule: never rely on PostgREST&apos;s default cap on{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">market_snapshots</span>.
          </p>
        </section>
      </div>
      <Toc items={tocItems} containerId="scroll-content" />
    </>
  );
}
