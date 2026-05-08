/*
 * ReactBridge.jslib — Unity ↔ React WebGL postMessage bridge.
 *
 * Place this file at:
 *   /Assets/Plugins/WebGL/ReactBridge.jslib
 *
 * It declares the Vibez_PostToReact symbol that GameManager.cs imports via
 * [DllImport("__Internal")]. When Unity calls it, this routes the JSON to
 * the parent React frame via window.postMessage AND also invokes the
 * optional global hook `window.dispatchReactGameMessage(msg)` that
 * CyberCasinoRoom.tsx already listens for.
 */

mergeInto(LibraryManager.library, {

  Vibez_PostToReact: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    try {
      var msg = JSON.parse(json);
      msg.source = "VibezUnity";

      // 1. window.parent for iframe-mounted Unity builds
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, "*");
      }

      // 2. Same-window canvas mount: react-unity-webgl uses an event hook.
      window.postMessage(msg, "*");

      // 3. Optional direct hook so React doesn't even need an event listener.
      if (typeof window.dispatchReactGameMessage === "function") {
        window.dispatchReactGameMessage(msg);
      }
    } catch (e) {
      console.warn("[ReactBridge] failed to forward Unity message:", e);
    }
  }

});
