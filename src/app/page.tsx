import { getPrompts, getCategories, getGalleryImagesBatch } from '@server/database.mjs';
import { HomeClient } from '@/components/HomeClient';

// ISR: revalidate every 60s — data only changes on sync
export const revalidate = 60;

export default function HomePage() {
  // Server-side data prefetch — no client waterfall
  const promptsData = getPrompts({ limit: 30 });
  const categories = getCategories();
  const galleryMap = getGalleryImagesBatch(promptsData.prompts.map(p => p.id));

  return (
    <HomeClient
      initialPrompts={promptsData}
      initialCategories={categories}
      initialGallery={galleryMap}
    />
  );
}
