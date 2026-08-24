'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Newspaper,
  TrendingUp,
  Coins,
  Compass,
  BookOpen,
  Archive,
  Network,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Calendar,
  Droplet,
} from 'lucide-react';

// ─── Single source of truth for all nav items ────────────────────────────────

interface ActiveNavDef {
  kind: 'active';
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface PlannedNavDef {
  kind: 'coming-soon' | 'planned';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tooltipTextExpanded?: string;
  tooltipTextCollapsed?: string;
}

type NavDef = ActiveNavDef | PlannedNavDef;

const NAV_ITEMS: NavDef[] = [
  // ── Active ──────────────────────────────────────────────────────────────
  { kind: 'active', href: '/dashboard',     icon: LayoutDashboard, label: 'Markets Dashboard' },
  { kind: 'active', href: '/news', icon: Newspaper,       label: 'News Engine'       },

  // ── Coming Soon ─────────────────────────────────────────────────────────
  {
    kind: 'active',
    href: '/morning-brief',
    icon: Sun,
    label: 'Morning Brief',
  },
  {
    kind: 'active',
    href: '/calendar',
    icon: Calendar,
    label: 'Economic Calendar',
  },
{
    kind: 'active',
    href: '/commodities',
    icon: Droplet,
    label: 'Commodities Intelligence',
  },

  // ── Planned ─────────────────────────────────────────────────────────────
  { kind: 'planned', icon: TrendingUp, label: 'Fixed Income Tools',
    tooltipTextExpanded: 'Coming in a future week', tooltipTextCollapsed: 'Fixed Income Tools (Planned)' },
  { kind: 'planned', icon: Coins,      label: 'FX Calculators',
    tooltipTextExpanded: 'Coming in a future week', tooltipTextCollapsed: 'FX Calculators (Planned)' },
  { kind: 'planned', icon: Compass,    label: 'Geopolitical Map',
    tooltipTextExpanded: 'Coming in a future week', tooltipTextCollapsed: 'Geopolitical Map (Planned)' },
  { kind: 'planned', icon: BookOpen,   label: 'Trade Journal',
    tooltipTextExpanded: 'Coming in a future week', tooltipTextCollapsed: 'Trade Journal (Planned)' },
  { kind: 'planned', icon: Archive,    label: 'Research Library',
    tooltipTextExpanded: 'Coming in a future week', tooltipTextCollapsed: 'Research Library (Planned)' },
  { kind: 'planned', icon: Network,    label: 'Correlations',
    tooltipTextExpanded: 'Coming in a future week', tooltipTextCollapsed: 'Correlations (Planned)' },
];

// Derived slices — always in sync with NAV_ITEMS
const activeItems     = NAV_ITEMS.filter((n): n is ActiveNavDef  => n.kind === 'active');
const comingSoonItems = NAV_ITEMS.filter((n): n is PlannedNavDef => n.kind === 'coming-soon');
const plannedItems    = NAV_ITEMS.filter((n): n is PlannedNavDef => n.kind === 'planned');

// ─── Sub-components ───────────────────────────────────────────────────────────

interface NavItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isCollapsed: boolean;
}

function NavItem({ href, icon: Icon, label, isCollapsed }: NavItemProps) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`relative flex items-center px-4 py-2.5 my-0.5 group transition-all duration-150 rounded-[var(--radius-sm)] border border-transparent outline-none ${
        isActive
          ? 'bg-[var(--color-surface)] text-[var(--color-primary)] font-semibold'
          : 'text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)]/50'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-[var(--color-accent)] rounded-r" />
      )}
      <Icon className={`w-4 h-4 flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-[var(--color-accent)]' : ''}`} />
      <span
        className={`font-sans text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis ${
          isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[180px] opacity-100 ml-3'
        }`}
      >
        {label}
      </span>
      {isCollapsed && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 font-sans rounded-[var(--radius-sm)] shadow-none">
          {label}
        </div>
      )}
    </Link>
  );
}

interface PlannedItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isCollapsed: boolean;
  tooltipTextExpanded?: string;
  tooltipTextCollapsed?: string;
}

function PlannedItem({
  icon: Icon,
  label,
  isCollapsed,
  tooltipTextExpanded = 'Coming in a future week',
  tooltipTextCollapsed = `${label} (Coming soon)`,
}: PlannedItemProps) {
  const tooltipText = isCollapsed ? tooltipTextCollapsed : tooltipTextExpanded;

  return (
    <div className="relative flex items-center px-4 py-2.5 my-0.5 group opacity-40 text-[var(--color-secondary)] cursor-default">
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span
        className={`font-sans text-xs font-medium transition-all duration-200 whitespace-nowrap overflow-hidden text-ellipsis ${
          isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[180px] opacity-100 ml-3'
        }`}
      >
        {label}
      </span>
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 font-sans rounded-[var(--radius-sm)] shadow-none">
        {tooltipText}
      </div>
    </div>
  );
}

// ─── Section separator ────────────────────────────────────────────────────────

function SectionSeparator({ label, isCollapsed }: { label: string; isCollapsed: boolean }) {
  return (
    <div className={`transition-all duration-200 border-[var(--color-border)]/50 flex-shrink-0 ${
      isCollapsed ? 'mx-3 my-3 border-t' : 'px-4 pt-3 pb-1 border-t border-transparent'
    }`}>
      <span className={`block font-mono text-[10px] tracking-[0.15em] text-[var(--color-secondary)]/40 transition-opacity duration-200 ${
        isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'
      }`}>
        {label}
      </span>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  return (
    <aside
      className={`h-full flex flex-col bg-[var(--color-background)] border-r border-[var(--color-border)] select-none overflow-visible transition-[width] duration-200 ease-in-out z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* ── Scrollable content area — scrollbar hidden, flex-1 fills space ── */}
      <div className="scrollbar-none flex flex-col flex-1 min-h-0 overflow-y-auto">

        {/* Logo / Wordmark — links to landing page */}
        <div className="flex items-center px-4 py-4 h-[56px] border-b border-[var(--color-border)]/30 overflow-hidden flex-shrink-0">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex items-center gap-3 rounded-[var(--radius-sm)] transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-0"
          >
            <div className="w-8 h-8 flex items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--color-accent)]">
                <path d="M12 2L2 22H7L12 12L17 22H22L12 2Z" fill="currentColor" />
              </svg>
            </div>
            <div className={`flex flex-col transition-all duration-200 overflow-hidden whitespace-nowrap ${
              isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-1'
            }`}>
              <span className="font-sans font-bold tracking-widest text-[var(--color-primary)] text-[13px] leading-tight">
                ATLAS
              </span>
              <span className="font-mono text-[9px] tracking-wider text-[var(--color-accent)] uppercase leading-none mt-0.5">
                intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* ── Active Modules ── */}
        <nav className="flex flex-col gap-0.5 p-2 mt-4 flex-shrink-0">
          {activeItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        <div className="flex flex-col gap-0.5 px-2 flex-shrink-0">
          {comingSoonItems.map((item, idx) => (
            <PlannedItem
              key={idx}
              icon={item.icon}
              label={item.label}
              isCollapsed={isCollapsed}
              tooltipTextExpanded={item.tooltipTextExpanded}
              tooltipTextCollapsed={item.tooltipTextCollapsed}
            />
          ))}
        </div>

        {/* ── Planned ── */}
        <SectionSeparator label="PLANNED" isCollapsed={isCollapsed} />
        <div className="flex flex-col gap-0.5 px-2 flex-shrink-0">
          {plannedItems.map((item, idx) => (
            <PlannedItem
              key={idx}
              icon={item.icon}
              label={item.label}
              isCollapsed={isCollapsed}
              tooltipTextExpanded={item.tooltipTextExpanded}
              tooltipTextCollapsed={item.tooltipTextCollapsed}
            />
          ))}
        </div>

        {/* Push footer to bottom when content is short */}
        <div className="flex-1" />
      </div>

      {/* ── Pinned footer: Settings + Collapse toggle ── */}
      <div className="flex-shrink-0 flex flex-col gap-0.5 p-2 border-t border-[var(--color-border)]/30 bg-[var(--color-background)] z-40">
        <NavItem href="/settings" icon={Settings} label="Settings" isCollapsed={isCollapsed} />
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="relative flex items-center px-4 py-2.5 my-0.5 w-full text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)]/50 transition-all duration-150 rounded-[var(--radius-sm)] border border-transparent cursor-pointer group text-left"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronLeft className="w-4 h-4 flex-shrink-0" />
          )}
          <span
            className={`font-sans text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden ${
              isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'
            }`}
          >
            Collapse
          </span>
          {isCollapsed && (
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 font-sans rounded-[var(--radius-sm)] shadow-none">
              Expand Sidebar
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
