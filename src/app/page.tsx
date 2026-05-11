'use client';

import { useState, useMemo } from 'react';
import { usePrompts } from '@/hooks/usePrompts';
import { useCategories } from '@/hooks/useCategories';
import { useGalleryBatch } from '@/hooks/useGallery';
import { useLightbox } from '@/hooks/useLightbox';
import { Topbar } from '@/components/Topbar';
import { Hero } from '@/components/Hero';
import { CategoryPills } from '@/components/CategoryPills';
import { MosaicGrid } from '@/components/MosaicGrid';
import { Lightbox } from '@/components/Lightbox';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { categories } = useCategories();
  const { prompts, isLoading } = usePrompts({
    category: activeCategory || undefined,
    limit: 200,
  });
  const { galleryMap } = useGalleryBatch(prompts.map(p => p.id));
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
          {/* Category pills */}
          <div className="mb-8">
            <CategoryPills
              categories={categories}
              activeId={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>

          {/* Grid */}
          <MosaicGrid
            prompts={prompts}
            galleryMap={galleryMap}
            isLoading={isLoading}
            onOpenLightbox={open}
          />
        </section>

        <Footer />
      </main>

      <Lightbox prompt={activePrompt} onClose={close} />
    </>
  );
}
