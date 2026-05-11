'use client';

import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/animations';

export function MosaicSkeleton({ count = 12 }: { count?: number }) {
  return (
    <motion.div
      className="mosaic-grid"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          variants={staggerItem}
          className="mb-5 break-inside-avoid"
        >
          <div className="glass rounded-[20px] overflow-hidden">
            {/* Image skeleton */}
            <div
              className="skeleton w-full"
              style={{ aspectRatio: ['4/5', '3/4', '16/9', '1/1'][i % 4] }}
            />
            {/* Content skeleton */}
            <div className="p-4 space-y-3">
              <div className="skeleton h-4 w-3/4 rounded-full" />
              <div className="skeleton h-3 w-full rounded-full" />
              <div className="skeleton h-3 w-2/3 rounded-full" />
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
