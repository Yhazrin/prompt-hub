'use client';

import useSWR from 'swr';
import { swrKeys, fetcher } from '@/lib/api';
import type { GalleryImage } from '@/lib/types';

export function useGallery(promptId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<GalleryImage[]>(
    promptId ? swrKeys.gallery(promptId) : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    images: data ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useGalleryBatch(ids: string[]) {
  const key = ids.length > 0 ? swrKeys.galleryBatch(ids) : null;
  const { data, error, isLoading } = useSWR<Record<string, GalleryImage[]>>(
    key,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  return {
    galleryMap: data ?? {},
    isLoading,
    isError: error,
  };
}
