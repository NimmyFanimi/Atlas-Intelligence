'use client';

// NewsDetailPanel.tsx
//
// Full reading view for a single news article, presented inside a centered
// modal overlay (handled by NewsFeed). Matches the reference mockup's panel
// layout: 720px hero with overlaid headline/tags, meta row, gauge row,
// analysis body, and a footer link.
//
// Reuses the exported helpers/types from NewsCard (article type, ticker/gauge/
// badge and time helpers, plus the asset-class fallback style) rather than
// duplicating them.

import {
  NewsArticle,
  NewsAiAnalysis,
  tickerLabel,
  relativeTime,
  Sentimeter,
  MacroBadge,
  fallbackStyleFor,
} from './NewsCard';

interface NewsDetailPanelProps {
  article: NewsArticle;
  // asset id -> ticker symbol, same dependency as NewsCard.
  assetsById?: Record<string, string>;
  // asset id -> asset class, for the hero fallback palette.
  assetClassById?: Record<string, string>;
  // Closes the modal overlay.
  onClose?: () => void;
}

// ── helpers ──

function absoluteTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  return `${day} ${month} ${year}, ${time}`;
}

function CloseIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// ── component ──

export default function NewsDetailPanel({
  article,
  assetsById,
  assetClassById,
  onClose,
}: NewsDetailPanelProps) {
  const analysis: NewsAiAnalysis | null = article.ai_analysis ?? null;
  const pending = !analysis;

  const hasWhat = pending ? false : Boolean(
    typeof analysis?.what_happened === 'string' && analysis!.what_happened!.trim()
  );
  const hasWhy = pending
    ? false
    : typeof analysis?.why_it_matters === 'string' && Boolean(analysis!.why_it_matters!.trim());
  const hasTrade = pending
    ? false
    : typeof analysis?.trade_read === 'string' && Boolean(analysis!.trade_read!.trim());

  const heroFallback = fallbackStyleFor(article, assetClassById);

  return (
    <div className="flex flex-col bg-[#101114] border border-[#2A2D31]">
      {/* Hero */}
      <div
        className="relative w-full aspect-[21/9] overflow-hidden"
        style={article.image_url ? undefined : heroFallback}
      >
        {article.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- remote third-party image, unknown domain/dimensions
          <img src={article.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}

        {/* bottom scrim so overlay content stays readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,11,13,0) 30%, rgba(10,11,13,0.85) 88%, #101114 100%)',
          }}
        />

        {/* macro chip top-left */}
        {article.is_macro && (
          <div className="absolute top-[18px] left-[18px]">
            <MacroBadge />
          </div>
        )}

        {/* close button top-right */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-[18px] right-[18px] inline-flex items-center justify-center w-8 h-8 text-[#E8E9EB] border border-[#E8E9EB]/[0.22] bg-[#0A0B0D]/[0.55] hover:bg-[#0A0B0D]/80 transition-colors duration-150 cursor-pointer"
        >
          <CloseIcon />
        </button>

        {/* headline + tags overlaid on the scrim at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-6 px-7 pb-6">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(article.matched_asset_ids ?? []).map((id) => (
              <span
                key={id}
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-[#5DCAA5] bg-[#0D9488]/[0.18] px-1.5 py-1 rounded-sm leading-none"
              >
                {tickerLabel(id, assetsById)}
              </span>
            ))}
          </div>
          <h2 className="text-[22px] font-semibold leading-snug tracking-[-0.01em] text-[#F5F6F7] max-w-[85%]">
            {article.title}
          </h2>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2.5 px-7 py-4 border-b border-[#1F2124] font-mono text-xs text-[#7C8187]">
        <span>{article.source ?? 'unknown'}</span>
        <span className="text-[#3A3D42]">·</span>
        <span>{relativeTime(article.published_at)}</span>
        {absoluteTimestamp(article.published_at) && (
          <>
            <span className="text-[#3A3D42]">·</span>
            <span>{absoluteTimestamp(article.published_at)}</span>
          </>
        )}
      </div>

      {/* Sentiment row */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-[#1F2124]">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#7C8187]">Sentimeter</span>
          <span className="text-xs text-[#52565C]">
            Averaged across {Math.max(1, (article.matched_asset_ids ?? []).length)} matched {article.matched_asset_ids?.length === 1 ? 'asset' : 'assets'}
          </span>
        </div>
        <Sentimeter value={article.sentiment_score} width={140} />
      </div>

      {/* Body */}
      <div className="px-7 py-6">
        {pending ? (
          <div className="border border-dashed border-[#2A2D31] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#7C8187] mb-2">Analysis</p>
            <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
              Analysis pending — this article has not been processed by the AI
              analysis pipeline yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* what_happened — leading summary */}
            {hasWhat && (
              <section aria-label="Summary">
                <p className="text-[15.5px] leading-relaxed text-[#D4D6D9] pb-5 mb-5 border-b border-[#1A1C1F]">
                  {analysis!.what_happened}
                </p>
              </section>
            )}

            {/* two-column layout, stacks below md */}
            {(hasWhy || hasTrade) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {hasWhy && (
                  <section aria-label="Why it matters">
                    <span className="block font-mono text-[10px] tracking-[0.14em] uppercase text-[#0D9488] mb-2.5">
                      Why it matters
                    </span>
                    <p className="text-[14px] leading-relaxed text-[#B8BABD]">{analysis!.why_it_matters}</p>
                  </section>
                )}
                {hasTrade && (
                  <section aria-label="Trade read">
                    <span className="block font-mono text-[10px] tracking-[0.14em] uppercase text-[#0D9488] mb-2.5">
                      Trade read
                    </span>
                    <p className="text-[14px] leading-relaxed text-[#B8BABD]">{analysis!.trade_read}</p>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider + footer link */}
      <div className="h-px w-full bg-[#1A1C1F]" />
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between px-7 py-4 font-mono text-xs font-semibold tracking-[0.02em] text-[#5DCAA6] hover:text-[#0F766E] transition-colors duration-150"
      >
        Read original article
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}