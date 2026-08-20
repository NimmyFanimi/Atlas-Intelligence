'use client';

import React from 'react';
import Link from 'next/link';
import { CommodityOverview } from '@/lib/data/commodities';

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;
const VERTICAL_PAD = 2;

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sparklineColor(changePct: number | null | undefined): string {
  if (changePct === null || changePct === undefined || isNaN(changePct)) {
    return 'var(--color-accent)';
  }
  return changePct >= 0 ? 'var(--color-market-up)' : 'var(--color-market-down)';
}

/**
 * Flattens the price series into an SVG polyline points string, normalising
 * values to the 0-32 viewBox height (newest right). Oldest -> newest maps
 * left -> right as the data comes out of getCommoditiesOverview().
 */
function buildSparklinePoints(prices: number[]): string {
  if (prices.length === 0) return '';
  if (prices.every((p) => p === prices[0])) {
    const y = SPARK_HEIGHT / 2;
    return `0,${y} ${SPARK_WIDTH},${y}`;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const stepX = prices.length > 1 ? SPARK_WIDTH / (prices.length - 1) : 0;

  return prices
    .map((p, i) => {
      const x = i * stepX;
      const y = VERTICAL_PAD + (1 - (p - min) / range) * (SPARK_HEIGHT - VERTICAL_PAD * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
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

function CommodityCard({ commodity }: { commodity: CommodityOverview }) {
  const changePct = commodity.latest?.change_pct ?? null;
  const prices = commodity.sparkline.map((p) => p.price);
  const showSpark = prices.length > 0;
  const color = sparklineColor(changePct);

  return (
    <Link
      href={`/commodities/${commodity.symbol.toLowerCase()}`}
      className="flex flex-col gap-3 p-5 bg-[var(--color-background)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors duration-150 min-w-0"
    >
      <div className="min-w-0">
        <div className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-secondary)]/60">
          {commodity.symbol}
        </div>
        <div className="text-[15px] font-medium text-[var(--color-primary)] mt-1">
          {commodity.name}
        </div>
      </div>

      <div className="flex items-center gap-2.5 min-w-0">
        {commodity.latest ? (
          <div className="font-mono text-2xl font-bold text-[var(--color-primary)]">
            {formatPrice(commodity.latest.price)}
          </div>
        ) : (
          <div className="font-mono text-2xl font-bold text-[var(--color-secondary)]/60">
            --
          </div>
        )}
        <ChangeChip value={changePct} />
      </div>

      {showSpark ? (
        <svg
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full h-8"
          aria-hidden="true"
        >
          <polygon
            points={`${buildSparklinePoints(prices)} ${SPARK_WIDTH},${SPARK_HEIGHT} 0,${SPARK_HEIGHT}`}
            fill={color}
            fillOpacity={0.12}
          />
          <polyline
            points={buildSparklinePoints(prices)}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="h-8 w-full" />
      )}
    </Link>
  );
}

export default function CommoditiesOverview({
  commodities,
}: {
  commodities: CommodityOverview[];
}) {
  const isEmpty = commodities.length === 0;

  return (
    <div className="p-9">
      {/* Header */}
      <div className="mb-7">
        <div className="font-mono text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-accent)]">
          Commodities
        </div>
        <div className="text-2xl font-semibold tracking-[-0.01em] mt-1.5 text-[var(--color-primary)]">
          Watchlist Overview
        </div>
      </div>

      {isEmpty ? (
        <div className="text-[13px] text-[var(--color-secondary)]/50 px-[2px] py-2">
          No commodities tracked
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {commodities.map((commodity) => (
            <CommodityCard key={commodity.id} commodity={commodity} />
          ))}
        </div>
      )}
    </div>
  );
}