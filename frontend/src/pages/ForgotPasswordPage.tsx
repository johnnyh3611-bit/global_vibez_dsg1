/**
 * ForgotPasswordPage — request a reset link by email.
 *
 * Always shows the same success confirmation regardless of whether the
 * email is registered (server contract), so attackers can't enumerate.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        // Distinguish email-provider failures from generic 4xx/5xx so
        // users get a clearer "try again later" rather than "something
        // went wrong" — these surface as a sonner toast on top of the
        // inline form error.
        if (r.status === 429) {
          toast.error("Too many reset requests. Try again in a few minutes.", {
            id: "forgot-pw-rate-limit",
          });
        } else if (r.status === 503 || r.status === 502) {
          toast.error(
            "Email service is temporarily unavailable. Please try again shortly.",
            { id: "forgot-pw-email-down", duration: 6000 },
          );
        }
        throw new Error(data.detail || "Something went wrong. Try again.");
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center px-4" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6" data-testid="forgot-back-to-login">
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {!sent ? (
            <>
              <h1 className="text-3xl font-black italic tracking-tight text-white mb-2">
                Forgot your password?
              </h1>
              <p className="text-sm text-slate-400 mb-8">
                Drop your email and we'll send you a reset link. Expires in 60 minutes.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5" data-testid="forgot-password-form">
                <div>
                  <Label htmlFor="email" className="text-white mb-2 block">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                      placeholder="you@example.com"
                      required
                      data-testid="forgot-password-email-input"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-rose-400" data-testid="forgot-password-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black italic uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="forgot-password-submit-btn"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending</> : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4" data-testid="forgot-password-success">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black italic text-white mb-2">Check your inbox.</h2>
              <p className="text-sm text-slate-400 mb-6">
                If <span className="text-white font-semibold">{email}</span> is registered, we've sent a reset link. It expires in 60 minutes.
              </p>
              <p className="text-xs text-slate-500">
                Didn't get it? Check spam, or{" "}
                <button
                  onClick={() => { setSent(false); }}
                  className="text-fuchsia-400 hover:text-fuchsia-300 underline"
                  data-testid="forgot-password-try-again"
                >
                  try again
                </button>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
