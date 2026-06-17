/**
 * CyberCasinoRoom — Unity WebGL wrapper for external Cyber Casino games.
 *
 * Hosts a Unity build via react-unity-webgl. The Unity layer calls back into
 * React via:
 *   ReactUnityWebGL.SubmitGameResult(jsonString)
 *
 * On submit, we POST to /api/v1/rewards/queue which puts ₵ rewards into the
 * 72-hour God-Mode escrow. If a Solana wallet is connected via any supported
 * Solflare, we include `user_wallet` so the eventual on-chain payout has
 * a recipient.
 *
 * Routes:
 *   /cyber-casino                — default build (gameId="cyber_casino_main")
 *   /cyber-casino/:gameId        — dynamic build per game
 *
 * Demo mode: when no Unity build is found, falls back to the built-in
 * <CyberCasinoDemoGame /> mini-game so the end-to-end flow is testable today.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Unity, useUnityContext } from "react-unity-webgl";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, Zap, ArrowLeft, Clock, Bolt } from "lucide-react";
import WalletConnectButton from "@/components/web3/WalletConnectButton";
import CyberCasinoDemoGame from "./CyberCasinoDemoGame";
import { authFetch } from "@/utils/secureAuth";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const UNITY_BASE = process.env.REACT_APP_UNITY_BUILD_BASE || "/unity-builds";

type SubmitResult = {
  status: string;
  reward_id?: string;
  reward_amount_coins?: number;
  gross_coins?: number;
  fee_coins?: number;
  fee_rate?: number;
  speed?: string;
  delay_hours?: number;
  unlocks_at?: string;
  detail?: string;
};

type PayoutSpeed = "standard" | "instant";

export default function CyberCasinoRoom() {
  const { gameId: gameIdParam } = useParams();
  const navigate = useNavigate();
  const gameId = gameIdParam || "cyber_casino_main";
  const { publicKey, connected } = useWallet();

  const buildBase = `${UNITY_BASE}/${gameId}/Build`;
  const {
    unityProvider,
    isLoaded,
    loadingProgression,
    addEventListener,
    removeEventListener,
    sendMessage,
    UNSAFE__unityInstance,
  } = useUnityContext({
    loaderUrl: `${buildBase}/${gameId}.loader.js`,
    dataUrl: `${buildBase}/${gameId}.data`,
    frameworkUrl: `${buildBase}/${gameId}.framework.js`,
    codeUrl: `${buildBase}/${gameId}.wasm`,
  });

  const [submitState, setSubmitState] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unityError, setUnityError] = useState("");
  const [buildChecked, setBuildChecked] = useState(false);
  const [payoutSpeed, setPayoutSpeed] = useState<PayoutSpeed>("standard");
  const [handshakeToken, setHandshakeToken] = useState<string | null>(null);

  void UNSAFE__unityInstance;

  // Fetch the 60-second one-time-use handshake token as soon as the
  // page mounts. We pass it into Unity via sendMessage once Unity loads.
  useEffect(() => {
    let cancelled = false;
    authFetch(`${BACKEND}/api/game/handshake`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.token) setHandshakeToken(data.token);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // When Unity is loaded AND we have a handshake token, push it into
  // the engine's "AuthManager" GameObject. (Standard Unity convention —
  // your build should expose a public `ReceiveToken(string)` method.)
  useEffect(() => {
    if (isLoaded && handshakeToken) {
      try {
        sendMessage("AuthManager", "ReceiveToken", handshakeToken);
      } catch {
        // The placeholder build doesn't have AuthManager — that's fine.
      }
    }
  }, [isLoaded, handshakeToken, sendMessage]);

  const submitResult = useCallback(
    async (raw: string) => {
      // Wallet-required guard — cash-out into ₵ escrow now requires a
      // connected Solana wallet so payouts have an on-chain destination.
      if (!connected || !publicKey) {
        setSubmitState({
          status: "WalletRequired",
          detail: "Connect a Solana wallet to cash out into the ₵ escrow.",
        });
        return;
      }

      let parsed: { points?: number; multiplier?: number; metadata?: Record<string, unknown> } = {};
      try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        parsed = { points: 0, multiplier: 1 };
      }
      setSubmitting(true);
      try {
        const res = await fetch(`${BACKEND}/api/v1/rewards/queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_id: gameId,
            points: Number(parsed.points || 0),
            multiplier: Number(parsed.multiplier || 1),
            metadata: parsed.metadata || {},
            speed: payoutSpeed,
            user_wallet: publicKey.toBase58(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as SubmitResult;
        setSubmitState(data);
      } catch {
        setSubmitState({ status: "Error", detail: "Network failure" });
      } finally {
        setSubmitting(false);
      }
    },
    [gameId, connected, publicKey, payoutSpeed],
  );

  // Expose React → Unity bridge (Unity calls back via window.ReactUnityWebGL.*)
  useEffect(() => {
    addEventListener("SubmitGameResult", submitResult as never);
    return () => removeEventListener("SubmitGameResult", submitResult as never);
  }, [addEventListener, removeEventListener, submitResult]);

  // Detect missing Unity build (the SPA returns 200 + index.html for unknown
  // paths, so we sniff the body for HTML to decide if a build exists).
  useEffect(() => {
    let cancelled = false;
    fetch(`${buildBase}/${gameId}.loader.js`, { method: "GET" })
      .then(async (r) => {
        const text = await r.text();
        const looksLikeHtml = /^\s*<!doctype/i.test(text) || /<html/i.test(text);
        if (!cancelled && (!r.ok || looksLikeHtml)) {
          setUnityError(`Unity build not deployed at ${buildBase}.`);
        }
      })
      .catch(() => {
        if (!cancelled) setUnityError(`Unity build unreachable at ${buildBase}.`);
      })
      .finally(() => { if (!cancelled) setBuildChecked(true); });
    return () => { cancelled = true; };
  }, [buildBase, gameId]);

  return (
    <div
      className="min-h-screen bg-slate-950 text-cyan-100 relative overflow-hidden"
      data-testid="cyber-casino-root"
    >
      {/* Cyber grid backdrop */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#0ff2 1px, transparent 1px), linear-gradient(90deg, #0ff2 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 backdrop-blur gap-4 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-cyan-300 hover:text-cyan-100"
          data-testid="cyber-casino-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-black tracking-[0.3em] uppercase text-cyan-300">
          Cyber Casino · {gameId.replace(/_/g, " ")}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-fuchsia-300">
            <Zap className="w-4 h-4" /> Rewards in ₵ (72h escrow)
          </div>
          <WalletConnectButton />
        </div>
      </header>

      <main
        className="relative z-10 max-w-6xl mx-auto px-4 py-6 flex flex-col items-center gap-4"
        data-testid="cyber-casino-stage"
      >
        {connected && publicKey && (
          <div
            className="text-[11px] text-emerald-300 font-mono"
            data-testid="cyber-casino-wallet-pill"
          >
            Wallet linked · {publicKey.toBase58().slice(0, 6)}…{publicKey.toBase58().slice(-4)}
          </div>
        )}

        {/* Payout speed selector */}
        <div
          className="flex items-center gap-2 p-1 rounded-full border border-cyan-500/30 bg-black/40"
          data-testid="cyber-casino-payout-toggle"
        >
          <button
            onClick={() => setPayoutSpeed("standard")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider transition-all ${
              payoutSpeed === "standard"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/50"
                : "text-cyan-600 hover:text-cyan-400"
            }`}
            data-testid="cyber-casino-payout-standard"
          >
            <Clock className="w-3 h-3" /> Standard · 5% / 72h
          </button>
          <button
            onClick={() => setPayoutSpeed("instant")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider transition-all ${
              payoutSpeed === "instant"
                ? "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/50"
                : "text-fuchsia-600 hover:text-fuchsia-400"
            }`}
            data-testid="cyber-casino-payout-instant"
          >
            <Bolt className="w-3 h-3" /> Instant · 12% / 0h
          </button>
        </div>

        {unityError ? (
          <CyberCasinoDemoGame
            gameId={gameId}
            onSubmit={submitResult}
            submitting={submitting}
          />
        ) : (
          <>
            {!buildChecked && (
              <div className="flex items-center gap-3 text-cyan-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                Probing Unity build…
              </div>
            )}
            {buildChecked && !isLoaded && (
              <div
                className="flex items-center gap-3 text-cyan-300"
                data-testid="cyber-casino-loader"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading Unity build · {Math.round(loadingProgression * 100)}%
              </div>
            )}
            {buildChecked && (
              <Unity
                unityProvider={unityProvider}
                style={{
                  width: "100%",
                  maxWidth: 1280,
                  aspectRatio: "16 / 9",
                  background: "#000",
                  borderRadius: 12,
                  boxShadow: "0 0 60px rgba(0,255,255,0.15)",
                }}
                data-testid="cyber-casino-unity"
              />
            )}
            {buildChecked && isLoaded && (
              <button
                onClick={() =>
                  submitResult(
                    JSON.stringify({
                      points: 100 + Math.floor(Math.random() * 400),
                      multiplier: 1,
                      metadata: { game: gameId, mode: "manual_test_cashout" },
                    }),
                  )
                }
                disabled={submitting || !connected}
                className={`mt-3 px-5 py-2 rounded-full font-black uppercase tracking-wider text-xs transition-all ${
                  !connected
                    ? "bg-amber-500/20 text-amber-300 border border-amber-400/40 cursor-not-allowed animate-pulse"
                    : "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black"
                } disabled:opacity-60`}
                data-testid="cyber-casino-test-cashout"
                title={!connected ? "Connect a Solana wallet to cash out" : ""}
              >
                {!connected
                  ? "Connect Wallet to Cash Out"
                  : submitting
                  ? "Queueing…"
                  : "Test Cash-Out into ₵ Escrow"}
              </button>
            )}
          </>
        )}

        {submitting && (
          <p className="text-cyan-300 text-sm" data-testid="cyber-casino-submitting">
            Queueing reward in escrow…
          </p>
        )}

        {submitState && (
          <div
            className={`mt-2 px-4 py-3 rounded border max-w-xl w-full ${
              submitState.status === "Queued"
                ? "border-emerald-500/50 bg-emerald-900/20 text-emerald-200"
                : submitState.status === "WalletRequired"
                ? "border-amber-500/50 bg-amber-900/20 text-amber-200"
                : "border-red-500/50 bg-red-900/20 text-red-200"
            }`}
            data-testid="cyber-casino-submit-result"
          >
            {submitState.status === "Queued" ? (
              <>
                <p className="font-bold">
                  ₵{submitState.reward_amount_coins?.toLocaleString()} net queued
                  {submitState.speed === "instant" ? " (Instant)" : " (Standard 72h)"}
                </p>
                {typeof submitState.gross_coins === "number" && (
                  <p className="text-xs opacity-80">
                    Gross ₵{submitState.gross_coins.toLocaleString()} − fee ₵
                    {submitState.fee_coins?.toLocaleString()} (
                    {Math.round((submitState.fee_rate || 0) * 100)}%)
                  </p>
                )}
                <p className="text-xs opacity-80">
                  Unlocks at:{" "}
                  {submitState.unlocks_at
                    ? new Date(submitState.unlocks_at).toLocaleString()
                    : "—"}
                </p>
                <p className="text-[11px] opacity-60 mt-1">
                  Reward ID: {submitState.reward_id}
                </p>
              </>
            ) : (
              <p className="text-sm">{submitState.detail || submitState.status}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
