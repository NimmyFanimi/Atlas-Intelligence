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

interface DetailChartProps {
  data: { timestamp: string; price: number }[];
}

export default function DetailChart({ data }: DetailChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center text-[var(--color-secondary)] font-mono text-xs">
        No historical data available
      </div>
    );
  }

  const formatTime = (tick: string) => {
    const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(tick);
    const date = new Date(hasZone ? tick : `${tick}Z`);
    return date.toLocaleTimeString('en-US', {
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

  return (
    <div className="w-full h-80">
      <style>{`
        .recharts-surface {
          outline: none;
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--color-border)" strokeWidth={1} />
          <XAxis
            dataKey="timestamp"
            stroke="var(--color-secondary)"
            fontSize={11}
            tick={{ style: { fontFamily: 'var(--font-jetbrains-mono)' } }}
            tickFormatter={formatTime}
            minTickGap={8}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="var(--color-secondary)"
            fontSize={11}
            tick={{ style: { fontFamily: 'var(--font-jetbrains-mono)' } }}
            tickFormatter={formatPriceTick}
            domain={['dataMin', 'dataMax']}
            orientation="right"
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(label) => formatTime(label as string)}
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              borderWidth: 1,
            }}
            labelStyle={{
              color: 'var(--color-secondary)',
              fontSize: 11,
              fontFamily: 'var(--font-jetbrains-mono)',
            }}
            itemStyle={{
              color: 'var(--color-primary)',
              fontSize: 11,
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
