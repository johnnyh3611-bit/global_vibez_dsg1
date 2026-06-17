// craco.config.js
const path = require("path");
const webpack = require("webpack");

let HealthCheckPlugin = null;
let healthPluginInstance = null;
try {
  // Health-check plugin is optional; fall back gracefully if missing.
  HealthCheckPlugin = require("./scripts/healthCheckWebpackPlugin.js");
} catch {
  HealthCheckPlugin = null;
}

const config = {
  enableHealthCheck: process.env.ENABLE_WEBPACK_HEALTH === "1",
};

if (config.enableHealthCheck && HealthCheckPlugin) {
  healthPluginInstance = new HealthCheckPlugin();
}

module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    plugins: {
      add: [],
    },
    configure: (webpackConfig) => {
      // 2026-05-17 deploy fix: explicitly disable source maps in
      // production. CRA respects GENERATE_SOURCEMAP=false at .env-load
      // time, but Emergent's Cloud Build rewrites .env with production
      // secrets so the perf flag was getting dropped, causing webpack
      // to spend 3-5 minutes generating ~500MB of unused source maps
      // and then stalling the build. Forcing devtool=false here makes
      // the setting platform-agnostic.
      if (process.env.NODE_ENV === "production") {
        webpackConfig.devtool = false;
      }

      // 2026-05-17 deploy fix: cap TerserPlugin parallel workers to 2.
      // Default (= os.cpus().length) was spinning up 8 minify workers
      // on Cloud Build's 8-core node — each consuming ~1.2GB — which
      // blew past the 8GB node heap cap and silently OOM-stalled the
      // build for 5+ minutes before timing out. 2 workers keeps the
      // memory peak under control AND finishes minification ~3× faster
      // because they don't thrash GC.
      if (Array.isArray(webpackConfig.optimization?.minimizer)) {
        webpackConfig.optimization.minimizer.forEach((m) => {
          if (m && m.constructor && m.constructor.name === "TerserPlugin") {
            try {
              m.options = m.options || {};
              m.options.parallel = 2;
            } catch {
              /* best-effort */
            }
          }
        });
      }

      // Ignore source-map warnings for packages without published sources
      webpackConfig.ignoreWarnings = (webpackConfig.ignoreWarnings || []).concat([
        { module: /node_modules\/@react-three/ },
        { module: /node_modules\/three/ },
        { module: /node_modules\/iwer/ },
        { module: /node_modules\/@privy-io/ },
        { module: /node_modules\/@base-org/ },
        /Failed to parse source map/,
      ]);

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // Polyfills for Solana wallet adapter (webpack 5 stripped node-builtins)
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer"),
        process: require.resolve("process/browser"),
        vm: false,
        fs: false,
        net: false,
        tls: false,
      };

      // Privy ships EVM/WalletConnect/iwer/Coinbase Smart Wallet adapters
      // that never run when walletChainType="solana-only". Stub them so
      // webpack stops choking on their internal module resolution.
      const stub = path.resolve(__dirname, "src/empty-module.js");
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        "@": path.resolve(__dirname, "src"),
        "@walletconnect/ethereum-provider": stub,
        "@iwer/devui": stub,
        "@iwer/sem": stub,
        "@base-org/account": stub,
        "@privy-io/ethereum": stub,
      };

      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: { fullySpecified: false },
      });

      // Inject `Buffer` and `process` as globals for Solana/Streamflow
      // SDKs that use them without explicit imports (fixes
      // "Buffer is not defined" in the browser at runtime).
      webpackConfig.plugins = (webpackConfig.plugins || []).concat([
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: "process/browser",
        }),
      ]);

      return webpackConfig;
    },
  },
};
