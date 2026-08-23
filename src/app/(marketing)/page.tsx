import React from 'react';
import Link from 'next/link';
import { getLandingPreviewAssets } from '@/lib/data/markets';

export const revalidate = 60;

export default async function LandingPage() {
  const assets = await getLandingPreviewAssets();

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-primary)] font-sans antialiased">
      {/* 1. TOP BAR */}
      <header className="flex items-center justify-between px-6 md:px-11 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[7px] bg-[rgba(13,148,136,0.12)] flex items-center justify-center text-[var(--color-accent)]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
              <path d="M12 2L2 22H7L12 12L17 22H22L12 2Z" />
            </svg>
          </div>
          <div className="leading-[1.15]">
            <div className="font-sans text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
              Atlas
            </div>
            <div className="font-mono text-[9.5px] text-[var(--color-accent)] tracking-[0.14em] mt-0.5">
              INTELLIGENCE
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-[22px]">
          <Link
            href="/docs"
            className="text-sm font-sans font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Docs
          </Link>
          <div className="flex items-center gap-2 px-[13px] py-[7px] border border-[var(--color-border)] rounded-[8px] text-[13px] font-sans text-[var(--color-secondary)] hover:border-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer select-none">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>GitHub</span>
            <span className="text-[9.5px] text-[var(--color-muted)]">(soon)</span>
          </div>
          <Link
            href="/dashboard"
            className="px-[18px] py-[9px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[#04241F] text-[13.5px] font-sans font-semibold rounded-[8px] transition-colors"
          >
            Launch app
          </Link>
        </div>
      </header>

      {/* 2. HERO */}
      <section className="px-6 sm:px-10 pt-[84px] pb-[60px] text-center max-w-[720px] mx-auto">
        <div className="font-sans text-[13.5px] font-medium tracking-[0.02em] text-[var(--color-accent)] mb-[22px] flex items-center justify-center gap-2">
          <span className="w-[5px] h-[5px] rounded-full bg-[var(--color-market-up)] animate-pulse-dot" />
          Live market data, built for sales and trading
        </div>
        <h1 className="text-[36px] sm:text-[44px] font-semibold tracking-[-0.025em] leading-[1.18] mb-[22px] max-w-[640px] mx-auto">
          <span className="whitespace-nowrap text-[var(--color-primary)]">
            Everything a trading desk checks
          </span>
          <br />
          <span className="text-[var(--color-secondary)]">before 9am.</span>
        </h1>
        <p className="font-sans text-[16.5px] text-[var(--color-secondary)] leading-[1.65] max-w-[520px] mx-auto mb-[36px] font-normal">
          A real time research terminal covering markets, news, macro, and commodities. It's the same numbers a trading floor watches, just without the Bloomberg subscription.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-6 py-[13px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[#04241F] text-sm font-sans font-semibold rounded-[8px] flex items-center gap-2 transition-colors"
          >
            Launch app
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="px-6 py-[13px] bg-transparent text-[var(--color-primary)] hover:border-[var(--color-muted)] text-sm font-sans font-medium border border-[var(--color-border)] rounded-[8px] transition-colors"
          >
            Explore docs
          </Link>
        </div>
      </section>

      {/* 3. PRODUCT PREVIEW */}
      <section className="max-w-[900px] mx-auto mb-[76px] px-6 sm:px-10">
        <div
          className="border border-[var(--color-border)] rounded-[14px] bg-[var(--color-surface)] overflow-hidden"
          style={{ boxShadow: '0 40px 80px -40px rgba(0,0,0,0.6)' }}
        >
          {/* Chrome Header */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--color-border)] bg-[#0C0D10]">
            <div className="w-[7px] h-[7px] rounded-full bg-[#E5605A]" />
            <div className="w-[7px] h-[7px] rounded-full bg-[#E6B450]" />
            <div className="w-[7px] h-[7px] rounded-full bg-[#5FBE6E]" />
            <div className="font-mono text-[10.5px] text-[var(--color-muted)] ml-2">
              atlas-intelligence.app/dashboard
            </div>
            <div className="ml-auto flex items-center gap-1.5 font-mono text-[9.5px] text-[var(--color-market-up)] tracking-[0.05em]">
              <span className="w-[5px] h-[5px] rounded-full bg-[var(--color-market-up)] animate-pulse-dot" />
              LIVE DATA
            </div>
          </div>

          {/* Preview Body */}
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {assets.map((asset) => (
                <div
                  key={asset.symbol}
                  className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-[10px] p-4"
                >
                  <div className="font-mono text-[10px] font-semibold text-[var(--color-muted)] tracking-[0.06em] mb-1">
                    {asset.symbol}
                  </div>
                  <div className="font-sans text-[12.5px] text-[var(--color-secondary)] mb-3 truncate">
                    {asset.name}
                  </div>
                  <div className="font-mono text-[18px] font-semibold mb-1.5 text-[var(--color-primary)]">
                    {asset.formattedPrice}
                  </div>
                  <div
                    className={`inline-block font-mono text-[11px] font-semibold px-[7px] py-[3px] rounded-[5px] ${
                      asset.isUp
                        ? 'text-[var(--color-market-up)] bg-[rgba(92,141,115,0.12)]'
                        : 'text-[var(--color-market-down)] bg-[rgba(195,107,103,0.12)]'
                    }`}
                  >
                    {asset.formattedChangePct}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURE STRIP */}
      <section className="max-w-[900px] mx-auto mb-[80px] px-6 sm:px-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-[26px_24px]">
          <svg
            className="w-6 h-6 text-[var(--color-accent)] mb-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M3 3v18h18M7 14l3-3 3 3 5-6" />
          </svg>
          <div className="font-sans text-[14.5px] font-semibold mb-2 tracking-[-0.01em] text-[var(--color-primary)]">
            Real market data
          </div>
          <div className="font-sans text-[13px] text-[var(--color-secondary)] leading-[1.6]">
            A 16-asset watchlist across indices, FX, rates, and commodities, sourced from EIA, FRED, and Metals.dev, not synthetic feeds.
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-[26px_24px]">
          <svg
            className="w-6 h-6 text-[var(--color-accent)] mb-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M4 4h16v12H4z M4 20h16 M8 16v4 M16 16v4" />
          </svg>
          <div className="font-sans text-[14.5px] font-semibold mb-2 tracking-[-0.01em] text-[var(--color-primary)]">
            AI analyzed news
          </div>
          <div className="font-sans text-[13px] text-[var(--color-secondary)] leading-[1.6]">
            Every article tagged to the assets it affects, with sentiment scoring and an analyst style read on why it matters.
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-[26px_24px]">
          <svg
            className="w-6 h-6 text-[var(--color-accent)] mb-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
          </svg>
          <div className="font-sans text-[14.5px] font-semibold mb-2 tracking-[-0.01em] text-[var(--color-primary)]">
            Honest, not fabricated
          </div>
          <div className="font-sans text-[13px] text-[var(--color-secondary)] leading-[1.6]">
            Where real data isn't available, Atlas shows a caveat, not a guess. Sourcing is disclosed directly in the UI.
          </div>
        </div>
      </section>

      {/* 5. FOOTER CTA */}
      <footer className="text-center px-6 sm:px-10 pb-[72px]">
        <div className="font-sans text-[13px] text-[var(--color-muted)] mb-[18px]">
          Built solo, in four weeks, on a £0 API budget.
        </div>
        <Link
          href="/docs"
          className="inline-block px-6 py-[13px] bg-transparent text-[var(--color-primary)] hover:border-[var(--color-muted)] text-sm font-sans font-medium border border-[var(--color-border)] rounded-[8px] transition-colors"
        >
          Read the build notes
        </Link>
      </footer>
    </div>
  );
}
