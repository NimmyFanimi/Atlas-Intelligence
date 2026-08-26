import Link from 'next/link';
import DocsSidebar from '@/components/docs/DocsSidebar';

export default function DesignPage() {
  return (
    <div className="docs-root h-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] flex relative">
      <DocsSidebar />
      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        <div className="flex-1 py-10 px-12 overflow-y-auto h-full" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-strong) transparent' }}>
          <div className="breadcrumb text-[13px] text-[var(--text-muted)] mb-7">
            <Link href="/docs" className="hover:text-[var(--teal-light)] transition-colors">
              Atlas Docs
            </Link>{' '}
            / <span className="current text-[var(--text-secondary)]">Design</span>
          </div>
          <div className="page-title text-[30px] font-semibold tracking-[-0.02em] mb-[10px]">Design</div>
          <div className="page-sub text-[15px] text-[var(--text-secondary)] mb-11 max-w-[560px]">
            The visual choices behind the terminal, and why they matter more than how they look.
          </div>

          <section className="chunk mb-14 scroll-mt-6 max-w-[620px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">A trading terminal, not a SaaS card wall</h2>
            <p className="text-[var(--text-secondary)] leading-7 mb-3">
              The reference was Linear and Vercel dashboard before it was ever Bloomberg. Dense, not decorative, with real column alignment, not
              flex wrap cards of inconsistent height. Flat fills, hairline borders in <span className="font-mono text-[13px] text-[var(--text-primary)]">#2A2D33</span> (hairline, never a shadow), sharp 4 px
              corners, no gradients, no glass, no blur, no purple to blue button that says &quot;AI slop.&quot;
            </p>
            <p className="text-[var(--text-secondary)] leading-7">
              Every surface is one of two near blacks, page <span className="font-mono text-[13px] text-[var(--text-primary)]">#0A0B0D</span> and card{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">#14161A</span>, so information sits forward and chrome sits back. There is exactly
              one accent (teal, 600) and it earns its keep: active state, key CTA, a sparkline that actually means &quot;this is live.&quot;
            </p>
          </section>

          <section className="chunk mb-14 scroll-mt-6 max-w-[620px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Type as hierarchy</h2>
            <p className="text-[var(--text-secondary)] leading-7 mb-3">
              Two fonts only: Inter for chrome and body, JetBrains Mono for every number (price, percentage, yield, date). Tight letter spacing on
              headers, slightly loosened on body. Four tiers (hero mono <span className="font-mono text-[13px] text-[var(--text-primary)]">2xl semibold</span>,
              primary <span className="font-mono text-[13px] text-[var(--text-primary)]">sm</span>, metadata{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">xs muted mono</span>, structural label{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">xs uppercase widest</span>) and nothing in between, so a new page slots into
              the same scale instead of inventing a new one.
            </p>
            <p className="text-[var(--text-secondary)] leading-7">
              Numbers in Mono do real work here. They right align, they scan, and they make a 4 digit price look different from a 2 digit change so the eye
              knows which is which before it reads.
            </p>
          </section>

          <section className="chunk mb-14 scroll-mt-6 max-w-[620px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Color with discipline</h2>
            <p className="text-[var(--text-secondary)] leading-7 mb-3">
              Up is sage <span className="font-mono text-[13px] text-[var(--text-primary)]">#5C8D73</span>, down is dusty coral{' '}
              <span className="font-mono text-[13px] text-[var(--text-primary)]">#C36B67</span>, deliberately desaturated after a too saturated stoplight pass. They
              are reserved exclusively for price direction, never reused for calendar importance or sentiment. Calendar importance is the left accent bar in teal
              opacity (high 100 percent, medium 45 percent, low 15 percent). Sentiment &quot;Sentimeter&quot; gauge is teal from dim to bright with the numeric readout centered under the
              needle, not a traffic light gradient that would collide with moves.
            </p>
            <p className="text-[var(--text-secondary)] leading-7">
              Every interactive element carries <span className="font-mono text-[13px] text-[var(--text-primary)]">transition-colors duration-150</span> so hover
              fades rather than snaps, and every focusable non native element has a teal ring. The browser default white box showed up three separate times
              (list rows, carousel cards, Recharts own SVG surface) before the pattern stuck.
            </p>
          </section>

          <section className="chunk mb-14 scroll-mt-6 max-w-[620px]">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] mb-[14px]">Detail that compounds</h2>
            <p className="text-[var(--text-secondary)] leading-7 mb-3">
              Percentage changes render as small filled pill badges (solid sage and coral and grey, near white text). Absolute change stays plain colored text. The
              pill was a weight decision from polish, specifically so a 0.12 percent and a 4.3 percent do not read with the same visual mass. Sparklines carry a flat
              12 percent filled area under the line in the line own color, just enough to give a 1.6 px stroke weight without a gradient. Internal dividers run
              at 50 percent border opacity so the outer card edge stays dominant.
            </p>
            <p className="text-[var(--text-secondary)] leading-7">
              Honesty is part of the design too. Where data is not available (FRED rates with no intraday change, EIA prices up to 8 days old, a TBD release
              with no published date yet) the UI says so, with &quot;n/a,&quot; &quot;Range Since Tracking Began,&quot; &quot;Date TBD&quot; pill with a hover tooltip, rather than faking a
              plausible number. The same restraint applies to the docs shell itself: fixed height, internal scroll only, so the page never grows a native
              scrollbar it does not own.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
