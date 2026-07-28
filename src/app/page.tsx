export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-background)] p-8">
      <div className="w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8">
        <h1 className="text-[var(--color-primary)] text-xl font-semibold mb-6 tracking-tight">
          ATLAS INTELLIGENCE
        </h1>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-[var(--color-secondary)] text-sm mb-3">Option A: Dusty Emerald & Muted Brick</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-[var(--color-border)] flex items-center justify-between">
                <span className="text-[var(--color-secondary)] uppercase text-xs tracking-wider">S&P 500</span>
                <span className="text-[var(--color-market-up-a)] font-mono">+1.24%</span>
              </div>
              <div className="p-4 border border-[var(--color-border)] flex items-center justify-between">
                <span className="text-[var(--color-secondary)] uppercase text-xs tracking-wider">WTI CRUDE</span>
                <span className="text-[var(--color-market-down-a)] font-mono">-0.85%</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-[var(--color-secondary)] text-sm mb-3">Option B: Sage Green & Dusty Coral</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-[var(--color-border)] flex items-center justify-between">
                <span className="text-[var(--color-secondary)] uppercase text-xs tracking-wider">S&P 500</span>
                <span className="text-[var(--color-market-up-b)] font-mono">+1.24%</span>
              </div>
              <div className="p-4 border border-[var(--color-border)] flex items-center justify-between">
                <span className="text-[var(--color-secondary)] uppercase text-xs tracking-wider">WTI CRUDE</span>
                <span className="text-[var(--color-market-down-b)] font-mono">-0.85%</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-[var(--color-secondary)] text-sm">
          Once you pick an option, I will lock it in and we can proceed with the Supabase schema implementation.
        </p>
      </div>
    </div>
  );
}
