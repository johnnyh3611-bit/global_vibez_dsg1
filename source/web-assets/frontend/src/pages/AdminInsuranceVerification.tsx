import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, XCircle, Clock, Shield } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Submission = {
  submission_id: string;
  user_id: string;
  insurance_provider?: string;
  policy_number?: string;
  expiry_date?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  license_plate?: string;
  document_url?: string;
  submitted_at?: string;
  user?: { name?: string; email?: string };
};

export default function AdminInsuranceVerification() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/insurance-verification/admin/pending`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (userId: string, status: "approved" | "denied") => {
    setBusyId(userId);
    try {
      const res = await authFetch(`${API}/api/insurance-verification/admin/review`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, status }),
      });
      if (!res.ok) throw new Error("Review failed");
      await load();
    } catch {
      alert("Failed to submit review");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6"
      data-testid="admin-insurance-verification"
    >
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="text-white/80 mb-4" onClick={() => navigate("/vibe-vault-admin/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> God Mode
        </Button>
        <div className="flex items-center gap-3 mb-6 text-white">
          <Shield className="w-8 h-8 text-cyan-300" />
          <div>
            <h1 className="text-2xl font-bold">Insurance Verification Queue</h1>
            <p className="text-sm text-white/60">{submissions.length} pending</p>
          </div>
        </div>

        {loading ? (
          <p className="text-white">Loading…</p>
        ) : submissions.length === 0 ? (
          <Card className="p-8 bg-white/10 border-white/20 text-white/70 text-center">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            No pending insurance submissions.
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => (
              <Card
                key={s.submission_id}
                className="p-5 bg-white/10 border-white/20 text-white"
                data-testid={`insurance-queue-item-${s.user_id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold">{s.user?.name || s.user_id}</p>
                    <p className="text-xs text-white/50">{s.user?.email}</p>
                    <p className="text-sm mt-2">
                      {s.insurance_provider} · {s.policy_number} · exp {s.expiry_date}
                    </p>
                    <p className="text-xs text-white/60">
                      {s.vehicle_year} {s.vehicle_make} {s.vehicle_model} · {s.license_plate}
                    </p>
                    {s.document_url && (
                      <a
                        href={`${API}${s.document_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 text-xs underline mt-1 inline-block"
                      >
                        View document
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={busyId === s.user_id}
                      onClick={() => review(s.user_id, "approved")}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      disabled={busyId === s.user_id}
                      onClick={() => review(s.user_id, "denied")}
                      variant="destructive"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Deny
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
