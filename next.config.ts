import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {}, // This silences the Turbopack error
  outputFileTracingIncludes: {
    "/api/auth/verify": ["data/chair-holders.txt"],
  },
};

export default nextConfig;
