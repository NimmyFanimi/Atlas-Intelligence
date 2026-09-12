'use client';

// NewsFeed.tsx
//
// Top-level feed for the /news page. Matches the MarketsDashboard data-flow
// pattern: a server page fetches news + the asset symbol map and passes it in
// as a `data` prop; this client component handles view state, grouping, and
// the detail modal.
//
// Detail interaction: News Engine uses a centered MODAL OVERLAY (720px), with
// the grid behind it blurred and dimmed. This is intentionally different from
// Markets Dashboard's right-column side panel — a deliberate per-module
// interaction pattern. Closing happens via the panel's close button, a
// backdrop click, or the Escape key.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NewsCard, { NewsArticle, NewsAiAnalysis } from './NewsCard';
import NewsDetailPanel from './NewsDetailPanel';
import type { NewsFeedData } from '@/lib/news';
import { fetchArticleAnalysis, fetchRecentArticles } from '@/lib/data/newsAnalysis';

type ViewMode = 'unified' | 'split';

// ── local view toggle (mirrors MarketsDashboard.ViewToggle look, separate region) ──
function FeedViewToggle({ viewMode, onViewChange }: {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
}) {
  const base = 'px-4 py-1 transition-colors duration-150';
  const active = 'bg-[var(--color-accent)] text-[var(--color-background)]';
  const idle = 'text-[var(--color-secondary)] hover:text-[var(--color-primary)]';
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-xs">
      <button type="button" onClick={() => onViewChange('unified')} className={`${base} ${viewMode === 'unified' ? active : idle}`}>
        Unified
      </button>
      <button type="button" onClick={() => onViewChange('split')} className={`${base} ${viewMode === 'split' ? active : idle}`}>
        Split
      </button>
    </div>
  );
}

// ── section header (matches MarketsDashboard's section header treatment) ──
function FeedSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-secondary)]/70 flex items-center gap-2 mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-accent)]" />
        {label}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </section>
  );
}

// ── prev/next modal navigation (mirrors MarketsDashboard's carousel chevron
//    pattern: rounded hairline button, accent chevron, visible on hover) ──
function ModalChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function ModalNavButton({ direction, onClick, disabled }: {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={direction === 'left' ? 'Previous article' : 'Next article'}
      onClick={onClick}
      disabled={disabled}
      className="w-10 h-10 rounded-full bg-[var(--color-surface)]/80 border border-[var(--color-border)] text-[var(--color-accent)] flex items-center justify-center transition-colors duration-150 cursor-pointer hover:border-[var(--color-accent)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] disabled:opacity-30 disabled:cursor-default disabled:hover:border-[var(--color-border)]"
    >
      <ModalChevronIcon direction={direction} />
    </button>
  );
}

// ── card grid (shared by unified + every split section) ──
function CardGrid({ articles, assetsById, assetClassById, onSelect }: {
  articles: NewsArticle[];
  assetsById: Record<string, string>;
  assetClassById: Record<string, string>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {articles.map((article) => (
        <NewsCard
          key={article.id}
          article={article}
          assetsById={assetsById}
          assetClassById={assetClassById}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface NewsFeedProps {
  // null while the server page is still loading.
  data: NewsFeedData | null;
}

export default function NewsFeed({ data }: NewsFeedProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Records which visible list the currently-open article was clicked from so
  // prev/next navigate within that same ordered list: '__all' for the unified
  // grid, otherwise the id of the split-view section it belongs to.
  const [sourceSection, setSourceSection] = useState<string>('__all');

  // Articles inserted by the news cron after ISR generation, merged in once
  // on mount by the effect below. They become normal members of articles,
  // so modal, split view, nav, and fallbacks need no special casing.
  const [addedArticles, setAddedArticles] = useState<NewsArticle[]>([]);
  // Mount guard so the recent fetch runs at most once per page load, and
  // only after server data is available (data can be null while loading).
  const fetchedRecentRef = useRef(false);

  const articles = useMemo(() => {
    const base = data?.articles ?? [];
    if (addedArticles.length === 0) return base;
    const seen = new Set(base.map((a) => a.id));
    const fresh = addedArticles.filter((a) => !seen.has(a.id));
    if (fresh.length === 0) return base;
    return [...fresh, ...base].sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  }, [data?.articles, addedArticles]);
  const assetsById = useMemo(() => data?.assetsById ?? {}, [data?.assetsById]);
  const assetClassById = useMemo(() => data?.assetClassById ?? {}, [data?.assetClassById]);

  // One-shot list refresh on mount: fetch a small recent batch and prepend
  // any ids not already in the cached list, sorted by published_at desc.
  // Additive rows only, never updates existing rows. No interval, no polling,
  // no refetch on focus, no subscription. A later refresh or remount picks
  // up ISR state normally.
  useEffect(() => {
    if (!data || fetchedRecentRef.current) return;
    fetchedRecentRef.current = true;
    let cancelled = false;
    const knownIds = new Set((data.articles ?? []).map((a) => a.id));
    fetchRecentArticles(10)
      .then((recent) => {
        if (cancelled || !recent) return;
        const genuinelyNew = recent.filter((a) => !knownIds.has(a.id));
        if (genuinelyNew.length === 0) return;
        setAddedArticles((prev) => {
          const seen = new Set([...knownIds, ...prev.map((a) => a.id)]);
          const toAdd = genuinelyNew.filter((a) => !seen.has(a.id));
          if (toAdd.length === 0) return prev;
          return [...prev, ...toAdd];
        });
      })
      .catch(() => {
        // fetchRecentArticles returns null on error, so this is only a safety net.
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  // Fresh ai_analysis values fetched client-side for articles that were still
  // pending in the ISR-cached list, keyed by article id so a refresh for one
  // article never affects any other.
  const [analysisOverrides, setAnalysisOverrides] = useState<
    Record<string, { ai_analysis: NewsAiAnalysis; ai_model_used: string | null }>
  >({});

  const cachedSelectedArticle = articles.find((a) => a.id === selectedId) ?? null;
  // Merge any client-side refresh into the local copy passed to the modal, so
  // NewsDetailPanel needs no prop or rendering changes.
  const selectedArticle =
    cachedSelectedArticle && selectedId && analysisOverrides[selectedId]
      ? { ...cachedSelectedArticle, ...analysisOverrides[selectedId] }
      : cachedSelectedArticle;

  const openArticle = useCallback((id: string, section: string) => {
    setSourceSection(section);
    setSelectedId(id);
  }, []);

  const closeModal = useCallback(() => setSelectedId(null), []);

  // One-shot refetch when the modal opens, only for articles whose cached
  // ai_analysis is still null. If the row has since been analyzed, the fresh
  // value is merged above and the modal re-renders with it. No polling, no
  // refetch loop, no subscription. A still-null result or a fetch error simply
  // leaves the existing cached (pending) state in place.
  useEffect(() => {
    if (!selectedId) return;
    const cached = articles.find((a) => a.id === selectedId) ?? null;
    if (!cached || cached.ai_analysis) return;
    if (analysisOverrides[selectedId]) return;
    let cancelled = false;
    fetchArticleAnalysis(selectedId)
      .then((result) => {
        if (cancelled) return;
        if (result?.ai_analysis) {
          setAnalysisOverrides((prev) => ({
            ...prev,
            [selectedId]: {
              ai_analysis: result.ai_analysis as NewsAiAnalysis,
              ai_model_used: result.ai_model_used,
            },
          }));
        }
      })
      .catch((err) => {
        console.warn('[NewsFeed] article analysis refetch failed, using cached state:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, articles, analysisOverrides]);

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!selectedArticle) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedArticle, closeModal]);

  // Split view grouping: market-wide (is_macro) + a section per matched asset.
  // An article appears in multiple sections when it matches multiple assets,
  // since is_macro and matched_asset_ids are independent fields.
  const splitSections = useMemo(() => {
    const sections: { id: string; label: string; articles: NewsArticle[] }[] = [];

    const macroArticles = articles.filter((a) => a.is_macro);
    if (macroArticles.length > 0) {
      sections.push({ id: '__macro', label: 'Market-wide', articles: macroArticles });
    }

    const assetLookup = new Map<string, { label: string; articles: NewsArticle[] }>();
    for (const article of articles) {
      for (const assetId of article.matched_asset_ids) {
        if (!assetLookup.has(assetId)) {
          assetLookup.set(assetId, {
            label: assetsById[assetId] ?? assetId.slice(0, 4).toUpperCase(),
            articles: [],
          });
        }
        assetLookup.get(assetId)!.articles.push(article);
      }
    }
    for (const [assetId, group] of assetLookup) {
      sections.push({
        id: assetId,
        label: group.label,
        articles: group.articles,
      });
    }
    return sections;
  }, [articles, assetsById]);

  // Ordered list the modal's prev/next navigate through — the same list the
  // clicked card was shown in: the full unified grid, or the specific split
  // section the article belongs to. Duplicates across split sections are
  // avoided because each list is one section's slice.
  const navList = useMemo(() => {
    if (viewMode === 'split' && sourceSection !== '__all') {
      return splitSections.find((s) => s.id === sourceSection)?.articles ?? articles;
    }
    return articles;
  }, [viewMode, sourceSection, splitSections, articles]);

  const currentIndex = navList.findIndex((a) => a.id === selectedId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < navList.length - 1;
  const goPrev = useCallback(() => {
    if (hasPrev) setSelectedId(navList[currentIndex - 1].id);
  }, [hasPrev, navList, currentIndex]);
  const goNext = useCallback(() => {
    if (hasNext) setSelectedId(navList[currentIndex + 1].id);
  }, [hasNext, navList, currentIndex]);

  const body = viewMode === 'split' ? (
    splitSections.length > 0 ? (
      splitSections.map((section) => (
        <FeedSection key={section.id} label={section.label}>
          {section.articles.map((article) => (
            <NewsCard
              key={article.id}
              article={article}
              assetsById={assetsById}
              assetClassById={assetClassById}
              onSelect={(id) => openArticle(id, section.id)}
            />
          ))}
        </FeedSection>
      ))
    ) : (
      <CardGrid articles={articles} assetsById={assetsById} assetClassById={assetClassById} onSelect={(id) => openArticle(id, '__all')} />
    )
  ) : (
    <CardGrid articles={articles} assetsById={assetsById} assetClassById={assetClassById} onSelect={(id) => openArticle(id, '__all')} />
  );

  const content = (
    <div className="min-w-0 flex-1">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-primary)] mb-1">News Engine</h1>
          <p className="font-mono text-xs text-[var(--color-secondary)]">
            {articles.length} article{articles.length === 1 ? '' : 's'}
          </p>
        </div>
        <FeedViewToggle viewMode={viewMode} onViewChange={setViewMode} />
      </div>
      <div className="space-y-1">{body}</div>
    </div>
  );

  return (
    <div className="relative p-4 flex-1 bg-[var(--color-background)] overflow-x-hidden scrollbar-none">
      {!data ? (
        // loading state
        <div className="flex items-center justify-center h-48 text-[var(--color-secondary)] font-mono text-xs">
          Loading news…
        </div>
      ) : articles.length === 0 ? (
        // empty state
        <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-primary)] mb-1">No news yet</p>
          <p className="text-xs text-[var(--color-secondary)]">
            Articles will appear here once the news ingestion pipeline has run.
          </p>
        </div>
      ) : (
        <>
          {/* page content — blurred + dimmed behind the modal (two layers:
              a blur filter on the content plus the dark scrim overlay below) */}
          <div
            className={selectedArticle
              ? 'pointer-events-none select-none blur-[6px] opacity-55'
              : ''}
          >
            {content}
          </div>

          {/* centered modal overlay (News Engine detail view) — dark scrim
              between the blurred page and the modal panel */}
          {selectedArticle && (
            <div
              className="fixed inset-0 z-50 overflow-y-auto scrollbar-none"
              style={{ backgroundColor: 'rgba(6,7,8,0.72)' }}
              onClick={closeModal}
              role="dialog"
              aria-modal="true"
              aria-label={selectedArticle.title}
            >
              <div className="min-h-full flex items-start justify-center gap-5 py-12 px-4">
                <div className="self-center" onClick={(e) => e.stopPropagation()}>
                  <ModalNavButton
                    direction="left"
                    disabled={!hasPrev}
                    onClick={goPrev}
                  />
                </div>
                <div className="w-full max-w-[720px]" onClick={(e) => e.stopPropagation()}>
                  <NewsDetailPanel
                    article={selectedArticle}
                    assetsById={assetsById}
                    assetClassById={assetClassById}
                    onClose={closeModal}
                  />
                </div>
                <div className="self-center" onClick={(e) => e.stopPropagation()}>
                  <ModalNavButton
                    direction="right"
                    disabled={!hasNext}
                    onClick={goNext}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}