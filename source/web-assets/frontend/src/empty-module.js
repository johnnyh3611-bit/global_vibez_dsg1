// Empty stub for unresolved EVM-only Privy modules. We're Solana-only so
// none of the WalletConnect / Coinbase / Ethereum bridge screens ever run
// at runtime — but webpack still tries to resolve them statically. This
// file is aliased in via craco.config.cjs.
//
// DO NOT alias @iwer/devui or @iwer/sem here — those need a real constructor
// (see src/stubs/iwer-devui.js). An empty export caused:
//   TypeError: devUIConstructor is not a constructor
module.exports = {};
module.exports.default = {};
