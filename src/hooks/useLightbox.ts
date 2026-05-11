'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Prompt } from '@/lib/types';

export function useLightbox() {
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);

  const open = useCallback((prompt: Prompt) => {
    setActivePrompt(prompt);
    document.body.style.overflow = 'hidden';
  }, []);

  const close = useCallback(() => {
    setActivePrompt(null);
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePrompt) close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activePrompt, close]);

  return { activePrompt, open, close };
}
