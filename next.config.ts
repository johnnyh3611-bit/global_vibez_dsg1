import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {}, // This silences the Turbopack error
  // Avoid bundling the large vendored extension tree into server functions.
  outputFileTracingExcludes: {
    "**": ["source/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/auth/verify": ["data/**/*"],
  },
};

export default nextConfig;
