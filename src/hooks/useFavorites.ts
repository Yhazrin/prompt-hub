'use client';

import { useCallback } from 'react';
import { toggleFavorite } from '@/lib/api';
import useSWR from 'swr';
import { swrKeys, fetcher } from '@/lib/api';
import type { PromptsResponse } from '@/lib/types';

export function useFavorites() {
  const { data, isLoading, mutate } = useSWR<PromptsResponse>(
    swrKeys.prompts({ sort: 'updated_at', order: 'desc', limit: '200' }),
    fetcher,
    { revalidateOnFocus: false }
  );

  const favorites = (data?.prompts ?? []).filter(p => p.favorite);

  const toggle = useCallback(async (promptId: string) => {
    try {
      const result = await toggleFavorite(promptId);
      mutate();
      return result.favorite;
    } catch {
      return null;
    }
  }, [mutate]);

  return { favorites, toggle, isLoading };
}
