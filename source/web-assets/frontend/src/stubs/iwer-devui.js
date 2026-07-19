/**
 * Webpack alias for @iwer/devui (see craco.config.cjs).
 * Exports a real DevUI constructor so @pmndrs/xr installDevUI() succeeds
 * without loading Meta's desktop emulator UI.
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
