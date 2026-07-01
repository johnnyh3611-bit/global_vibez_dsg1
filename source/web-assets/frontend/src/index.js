import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Register the offline-asset cache service worker. Best-effort; failures
// are silent so SW registration never blocks first-paint.
//
// We also force `registration.update()` on every load so a returning
// user with an OLD service worker (e.g. the pre-Nova-narration SW that
// pinned the male-voice MP3 in cache) gets the new SW activated
// immediately — instead of waiting for the browser's once-per-24h
// background check. Combined with the bumped CACHE_VERSION in
// `gv-sw.js`, this guarantees the new Nova narration MP3 ships to
// every returning visitor on their very next page load.
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/gv-sw.js")
      .then((reg) => {
        // Force a fresh fetch of /gv-sw.js — if the bytes differ from
        // what's installed, the new SW enters waiting → skipWaiting()
        // in its install handler activates it immediately.
        reg.update().catch(() => null);
      })
      .catch(() => {
        /* no-op — offline support degrades gracefully */
      });

    // When a new SW takes control (post-update), reload the page once
    // so the audio element fetches the new Nova MP3 instead of the
    // stale Onyx file the OLD SW had cached. The `_gvReloadedForSW`
    // sentinel prevents an infinite reload loop.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
