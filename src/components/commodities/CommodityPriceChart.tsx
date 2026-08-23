'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ChartPoint } from '@/lib/data/commodityDetail';

function parseTimestamp(timestamp: string): Date {
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(timestamp);
  return new Date(hasZone ? timestamp : `${timestamp}Z`);
}

export default function CommodityPriceChart({ data }: { data: ChartPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[220px] flex items-center justify-center text-[var(--color-secondary)]/60 font-mono text-xs">
        No historical data available
      </div>
    );
  }

  const formatDate = (tick: string) => {
    return parseTimestamp(tick).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTooltipLabel = (label: string) => {
    return parseTimestamp(label).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPriceTick = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Unique day ticks
  const dayTicks: string[] = [];
  const seen = new Set<string>();
  for (const p of data) {
    const d = formatDate(p.timestamp);
    if (!seen.has(d)) {
      seen.add(d);
      dayTicks.push(p.timestamp);
    }
  }

  return (
    <div className="w-full h-[220px]">
      <style>{`.recharts-surface{outline:none;}`}</style>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="rgba(42, 45, 51, 0.5)" strokeWidth={1} />
          <XAxis
            dataKey="timestamp"
            stroke="var(--color-secondary)"
            fontSize={12}
            ticks={dayTicks}
            tick={{ style: { fontFamily: 'var(--font-jetbrains-mono)' } }}
            tickFormatter={formatDate}
            minTickGap={8}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="var(--color-secondary)"
            fontSize={12}
            tick={{ style: { fontFamily: 'var(--font-jetbrains-mono)' } }}
            tickFormatter={formatPriceTick}
            domain={['dataMin', 'dataMax']}
            orientation="right"
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            labelFormatter={(label) => formatTooltipLabel(label as string)}
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              borderWidth: 1,
            }}
            labelStyle={{
              color: 'var(--color-secondary)',
              fontSize: 12,
              fontFamily: 'var(--font-jetbrains-mono)',
            }}
            itemStyle={{
              color: 'var(--color-primary)',
              fontSize: 12,
              fontFamily: 'var(--font-jetbrains-mono)',
            }}
            formatter={(value) => {
              if (value === undefined || value === null) return ['n/a', 'Price'];
              const num = typeof value === 'number' ? value : Number(value);
              if (isNaN(num)) return ['n/a', 'Price'];
              return [formatPriceTick(num), 'Price'];
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
