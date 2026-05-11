'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { fetcher } from '@/lib/api';
import { useCategories } from '@/hooks/useCategories';
import { useGalleryBatch } from '@/hooks/useGallery';
import { useLightbox } from '@/hooks/useLightbox';
import { Topbar } from '@/components/Topbar';
import { Hero } from '@/components/Hero';
import { CategoryPills } from '@/components/CategoryPills';
import { MosaicGrid } from '@/components/MosaicGrid';
import { Lightbox } from '@/components/Lightbox';
import { Footer } from '@/components/Footer';
import type { PromptsResponse, Category, GalleryImage } from '@/lib/types';

const PAGE_SIZE = 30;

interface HomeClientProps {
  initialPrompts: PromptsResponse;
  initialCategories: Category[];
  initialGallery: Record<string, GalleryImage[]>;
}

export function HomeClient({ initialPrompts, initialCategories, initialGallery }: HomeClientProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const getKey = useCallback((pageIndex: number, previousPageData: PromptsResponse | null) => {
    if (previousPageData && previousPageData.prompts.length < PAGE_SIZE) return null;
    const params: Record<string, string> = { limit: String(PAGE_SIZE), page: String(pageIndex + 1) };
    if (activeCategory) params.category = activeCategory;
    return `/api/prompts?${new URLSearchParams(params).toString()}`;
  }, [activeCategory]);

  const {
    data,
    isLoading,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite<PromptsResponse>(getKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    revalidateFirstPage: false,
    fallbackData: !activeCategory ? [initialPrompts] : undefined,
  });

  const prompts = data ? data.flatMap(page => page.prompts) : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.prompts.length === 0;
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.prompts.length < PAGE_SIZE);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && !isReachingEnd) {
      setSize(size + 1);
    }
  }, [size, setSize, isLoadingMore, isReachingEnd]);

  const { categories } = useCategories(initialCategories);
  const { galleryMap } = useGalleryBatch(prompts.map(p => p.id), initialGallery);
  const { activePrompt, open, close } = useLightbox();

  const stats = useMemo(() => ({
    total: categories.reduce((s, c) => s + c.prompt_count, 0),
    categories: categories.length,
  }), [categories]);

  return (
    <>
      <Topbar onSearchSelect={open} />

      <main className="min-h-screen">
        <Hero total={stats.total} categories={stats.categories} />

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="mb-8">
            <CategoryPills
              categories={categories}
              activeId={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>

          <MosaicGrid
            prompts={prompts}
            galleryMap={galleryMap}
            isLoading={isLoading && !data}
            isLoadingMore={isLoadingMore}
            isReachingEnd={isReachingEnd}
            onLoadMore={handleLoadMore}
            onOpenLightbox={open}
          />
        </section>

        <Footer />
      </main>

      <Lightbox prompt={activePrompt} onClose={close} />
    </>
  );
}
