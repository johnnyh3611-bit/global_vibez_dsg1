import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle, Shield } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type StatusBody = {
  has_insurance?: boolean;
  status?: string;
  insurance_provider?: string;
  policy_number?: string;
  expiry_date?: string;
  driver_license_verified?: boolean;
  vehicle?: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    license_plate?: string;
  };
};

export default function InsuranceVerificationStatus() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API}/api/insurance-verification/status`);
        if (!res.ok) throw new Error("Failed to load insurance status");
        setStatus(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Loading…
      </div>
    );
  }

  const s = status?.status || "unverified";
  const Icon =
    s === "approved" ? CheckCircle : s === "pending" ? Clock : s === "denied" ? XCircle : AlertCircle;
  const iconColor =
    s === "approved"
      ? "text-emerald-400"
      : s === "pending"
      ? "text-amber-400"
      : s === "denied"
      ? "text-red-400"
      : "text-gray-400";

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-indigo-950 p-6"
      data-testid="insurance-status-page"
    >
      <div className="max-w-lg mx-auto">
        <Button variant="ghost" className="text-white/80 mb-4" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
        </Button>
        <Card className="p-8 bg-white/10 border-white/20 text-white text-center">
          <Shield className="w-12 h-12 mx-auto text-cyan-300 mb-3" />
          <Icon className={`w-16 h-16 mx-auto mb-4 ${iconColor}`} />
          <h1 className="text-2xl font-bold mb-2 capitalize">Insurance: {s}</h1>
          {error && <p className="text-red-300 text-sm mb-3">{error}</p>}
          {status?.insurance_provider && (
            <p className="text-white/70 text-sm mb-1">
              {status.insurance_provider} · {status.policy_number}
            </p>
          )}
          {status?.vehicle?.make && (
            <p className="text-white/60 text-xs mb-4">
              {status.vehicle.year} {status.vehicle.make} {status.vehicle.model} ·{" "}
              {status.vehicle.license_plate}
            </p>
          )}
          {!status?.driver_license_verified && (
            <p className="text-amber-200 text-sm mb-4">
              Driver license not verified yet.{" "}
              <Link to="/driver-license-verification" className="underline">
                Verify license
              </Link>
            </p>
          )}
          {(s === "unverified" || s === "denied") && (
            <Button
              className="w-full bg-cyan-500 text-black font-bold"
              onClick={() => navigate("/insurance-verification")}
            >
              Submit Insurance
            </Button>
          )}
          {s === "approved" && (
            <Button
              className="w-full bg-cyan-500 text-black font-bold"
              onClick={() => navigate("/vibe-ridez/post-ride")}
            >
              Offer a Ride
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
