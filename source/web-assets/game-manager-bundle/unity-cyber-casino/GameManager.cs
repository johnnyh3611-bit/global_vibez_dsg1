/*
 * GameManager.cs — Cyber Casino Unity Game Manager
 *
 * Drop this script onto an empty GameObject named "GameManager" in your
 * Unity Cyber Casino scene. It is the central authority that:
 *
 *   1. Talks to the React host (window) via JSLib bridge
 *      (ReactBridge.jslib) using SendMessage <-> postMessage.
 *   2. Holds the canonical match state (round, score, multiplier, time).
 *   3. Brokers the ₵ Vibez Coin escrow flow:
 *        Unity ──"GameStart"──> React ──/api/v1/games/start──> backend
 *        Unity ──"GameResult"─> React ──/api/v1/rewards/queue─> backend
 *   4. Surfaces a small singleton API the rest of your game scripts
 *      can use:   GameManager.Instance.AddScore(120);  etc.
 *
 * Targeting: Unity 2022.3 LTS or newer. WebGL build platform.
 *
 * IMPORTANT — Build settings (Project Settings > Player > WebGL):
 *   • Compression Format: Brotli  (matches the React loader expectations)
 *   • Decompression Fallback: Disabled
 *   • Run In Background: ON
 *   • Memory Size: 256 MB starting (raise if your scene is heavy)
 *
 * Usage from inside a gameplay script:
 *     GameManager.Instance.AddScore(50);
 *     GameManager.Instance.SetMultiplier(2.0f);
 *     GameManager.Instance.SubmitResult();   // cashes out into ₵ escrow
 *
 * Usage from React (already wired in CyberCasinoRoom.tsx):
 *     unityProvider.send("GameManager", "StartRound", '{"betAmount":50}');
 *
 * Author: Global Vibez DSG · 2026-04
 */

using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

#if UNITY_WEBGL && !UNITY_EDITOR
using UnityEngine.Rendering;
#endif

[DisallowMultipleComponent]
public class GameManager : MonoBehaviour
{
    // ───────────────────────────────────── Singleton ──

    public static GameManager Instance { get; private set; }

    // ───────────────────────────────────── Public state ──

    [Header("Match Configuration")]
    [Tooltip("How many seconds a round lasts before auto-ending. 0 = no timer.")]
    [SerializeField] private float roundDurationSec = 90f;

    [Tooltip("Game id stamped on every escrow row. Match the room key in React.")]
    [SerializeField] private string gameId = "cyber_casino_main";

    [Header("Runtime (read-only)")]
    [SerializeField] private GameState state = GameState.Idle;
    [SerializeField] private int score = 0;
    [SerializeField] private float multiplier = 1f;
    [SerializeField] private int betAmount = 0;
    [SerializeField] private float timeRemaining = 0f;

    public GameState CurrentState => state;
    public int Score => score;
    public float Multiplier => multiplier;
    public int BetAmount => betAmount;
    public float TimeRemaining => timeRemaining;

    // ───────────────────────────────────── Events ──

    public event Action<int> OnScoreChanged;
    public event Action<float> OnMultiplierChanged;
    public event Action<GameState, GameState> OnStateChanged;       // (from, to)
    public event Action<GameResult> OnRoundEnded;

    // ───────────────────────────────────── React bridge JSLib ──
    //
    // To finish wiring this you also need /Assets/Plugins/WebGL/ReactBridge.jslib
    // (template provided at the bottom of this file as a comment block).

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] private static extern void Vibez_PostToReact(string json);
#else
    private static void Vibez_PostToReact(string json) {
        Debug.Log("[GameManager] (editor stub) → React: " + json);
    }
#endif

    // ───────────────────────────────────── Unity lifecycle ──

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    private void Start()
    {
        // Tell React we're booted and ready to receive a StartRound call.
        PostToReact(new BridgeEvent { type = "Ready", gameId = gameId });
    }

    private void Update()
    {
        if (state != GameState.Playing || roundDurationSec <= 0f) return;
        timeRemaining -= Time.deltaTime;
        if (timeRemaining <= 0f)
        {
            timeRemaining = 0f;
            EndRound("timeout");
        }
    }

    // ───────────────────────────────────── React → Unity (SendMessage) ──
    //
    // React calls these via:
    //   unityProvider.send("GameManager", "<MethodName>", "<json string>");
    //
    // Method names MUST match exactly (case-sensitive). Each takes a single
    // string argument that we parse as JSON.

    /// <summary>Called by React when the player clicks "Play". Carries the
    /// ₵ bet they want to wager for this round.</summary>
    public void StartRound(string json)
    {
        var payload = JsonUtility.FromJson<StartRoundPayload>(json ?? "{}");
        betAmount = Mathf.Max(0, payload.betAmount);
        score = 0;
        multiplier = 1f;
        timeRemaining = roundDurationSec;
        TransitionTo(GameState.Playing);
        OnScoreChanged?.Invoke(0);
        OnMultiplierChanged?.Invoke(1f);

        PostToReact(new BridgeEvent
        {
            type = "GameStart",
            gameId = gameId,
            betAmount = betAmount,
        });
    }

    /// <summary>Pause the round (e.g. user opened a modal). Timer pauses.</summary>
    public void PauseRound(string _)
    {
        if (state == GameState.Playing) TransitionTo(GameState.Paused);
    }

    public void ResumeRound(string _)
    {
        if (state == GameState.Paused) TransitionTo(GameState.Playing);
    }

    /// <summary>Force-end the round (host kicked, network drop, etc.).</summary>
    public void ForceEndRound(string reason)
    {
        EndRound(string.IsNullOrEmpty(reason) ? "external" : reason);
    }

    // ───────────────────────────────────── Public gameplay API ──

    public void AddScore(int amount)
    {
        if (state != GameState.Playing) return;
        score += amount;
        if (score < 0) score = 0;
        OnScoreChanged?.Invoke(score);
    }

    public void SetMultiplier(float newMultiplier)
    {
        if (state != GameState.Playing) return;
        multiplier = Mathf.Max(0f, newMultiplier);
        OnMultiplierChanged?.Invoke(multiplier);
    }

    /// <summary>Cash-out trigger. Called by gameplay scripts when the player
    /// hits a target / clears the level / etc. Posts the result to React,
    /// which then POSTs /api/v1/rewards/queue to escrow ₵ Vibez Coins.</summary>
    public void SubmitResult()
    {
        EndRound("manual");
    }

    // ───────────────────────────────────── Internal ──

    private void EndRound(string reason)
    {
        if (state == GameState.Idle || state == GameState.Ended) return;

        TransitionTo(GameState.Ended);

        var result = new GameResult
        {
            gameId = gameId,
            score = score,
            multiplier = multiplier,
            betAmount = betAmount,
            durationSec = roundDurationSec - timeRemaining,
            reason = reason,
        };

        OnRoundEnded?.Invoke(result);

        // The single payload that React listens for. Field names must match
        // CyberCasinoRoom.tsx → submitResult() expectation:
        //   { points: number, multiplier: number, metadata: object }
        var bridgePayload = new BridgeEvent
        {
            type = "GameResult",
            gameId = gameId,
            points = result.score,
            multiplier = result.multiplier,
            metadata = JsonUtility.ToJson(new ResultMetadata
            {
                duration_sec = result.durationSec,
                bet_amount = result.betAmount,
                reason = result.reason,
            }),
        };
        PostToReact(bridgePayload);
    }

    private void TransitionTo(GameState next)
    {
        if (state == next) return;
        var prev = state;
        state = next;
        OnStateChanged?.Invoke(prev, next);
    }

    private void PostToReact(BridgeEvent ev)
    {
        try
        {
            Vibez_PostToReact(JsonUtility.ToJson(ev));
        }
        catch (Exception e)
        {
            Debug.LogWarning("[GameManager] PostToReact failed: " + e);
        }
    }

    // ───────────────────────────────────── Types ──

    public enum GameState { Idle, Playing, Paused, Ended }

    [Serializable]
    private struct StartRoundPayload { public int betAmount; }

    [Serializable]
    private struct ResultMetadata
    {
        public float duration_sec;
        public int bet_amount;
        public string reason;
    }

    [Serializable]
    public struct GameResult
    {
        public string gameId;
        public int score;
        public float multiplier;
        public int betAmount;
        public float durationSec;
        public string reason;
    }

    [Serializable]
    private struct BridgeEvent
    {
        public string type;
        public string gameId;
        public int betAmount;
        public int points;
        public float multiplier;
        public string metadata;
    }
}

/* ──────────────────────────────────────────────────────────────────
   Companion file: /Assets/Plugins/WebGL/ReactBridge.jslib

   mergeInto(LibraryManager.library, {
     Vibez_PostToReact: function (jsonPtr) {
       var json = UTF8ToString(jsonPtr);
       try {
         var msg = JSON.parse(json);
         msg.source = "VibezUnity";
         window.parent.postMessage(msg, "*");
         if (window.dispatchReactGameMessage) {
           window.dispatchReactGameMessage(msg);
         }
       } catch (e) { console.warn("ReactBridge:", e); }
     }
   });
   ────────────────────────────────────────────────────────────────── */
