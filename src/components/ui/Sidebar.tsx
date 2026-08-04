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
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

interface NavItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isCollapsed: boolean;
}

function NavItem({ href, icon: Icon, label, isCollapsed }: NavItemProps) {
  const pathname = usePathname();
  // Match dashboard `/` exactly, other routes by prefix
  const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`relative flex items-center px-4 py-2.5 my-0.5 group transition-all duration-150 rounded-[var(--radius-sm)] border border-transparent ${
        isActive
          ? 'bg-[var(--color-surface)] border-[var(--color-border)]/40 text-[var(--color-primary)] font-semibold'
          : 'text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)]/50'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-[var(--color-accent)] rounded-r" />
      )}
      <Icon className={`w-4 h-4 flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-[var(--color-accent)]' : ''}`} />
      <span
        className={`font-sans text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden ${
          isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'
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
}

function PlannedItem({ icon: Icon, label, isCollapsed }: PlannedItemProps) {
  const tooltipText = isCollapsed ? `${label} (Coming soon)` : 'Coming in a future week';

  return (
    <div
      className="relative flex items-center px-4 py-2.5 my-0.5 group opacity-40 text-[var(--color-secondary)] cursor-default"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span
        className={`font-sans text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden ${
          isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'
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

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const plannedModules = [
    { label: 'Fixed Income Tools', icon: TrendingUp },
    { label: 'FX Calculators', icon: Coins },
    { label: 'Geopolitical Map', icon: Compass },
    { label: 'Trade Journal', icon: BookOpen },
    { label: 'Research Library', icon: Archive },
    { label: 'Correlations', icon: Network },
  ];

  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col justify-between bg-[var(--color-background)] border-r border-[var(--color-border)] select-none overflow-visible transition-[width] duration-200 ease-in-out z-30 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex flex-col min-h-0">
        {/* Logo Monogram / Wordmark */}
        <div className="flex items-center px-4 py-4 h-[56px] border-b border-[var(--color-border)]/30 overflow-hidden">
          <div className="flex items-center gap-3">
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
          </div>
        </div>

        {/* Active Modules Group */}
        <nav className="flex flex-col gap-0.5 p-2 mt-4">
          <NavItem href="/" icon={LayoutDashboard} label="Markets Dashboard" isCollapsed={isCollapsed} />
          <NavItem href="/news" icon={Newspaper} label="News Engine" isCollapsed={isCollapsed} />
        </nav>

        {/* Planned Section Header / Separator */}
        <div className={`transition-all duration-200 border-[var(--color-border)]/50 ${
          isCollapsed 
            ? 'mx-3 my-3 border-t' 
            : 'px-4 pt-4 pb-1.5 border-t border-transparent'
        }`}>
          <span className={`block font-mono text-[10px] tracking-[0.15em] text-[var(--color-secondary)]/40 transition-opacity duration-200 ${
            isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'
          }`}>
            PLANNED
          </span>
        </div>

        {/* Planned Modules Group */}
        <div className="flex flex-col gap-0.5 px-2">
          {plannedModules.map((item, idx) => (
            <PlannedItem key={idx} icon={item.icon} label={item.label} isCollapsed={isCollapsed} />
          ))}
        </div>
      </div>

      {/* Bottom Area: Settings & Collapse Toggle */}
      <div className="flex flex-col gap-0.5 p-2 border-t border-[var(--color-border)]/30 bg-[var(--color-background)]">
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
