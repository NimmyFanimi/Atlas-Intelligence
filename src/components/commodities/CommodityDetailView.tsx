import Link from 'next/link';
import type { CommodityDetail } from '@/lib/data/commodityDetail';
import { getSourceLabel, getLastUpdatedDate } from '@/lib/data/commodityDetail';
import CommodityPriceChart from './CommodityPriceChart';

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDollarChange(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  // Use fixed 2 decimals, preserve sign from value (negative already includes -)
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value === 0) return `$0.00`;
  if (value > 0) return `+$${formatted}`;
  return `-$${formatted}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLastUpdated(iso: string | null): string {
  if (!iso) return '--';
  return formatShortDate(iso);
}

function ChangeChip({ value }: { value: number | null }) {
  if (value === null || value === undefined || isNaN(value)) {
    return (
      <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 text-[var(--color-secondary)] bg-[var(--color-secondary)]/12">
        --
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      className={`font-mono text-[11px] font-semibold px-1.5 py-0.5 ${
        positive
          ? 'text-[var(--color-market-up)] bg-[var(--color-market-up)]/12'
          : 'text-[var(--color-market-down)] bg-[var(--color-market-down)]/12'
      }`}
    >
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatShortDate(iso);
}

export default function CommodityDetailView({ commodity }: { commodity: CommodityDetail }) {
  const latest = commodity.latest;
  const sourceLabel = latest ? getSourceLabel(latest.metadata) : '--';
  const lastUpdatedRaw = latest ? getLastUpdatedDate(latest.metadata) : null;
  const lastUpdatedDisplay = formatLastUpdated(lastUpdatedRaw);

  const changeAbsDisplay = formatDollarChange(latest?.change_abs ?? null);

  const rangeDisplay =
    commodity.range.min !== null && commodity.range.max !== null
      ? `$${formatPrice(commodity.range.min)} - $${formatPrice(commodity.range.max)}`
      : '--';

  const caveatDisplay = commodity.range.earliestDate
    ? `Data since ${formatShortDate(commodity.range.earliestDate)}`
    : null;

  return (
    <div className="p-9">
      {/* Breadcrumb */}
      <div className="font-mono text-[11px] tracking-[0.05em] uppercase text-[var(--color-secondary)]/60 mb-4">
        <Link href="/commodities" className="hover:text-[var(--color-accent)] transition-colors">
          Commodities
        </Link>
        <span className="mx-1">/</span>
        <span className="text-[var(--color-accent)]">{commodity.name}</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start pb-5 border-b border-[var(--color-border)] mb-6">
        <div>
          <div className="text-[26px] font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
            {commodity.name}
          </div>
          <div className="font-mono text-[12px] text-[var(--color-secondary)]/60 mt-1">
            {commodity.symbol} · Sourced via {sourceLabel}
          </div>
        </div>
        <div className="text-right">
          {latest ? (
            <div className="font-mono text-[28px] font-semibold text-[var(--color-primary)]">
              ${formatPrice(latest.price)}
            </div>
          ) : (
            <div className="font-mono text-[28px] font-semibold text-[var(--color-secondary)]/60">--</div>
          )}
          <div className="mt-1 flex justify-end">
            <ChangeChip value={latest?.change_pct ?? null} />
          </div>
        </div>
      </div>

      {/* Chart panel — filtered to current real source only; "Last 30 Days" would be misleading
          since real-source data only exists since Aug 19 (~4-5 days as of now). */}
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-6">
        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--color-secondary)] mb-4">
          Price History
        </div>
        <CommodityPriceChart data={commodity.history} />
      </div>

      {/* Stats row — corrected spec: Source / Change $ / Range Since Tracking / Last Updated */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--color-border)] border border-[var(--color-border)] mb-6">
        <div className="bg-[var(--color-surface)] px-[18px] py-4">
          <div className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--color-secondary)]/60 mb-2">
            Source
          </div>
          <div className="font-mono text-[16px] font-semibold text-[var(--color-primary)]">{sourceLabel}</div>
        </div>
        <div className="bg-[var(--color-surface)] px-[18px] py-4">
          <div className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--color-secondary)]/60 mb-2">
            Change ($)
          </div>
          <div className="font-mono text-[16px] font-semibold text-[var(--color-primary)]">{changeAbsDisplay}</div>
        </div>
        <div className="bg-[var(--color-surface)] px-[18px] py-4">
          <div className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--color-secondary)]/60 mb-2">
            Range Since Tracking Began
          </div>
          <div className="font-mono text-[16px] font-semibold text-[var(--color-primary)]">{rangeDisplay}</div>
          {caveatDisplay && (
            <div className="text-[10px] text-[var(--color-secondary)]/60 mt-1 italic">{caveatDisplay}</div>
          )}
        </div>
        <div className="bg-[var(--color-surface)] px-[18px] py-4">
          <div className="font-mono text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--color-secondary)]/60 mb-2">
            Last Updated
          </div>
          <div className="font-mono text-[16px] font-semibold text-[var(--color-primary)]">{lastUpdatedDisplay}</div>
        </div>
      </div>

      {/* Related news */}
      <div>
        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--color-secondary)] mb-[14px]">
          Related News
        </div>
        {commodity.relatedNews.length === 0 ? (
          <div className="text-[13px] text-[var(--color-secondary)]/60 italic py-2">
            No related news currently tagged.
          </div>
        ) : (
          <div className="flex flex-col">
            {commodity.relatedNews.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="py-[14px] border-b border-[var(--color-border)] last:border-b-0 hover:opacity-80 transition-opacity block"
              >
                <div className="text-[14px] text-[var(--color-primary)] leading-snug">{article.title}</div>
                <div className="font-mono text-[10.5px] text-[var(--color-secondary)]/60 mt-1">
                  {article.source ?? 'unknown'} · {relativeTime(article.published_at)}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
