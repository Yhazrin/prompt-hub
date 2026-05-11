'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { swrKeys, fetcher } from '@/lib/api';
import type { Prompt } from '@/lib/types';

export function useSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, debounceMs]);

  const { data, isLoading } = useSWR<Prompt[]>(
    debouncedQuery.length >= 2 ? swrKeys.search(debouncedQuery) : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 1000 }
  );

  return {
    query,
    setQuery,
    results: data ?? [],
    isLoading: isLoading && debouncedQuery.length >= 2,
    hasResults: (data?.length ?? 0) > 0,
  };
}
