import Link from 'next/link';
import Toc from '@/components/docs/Toc';

const tocItems = [
  { id: 'sec-markets', label: 'Markets Dashboard' },
  { id: 'sec-news', label: 'News Engine' },
  { id: 'sec-brief', label: 'Morning Brief' },
  { id: 'sec-calendar', label: 'Economic Calendar' },
  { id: 'sec-commodities', label: 'Commodities' },
];

export default function ModulesPage() {
  return (
    <>
      <div
        id="scroll-content-modules"
        className="flex-1 py-10 px-5 md:px-12 overflow-y-auto h-full"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-strong) transparent' }}
      >
        <div className="breadcrumb text-[13px] text-[var(--text-muted)] mb-7">
          <Link href="/docs" className="hover:text-[var(--teal-light)] transition-colors">
            Atlas Docs
          </Link>{' '}
          / <span className="current text-[var(--text-secondary)]">Modules</span>
        </div>
        <div className="page-title text-[30px] font-semibold tracking-[-0.02em] mb-[10px]">Modules</div>
        <div className="page-sub text-[15px] text-[var(--text-secondary)] mb-11 max-w-[560px]">
          What each of the five parts does, and the real data behind it. Sourcing is disclosed directly in the UI, not hidden in a footnote.
        </div>

        <section id="sec-markets" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Markets Dashboard</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Markets Dashboard</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            The watchlist is 16 assets, fixed: indices (S and P 500, Nasdaq 100, Dow, FTSE 100, Euro Stoxx 50), FX (EUR and USD, GBP and USD, USD and JPY, DXY), rates
            (US 10Y, US 2Y), and commodities (WTI, Brent, Gold, Natural Gas, Copper). Indices and FX are read from Finnhub ETF proxies (SPY for SandP, QQQ for
            Nasdaq, FXE for EUR and USD, etc.) because Finnhub free tier returns 403 on real OANDA and CFD symbols, verified live before the schema was locked.
            Rates come from FRED directly (series DGS10, DGS2). Bond ETF prices track price, not yield, and a rates audience expects a yield.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            Each card shows price in JetBrains Mono, percentage change as a filled pill (sage and coral), and a sparkline with a low opacity filled area (about 12 percent)
            under the line for weight without violating the no gradient rule. The detail panel timeframe selector (1H, 12H, 1D, 7D, 30D) downsamples 7D and 30D to
            about 120 points client side. The snapshot join is two queries (fetch assets, fetch a bounded snapshot window, group and reduce in JS) with explicit
            per timeframe limits sized for 5 minute cadence. Ascending order without an explicit limit once silently served stale prices past the 1,000 row
            PostgREST default.
          </p>
        </section>

        <section id="sec-news" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">News Engine</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">News Engine</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            Marketaux <span className="font-mono text-[13px] text-[var(--text-primary)]">/news/all</span> supplies title, description, image, source, and
            per entity sentiment scores. There is no single article level sentiment, so Atlas derives one by averaging the entity scores, nulls excluded. Asset
            tagging compares Marketaux entity symbol against each asset <span className="font-mono text-[13px] text-[var(--text-primary)]">finnhub_symbol</span>. A
            macro flag is a separate keyword match, so an article can be both macro and ticker tagged. Ingestion is capped at 2 articles per run with an 800 ms
            delay between Gemini 2.0 Flash analyses to keep the whole job inside cron-job.org 30 second watchdog.
          </p>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            The &quot;Sentimeter&quot; gauge (needle plus arc plus numeric readout, teal only) appears only in the full screen modal. The card is too small to render the
            number legibly, so it was removed there rather than kept broken. Image fallback uses a 5 color palette keyed to asset class (teal indices, purple
            FX, pink rates, coral commodities, grey macro) so a null image still hints at the story type.
          </p>
        </section>

        <section id="sec-brief" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Morning Brief</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Morning Brief</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            Generated once daily via Gemini, 200 to 300 words, combining the top 3 gainers and losers from{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">getMarketsDashboard()</span>, the last
            24 hours of macro news (max 8), and the next 3 days of calendar events. It only mentions the calendar if the list is genuinely non empty, never
            fabricating a mention when nothing is confirmed. Written to the <span className="font-mono text-[13px] text-[var(--text-primary)]">morning_briefs</span> table on{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">brief_date</span> (unique, write once). This is the one cron that runs on Vercel
            itself, not cron-job.org, because generation time outgrew the external watchdog.
          </p>
        </section>

        <section id="sec-calendar" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Economic Calendar</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Economic Calendar</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            Four FRED releases are tracked directly: CPI (10), NFP (50), GDP (53), PCE (54). The correct endpoint is{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">fred/release/dates</span> (singular), not{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">fred/releases/dates</span> (plural), which silently ignores{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">release_id</span>. The fetcher uses{' '}
            <span className="font-mono text-[13px] text-[var(--text-primary)]">sort_order=desc and limit=20</span> and takes the last future dated row, because
            ascending plus limit 1000 never reaches present day for high frequency releases like FOMC (3,748 entries). FOMC dates themselves are not from FRED at
            all. They come from the calendar.net unofficial mirror and are labeled &quot;Unofficial source&quot; in the UI. Importance is the left accent bar
            (teal opacity by level). Status is the right pill (Confirmed versus Date TBD), never the reserved sage and coral price direction tokens.
          </p>
        </section>

        <section id="sec-commodities" className="chunk mb-14 scroll-mt-6">
          <span className="meta-label inline-block font-mono text-[11px] text-[var(--teal-light)] bg-[var(--teal-dim)] px-2 py-[3px] rounded-[5px] mb-3">Commodities</span>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Commodities</h2>
          <p className="text-[var(--text-secondary)] max-w-[620px] mb-3 leading-7">
            WTI, Brent and Natural Gas are sourced from the EIA (daily petroleum spot table, which only publishes weekly, so prices can be up to 8 days old by
            design, not a bug), Gold and Copper from Metals.dev LME 3 month benchmark, batched into one call and gated behind a daily fetch guard because
            the free tier is 100 requests per month with a second key as fallback. The deep dive stat is &quot;Range Since Tracking Began&quot; rather than a 52 week high and low,
            because a full year of real source history does not exist yet and fabricating one would break the honesty principle. Each detail page also surfaces
            related, ticker tagged news from the News Engine.
          </p>
        </section>
      </div>
      <Toc items={tocItems} containerId="scroll-content-modules" />
    </>
  );
}
