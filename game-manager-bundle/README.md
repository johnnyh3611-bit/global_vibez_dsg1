# Global Vibez DSG — Game Manager Bundle

Everything game-related from the platform, organized for handoff.

## What's inside

```
game-manager-bundle/
├── README.md                          ← you are here
│
├── frontend-game-engine/
│   └── game-engine/                   ← /app/frontend/src/game-engine
│       ├── GameEngine.js              ← universal validator + turn manager
│       ├── GameLogic.js
│       ├── SpecificRules.js
│       ├── index.js
│       ├── rules/
│       │   ├── SpadesLogic.js
│       │   ├── UnoLogic.js
│       │   └── CheckersLogic.js
│       └── utils/
│           ├── WinConditions.js
│           ├── CardUtils.js
│           └── TurnManager.js
│
├── plugin-architecture/               ← Core+Plugin pattern (extensible games)
│   ├── engine/core/PluginInterface.js ← base class every game plugin extends
│   └── SpadesPlugin.js                ← reference plugin implementation
│
├── backend-multiplayer/               ← /app/backend/routes/*
│   ├── http_multiplayer.py            ← matchmaking + turn rotation + state
│   └── vibe_ridez_dispatch.py         ← cascade dispatch + escrow
│
└── unity-cyber-casino/
    ├── GameManager.cs                 ← drop into Unity Assets/Scripts
    └── ReactBridge.jslib              ← drop into Assets/Plugins/WebGL
```

---

## 1. Frontend Game Engine

`GameEngine.js` is the **universal** turn / validation layer. Every move
goes through `GameEngine.validateAction(gameState, action)` before being
sent to the backend. It checks:

1. Is it the player's turn? (universal)
2. Is the move data well-formed? (universal)
3. Game-specific rule (delegates to `SpecificRules[gameType]`)

To plug a new card game in:
1. Add a new file under `rules/` — e.g. `rules/PokerLogic.js` — exporting a
   class that implements `validateMove`, `calculateWin`, and `getNextPlayer`.
2. Register it in `SpecificRules.js`.

That's the entire dependency contract for cards.

---

## 2. Plugin Architecture (extensible games)

`engine/core/PluginInterface.js` is a **richer** base class for full game
plugins (used by the Plugin registry). It carries config (min/max players,
deck type, betting flag, win condition) and exposes hooks: `validateAction`,
`executeAction`, `calculateScore`, `determineWinner`, `getValidActions`,
`onGameStart`.

`SpadesPlugin.js` is the canonical reference — copy it when adding a new
game. The plugin registry auto-discovers files in `/frontend/src/plugins/`.

---

## 3. Backend Multiplayer (`http_multiplayer.py`)

FastAPI router serving:

| Endpoint | Purpose |
|---|---|
| `POST /api/http-multiplayer/heartbeat` | keep session alive |
| `POST /api/http-multiplayer/join-queue` | enter matchmaking pool |
| `GET  /api/http-multiplayer/check-match/{user_id}` | poll for match |
| `GET  /api/http-multiplayer/game/{game_id}` | full game state |
| `POST /api/http-multiplayer/place-bid` | place a bid |
| `POST /api/http-multiplayer/make-move` | submit a move |
| `POST /api/http-multiplayer/leave-queue` | exit matchmaking |

The server is the **authoritative** source of truth. The frontend's
`GameEngine.validateAction` is a *fast pre-check* to avoid round-trips —
any move that passes the client must still be re-validated server-side.

State for in-flight games lives in MongoDB; matchmaking queues live
in-memory (the recently-shipped persistence work covers VibeRidez drivers,
not card games yet — open work item).

---

## 4. Unity Cyber Casino (`GameManager.cs`)

Singleton MonoBehaviour. Lifecycle:

```
React → unityProvider.send("GameManager", "StartRound", '{"betAmount":50}')
                                ↓
                       GameManager.StartRound()  → OnScoreChanged events
                                ↓
                       GameManager.SubmitResult()
                                ↓
                       Vibez_PostToReact(json)   ← in ReactBridge.jslib
                                ↓
                       React onMessage → POST /api/v1/rewards/queue
                                ↓
                       Backend escrows ₵ Vibez Coins for 72h
```

### Setup checklist (in Unity Editor)

1. Create empty GameObject named `GameManager` in your main scene.
2. Attach `GameManager.cs` script.
3. In the Inspector, set `Game Id` to match the room key in
   `CyberCasinoRoom.tsx` (currently `cyber_casino_main`).
4. Drop `ReactBridge.jslib` at `Assets/Plugins/WebGL/`.
5. **Project Settings → Player → WebGL:**
   - Compression Format: **Brotli**
   - Decompression Fallback: **Disabled**
   - Run In Background: **ON**
   - Memory Size: 256 MB (raise if scene is heavy)
6. Build for WebGL → zip the `Build/` folder → drop the zip in chat,
   I'll wire it into `/frontend/public/unity-builds/cyber_casino_main/`.

### Public API any gameplay script can call

```csharp
GameManager.Instance.AddScore(120);
GameManager.Instance.SetMultiplier(2.5f);
GameManager.Instance.SubmitResult();          // cash out
GameManager.Instance.OnScoreChanged += (s) => Debug.Log("New score: " + s);
GameManager.Instance.OnRoundEnded += (r) => Debug.Log("Cashed out " + r.score);
```

### React already-wired event listener
```ts
// CyberCasinoRoom.tsx already listens for messages with source: "VibezUnity"
window.addEventListener("message", (e) => {
  if (e.data?.source !== "VibezUnity") return;
  if (e.data.type === "GameResult") submitResult(JSON.stringify(e.data));
});
```

---

## Pending / open items in the game stack

- ♠️ **Spades AAA Phase 3** — animated trick-winner FX in the new oval table.
- 🎮 **Real Cyber Casino Unity build** — the placeholder cubes will swap
  out the moment you upload your WebGL zip.
- 💾 **Card game state persistence** — match state survives a backend
  restart for VibeRidez but not yet for HTTP-multiplayer card games.

---

_Generated 2026-04-26 — Global Vibez DSG_
