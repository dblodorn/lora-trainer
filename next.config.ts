import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["reshaped"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.digitaloceanspaces.com" },
      { protocol: "https", hostname: "d2w9rnfcy7mm78.cloudfront.net" },
      { protocol: "https", hostname: "*.are.na" },
      // Generated images whose mirror to Spaces failed keep their fal.ai URL.
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.media" },
    ],
  },
};

export default nextConfig;
