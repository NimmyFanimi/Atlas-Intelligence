import Link from 'next/link';
import DocsSidebar from '@/components/docs/DocsSidebar';
import DataFlowDiagram from '@/components/docs/DataFlowDiagram';

export default function ArchitecturePage() {
  return (
    <div className="docs-root h-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] flex relative">
      <DocsSidebar />
      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        <div className="flex-1 py-10 px-12 overflow-y-auto h-full" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-strong) transparent' }}>
          <div className="breadcrumb text-[13px] text-[var(--text-muted)] mb-7">
            <Link href="/docs" className="hover:text-[var(--teal-light)] transition-colors">
              Atlas Docs
            </Link>{' '}
            / <span className="current text-[var(--text-secondary)]">Architecture</span>
          </div>
          <div className="page-title text-[30px] font-semibold tracking-[-0.02em] mb-[10px]">Architecture</div>
          <div className="page-sub text-[15px] text-[var(--text-secondary)] mb-11 max-w-[560px]">
            How data moves through the system, end to end, from five upstream sources into a single Supabase truth layer and out to the app.
          </div>

          <section className="chunk mb-14 scroll-mt-6">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Data flow</h2>
            <p className="text-[var(--text-secondary)] max-w-[620px] mb-3">
              The frontend never calls an upstream API directly. Every price, story, and calendar date is written first to Supabase by a scheduled job. The app
              is a pure reader. That one decision keeps us comfortably under every free tier rate limit (Finnhub 60 calls per minute, Marketaux 100 requests per day,
              Metals.dev 100 requests per month) no matter how many people have the dashboard open.
            </p>
            <DataFlowDiagram />
          </section>

          <section className="chunk mb-14 scroll-mt-6 max-w-[620px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Scheduling</h2>
            <p className="text-[var(--text-secondary)] mb-3 leading-7">
              Market snapshots run every 5 minutes via cron-job.org, hitting a Next.js API route secured with a Bearer{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">CRON_SECRET</span>. Five minutes was not
              arbitrary: at 16 assets it is roughly 4,608 rows per day, about 420 MB per year at 250 bytes per row, tight but survivable inside Supabase&apos;s 500 MB free tier
              for the year this project needs to stay live. At 1 minute cadence the same math is 1.8 GB per year and the cap breaks in about three months.
            </p>
            <p className="text-[var(--text-secondary)] mb-3 leading-7">
              News polling runs every 2 hours (news does not need price like freshness), and the EIA and FRED pulls are gated behind a &quot;did we already fetch today&quot;
              check so the same 5 minute tick does not hammer an end of day or weekly source. Morning Brief is the one job that lives on Vercel&apos;s own cron. Its
              Gemini generation grew past cron-job.org&apos;s 30 second watchdog, but fits comfortably in Vercel&apos;s 60 second window.
            </p>
          </section>

          <section className="chunk mb-14 scroll-mt-6 max-w-[620px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Supabase as truth</h2>
            <p className="text-[var(--text-secondary)] mb-3 leading-7">
              Five tables, each owned by one cron: <span className="font-mono text-[13px] text-[var(--text-primary)]">assets</span> (seeded, 16 rows),{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">market_snapshots</span>,{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">news_articles</span>,{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">calendar_events</span>, and{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">morning_briefs</span>. Composite index on{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">(asset_id, timestamp DESC)</span>, GIN on news&apos;s matched tickers,
              partial indexes for &quot;unanalyzed&quot; and &quot;estimate missing&quot; hot paths, RLS public read only. The frontend&apos;s main join (latest snapshot per asset) is
              done in TypeScript by grouping a bounded window rather than a Postgres RPC. At 16 assets the performance difference is unmeasurable and the logic
              stays readable on GitHub.
            </p>
          </section>

          <section className="chunk mb-14 scroll-mt-6 max-w-[620px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Resilience choices</h2>
            <p className="text-[var(--text-secondary)] mb-3 leading-7">
              Per entry error isolation in every ingest loop (one bad symbol never poisons the rest), explicit limits on every{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">market_snapshots</span> query (PostgREST silently caps at 1,000 rows without an
              explicit limit, a real bug that once served stale prices), and short, auditable upsert keys per table (
              <span className="font-mono text-[13px] text-[var(--text-primary)]">marketaux_uuid</span> for news,{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">(fred_release_id, release_date)</span> for calendar) are the backbone. Where real
              data is not available the UI shows a caveat, never a fabricated fill. That same honesty principle shapes the Calendar&apos;s &quot;Date TBD&quot; pill and the
              commodities Range Since Tracking Began stat.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
