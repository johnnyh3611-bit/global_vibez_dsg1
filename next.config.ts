import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {}, // This silences the Turbopack error
  outputFileTracingExcludes: {
    "**": ["source/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/auth/verify": ["data/**/*"],
  },
};

export default nextConfig;
