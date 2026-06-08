import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
