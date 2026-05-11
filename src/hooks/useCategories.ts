'use client';

import useSWR from 'swr';
import { swrKeys, fetcher } from '@/lib/api';
import type { Category } from '@/lib/types';

export function useCategories() {
  const { data, error, isLoading } = useSWR<Category[]>(swrKeys.categories, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return {
    categories: data ?? [],
    isLoading,
    isError: error,
  };
}
