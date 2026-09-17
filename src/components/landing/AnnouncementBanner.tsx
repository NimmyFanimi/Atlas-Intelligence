"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "atlas_announcement_news_reliability_dismissed";
const TARGET_HREF = "/docs/data-integrity#sec-news-reliability";

// Compact dismissible pill above the hero. Flat teal wash, no gradient or shadow.
export default function AnnouncementBanner() {
  // Both default to false so the server and the first client render both
  // output null. localStorage is only read inside the mount effect below.
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissed(true);
      }
    } catch {
      // Storage unavailable, show the banner for this session.
    }
    setMounted(true);
  }, []);

  if (!mounted || dismissed) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Storage unavailable, still hide for this session.
    }
    setDismissed(true);
  };

  return (
    <div className="mx-4 md:mx-auto mt-4 flex h-10 w-fit items-center rounded-full border border-[var(--teal)]/30 bg-[rgba(13,148,136,0.12)]">
      <div className="flex w-full items-center gap-2 px-4 py-1.5">
        <Link
          href={TARGET_HREF}
          onClick={dismiss}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 truncate text-center font-sans text-[13px] font-medium text-[var(--teal-light)] hover:text-[var(--teal)] transition-colors"
        >
          <span aria-hidden="true" className="shrink-0">
            🎉
          </span>
          <span className="truncate hover:underline hover:underline-offset-4">
            New case study: The News Engine that kept almost working
          </span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[var(--teal-light)] hover:text-[var(--teal)] transition-colors cursor-pointer"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
