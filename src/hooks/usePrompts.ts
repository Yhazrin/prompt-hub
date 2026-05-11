'use client';

import useSWRInfinite from 'swr/infinite';
import { fetcher } from '@/lib/api';
import type { PromptsResponse } from '@/lib/types';

const PAGE_SIZE = 30;

function getKey(params: Record<string, string>) {
  return (pageIndex: number, previousPageData: PromptsResponse | null) => {
    // Reached the end
    if (previousPageData && previousPageData.prompts.length < PAGE_SIZE) return null;
    // First page, no previous data
    if (pageIndex === 0) {
      const sp = new URLSearchParams({ ...params, limit: String(PAGE_SIZE), page: '1' });
      return `/api/prompts?${sp.toString()}`;
    }
    const sp = new URLSearchParams({ ...params, limit: String(PAGE_SIZE), page: String(pageIndex + 1) });
    return `/api/prompts?${sp.toString()}`;
  };
}

export function usePrompts(params: {
  category?: string;
  sub?: string;
  search?: string;
  sort?: string;
  order?: string;
} = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
  );

  const {
    data,
    error,
    isLoading,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite<PromptsResponse>(getKey(cleanParams), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    revalidateFirstPage: false,
  });

  const prompts = data ? data.flatMap(page => page.prompts) : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.prompts.length === 0;
  const total = data?.[0]?.pagination.total ?? 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.prompts.length < PAGE_SIZE);

  return {
    prompts,
    total,
    isLoading,
    isLoadingMore,
    isReachingEnd,
    isValidating,
    isError: error,
    size,
    setSize,
  };
}
