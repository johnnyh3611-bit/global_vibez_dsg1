/**
 * Stub for @iwer/devui — webpack alias target (craco.config.cjs).
 *
 * ROOT CAUSE of "devUIConstructor is not a constructor":
 *   @pmndrs/xr/emulate.js does:
 *     import { DevUI } from '@iwer/devui';
 *     xrdevice.installDevUI(DevUI);   // → new DevUI(xrDevice)
 *   We previously aliased @iwer/devui → empty-module.js (`module.exports = {}`),
 *   so the named export `DevUI` was `undefined`. XRDevice.installDevUI then
 *   threw TypeError: devUIConstructor is not a constructor.
 *
 * This stub exports a real constructor (CJS + __esModule) so named and
 * default imports both receive a callable class, matching the real package
 * API without shipping Meta's heavy DevUI UI.
 */
"use strict";

function DevUI(_xrDevice) {
  this.version = "stub";
  this.devUIContainer =
    typeof document !== "undefined" ? document.createElement("div") : null;
}

DevUI.prototype.render = function render(_time) {
  /* no-op — desktop emulator UI intentionally omitted */
};

Object.defineProperty(DevUI.prototype, "devUICanvas", {
  get: function getDevUICanvas() {
    return null;
  },
  enumerable: true,
});

module.exports = {
  __esModule: true,
  DevUI: DevUI,
  VERSION: "stub",
  default: DevUI,
};
