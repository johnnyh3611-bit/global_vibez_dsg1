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

  async redirects() {
    return [
      { source: "/chairs", destination: "/chair-registry", permanent: true },
      { source: "/registry", destination: "/chair-registry", permanent: true },
    ];
  },
};

export default nextConfig;