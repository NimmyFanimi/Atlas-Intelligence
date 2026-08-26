import Link from 'next/link';
import DocsSidebar from '@/components/docs/DocsSidebar';

export default function OverviewPage() {
  return (
    <div className="docs-root h-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] flex relative">
      <DocsSidebar />
      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        <div
          id="scroll-content-overview"
          className="flex-1 py-10 px-12 overflow-y-auto h-full"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-strong) transparent' }}
        >
          <div className="breadcrumb text-[13px] text-[var(--text-muted)] mb-7">
            <Link href="/docs" className="crumb-link hover:text-[var(--teal-light)] transition-colors">
              Atlas Docs
            </Link>{' '}
            / <span className="current text-[var(--text-secondary)]">Overview</span>
          </div>
          <div className="page-title text-[30px] font-semibold tracking-[-0.02em] mb-[10px]">Why I built this</div>
          <div className="page-sub text-[15px] text-[var(--text-secondary)] mb-11 max-w-[560px]">
            A market intelligence dashboard, built solo to learn how a trading desk actually processes information.
          </div>

          <section className="chunk mb-14 scroll-mt-6 max-w-[640px]">
            <p className="text-[var(--text-secondary)] leading-7 mb-3">
              Financial markets throw off a huge amount of information every day. Prices, news, macro data, commodities, all moving, all connected, and most of it
              scattered across different sites and terminals that cost more than a student can spend. I wanted to understand how a trading desk actually processes all
              of that before I had ever sat at one, so I built something that tries to.
            </p>
            <p className="text-[var(--text-secondary)] leading-7 mb-3">
              Atlas is not a toy dashboard with random numbers. It is five real modules stitched together on a zero API budget: a live Markets Dashboard for 16 assets,
              a News Engine that tags every article to the tickers it moves and scores its sentiment, a Morning Brief that writes itself before the open, an
              Economic Calendar anchored to FRED&apos;s official release dates, and a Commodities deep dive that sources WTI, Brent and Natural Gas from the EIA directly
              and Gold and Copper from Metals.dev&apos;s LME benchmarks, not ETF proxies.
            </p>
            <p className="text-[var(--text-secondary)] leading-7">
              The hard part was not the charts. It was making sure the data behind them was honest: caching aggressively so free tier rate limits never break the UI,
              choosing ETF proxies only where the alternative was no data at all, and when a real quote is not available showing a clear caveat instead of a guess.
              That no fabricated data principle is the thread through these docs.
            </p>
          </section>

          <section className="chunk mb-14 scroll-mt-6">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">What&apos;s in these docs</h2>
            <p className="text-[var(--text-secondary)] max-w-[620px] mb-3">Architecture, Modules, Data Integrity, and Design, each a click away in the sidebar on the left.</p>
            <ul className="list-disc pl-5 space-y-1.5 text-[var(--text-secondary)] max-w-[620px]">
              <li>
                <Link href="/docs/architecture" className="text-[var(--teal-light)] hover:underline">
                  Architecture
                </Link>{' '}
                explains how data moves from five upstream sources through cron ingestion into Supabase and out to the Next.js frontend.
              </li>
              <li>
                <Link href="/docs/modules" className="text-[var(--teal-light)] hover:underline">
                  Modules
                </Link>{' '}
                covers what each of the five modules does and the real data contracts behind them.
              </li>
              <li>
                <Link href="/docs/data-integrity" className="text-[var(--teal-light)] hover:underline">
                  Data Integrity
                </Link>{' '}
                details four production bugs that made it to prod, how they were found, and what actually fixed them.
              </li>
              <li>
                <Link href="/docs/design" className="text-[var(--teal-light)] hover:underline">
                  Design
                </Link>{' '}
                describes the terminal inspired visual language and why it looks the way it does.
              </li>
            </ul>
          </section>

          <section className="chunk mb-14 scroll-mt-6 max-w-[640px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">How to read this</h2>
            <p className="text-[var(--text-secondary)] leading-7">
              These docs are written for reviewers as much as users. Every tradeoff is disclosed directly: where ETF proxies stand in for an index, where FRED only
              updates end of day, where the EIA publish cadence means a price looks stale. If something looks like a gap, it probably is one, and the text says so.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
