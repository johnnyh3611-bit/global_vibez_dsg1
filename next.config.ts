import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {}, // This silences the Turbopack error
  async redirects() {
    return [
      { source: "/chairs", destination: "/chair-registry", permanent: true },
      { source: "/registry", destination: "/chair-registry", permanent: true },
    ];
  },
};

export default nextConfig;
