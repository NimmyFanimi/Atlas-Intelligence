'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

interface NavSubItem {
  label: string;
  id: string;
}

interface NavItem {
  label: string;
  href: string;
  subItems?: NavSubItem[];
  expandable?: boolean;
}

const NAV: NavItem[] = [
  { label: 'Overview', href: '/overview' },
  { label: 'Architecture', href: '/docs/architecture' },
  {
    label: 'Modules',
    href: '/docs/modules',
    expandable: true,
    subItems: [
      { label: 'Markets Dashboard', id: 'sec-markets' },
      { label: 'News Engine', id: 'sec-news' },
      { label: 'Morning Brief', id: 'sec-brief' },
      { label: 'Economic Calendar', id: 'sec-calendar' },
      { label: 'Commodities', id: 'sec-commodities' },
    ],
  },
  {
    label: 'Data Integrity',
    href: '/docs/data-integrity',
    expandable: true,
    subItems: [
      { label: 'The EIA key that wasn’t there', id: 'sec-eia' },
      { label: 'The FOMC event that fired every day', id: 'sec-fomc' },
      { label: 'Copper up 35,000%', id: 'sec-copper' },
      { label: 'The assets that went missing', id: 'sec-postgrest' },
    ],
  },
  { label: 'Design', href: '/docs/design' },
];

interface DocsSidebarProps {
  onNavigate?: () => void;
}

export default function DocsSidebar({ onNavigate }: DocsSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/overview') return pathname === '/overview';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Same offset as Toc.tsx — must clear pill + margin + buffer (≈56px)
  const SIDEBAR_SCROLL_OFFSET = 56;

  function handleSubClick(e: React.MouseEvent, href: string, id: string) {
    // If already on that docs page, scroll the internal scroll container instead of hash-nav
    if (pathname === href) {
      e.preventDefault();
      // Try both known container ids; only one will exist on the current page
      const candidates = ['scroll-content', 'scroll-content-modules', 'scroll-content-overview'];
      let container: HTMLElement | null = null;
      for (const cid of candidates) {
        const c = document.getElementById(cid);
        if (c) {
          container = c;
          break;
        }
      }
      const el = document.getElementById(id);
      if (el && container) {
        container.scrollTo({ top: (el as HTMLElement).offsetTop - SIDEBAR_SCROLL_OFFSET, behavior: 'smooth' });
        // Update hash without triggering a page jump
        history.pushState(null, '', `${href}#${id}`);
      }
      // Close mobile drawer if present (deferred via caller's setTimeout if needed)
      onNavigate?.();
    }
    // else: let Link navigate normally; target page will handle hash scroll on mount via its own Toc logic
    // onNavigate will be called via the Link's onClick for cross-page navigation
  }

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] flex flex-col gap-6 px-5 py-7 overflow-y-auto scrollbar-none">
      {/* Brand, now hidden when DocsTopBar is present, but kept for direct sidebar use; links to /docs */}
      <Link href="/docs" onClick={onNavigate} className="flex items-center gap-[9px] no-underline outline-none focus:outline-none focus-visible:outline-none">
        <div className="w-6 h-6 rounded-[7px] bg-[var(--teal)] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-[14px] h-[14px]">
            <path d="M5 16.5L12 6.5L19 16.5" stroke="#04241D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex flex-col leading-[1.15]">
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Atlas</span>
          <span className="text-[9.5px] font-medium tracking-[0.08em] uppercase text-[var(--text-muted)]">Docs</span>
        </div>
      </Link>

      <nav className="flex flex-col gap-[2px]">
        {NAV.map((item) => {
          const active = isActive(item.href);
          const expanded = active && !!item.expandable;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center justify-between px-[10px] py-[9px] rounded-[8px] text-[14px] no-underline outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 transition-colors duration-150 ${
                  active ? 'bg-[var(--teal-dim)] text-[var(--teal-light)] font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{item.label}</span>
                {item.expandable && (
                  <span
                    className={`text-[11px] text-[var(--text-muted)] transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                  >
                    ›
                  </span>
                )}
              </Link>
              {item.subItems && (
                <div
                  className={`flex flex-col gap-[1px] pl-[22px] mt-[2px] mb-1 overflow-hidden transition-[max-height] duration-200 ease-in-out ${expanded ? 'max-h-[240px]' : 'max-h-0'}`}
                >
                  {item.subItems.map((sub) => (
                    <Link
                      key={sub.label}
                      href={`${item.href}#${sub.id}`}
                      onClick={(e) => {
                        handleSubClick(e, item.href, sub.id);
                        // If handleSubClick didn't already close (cross-page nav), close drawer
                        if (pathname !== item.href) onNavigate?.();
                      }}
                      className={`block px-[10px] py-[7px] rounded-[7px] text-[13px] no-underline outline-none focus:outline-none focus-visible:outline-none cursor-pointer transition-colors duration-150 ${active ? 'text-[var(--teal-light)] hover:text-[var(--teal-light)] hover:bg-[var(--surface-2)]' : 'text-[var(--text-muted)]'}`}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
