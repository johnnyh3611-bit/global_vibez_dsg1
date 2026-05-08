/**
 * ResetPasswordPage — visited from the email link.
 * URL: /reset-password?token=...
 *
 * Flow:
 *   1. On mount, GET /api/auth/reset-password/verify?token=... → show form or error
 *   2. On submit, POST /api/auth/reset-password → redirect to /login on success
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type VerifyReason = "missing" | "invalid" | "expired" | "used" | "network";
type VerifyState =
  | { status: "checking" }
  | { status: "valid"; email?: string }
  | { status: "invalid"; reason: VerifyReason };

const REASON_COPY: Record<string, { title: string; body: string }> = {
  missing: { title: "No reset token.", body: "This page needs a reset link from your email." },
  invalid: { title: "This link is invalid.", body: "It may have been mistyped or tampered with." },
  expired: { title: "This link expired.", body: "Reset links are good for 60 minutes. Request a new one." },
  used:    { title: "This link was already used.", body: "If you still need to reset, request a new link." },
  network: { title: "Couldn't verify right now.", body: "Check your connection and try again." },
};

const validate = (p: string): string | null => {
  if (p.length < 8) return "At least 8 characters.";
  if (!/[A-Z]/.test(p)) return "At least one uppercase letter.";
  if (!/[a-z]/.test(p)) return "At least one lowercase letter.";
  if (!/\d/.test(p)) return "At least one number.";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(p)) return "At least one special character.";
  return null;
};

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [verify, setVerify] = useState<VerifyState>({ status: "checking" });
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerify({ status: "invalid", reason: "missing" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`);
        const data = await r.json();
        if (cancelled) return;
        if (data.valid) setVerify({ status: "valid", email: data.email });
        else setVerify({ status: "invalid", reason: (data.reason || "invalid") as VerifyReason });
      } catch {
        if (!cancelled) setVerify({ status: "invalid", reason: "network" });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const rule = useMemo(() => validate(pwd), [pwd]);
  const mismatch = pwd && confirm && pwd !== confirm;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (rule || mismatch || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, new_password: pwd }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Couldn't reset. Try again.");
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2400);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [rule, mismatch, submitting, token, pwd, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center px-4" data-testid="reset-password-page">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {verify.status === "checking" && (
            <div className="py-10 flex flex-col items-center text-slate-400" data-testid="reset-checking">
              <Loader2 className="w-6 h-6 animate-spin mb-3" />
              <span className="text-sm">Verifying your reset link…</span>
            </div>
          )}

          {verify.status === "invalid" && (
            <div className="text-center py-4" data-testid="reset-invalid">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 mb-5">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
              </div>
              <h2 className="text-2xl font-black italic text-white mb-2">
                {REASON_COPY[verify.reason].title}
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                {REASON_COPY[verify.reason].body}
              </p>
              <Link
                to="/forgot-password"
                className="inline-block px-5 py-2.5 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-sm uppercase tracking-widest"
                data-testid="reset-request-new-link-btn"
              >
                Request new link
              </Link>
            </div>
          )}

          {verify.status === "valid" && !success && (
            <>
              <h1 className="text-3xl font-black italic tracking-tight text-white mb-2">
                Pick a new password.
              </h1>
              <p className="text-sm text-slate-400 mb-8">
                {verify.email ? <>For <span className="text-white">{verify.email}</span></> : null}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5" data-testid="reset-password-form">
                <div>
                  <Label htmlFor="pwd" className="text-white mb-2 block">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="pwd"
                      type={showPwd ? "text" : "password"}
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      className="pl-10 pr-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                      placeholder="••••••••"
                      required
                      data-testid="reset-password-new-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      tabIndex={-1}
                      aria-label={showPwd ? "Hide password" : "Show password"}
                    >
                      {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {pwd && rule && (
                    <p className="text-xs text-amber-400 mt-2" data-testid="reset-password-rule-hint">{rule}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm" className="text-white mb-2 block">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="confirm"
                      type={showPwd ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pl-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                      placeholder="••••••••"
                      required
                      data-testid="reset-password-confirm-input"
                    />
                  </div>
                  {mismatch && <p className="text-xs text-amber-400 mt-2" data-testid="reset-password-mismatch">Passwords don't match.</p>}
                </div>

                {error && (
                  <div className="text-sm text-rose-400" data-testid="reset-password-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !!rule || !!mismatch || !pwd || !confirm}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black italic uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="reset-password-submit-btn"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating</> : "Update Password"}
                </button>
              </form>
            </>
          )}

          {success && (
            <div className="text-center py-4" data-testid="reset-password-success">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black italic text-white mb-2">Password updated.</h2>
              <p className="text-sm text-slate-400">Taking you to sign in…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
