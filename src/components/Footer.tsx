'use client';

import Link from 'next/link';
import { useCategories } from '@/hooks/useCategories';
import { getCatColors } from '@/lib/utils';

export function Footer() {
  const { categories } = useCategories();

  return (
    <footer className="glass noise mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[var(--color-text)]">Prompt Hub</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map(cat => {
              const colors = getCatColors(cat.id);
              return (
                <Link
                  key={cat.id}
                  href={`/cat/${cat.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-105"
                  style={{ background: colors.bg, color: colors.label }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: colors.accent }}
                  />
                  {cat.name}
                  <span className="opacity-60">{cat.prompt_count}</span>
                </Link>
              );
            })}
          </div>

          <p className="text-xs text-[var(--color-text-tertiary)]">
            从飞书知识库自动同步 · {categories.reduce((s, c) => s + c.prompt_count, 0)} 个提示词
          </p>
        </div>
      </div>
    </footer>
  );
}
