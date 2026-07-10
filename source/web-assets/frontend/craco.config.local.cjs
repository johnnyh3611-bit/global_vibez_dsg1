/**
 * Local CRACO config — same webpack aliases as production.
 * Use: npx craco build --config craco.config.local.cjs
 *
 * Keep this as a thin re-export so local builds always get the `@` → src
 * alias (and Privy stubs) from craco.config.cjs. A divergent local config
 * that overwrites resolve.alias without re-adding `@` breaks imports like
 * `@/engine/mechanics/BettingMechanics`.
 */
module.exports = require("./craco.config.cjs");
