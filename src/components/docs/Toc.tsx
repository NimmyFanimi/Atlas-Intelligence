'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TocItem {
  id: string;
  label: string;
}

interface TocProps {
  items: TocItem[];
  containerId: string;
}

export default function Toc({ items, containerId }: TocProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Offset must clear the teal "Case study" / module pill above each heading:
  // pill ~21px (11px text + 3px*2 padding + line-height) + mb-3 (12px) + 16px buffer ≈ 49px, rounded to 56
  const SCROLL_OFFSET = 56;

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    const container = document.getElementById(containerId);
    if (!el || !container) return;
    container.scrollTo({ top: (el as HTMLElement).offsetTop - SCROLL_OFFSET, behavior: 'smooth' });
  }

  useEffect(() => {
    const container = document.getElementById(containerId) as HTMLElement | null;
    if (!container) return;

    const sectionIds = items.map((i) => i.id);

    function updateIndicator() {
      const cont = document.getElementById(containerId) as HTMLElement | null;
      if (!cont) return;
      const containerRect = cont.getBoundingClientRect();
      // Must use getBoundingClientRect for both detection and positioning, not offsetTop
      const atBottom = cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 4;

      let idx = 0;
      if (atBottom) {
        idx = sectionIds.length - 1;
      } else {
        let bestDist = -Infinity;
        for (let i = 0; i < sectionIds.length; i++) {
          const el = document.getElementById(sectionIds[i]);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;
          // Threshold mirrors mockup: 80px
          if (relativeTop <= 80 && relativeTop > bestDist) {
            bestDist = relativeTop;
            idx = i;
          }
        }
      }

      setActiveIdx(idx);

      // Indicator positioning: compare active TOC item rect against .toc-track rect
      // NOT activeItem.offsetTop (siblings, not parent/child)
      const tocItems = document.querySelectorAll<HTMLElement>('[data-toc-item]');
      const activeItem = tocItems[idx] as HTMLElement | undefined;
      const track = trackRef.current;
      const indicator = indicatorRef.current;
      if (activeItem && track && indicator) {
        const trackRect = track.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        indicator.style.top = itemRect.top - trackRect.top + 'px';
        indicator.style.height = itemRect.height + 'px';
      }
    }

    const onScroll = () => updateIndicator();
    container.addEventListener('scroll', onScroll, { passive: true });
    // initial
    const t = setTimeout(updateIndicator, 30);
    // hash-based deep-link: if URL contains #id, scroll container to that section on mount
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && sectionIds.includes(hash)) {
      const hashEl = document.getElementById(hash);
      if (hashEl) setTimeout(() => container.scrollTo({ top: (hashEl as HTMLElement).offsetTop - SCROLL_OFFSET, behavior: 'smooth' }), 60);
    }
    // also observe resize
    window.addEventListener('resize', updateIndicator);

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateIndicator);
      clearTimeout(t);
    };
  }, [containerId, items]);

  // Also update indicator when activeIdx changes (in case layout shifted without scroll)
  useEffect(() => {
    // handled inside scroll effect's updateIndicator; this ensures indicator syncs on mount
  }, [activeIdx]);

  return (
    <div className="hidden lg:flex w-[200px] flex-shrink-0 py-10 pr-5 border-l border-[var(--border)] flex-col">
      <div className="sticky top-10 flex pl-5">
        <div ref={trackRef} className="toc-track relative w-px bg-[var(--border)] mr-4 flex-shrink-0">
          <div
            ref={indicatorRef}
            id="toc-indicator"
            className="toc-indicator absolute left-0 w-[2px] bg-[var(--teal)] rounded-[2px] transition-[top,height] duration-[250ms]"
            style={{ top: 0, height: 0 } as React.CSSProperties}
          />
        </div>
        <div id="toc-items" className="toc-items flex flex-col gap-[2px]">
          {items.map((item, i) => (
            <div
              key={item.id}
              data-toc-item
              data-target={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`toc-item text-[13px] leading-[1.4] py-[5px] cursor-pointer transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none ring-0 ${i === activeIdx ? 'text-[var(--text-primary)] font-medium active' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
