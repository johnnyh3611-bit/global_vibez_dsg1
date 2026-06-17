/**
 * AgeVerificationPage — 21+ verification flow for restricted goods
 * (alcohol + tobacco), encoding `Legal_Age_Verification_Protocol.pdf`.
 *
 * Route: /restricted-goods-verification
 *
 * Distinct from the platform-wide 18+ baseline gate at /age-verification.
 *
 * Three sections:
 *   1. Status banner — current verification state with copy + CTA
 *   2. DOB + ID + selfie capture form (or appeal form if rejected)
 *   3. The 4 spec pillars: 21+ requirement · Shadow-gate · Driver
 *      eligibility · Audit trail
 *
 * Provider-agnostic on purpose: file uploads route through the standard
 * `<DirectUpload />` component. Swapping in Persona/Stripe Identity later
 * means replacing the upload widget with their hosted SDK — endpoints stay.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  ShieldAlert,
  ShieldCheck,
  IdCard,
  Camera,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/utils/secureAuth";
import DirectUpload from "@/components/uploads/DirectUpload";

const API = process.env.REACT_APP_BACKEND_URL;

type Status = "not_submitted" | "pending" | "verified" | "rejected" | "appeal";

interface AvpStatus {
  status: Status;
  age: number | null;
  dob: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  eligible_for_restricted: boolean;
}

interface AvpConstants {
  minimum_age: number;
  restricted_categories: string[];
  decline_reasons: Record<string, string>;
  protocol_version: string;
}

export default function AgeVerificationPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AvpStatus | null>(null);
  const [constants, setConstants] = useState<AvpConstants | null>(null);
  const [dob, setDob] = useState("");
  const [idUrl, setIdUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [appealMsg, setAppealMsg] = useState("");

  const loadAll = async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        authFetch(`${API}/api/age-verification/status`),
        fetch(`${API}/api/age-verification/constants`),
      ]);
      if (sRes.ok) setStatus(await sRes.json());
      if (cRes.ok) setConstants(await cRes.json());
    } catch {
      /* silent — gate stays in not_submitted */
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dob) {
      toast.error("Please enter your date of birth");
      return;
    }
    if (!idUrl || !selfieUrl) {
      toast.error("Please upload both your government ID and a selfie");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/age-verification/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, id_document_url: idUrl, selfie_url: selfieUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Verification submission failed");
        return;
      }
      const d = await res.json();
      setStatus(d);
      if (d.status === "verified") {
        toast.success("You're verified — restricted goods unlocked.");
      } else if (d.status === "rejected") {
        toast.error("Verification declined. You may appeal below.");
      } else {
        toast.info("Submission received — awaiting review.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appealMsg.trim().length < 10) {
      toast.error("Please provide at least a sentence describing your appeal.");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/age-verification/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: appealMsg }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Appeal submission failed");
        return;
      }
      toast.success("Appeal received. An admin will review shortly.");
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#07030F] via-[#0a0815] to-[#170a23] text-white px-4 py-8"
      data-testid="age-verification-page"
    >
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-purple-300/70 hover:text-white text-sm mb-4"
          data-testid="age-verification-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-fuchsia-600 shadow-[0_0_20px_rgba(217,70,239,0.45)] flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              21+ Verification · Restricted Goods
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Age Verification</h1>
          </div>
        </div>
        <p className="text-sm text-purple-200/80 mb-2 max-w-xl">
          Verify you're {constants?.minimum_age ?? 21}+ to unlock alcohol and tobacco
          delivery. We accept a government-issued photo ID. Your documents are encrypted
          and only used for this verification.
        </p>
        {constants?.protocol_version && (
          <p className="text-[10px] font-mono text-purple-400/60 mb-2">
            {constants.protocol_version}
          </p>
        )}
        <p className="text-[10px] font-mono text-fuchsia-300/70 mb-6" data-testid="avp-kyc-vendor-label">
          Verified by{" "}
          <span className="text-fuchsia-200 font-bold">
            {(constants as { recommended_kyc_provider?: string } | null)?.recommended_kyc_provider === "stripe_identity"
              ? "Stripe Identity"
              : (constants as { recommended_kyc_provider?: string } | null)?.recommended_kyc_provider || "Trusted KYC partner"}
          </span>{" "}
          — bank-grade identity verification.
        </p>

        {/* Status banner */}
        <StatusBanner status={status} constants={constants} />

        {/* Submission / appeal forms */}
        {(!status || status.status === "not_submitted" || status.status === "rejected") &&
          status?.status !== "rejected" && (
            <form
              onSubmit={onSubmit}
              className="rounded-2xl border border-fuchsia-500/20 bg-[#0F0720] p-5 md:p-6 mt-4 space-y-4"
              data-testid="age-verification-form"
            >
              <h2 className="text-lg font-black">Submit for review</h2>

              <Field label="Date of birth" icon={CalendarDays}>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#1A0D2E] border border-fuchsia-500/20 rounded-lg px-3 py-2 text-white"
                  data-testid="age-verification-dob"
                  required
                />
              </Field>

              <Field label="Government ID (front)" icon={IdCard}>
                <DirectUpload
                  kind="id_doc"
                  accept="image"
                  cameraCapture
                  value={idUrl}
                  onChange={setIdUrl}
                  testid="age-verification-id-upload"
                />
              </Field>

              <Field label="Selfie (well-lit, no sunglasses)" icon={Camera}>
                <DirectUpload
                  kind="selfie"
                  accept="image"
                  cameraCapture
                  value={selfieUrl}
                  onChange={setSelfieUrl}
                  testid="age-verification-selfie-upload"
                />
              </Field>

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 text-sm font-bold disabled:opacity-50 shadow-[0_0_22px_rgba(251,191,36,0.4)]"
                data-testid="age-verification-submit-btn"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                Submit for verification
              </button>

              <p className="text-[11px] text-purple-300/55 leading-relaxed">
                By submitting you confirm the information is true. Submissions are
                retained in an immutable audit log per the Restricted Goods Delivery
                Standard.
              </p>
            </form>
          )}

        {/* Rejected → appeal form */}
        {status?.status === "rejected" && (
          <form
            onSubmit={onAppeal}
            className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 md:p-6 mt-4 space-y-3"
            data-testid="age-verification-appeal-form"
          >
            <h2 className="text-lg font-black text-red-200">Appeal this decision</h2>
            <p className="text-xs text-red-100/80">
              Tell us what to reconsider. A human reviewer will respond.
            </p>
            <textarea
              value={appealMsg}
              onChange={(e) => setAppealMsg(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Why should we re-review your submission?"
              className="w-full bg-[#1A0D2E] border border-red-500/30 rounded-lg px-3 py-2 text-white text-sm"
              data-testid="age-verification-appeal-textarea"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-red-500 hover:bg-red-400 text-white text-sm font-bold disabled:opacity-50"
              data-testid="age-verification-appeal-submit"
            >
              Submit appeal
            </button>
          </form>
        )}

        {/* Pillars */}
        <div className="grid md:grid-cols-2 gap-3 mt-6" data-testid="age-verification-pillars">
          <Pillar icon={ShieldCheck} title="21+ Requirement" body="Both customers and the drivers fulfilling restricted-goods orders must be verified 21 or older — non-negotiable." />
          <Pillar icon={ShieldAlert} title="Menu Shadow-Gate" body="Until verified, alcohol and tobacco items are HIDDEN from your menus — no temptation, no friction at checkout." />
          <Pillar icon={IdCard} title="Point-of-Delivery Check" body="Drivers scan recipient ID (PDF417 barcode), visually match the photo, and confirm sobriety before handing off." />
          <Pillar icon={BadgeCheck} title="Audit Trail" body="Every submission, decision, appeal, and admin override is logged immutably — full paper trail for any audit." />
        </div>
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  constants,
}: {
  status: AvpStatus | null;
  constants: AvpConstants | null;
}) {
  if (!status || status.status === "not_submitted") {
    return (
      <div
        className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 flex items-center gap-3"
        data-testid="age-verification-banner-not_submitted"
      >
        <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-100">Not yet verified</p>
          <p className="text-xs text-amber-100/70 mt-0.5">
            Submit your details below to unlock restricted goods delivery.
          </p>
        </div>
      </div>
    );
  }
  if (status.status === "pending" || status.status === "appeal") {
    return (
      <div
        className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 flex items-center gap-3"
        data-testid={`age-verification-banner-${status.status}`}
      >
        <Clock3 className="w-5 h-5 text-cyan-300 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-cyan-100">
            {status.status === "appeal" ? "Appeal under review" : "Awaiting review"}
          </p>
          <p className="text-xs text-cyan-100/70 mt-0.5">
            Most reviews finish within 24 hours. We'll notify you the moment a decision lands.
          </p>
        </div>
      </div>
    );
  }
  if (status.status === "verified") {
    return (
      <div
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 flex items-center gap-3"
        data-testid="age-verification-banner-verified"
      >
        <ShieldCheck className="w-5 h-5 text-emerald-300 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-100">You're verified</p>
          <p className="text-xs text-emerald-100/75 mt-0.5">
            Alcohol and tobacco delivery is unlocked. Drivers will still verify your ID at
            handoff per the Restricted Goods Delivery Standard.
          </p>
        </div>
      </div>
    );
  }
  // rejected
  const reason = status.rejected_reason || "policy";
  const copy = constants?.decline_reasons?.[reason] || "Verification declined per platform policy.";
  return (
    <div
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3"
      data-testid="age-verification-banner-rejected"
    >
      <ShieldAlert className="w-5 h-5 text-red-300 flex-shrink-0" />
      <div>
        <p className="text-sm font-bold text-red-100">Verification declined</p>
        <p className="text-xs text-red-100/85 mt-0.5">{copy}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof IdCard;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-purple-300/80 font-bold mb-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      {children}
    </label>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof IdCard;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-fuchsia-500/15 bg-[#0F0720] p-4">
      <Icon className="w-5 h-5 text-fuchsia-300 mb-2" />
      <p className="font-bold text-purple-100 text-sm">{title}</p>
      <p className="text-xs text-purple-300/75 mt-1 leading-relaxed">{body}</p>
    </div>
  );
}
