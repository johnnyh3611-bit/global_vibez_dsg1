/**
 * Stub for @iwer/sem — paired with iwer-devui.js.
 * @pmndrs/xr calls `xrdevice.installSEM(SyntheticEnvironmentModule)`.
 */
"use strict";

function SyntheticEnvironmentModule(_xrDevice) {
  /* no-op */
}

SyntheticEnvironmentModule.prototype.loadDefaultEnvironment = function loadDefaultEnvironment(
  _name,
) {
  /* no-op */
};

module.exports = {
  __esModule: true,
  SyntheticEnvironmentModule: SyntheticEnvironmentModule,
  default: SyntheticEnvironmentModule,
};
