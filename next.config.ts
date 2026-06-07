import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
      // OpenFoodFacts product images
      { protocol: "https", hostname: "images.openfoodfacts.org", pathname: "/**" },
      { protocol: "https", hostname: "static.openfoodfacts.org", pathname: "/**" },
      { protocol: "https", hostname: "world.openfoodfacts.org", pathname: "/**" },
    ],
  },
};

export default nextConfig;
