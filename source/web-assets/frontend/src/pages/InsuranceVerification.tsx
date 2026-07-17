import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Upload, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

export default function InsuranceVerification() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    insurance_provider: "",
    policy_number: "",
    expiry_date: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: String(new Date().getFullYear()),
    vehicle_color: "",
    license_plate: "",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!documentFile) {
      setError("Please upload your insurance document (card or PDF).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("insurance_document", documentFile);

      const res = await authFetch(`${API}/api/insurance-verification/submit`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to submit insurance");
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Submission failed");
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-indigo-950 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full p-8 bg-white/10 border-white/20 text-center text-white">
          <CheckCircle className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Insurance Submitted</h1>
          <p className="text-white/80 mb-6">
            Your policy is under review. You can offer rides once approved.
          </p>
          <Button onClick={() => navigate("/insurance-verification/status")} className="w-full">
            View Status
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-indigo-950 p-6"
      data-testid="insurance-verification-page"
    >
      <div className="max-w-xl mx-auto">
        <Button
          variant="ghost"
          className="text-white/80 mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Card className="p-8 bg-white/10 border-white/20 text-white">
          <div className="text-center mb-6">
            <Shield className="w-14 h-14 mx-auto text-cyan-300 mb-3" />
            <h1 className="text-3xl font-bold">Vehicle Insurance</h1>
            <p className="text-cyan-100/80 mt-2 text-sm">
              Required before offering rides. Driver license must be verified first.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/20 border border-red-400/40 p-3 text-sm text-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" data-testid="insurance-verification-form">
            {[
              ["insurance_provider", "Insurance provider"],
              ["policy_number", "Policy number"],
              ["expiry_date", "Expiry date", "date"],
              ["vehicle_make", "Vehicle make"],
              ["vehicle_model", "Vehicle model"],
              ["vehicle_year", "Year", "number"],
              ["vehicle_color", "Color"],
              ["license_plate", "License plate"],
            ].map(([name, label, type = "text"]) => (
              <label key={name} className="block text-sm">
                <span className="text-cyan-100/70">{label}</span>
                <input
                  name={name}
                  type={type}
                  required
                  value={(form as any)[name]}
                  onChange={onChange}
                  className="mt-1 w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-white"
                  data-testid={`insurance-field-${name}`}
                />
              </label>
            ))}

            <label className="block text-sm">
              <span className="text-cyan-100/70">Insurance document (image or PDF)</span>
              <div className="mt-1 flex items-center gap-3 rounded-lg border border-dashed border-cyan-400/40 bg-black/30 px-4 py-6">
                <Upload className="w-5 h-5 text-cyan-300" />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  data-testid="insurance-document-upload"
                  className="text-sm text-white/80"
                />
              </div>
            </label>

            <Button
              type="submit"
              disabled={uploading}
              className="w-full mt-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
              data-testid="insurance-submit-btn"
            >
              {uploading ? "Submitting…" : "Submit for Review"}
            </Button>
          </form>

          <p className="text-center text-xs text-white/50 mt-4">
            Need license verification first?{" "}
            <Link to="/driver-license-verification" className="underline text-cyan-300">
              Verify driver license
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
