'use client';

import { useMemo } from 'react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DetailChartProps {
  data: { timestamp: string; price: number }[];
  timeframe: string;
}

const LONG_TIMEFRAMES = new Set(['7D', '30D']);

function parseTimestamp(timestamp: string): Date {
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(timestamp);
  return new Date(hasZone ? timestamp : `${timestamp}Z`);
}

export default function DetailChart({ data, timeframe }: DetailChartProps) {
  const isLongRange = LONG_TIMEFRAMES.has(timeframe);

  const formatTime = (tick: string) => {
    return parseTimestamp(tick).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (tick: string) => {
    return parseTimestamp(tick).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const dayTicks = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    if (!isLongRange) return null;
    for (const point of data) {
      const day = formatDate(point.timestamp);
      if (!seen.has(day)) {
        seen.add(day);
        result.push(point.timestamp);
      }
    }
    return result;
  }, [data, isLongRange]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-[var(--color-secondary)] font-mono text-xs">
        No historical data available
      </div>
    );
  }

  const formatAxisTick = (tick: string) => {
    if (!isLongRange) return formatTime(tick);
    return formatDate(tick);
  };

  const formatTooltipLabel = (label: string) => {
    if (isLongRange) {
      return parseTimestamp(label).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return formatTime(label);
  };

  const formatPriceTick = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="w-full h-80">
      <style>{`
        .recharts-surface {
          outline: none;
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="rgba(42, 45, 51, 0.5)" strokeWidth={1} />
          <XAxis
            dataKey="timestamp"
            stroke="var(--color-secondary)"
            fontSize={12}
            ticks={dayTicks ?? undefined}
            tick={{ style: { fontFamily: 'var(--font-jetbrains-mono)' } }}
            tickFormatter={formatAxisTick}
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
              if (value === undefined || value === null) {
                return ['n/a', 'Price'];
              }
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
