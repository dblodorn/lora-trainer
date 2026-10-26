import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Compiles `graphql` tagged literals (react-relay) into imports of the
  // artifacts `npm run relay` writes to `__generated__/` beside each file.
  // Settings mirror relay.config.json; the two must agree or the transform
  // points at artifacts the compiler never wrote.
  compiler: {
    relay: {
      src: "./src",
      language: "typescript",
      eagerEsModules: true,
    },
  },
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
