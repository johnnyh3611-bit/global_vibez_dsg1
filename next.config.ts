import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {}, // This silences the Turbopack error
  // The dynamic filesystem access in src/lib/dealer/chairs.ts (fs.readFileSync on
  // an env-derived path) cannot be statically analyzed by Node File Tracing, so it
  // conservatively traces the ENTIRE project into the api/auth/verify function.
  // That pulls the ~317MB `source/` directory (old web-assets/scripts that are
  // never used at runtime) into the function and pushes it over Vercel's 250MB
  // limit. Exclude that directory from every function's trace, and explicitly
  // include the data file that chairs.ts actually reads at runtime.
  outputFileTracingExcludes: {
    "**": ["./source/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/auth/verify": ["./data/**/*"],
  },
};

export default nextConfig;
