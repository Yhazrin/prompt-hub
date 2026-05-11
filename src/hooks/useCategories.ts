'use client';

import useSWR from 'swr';
import { swrKeys, fetcher } from '@/lib/api';
import type { Category } from '@/lib/types';

export function useCategories(initialData?: Category[]) {
  const { data, error, isLoading } = useSWR<Category[]>(swrKeys.categories, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
    fallbackData: initialData,
  });

  return {
    categories: data ?? [],
    isLoading,
    isError: error,
  };
}
