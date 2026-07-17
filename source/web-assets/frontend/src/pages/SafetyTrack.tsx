import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Shield, Clock } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API_URL = process.env.REACT_APP_BACKEND_URL;

/** Simple share viewer for date location tracking. */
export default function SafetyTrack() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [share, setShare] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;
    const load = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/safety/share/${shareId}`);
        if (!res.ok) {
          setError("Share not found or expired");
          return;
        }
        const data = await res.json();
        setShare(data.share);
        setUser(data.user);
      } catch {
        setError("Could not load share");
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [shareId]);

  const mapsUrl =
    share && (share.latitude || share.longitude)
      ? `https://maps.google.com/?q=${share.latitude},${share.longitude}`
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-lg mx-auto space-y-4 pt-8">
        <button
          type="button"
          onClick={() => navigate("/safety")}
          className="text-white/60 hover:text-white"
        >
          ← Date Safety
        </button>
        <Card className="p-6 bg-black/50 border-violet-500/30 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-violet-400" />
            <h1 className="text-xl font-bold">Live location</h1>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {share && (
            <>
              <p className="text-lg font-semibold">
                {user?.name || "Match"} is sharing
              </p>
              <p className="text-sm text-white/60 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Until {new Date(share.expires_at).toLocaleString()}
              </p>
              <p className="text-sm text-white/50">
                Status: {share.status}
                {share.last_check_in
                  ? ` · last check-in ${new Date(share.last_check_in).toLocaleString()}`
                  : ""}
              </p>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 font-mono text-sm">
                <MapPin className="w-4 h-4 inline mr-2 text-cyan-400" />
                {share.latitude || share.longitude
                  ? `${Number(share.latitude).toFixed(5)}, ${Number(share.longitude).toFixed(5)}`
                  : "Waiting for GPS…"}
              </div>
              {mapsUrl && (
                <Button asChild className="w-full bg-violet-600 text-white">
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    Open in Maps
                  </a>
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
