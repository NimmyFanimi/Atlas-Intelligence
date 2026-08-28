import Link from 'next/link';

export default function DocsLandingPage() {
  const cards = [
    { title: 'Overview', desc: 'Why I built this and what it actually is', icon: '◆', href: '/overview' },
    { title: 'Architecture', desc: 'How data moves through the system, end to end', icon: '▤', href: '/docs/architecture' },
    { title: 'Modules', desc: 'What each of the five parts does, and the real data behind it', icon: '▦', href: '/docs/modules' },
    { title: 'Data Integrity', desc: 'Four real production bugs, root-caused and fixed', icon: '◈', href: '/docs/data-integrity' },
    { title: 'Design', desc: 'The visual choices behind the terminal, and why', icon: '◐', href: '/docs/design' },
  ];

  return (
    <div className="docs-root h-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] flex flex-col relative">
      <Link
        href="/"
        className="absolute top-4 left-6 z-10 text-[13px] font-medium text-[var(--teal-light)] hover:text-[var(--teal)] transition-colors no-underline"
      >
        ← Back to site
      </Link>
      <div className="flex-1 overflow-y-auto flex items-start justify-center p-5 md:p-8 pt-10">
        <div className="w-full max-w-[960px]">
          <div className="docs-hero-title text-[30px] font-semibold tracking-[-0.02em] mb-[10px]">Atlas Docs</div>
          <div className="docs-hero-sub text-[15px] text-[var(--text-secondary)] max-w-[560px] mb-7">
            A full technical writeup of how Atlas is built, what it gets right, and where it broke along the way.
          </div>

          <div className="docs-cards-label text-[13px] font-semibold text-[var(--teal-light)] mb-3">Start here</div>
          <div className="docs-cards grid gap-4 max-w-[880px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="docs-card bg-[var(--surface-2)] border border-[var(--border)] rounded-[12px] p-6 cursor-pointer transition-[border-color,transform,background] duration-150 hover:border-[var(--teal)] hover:bg-[var(--surface-1)] hover:-translate-y-0.5 no-underline block"
              >
                <div className="docs-card-icon text-[var(--teal-light)] text-[16px] mb-2">{c.icon}</div>
                <div className="docs-card-title text-[15.5px] font-semibold mb-1.5 text-[var(--text-primary)]">{c.title}</div>
                <div className="docs-card-desc text-[12.5px] leading-[1.45] text-[var(--text-secondary)]">{c.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
