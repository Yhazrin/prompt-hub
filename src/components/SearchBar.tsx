'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring, fadeSlide } from '@/lib/animations';
import { useSearch } from '@/hooks/useSearch';
import { truncate, getCatColors } from '@/lib/utils';
import type { Prompt } from '@/lib/types';

interface SearchBarProps {
  onSelect: (prompt: Prompt) => void;
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const { query, setQuery, results, isLoading, hasResults } = useSearch();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showDropdown = focused && query.length >= 2;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="glass rounded-full flex items-center px-4 py-2.5 gap-2.5 w-full max-w-md">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="搜索提示词..."
          className="flex-1 bg-transparent outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 glass-strong rounded-[16px] overflow-hidden max-h-[400px] overflow-y-auto z-50"
            variants={fadeSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={spring.snappy}
          >
            {isLoading && (
              <div className="p-4 text-center text-sm text-[var(--color-text-tertiary)]">
                搜索中...
              </div>
            )}

            {!isLoading && !hasResults && (
              <div className="p-4 text-center text-sm text-[var(--color-text-tertiary)]">
                未找到匹配的提示词
              </div>
            )}

            {results.map(prompt => {
              const colors = getCatColors(prompt.category_id);
              return (
                <motion.button
                  key={prompt.id}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors flex items-start gap-3 border-b border-[var(--color-glass-border-subtle)] last:border-0"
                  onClick={() => { onSelect(prompt); setFocused(false); }}
                  whileTap={{ scale: 0.98 }}
                >
                  {prompt.image_url && (
                    <img
                      src={prompt.image_url}
                      alt=""
                      className="w-10 h-10 rounded-[8px] object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)] truncate">
                      {prompt.title}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
                      {truncate(prompt.prompt_text, 60)}
                    </div>
                  </div>
                  <span
                    className="text-[10px] rounded-full px-2 py-0.5 shrink-0 mt-0.5"
                    style={{ background: colors.bg, color: colors.label }}
                  >
                    {prompt.category_name}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
