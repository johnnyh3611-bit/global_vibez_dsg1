/**
 * ContentRightsPage — public IP policy & anti-piracy surface.
 *
 * Encodes `Content_Rights_And_IP_Policy.pdf`. Three sections:
 *   1. Trust strip with live counters (active assets / DMCA notices filed
 *      / sellers terminated) — proof the policy is real + enforced.
 *   2. Six policy pillars (DMCA · Fingerprint scan · Seller warranty ·
 *      Metadata filter · 3-strike rule · 10-day escrow).
 *   3. Open DMCA notice form so any rights-holder can file a takedown
 *      directly from the public site.
 *
 * Route: /content-rights
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  FileSearch,
  Gavel,
  Wallet as WalletIcon,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

interface PolicySnapshot {
  dmca_takedown_sla_hours: number;
  repeat_infringer_strike_threshold: number;
  payment_escrow_days: number;
  default_download_ttl_seconds: number;
  sample_duration_seconds: number;
  metadata_blocklist: string[];
  protocol_version: string;
  active_assets: number;
  lifetime_purchases: number;
  dmca_notices_filed: number;
  sellers_terminated: number;
  user_rights_agreement: string;
  dmca_agent?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
    registration_date?: string;
    paygov_tracking_id?: string;
  };
}

export default function ContentRightsPage() {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<PolicySnapshot | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/content-rights/policy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPolicy(d))
      .catch(() => null);
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#07030F] via-[#0a0815] to-[#170a23] text-white px-4 py-8"
      data-testid="content-rights-page"
    >
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-purple-300/70 hover:text-white text-sm mb-4"
          data-testid="content-rights-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-amber-500 shadow-[0_0_20px_rgba(217,70,239,0.45)] flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Content Rights · Anti-Piracy
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Your work is protected here</h1>
          </div>
        </div>
        <p className="text-sm text-purple-200/80 mb-2 max-w-2xl">
          Every downloadable file on Global Vibez DSG is protected by signed
          time-limited URLs that only mint after a verified purchase — users can
          sample, but they can never download without paying. Combined with
          digital fingerprinting at upload, DMCA 24-hour takedown, and a 3-strike
          repeat-infringer rule, your masters stay yours.
        </p>
        {policy?.protocol_version && (
          <p className="text-[10px] font-mono text-purple-400/60 mb-6">
            {policy.protocol_version}
          </p>
        )}

        {/* Live counters */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6"
          data-testid="content-rights-counters"
        >
          <Counter label="Active works" value={policy?.active_assets ?? 0} accent="text-fuchsia-300" />
          <Counter label="Purchases settled" value={policy?.lifetime_purchases ?? 0} accent="text-emerald-300" />
          <Counter label="DMCA filings" value={policy?.dmca_notices_filed ?? 0} accent="text-amber-300" />
          <Counter label="Sellers terminated" value={policy?.sellers_terminated ?? 0} accent="text-red-300" />
        </div>

        {/* 6 pillars */}
        <div className="grid md:grid-cols-2 gap-3 mb-6" data-testid="content-rights-pillars">
          <Pillar
            icon={ShieldCheck}
            title="Signed Download URLs"
            body={`Master files are NEVER directly downloadable. After purchase, we mint a one-shot URL signed with HMAC-SHA256 that expires in ${policy?.default_download_ttl_seconds ?? 300} seconds.`}
          />
          <Pillar
            icon={Fingerprint}
            title="Upload Fingerprint Scan"
            body="Every upload is fingerprinted and checked against the global registry before listing. Stolen masters are rejected at the door."
          />
          <Pillar
            icon={Gavel}
            title="DMCA 24-Hour Takedown"
            body={`Rights-holders file directly from this page. Pending notices freeze the listing immediately and an admin decides within ${policy?.dmca_takedown_sla_hours ?? 24} hours.`}
          />
          <Pillar
            icon={ShieldAlert}
            title={`${policy?.repeat_infringer_strike_threshold ?? 3}-Strike Termination`}
            body="Three upheld takedowns and the seller account is auto-terminated. ALL their other listings deactivate at the same time."
          />
          <Pillar
            icon={FileSearch}
            title="Metadata Keyword Filter"
            body={`Titles and descriptions are AI-scanned for piracy indicators ("Official Movie", "Leak", "Type Beat", etc.) before listing.`}
          />
          <Pillar
            icon={WalletIcon}
            title={`${policy?.payment_escrow_days ?? 10}-Day Payment Escrow`}
            body={`Funds from every sale are held for ${policy?.payment_escrow_days ?? 10} days to allow copyright disputes. Upheld takedowns trigger automatic refunds.`}
          />
        </div>

        {/* Rights agreement */}
        {policy?.user_rights_agreement && (
          <div
            className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4 mb-6"
            data-testid="content-rights-agreement"
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-300/90 mb-2">
              User Rights Agreement
            </p>
            <p className="text-xs text-cyan-100/85 leading-relaxed">
              {policy.user_rights_agreement}
            </p>
          </div>
        )}

        {/* DMCA Designated Agent — registered with US Copyright Office */}
        {policy?.dmca_agent?.name && (
          <div
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-4 mb-6"
            data-testid="content-rights-dmca-agent"
          >
            <div className="flex items-start gap-2.5 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-300/90 font-bold">
                Registered DMCA Designated Agent · US Copyright Office
              </p>
            </div>
            <div className="text-xs text-emerald-100/90 space-y-0.5 pl-6.5">
              <p>
                <span className="text-emerald-300/70 font-mono uppercase tracking-widest text-[9px]">Agent:</span>{" "}
                <span className="font-bold" data-testid="content-rights-dmca-agent-name">
                  {policy.dmca_agent.name}
                </span>
              </p>
              {policy.dmca_agent.address && (
                <p>
                  <span className="text-emerald-300/70 font-mono uppercase tracking-widest text-[9px]">Address:</span>{" "}
                  <span data-testid="content-rights-dmca-agent-address">{policy.dmca_agent.address}</span>
                </p>
              )}
              {policy.dmca_agent.email && (
                <p>
                  <span className="text-emerald-300/70 font-mono uppercase tracking-widest text-[9px]">Email:</span>{" "}
                  <a
                    href={`mailto:${policy.dmca_agent.email}`}
                    className="underline text-emerald-200"
                    data-testid="content-rights-dmca-agent-email"
                  >
                    {policy.dmca_agent.email}
                  </a>
                </p>
              )}
              {policy.dmca_agent.phone && (
                <p>
                  <span className="text-emerald-300/70 font-mono uppercase tracking-widest text-[9px]">Phone:</span>{" "}
                  <span data-testid="content-rights-dmca-agent-phone">{policy.dmca_agent.phone}</span>
                </p>
              )}
              {(policy.dmca_agent.registration_date || policy.dmca_agent.paygov_tracking_id) && (
                <p className="text-[10px] font-mono text-emerald-200/60 mt-1.5">
                  {policy.dmca_agent.registration_date &&
                    `Registered ${policy.dmca_agent.registration_date}`}
                  {policy.dmca_agent.paygov_tracking_id &&
                    ` · Pay.gov Tracking #${policy.dmca_agent.paygov_tracking_id}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* DMCA filing CTA */}
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-100">Spotted your work being sold without permission?</p>
              <p className="text-xs text-amber-100/75 mt-0.5">
                File a DMCA takedown. The listing freezes immediately and we'll
                decide within {policy?.dmca_takedown_sla_hours ?? 24} hours.
              </p>
            </div>
          </div>
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 text-sm font-bold"
              data-testid="content-rights-open-dmca"
            >
              File a DMCA takedown
            </button>
          ) : (
            <DmcaForm onDone={() => setShowForm(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

function DmcaForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    asset_id: "",
    claimant_name: "",
    claimant_email: "",
    claim_text: "",
    claim_proof_url: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.claim_text.trim().length < 30) {
      toast.error("Please describe the claim in at least a sentence (30+ characters).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/content-rights/dmca/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to submit notice");
        return;
      }
      const d = await res.json();
      toast.success(`Notice filed (#${d.notice_id.slice(0, 12)}…). The listing is frozen.`);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2" data-testid="content-rights-dmca-form">
      <Input
        label="Asset ID (from the listing URL)"
        value={form.asset_id}
        onChange={(v) => setForm({ ...form, asset_id: v })}
        testid="dmca-asset-id"
        required
      />
      <div className="grid md:grid-cols-2 gap-2">
        <Input
          label="Your name"
          value={form.claimant_name}
          onChange={(v) => setForm({ ...form, claimant_name: v })}
          testid="dmca-claimant-name"
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.claimant_email}
          onChange={(v) => setForm({ ...form, claimant_email: v })}
          testid="dmca-claimant-email"
          required
        />
      </div>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-widest text-amber-300/85 font-bold mb-1">
          Describe the infringement
        </span>
        <textarea
          value={form.claim_text}
          onChange={(e) => setForm({ ...form, claim_text: e.target.value })}
          rows={4}
          minLength={30}
          maxLength={4000}
          required
          placeholder="What's being infringed, when you created it, and any proof of ownership."
          className="w-full bg-[#1A0D2E] border border-amber-400/25 rounded-lg px-3 py-2 text-white text-sm"
          data-testid="dmca-claim-text"
        />
      </label>
      <Input
        label="Proof of ownership URL (optional)"
        value={form.claim_proof_url}
        onChange={(v) => setForm({ ...form, claim_proof_url: v })}
        testid="dmca-claim-proof"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 text-sm font-bold disabled:opacity-50"
        data-testid="dmca-submit"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
        File takedown notice
      </button>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  testid,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  testid: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-widest text-amber-300/85 font-bold mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-[#1A0D2E] border border-amber-400/25 rounded-lg px-3 py-2 text-white text-sm"
        data-testid={testid}
      />
    </label>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-black/30 border border-fuchsia-500/15 p-3 text-center">
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-purple-300/70 font-bold mt-0.5">
        {label}
      </p>
    </div>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
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
