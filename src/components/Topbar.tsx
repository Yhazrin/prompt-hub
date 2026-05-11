'use client';

import Link from 'next/link';
import { SearchBar } from './SearchBar';
import { useLightbox } from '@/hooks/useLightbox';
import type { Prompt } from '@/lib/types';

interface TopbarProps {
  onSearchSelect?: (prompt: Prompt) => void;
}

export function Topbar({ onSearchSelect }: TopbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="glass-strong">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-[var(--color-text)] hidden sm:block">
              Prompt Hub
            </span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <SearchBar onSelect={onSearchSelect ?? (() => {})} />
          </div>

          {/* Admin link */}
          <Link
            href="/admin"
            className="shrink-0 w-9 h-9 rounded-full glass flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6m8.66-14.5-5.2 3m-6.92 4-5.2 3m0-10 5.2 3m6.92 4 5.2 3" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
