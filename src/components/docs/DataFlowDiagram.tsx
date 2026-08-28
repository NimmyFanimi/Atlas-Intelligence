import React from 'react';

/**
 * Architecture data-flow diagram
 * Five source boxes -> cron ingestion -> Supabase -> Next.js app
 * Color-coded per mockup: teal (sources), purple/blue variants via existing tokens
 * Recreated as real DOM nodes, not an image.
 */
export default function DataFlowDiagram() {
  const sources = [
    { label: 'Finnhub', sub: 'quotes', color: 'teal' },
    { label: 'FRED', sub: 'rates & releases', color: 'teal' },
    { label: 'EIA', sub: 'WTI / Brent / Gas', color: 'blue' },
    { label: 'Metals.dev', sub: 'Gold / Copper', color: 'purple' },
    { label: 'Marketaux', sub: 'news + sentiment', color: 'blue' },
  ];

  return (
    <div className="my-8 max-w-[680px]">
      {/* Sources row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {sources.map((s) => (
          <div
            key={s.label}
            className={`rounded-[10px] border px-3 py-4 text-center outline-none focus:outline-none focus-visible:outline-none shadow-none ring-0 ${
              s.color === 'teal'
                ? 'bg-[rgba(13,148,136,0.10)] border-[var(--teal)]/30'
                : s.color === 'blue'
                  ? 'bg-[rgba(59,130,246,0.08)] border-[rgba(59,130,246,0.25)]'
                  : 'bg-[rgba(139,92,246,0.08)] border-[rgba(139,92,246,0.25)]'
            }`}
          >
            <div
              className={`font-mono text-[11px] font-semibold tracking-[0.06em] ${
                s.color === 'teal' ? 'text-[var(--teal-light)]' : s.color === 'blue' ? 'text-[#60a5fa]' : 'text-[#a78bfa]'
              }`}
            >
              {s.label.toUpperCase()}
            </div>
            <div className="font-mono text-[10px] text-[var(--text-muted)] mt-1 leading-[1.3]">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Arrow down from sources */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {sources.map((_, i) => (
          <div key={i} className="flex justify-center py-2">
            <span className="text-[11px] text-[var(--text-muted)]">↓</span>
          </div>
        ))}
      </div>

      {/* Cron ingestion */}
      <div className="mx-auto max-w-[420px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-5 py-4 text-center outline-none focus:outline-none focus-visible:outline-none shadow-none ring-0">
        <div className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">CRON INGESTION</div>
        <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">cron-job.org + Vercel Cron to API routes</div>
        <div className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">5 min snapshots, daily FRED guard, 2 hr news poll</div>
      </div>

      <div className="flex justify-center py-2">
        <span className="text-[11px] text-[var(--text-muted)]">↓</span>
      </div>

      {/* Supabase */}
      <div className="mx-auto max-w-[420px] rounded-[10px] border border-[var(--teal)]/30 bg-[rgba(13,148,136,0.10)] px-5 py-4 text-center outline-none focus:outline-none focus-visible:outline-none shadow-none ring-0">
        <div className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--teal-light)]">SUPABASE (PostgreSQL)</div>
        <div className="mt-1 font-mono text-[12px] text-[var(--text-secondary)]">assets, market_snapshots, news_articles, calendar_events, morning_briefs</div>
        <div className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">RLS public read, composite indexes, 500 MB free tier guard</div>
      </div>

      <div className="flex justify-center py-2">
        <span className="text-[11px] text-[var(--text-muted)]">↓</span>
      </div>

      {/* Next.js app */}
      <div className="mx-auto max-w-[420px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-1)] px-5 py-4 text-center outline-none focus:outline-none focus-visible:outline-none shadow-none ring-0">
        <div className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[#60a5fa]">NEXT.JS APP (App Router)</div>
        <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">Frontend reads only from Supabase, never direct API calls</div>
        <div className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">Markets, News, Brief, Calendar, Commodities</div>
      </div>

      <div className="mt-3 font-mono text-[10.5px] text-[var(--text-muted)] text-center">Teal is live price feeds, blue is fundamentals and calendar, purple is market news</div>
    </div>
  );
}
