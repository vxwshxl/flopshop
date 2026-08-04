import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake the barrel-file imports in these packages so a page that pulls
  // in three icons (or one chart) doesn't bundle the whole library.
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "date-fns"],
  },
  images: {
    // Render images directly (no /_next/image optimizer). This avoids the
    // 400 "url parameter is not allowed" errors for arbitrary remote hosts
    // (Google avatars, OpenFoodFacts, Supabase Storage) and keeps things simple.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
