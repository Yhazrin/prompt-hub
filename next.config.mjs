/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gzip compression for all Next.js responses (API + pages)
  compress: true,
  // Serve static images from /images/ (nginx proxy in production)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'internal-api-drive-stream.feishu.cn' },
      { protocol: 'https', hostname: '*.feishu.cn' },
    ],
    unoptimized: true, // nginx serves images directly in production
  },
  // Custom server handles port binding
  experimental: {},
  serverExternalPackages: ['./lib/database.mjs'],
};

export default nextConfig;
