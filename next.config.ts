import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {}, // This silences the Turbopack error

  // Optimization to prevent hitting Vercel's 250MB limit by excluding 
  // the 'source/' directory and including only necessary data
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