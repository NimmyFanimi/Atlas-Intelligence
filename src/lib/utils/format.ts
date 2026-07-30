export function formatPrice(price: number): string {
  if (isNaN(price)) return 'n/a';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(price);
}

export function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'n/a';
  return new Intl.NumberFormat('en-US', {
    signDisplay: 'exceptZero',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'n/a';
  const formatted = new Intl.NumberFormat('en-US', {
    signDisplay: 'exceptZero',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

export function formatVolatility(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'n/a';
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

export type ChangeColor = 'up' | 'down' | 'neutral';

export function getChangeColor(value: number | null | undefined): ChangeColor {
  if (value === null || value === undefined || isNaN(value)) return 'neutral';
  return value >= 0 ? 'up' : 'down';
}
