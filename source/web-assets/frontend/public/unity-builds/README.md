# Unity WebGL Builds

Drop your Unity WebGL build artifacts into this directory. The
`<CyberCasinoRoom />` React component auto-loads them at:

  /cyber-casino                      → cyber_casino_main/Build/
  /cyber-casino/<gameId>             → <gameId>/Build/

## Required files (per-game folder)

For a game with `gameId = "cyber_casino_main"`, drop these into
`/cyber_casino_main/Build/`:

```
cyber_casino_main.loader.js
cyber_casino_main.framework.js
cyber_casino_main.wasm
cyber_casino_main.data
```

## How to upload your own build

1. In Unity: **File → Build Settings → WebGL → Build**.
2. Unity outputs a folder containing `Build/<projectName>.loader.js`,
   `.framework.js[.br]`, `.wasm[.br]`, `.data[.br]`.
3. **If your build uses Brotli (`.br`) or gzip compression**, decompress
   each file first (we don't pre-configure web-server `Content-Encoding`
   headers in this environment):
   ```bash
   brotli -d *.framework.js.br -o cyber_casino_main.framework.js
   brotli -d *.wasm.br         -o cyber_casino_main.wasm
   brotli -d *.data.br         -o cyber_casino_main.data
   ```
4. Rename each file's prefix to match the game ID (e.g. `MyGame.loader.js
   → cyber_casino_main.loader.js`).
5. Copy the four files into this folder. Hot reload picks them up
   immediately — refresh `/cyber-casino` to load the new build.

## Bridging to the platform escrow

Inside Unity, post the player's score back to React by calling:

```csharp
[DllImport("__Internal")]
private static extern void SubmitGameResult(string json);

void OnGameOver(int score, float multiplier) {
    var json = JsonUtility.ToJson(new {
        points = score,
        multiplier = multiplier,
        metadata = new { round = currentRound }
    });
    SubmitGameResult(json);
}
```

Add a `.jslib` plugin so Unity can dispatch the event to React:

```javascript
mergeInto(LibraryManager.library, {
  SubmitGameResult: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    if (window.dispatchReactUnityEvent) {
      window.dispatchReactUnityEvent("SubmitGameResult", json);
    }
  },
});
```

The wrapper `<CyberCasinoRoom />` already listens for `SubmitGameResult`
and POSTs to `/api/v1/rewards/queue` with the connected wallet attached.

## Current default build

`cyber_casino_main/Build/` ships with Unity's open-source WebGL load-test
demo (Unity 6000.4.0f1 WebGL2 build, sourced from
[JohannesDeml/UnityWebGL-LoadingTest](https://github.com/JohannesDeml/UnityWebGL-LoadingTest),
MIT licensed). Replace with your own production build at any time.
