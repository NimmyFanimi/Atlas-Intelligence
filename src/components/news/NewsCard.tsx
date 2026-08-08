'use client';

// NewsCard.tsx
//
// Single news_articles card. Designed to match MarketsDashboard's flat,
// hairlined, no-gradient/no-shadow visual language while staying a fully
// independent component tree (no shared code with the dashboard).
//
// Note on tickers: a news_articles row only stores matched_asset_ids (asset
// UUIDs), not ticker symbols. To render real ticker pills in the tag row this
// card accepts an optional `assetsById` map (asset id -> ticker symbol)
// supplied by the parent feed/detail later. If omitted, pills fall back to a
// truncated asset id so the card still renders gracefully.

export interface NewsAiAnalysis {
  what_happened?: string | null;
  why_it_matters?: string | null;
  trade_read?: string | null;
  [key: string]: unknown;
}

// Mirrors the production news_articles row shape (supabase_schema.sql),
// including the new image_url column.
export interface NewsArticle {
  id: string;
  marketaux_uuid: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  source: string | null;
  published_at: string;
  sentiment_score: number | null;
  matched_asset_ids: string[];
  is_macro: boolean;
  ai_analysis: NewsAiAnalysis | null;
  ai_model_used: string | null;
  created_at?: string | null;
}

interface NewsCardProps {
  article: NewsArticle;
  // asset id -> ticker symbol, used to turn matched_asset_ids into ticker pills.
  assetsById?: Record<string, string>;
  // asset id -> asset class, used to pick the image-fallback palette.
  assetClassById?: Record<string, string>;
  // Fires when the card is clicked (intended to open a detail panel later).
  onSelect?: (articleId: string) => void;
}

// ── image-fallback palette, keyed by asset class ──
// RGB triplets, chosen to hint at what an article is about.
const ASSET_FALLBACK_PALETTE: Record<string, string> = {
  index: '13,148,136', // Indices — teal
  fx: '127,119,221', // FX — purple
  rate: '212,83,126', // Rates — pink
  commodity: '216,90,48', // Commodities — coral
};
const FALLBACK_GRAY = '136,135,128'; // Macro-only / mixed classes / none

// Fallback-rule decision (shared by NewsCard image + modal hero):
// use the RGB of the FIRST matched asset whose class is in the palette.
// Macro-only articles (empty matched_asset_ids) and mixed-class matches fall
// back to gray. Returns a `background-image` gradient for the tinted fill.
export function fallbackStyleFor(
  article: Pick<NewsArticle, 'matched_asset_ids'>,
  assetClassById?: Record<string, string>
): React.CSSProperties {
  let rgb = FALLBACK_GRAY;
  for (const assetId of article.matched_asset_ids ?? []) {
    const cls = assetClassById?.[assetId];
    const resolved = cls ? ASSET_FALLBACK_PALETTE[cls] : undefined;
    if (resolved) {
      rgb = resolved;
      break;
    }
  }
  return {
    backgroundImage: `linear-gradient(135deg, rgba(${rgb},0.20), rgba(${rgb},0.05))`,
  };
}

// ── helpers ──

const TICKER_PILL_LIMIT = 2;

export function tickerLabel(assetId: string, assetsById?: Record<string, string>): string {
  const symbol = assetsById?.[assetId];
  if (symbol) return symbol.toUpperCase();
  // No symbol known -> fall back to a shortened asset id so the pill never
  // renders completely empty.
  return assetId.slice(0, 4).toUpperCase();
}

export function relativeTime(iso: string): string {
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatSentiment(value: number): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

// Needle-and-arc Sentimeter.
//
// Geometry mirrors the reference mockup's SVG: a semicircular arc from -1
// (left) to +1 (right) with pivot at (70,70). Both the active-fill length and
// the needle rotation are computed from the REAL sentiment_score (clamped to
// -1..+1), never hardcoded.
//
// Angle mapping: score -1 → -90deg (pointing left), +1 → +90deg (right), 0 → 0.
// The active arc fill spans from the -1 end up to the score's angular position,
// so +0.42 lights ~71% and -0.29 lights ~35% of the semicircle respectively.
export function Sentimeter({ value, width = 140 }: { value: number | null; width?: number }) {
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  const safe = value !== null && !Number.isNaN(value) ? clamp(value) : null;

  // viewBox is taller than the arc so the numeric readout (rendered below the
  // needle pivot) stays inside the drawable area and isn't clipped out, and so
  // the −1/+1 scale labels have room to sit clear of the arc ends.
  const viewBox = '0 0 140 122';
  const R = 58;
  const cx = 70;
  const cy = 70;
  // Full semicircle arc length (half a circle of radius R).
  const totalArc = Math.PI * R * (180 / 180); // = π*R
  const startX = cx - R;
  const endX = cx + R;
  const arcPath = `M ${startX} ${cy} A ${R} ${R} 0 0 1 ${endX} ${cy}`;

  // angleDeg: position of score along the arc, measured from the -1 (left) end.
  // -1→0deg, 0→90deg (apex), +1→180deg (right).
  const angleDeg = safe === null ? 0 : (safe + 1) * 90;
  // fill = arc length from the -1 end up to the score's position.
  const fill = safe === null ? 0 : (angleDeg / 180) * totalArc;
  // needle rotation about pivot: score -1→-90deg (left), 0→0 (up), +1→+90deg (right)
  const needleRot = safe === null ? 0 : safe * 90;

  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={width * (122 / 140)}
      fill="none"
      aria-hidden="true"
    >
      {/* dim base track */}
      <path d={arcPath} stroke="#123832" strokeWidth="7" strokeLinecap="round" />
      {/* active fill: from the -1 end up to the score position (teal only, dim→bright) */}
      {safe !== null && (
        <path
          d={arcPath}
          stroke="#0D9488"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${totalArc}`}
          strokeDashoffset={0}
          opacity={0.9}
        />
      )}
      {/* needle */}
      <g transform={`translate(${cx},${cy}) rotate(${needleRot})`}>
        <line x1="0" y1="0" x2="0" y2={-49} stroke="#F5F6F7" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r="5" fill="#F5F6F7" />
      {/* scale labels inset below each arc end, clear of the arc stroke */}
      <text x={startX + 7} y={cy + 20} fontFamily="'JetBrains Mono',monospace" fontSize="11" fill="#4A4E54">
        −1
      </text>
      <text x={endX - 7} y={cy + 20} fontFamily="'JetBrains Mono',monospace" fontSize="11" fill="#4A4E54" textAnchor="end">
        +1
      </text>
      {/* numeric readout centered beneath the arc, under the needle */}
      <text
        x={cx}
        y={cy + 40}
        fontFamily="'JetBrains Mono',monospace"
        fontSize="15"
        fontWeight="700"
        fill="#F5F6F7"
        textAnchor="middle"
        letterSpacing="-0.01em"
      >
        {safe === null ? '—' : formatSentiment(value as number)}
      </text>
    </svg>
  );
}

export function MacroBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent)] border-l-2 border-[var(--color-accent)] pl-1.5 leading-none"
    >
      <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[var(--color-accent)]" />
      Macro
    </span>
  );
}

// ── component ──

export default function NewsCard({ article, assetsById, assetClassById, onSelect }: NewsCardProps) {
  const matched = article.matched_asset_ids ?? [];
  const visibleTickers = matched.slice(0, TICKER_PILL_LIMIT);
  const overflowCount = Math.max(0, matched.length - TICKER_PILL_LIMIT);
  const fallbackStyle = fallbackStyleFor(article, assetClassById);

  const teaser =
    (typeof article.ai_analysis?.why_it_matters === 'string' &&
      article.ai_analysis.why_it_matters.trim()) ||
    (typeof article.description === 'string' && article.description.trim()) ||
    '';

  return (
    <article
      tabIndex={0}
      role="button"
      onClick={() => onSelect?.(article.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(article.id);
        }
      }}
      className="group flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] transition-colors duration-150 hover:border-[var(--color-border)]"
    >
      {/* 1. Image */}
      <div className="relative aspect-video w-full overflow-hidden" style={fallbackStyle}>
        {article.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote third-party image, unknown domain/dimensions
          <img
            src={article.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}

        {/* 2. Macro badge — separate corner chip, not a ticker pill. */}
        {article.is_macro && (
          <div className="absolute right-2 top-2">
            <MacroBadge />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* 2. Tag row — ticker pills + overflow */}
        <div className="flex items-center gap-1.5">
          {visibleTickers.map((id) => (
            <span
              key={id}
              className="inline-flex items-center justify-center font-mono text-[10px] font-semibold uppercase leading-none rounded-sm bg-[var(--color-accent)]/12 text-[var(--color-accent)] px-1.5 py-1"
            >
              {tickerLabel(id, assetsById)}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="inline-flex items-center justify-center font-mono text-[10px] font-semibold leading-none rounded-sm bg-[var(--color-secondary)]/15 text-[var(--color-secondary)] px-1.5 py-1">
              +{overflowCount}
            </span>
          )}
        </div>

        {/* 3. Headline */}
        <h3 className="text-[var(--color-primary)] font-semibold text-base leading-snug tracking-tight line-clamp-2">
          {article.title}
        </h3>

        {/* 4. Metadata line */}
        <p className="font-mono text-xs text-[var(--color-secondary)] mt-1">
          {article.source ?? 'unknown'} · {relativeTime(article.published_at)}
        </p>

        {/* 5. One-line teaser */}
        {teaser ? (
          <p className="mt-2 truncate text-[var(--color-secondary)] text-[13px] leading-relaxed">
            {teaser}
          </p>
        ) : null}
      </div>

      {/* 6. Full-bleed hairline closing off the bottom edge of the card,
          outside the padded content wrapper. */}
      <div className="h-px w-full bg-[var(--color-border)]/50" />
    </article>
  );
}