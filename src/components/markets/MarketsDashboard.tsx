'use client';

import { useState } from 'react';
import AssetSparkline from './AssetSparkline';
import DetailChart from './DetailChart';
import { formatPrice, formatChange, formatPercent, formatVolatility, getChangeColor, ChangeColor } from '@/lib/utils/format';
import { MarketsDashboardData, AssetWithSnapshot, MarketsSummary } from '@/lib/data/markets';

const SECTION_LABELS: Record<string, string> = {
  index: 'Indices',
  fx: 'FX',
  rate: 'Rates',
  commodity: 'Commodities',
};

function sectionLabel(assetClass: string): string {
  return SECTION_LABELS[assetClass] ?? assetClass.charAt(0).toUpperCase() + assetClass.slice(1);
}

function changeColorClass(color: ChangeColor): string {
  switch (color) {
    case 'up':
      return 'text-[var(--color-market-up)]';
    case 'down':
      return 'text-[var(--color-market-down)]';
    default:
      return 'text-[var(--color-secondary)]';
  }
}

function ChangePctBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  const color = getChangeColor(value);
  const bgClass =
    color === 'up'
      ? 'bg-[var(--color-market-up)]'
      : color === 'down'
      ? 'bg-[var(--color-market-down)]'
      : 'bg-[var(--color-secondary)]';
  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-semibold rounded-full px-2 py-0.5 leading-none text-[var(--color-primary)] ${bgClass} ${className ?? ''}`}
    >
      {formatPercent(value)}
    </span>
  );
}

function getBadgeColor(assetClass: string): string {
  switch (assetClass) {
    case 'index': return 'rgba(59, 130, 246, 0.12)';
    case 'fx': return 'rgba(168, 85, 247, 0.12)';
    case 'commodity': return 'rgba(13, 148, 136, 0.12)';
    case 'rate': return 'rgba(245, 158, 11, 0.12)';
    default: return 'transparent';
  }
}

function getDotColor(assetClass: string): string {
  switch (assetClass) {
    case 'index': return 'rgb(59, 130, 246)';
    case 'fx': return 'rgb(168, 85, 247)';
    case 'commodity': return 'var(--color-accent)';
    case 'rate': return 'rgb(245, 158, 11)';
    default: return 'var(--color-secondary)';
  }
}

const GRID_COLS = 'grid grid-cols-[70px_1fr_95px_85px_75px_110px] gap-x-4';

function ViewToggle({ viewMode, onViewChange }: {
  viewMode: 'cards' | 'list';
  onViewChange: (mode: 'cards' | 'list') => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-xs">
      <button
        type="button"
        onClick={() => onViewChange('cards')}
        className={`px-3 py-1 ${viewMode === 'cards' ? 'bg-[var(--color-accent)] text-[var(--color-background)]' : 'text-[var(--color-secondary)] hover:text-[var(--color-primary)]'}`}
      >
        Cards
      </button>
      <button
        type="button"
        onClick={() => onViewChange('list')}
        className={`px-3 py-1 ${viewMode === 'list' ? 'bg-[var(--color-accent)] text-[var(--color-background)]' : 'text-[var(--color-secondary)] hover:text-[var(--color-primary)]'}`}
      >
        List
      </button>
    </div>
  );
}

function formatBreakdown(breakdown: Record<string, number>): string {
  return Object.entries(breakdown)
    .map(([key, count]) => ({ label: sectionLabel(key), count }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ label, count }) => `${count} ${label}`)
    .join(', ');
}

function AssetRow({
  asset,
  selected,
  onSelect,
}: {
  asset: AssetWithSnapshot;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const absColor = changeColorClass(getChangeColor(asset.latest?.change_abs));

  return (
    <div
      className={`
        ${GRID_COLS} items-center px-5 h-12 cursor-pointer
        border-b border-[var(--color-border)] last:border-b-0
        hover:bg-[#2A2D33]/20
        focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]
      `}
      style={selected ? { backgroundColor: 'rgba(13, 148, 136, 0.05)' } : undefined}
      tabIndex={0}
      role="button"
      onClick={() => onSelect(asset.id)}
    >
      <span className="inline-flex items-center justify-center font-mono text-xs text-[var(--color-primary)] rounded px-1.5 py-0.5 leading-none" style={{ backgroundColor: getBadgeColor(asset.asset_class) }}>
        {asset.symbol}
      </span>
      <span className="text-xs text-[var(--color-primary)] truncate">{asset.name}</span>
      <span className="font-mono text-sm font-semibold text-[var(--color-primary)] text-right">
        {asset.latest ? formatPrice(asset.latest.price) : 'n/a'}
      </span>
      <span className={`font-mono text-xs text-right ${absColor}`}>
        {formatChange(asset.latest?.change_abs)}
      </span>
      <ChangePctBadge value={asset.latest?.change_pct} className="text-xs justify-self-end" />
      <div className="pl-2">
        <AssetSparkline data={asset.sparkline} changeDirection={getChangeColor(asset.latest?.change_pct)} />
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  selected,
  onSelect,
}: {
  asset: AssetWithSnapshot;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const absColor = changeColorClass(getChangeColor(asset.latest?.change_abs));

  const prices = asset.sparkline.map((p) => p.price);
  const high = prices.length > 0 ? Math.max(...prices) : null;
  const low = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <div
      className={`
        flex-shrink-0 w-64 h-56 snap-start
        bg-[var(--color-surface)] border border-[var(--color-border)]
        p-4 flex flex-col gap-2
        cursor-pointer
        focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]
      `}
      style={selected ? { backgroundColor: 'rgba(13, 148, 136, 0.05)' } : undefined}
      tabIndex={0}
      role="button"
      onClick={() => onSelect(asset.id)}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center font-mono text-xs text-[var(--color-primary)] rounded px-1.5 py-0.5 leading-none" style={{ backgroundColor: getBadgeColor(asset.asset_class) }}>
          {asset.symbol}
        </span>
        <span className="text-xs text-[var(--color-secondary)] truncate">{asset.name}</span>
      </div>
      <span className="font-mono text-2xl font-semibold text-[var(--color-primary)]">
        {asset.latest ? formatPrice(asset.latest.price) : 'n/a'}
      </span>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-sm font-semibold ${absColor}`}>
          {formatChange(asset.latest?.change_abs)}
        </span>
        <ChangePctBadge value={asset.latest?.change_pct} className="text-sm" />
      </div>
      <div className="mt-auto">
        <AssetSparkline data={asset.sparkline} changeDirection={getChangeColor(asset.latest?.change_pct)} size="lg" />
        <span className="block font-mono text-xs text-[var(--color-secondary)] mt-1">
          H: {high !== null ? formatPrice(high) : 'n/a'} L: {low !== null ? formatPrice(low) : 'n/a'}
        </span>
      </div>
    </div>
  );
}

function Section({
  section,
  assets,
  selectedId,
  onSelect,
  viewMode,
}: {
  section: string;
  assets: AssetWithSnapshot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  viewMode: 'cards' | 'list';
}) {
  return (
    <div className="mb-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="font-mono text-[13px] uppercase tracking-widest text-[var(--color-secondary)] px-5 py-3 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getDotColor(section) }} />
        {sectionLabel(section)}
      </div>
      {viewMode === 'list' ? (
        <>
          <div
            className={`${GRID_COLS} font-mono text-xs font-semibold text-[var(--color-secondary)] px-5 py-1`}
          >
            <span>SYMBOL</span>
            <span>NAME</span>
            <span className="text-right">PRICE</span>
            <span className="text-right">CHANGE</span>
            <span className="text-right">%</span>
            <span></span>
          </div>
          {assets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              selected={asset.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto px-5 py-4"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              selected={asset.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ asset }: { asset: AssetWithSnapshot }) {
  const absColor = changeColorClass(getChangeColor(asset.latest?.change_abs));

  return (
    <div className="p-6">
      <div className="mb-3">
        <h2 className="text-[var(--color-primary)] text-sm font-semibold">
          {asset.name}
        </h2>
        <span className="font-mono text-xs text-[var(--color-secondary)]">
          {asset.symbol}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-6 mb-3">
        <div>
          <span className="block font-mono text-xs text-[var(--color-secondary)]">
            PRICE
          </span>
          <span className="font-mono text-2xl text-[var(--color-primary)]">
            {asset.latest ? formatPrice(asset.latest.price) : 'n/a'}
          </span>
        </div>
        <div>
          <span className="block font-mono text-xs text-[var(--color-secondary)]">
            CHANGE
          </span>
          <span className={`font-mono text-2xl ${absColor}`}>
            {formatChange(asset.latest?.change_abs)}
          </span>
        </div>
        <div>
          <span className="block font-mono text-xs text-[var(--color-secondary)]">
            CHANGE %
          </span>
          <ChangePctBadge value={asset.latest?.change_pct} className="text-2xl" />
        </div>
      </div>
      <DetailChart data={asset.sparkline} />
    </div>
  );
}

export default function MarketsDashboard({ data }: { data: MarketsDashboardData }) {
  const [selectedId, setSelectedId] = useState<string | null>(data.defaultSelectedId);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const selectedAsset = data.assets.find((a) => a.id === selectedId) || null;
  const { biggestMover, mostVolatile, breadth, totalAssets } = data.summary;

  return (
    <div className="min-h-screen bg-[var(--color-background)] overflow-x-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_400px]">
        <div className="p-4 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 overflow-x-hidden">
            <div className="md:col-span-4 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 flex flex-col gap-2">
              <span className="font-mono text-xs text-[var(--color-secondary)] tracking-widest uppercase min-w-0 w-full">BIGGEST MOVER</span>
              {biggestMover ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center font-mono text-xs text-[var(--color-primary)] rounded px-1.5 py-0.5 leading-none" style={{ backgroundColor: getBadgeColor(biggestMover.asset_class) }}>
                      {biggestMover.symbol}
                    </span>
                    <span className="text-xs text-[var(--color-primary)] truncate">{biggestMover.name}</span>
                  </div>
                  <span className="font-mono text-2xl font-semibold text-[var(--color-primary)]">
                    {biggestMover.latest ? formatPrice(biggestMover.latest.price) : 'n/a'}
                  </span>
                  <ChangePctBadge value={biggestMover.latest?.change_pct} className="text-sm self-start" />
                  <AssetSparkline data={biggestMover.sparkline} changeDirection={getChangeColor(biggestMover.latest?.change_pct)} />
                </>
              ) : (
                <span className="font-mono text-sm text-[var(--color-secondary)]">No data</span>
              )}
            </div>
            <div className="md:col-span-4 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 flex flex-col gap-2">
              <span className="font-mono text-xs text-[var(--color-secondary)] tracking-widest uppercase min-w-0 w-full">MOST VOLATILE</span>
              {mostVolatile ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center font-mono text-xs text-[var(--color-primary)] rounded px-1.5 py-0.5 leading-none" style={{ backgroundColor: getBadgeColor(mostVolatile.asset.asset_class) }}>
                      {mostVolatile.asset.symbol}
                    </span>
                    <span className="text-xs text-[var(--color-primary)] truncate">{mostVolatile.asset.name}</span>
                  </div>
                  <span className="font-mono text-2xl font-semibold text-[var(--color-primary)]">
                    {mostVolatile.asset.latest ? formatPrice(mostVolatile.asset.latest.price) : 'n/a'}
                  </span>
                  <span className="font-mono text-sm font-semibold text-[var(--color-secondary)]">
                    {formatVolatility(mostVolatile.volatility)}
                  </span>
                  <AssetSparkline data={mostVolatile.asset.sparkline} changeDirection={getChangeColor(mostVolatile.asset.latest?.change_pct)} />
                </>
              ) : (
                <span className="font-mono text-sm text-[var(--color-secondary)]">No data</span>
              )}
            </div>
            <div className="md:col-span-2 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 flex flex-col gap-2">
              <span className="font-mono text-xs text-[var(--color-secondary)] tracking-widest uppercase min-w-0 w-full">MARKET BREADTH</span>
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xl font-semibold text-[var(--color-market-up)]">{breadth.up}</span>
                  <span className="font-mono text-xs text-[var(--color-secondary)]">UP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xl font-semibold text-[var(--color-market-down)]">{breadth.down}</span>
                  <span className="font-mono text-xs text-[var(--color-secondary)]">DOWN</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xl font-semibold text-[var(--color-secondary)]">{breadth.flat}</span>
                  <span className="font-mono text-xs text-[var(--color-secondary)]">FLAT</span>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] p-4 flex flex-col gap-2">
              <span className="font-mono text-xs text-[var(--color-secondary)] tracking-widest uppercase min-w-0 w-full">ASSETS TRACKED</span>
              <span className="font-mono text-2xl font-semibold text-[var(--color-primary)]">{totalAssets.total}</span>
              <span className="font-mono text-xs text-[var(--color-secondary)] min-w-0 w-full break-words">{formatBreakdown(totalAssets.breakdown)}</span>
            </div>
          </div>

          <div className="mb-6">
            <ViewToggle viewMode={viewMode} onViewChange={setViewMode} />
          </div>

          {Object.keys(data.grouped).map((section) => (
            <Section
              key={section}
              section={section}
              assets={data.grouped[section]}
              selectedId={selectedId}
              onSelect={setSelectedId}
              viewMode={viewMode}
            />
          ))}
        </div>
        <div className="border-t border-[var(--color-border)] md:border-t-0 md:border-l bg-[var(--color-surface)]">
          {selectedAsset ? (
            <DetailPanel asset={selectedAsset} />
          ) : (
            <div className="p-4 text-[var(--color-secondary)] font-mono text-xs">
              No asset selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
