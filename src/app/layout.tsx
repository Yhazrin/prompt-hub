import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prompt Hub — AI 视觉灵感库',
  description: '精选 AI 图片提示词合集，从飞书知识库同步，支持多种风格分类浏览',
  keywords: ['AI', 'prompt', '提示词', 'Midjourney', 'DALL-E', 'Stable Diffusion'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className="antialiased">
        {/* Global noise texture overlay */}
        <svg className="fixed inset-0 w-full h-full pointer-events-none z-[9999]" style={{ opacity: 0.03 }}>
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
        {children}
      </body>
    </html>
  );
}
