'use client';

import useSWR from 'swr';
import { swrKeys, fetcher } from '@/lib/api';
import type { PromptsResponse } from '@/lib/types';

export function usePrompts(params: {
  category?: string;
  sub?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
} = {}) {
  const key = swrKeys.prompts(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    )
  );

  const { data, error, isLoading, mutate } = useSWR<PromptsResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  return {
    prompts: data?.prompts ?? [],
    pagination: data?.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 },
    isLoading,
    isError: error,
    mutate,
  };
}
