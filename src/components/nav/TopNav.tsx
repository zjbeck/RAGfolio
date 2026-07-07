"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/copy";
import { REPO_URL } from "@/lib/site";
import { ThemeToggles } from "./ThemeToggles";

export interface NavTab {
  slug: string;
  label: string;
  href: string;
}

/**
 * Slim top nav: wordmark (left), collection tabs (from config), then "How
 * this site works" + GitHub (right). Theme toggles land here in Stage 6.
 * Tabs derive entirely from corpus config — nothing about collections is
 * hardcoded.
 */
export function TopNav({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-6 border-b border-line bg-canvas/80 px-5 backdrop-blur">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        {copy.siteName}
      </Link>

      <nav className="flex items-center gap-1 text-sm" aria-label="Collections">
        {tabs.map((tab) => {
          const active = pathname.startsWith(`/docs/${tab.slug}`);
          return (
            <Link
              key={tab.slug}
              href={tab.href}
              className={`rounded-[var(--radius-sm)] px-2.5 py-1 transition-colors ${
                active
                  ? "bg-surface-2 text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3 text-sm">
        <Link href="/how-it-works" className="text-muted hover:text-ink">
          {copy.nav.howItWorks}
        </Link>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.nav.github}
          className="text-muted hover:text-ink"
        >
          <GitHubIcon />
        </a>
        <ThemeToggles />
      </div>
    </header>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
