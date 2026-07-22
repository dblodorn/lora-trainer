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
    ],
  },
};

export default nextConfig;
