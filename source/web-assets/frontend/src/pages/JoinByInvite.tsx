/**
 * /join/:code — Invite landing page.
 *
 * Validates the invite code, stores it in sessionStorage so the chair-vault
 * buy panel can pre-fill it, and redirects depending on auth state:
 *   • Signed in → /chair-vault (with code pre-filled)
 *   • Signed out → /login?from=/chair-vault (after login, code persists)
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sparkles, Check, X } from "lucide-react";
import { getUserId, authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

export default function JoinByInvite() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (!code) {
      setStatus("invalid");
      return;
    }
    fetch(`${API}/api/invites/validate/${encodeURIComponent(code)}`)
      .then(r => r.ok && r.json())
      .then(d => {
        if (d?.valid) {
          sessionStorage.setItem("pending_invite_code", code.toUpperCase());
          setStatus("valid");
          // Best-effort redeem if signed in
          if (getUserId()) {
            authFetch(`${API}/api/invites/redeem`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: code.toUpperCase() }),
            }).catch(() => {});
          }
          setTimeout(() => {
            if (getUserId()) navigate("/chair-vault");
            else navigate(`/login?next=${encodeURIComponent("/chair-vault")}`);
          }, 1800);
        } else {
          setStatus("invalid");
          setReason(d?.reason || "unknown");
        }
      })
      .catch(() => setStatus("invalid"));
  }, [code, navigate]);

  return (
    <div
      data-testid="join-by-invite"
      className="min-h-screen bg-[#050507] flex items-center justify-center px-6 text-cyan-100"
    >
      <div className="max-w-md w-full rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-3xl p-8 text-center">
        {status === "checking" && (
          <>
            <Sparkles className="w-10 h-10 text-amber-300 mx-auto animate-pulse" />
            <h1 className="mt-4 text-2xl font-black">Validating invite…</h1>
            <p className="text-xs text-cyan-500 font-mono mt-1">{code}</p>
          </>
        )}
        {status === "valid" && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-300" />
            </div>
            <h1 className="mt-4 text-2xl font-black">You're in.</h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              Invite locked to your account. Redirecting to the Vault…
            </p>
          </>
        )}
        {status === "invalid" && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-400/20 border border-rose-400/40 flex items-center justify-center">
              <X className="w-7 h-7 text-rose-300" />
            </div>
            <h1 className="mt-4 text-2xl font-black">
              {reason === "already_used"
                ? "Invite already used"
                : "Invite not recognized"}
            </h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              Ask your inviter for a fresh code, or have someone with a chair
              issue you a new one.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 rounded-xl bg-cyan-500 text-black px-4 py-2 text-sm font-bold"
            >
              Back home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
