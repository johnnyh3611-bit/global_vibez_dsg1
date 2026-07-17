import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Shield,
  AlertTriangle,
  Clock,
  Phone,
  CheckCircle,
  Siren,
} from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API_URL = process.env.REACT_APP_BACKEND_URL;

type TrustedContact = { name: string; phone?: string; email?: string };
type MatchRow = {
  match_id: string;
  user?: { name?: string; user_id?: string };
  chemistry_score?: number;
};

/**
 * Date safety hub: trusted emergency contact, location share with a match,
 * check-ins, and SOS. Wired for dating flow (not rides-only).
 */
export default function Safety() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectMatch = searchParams.get("match");

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [activeShares, setActiveShares] = useState<{
    my_shares: any[];
    shared_with_me: any[];
  }>({ my_shares: [], shared_with_me: [] });
  const [showStartShare, setShowStartShare] = useState(!!preselectMatch);
  const [loading, setLoading] = useState(true);
  const [trustedContact, setTrustedContact] = useState<TrustedContact | null>(
    null
  );
  const [showTrustedContactForm, setShowTrustedContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [sosBusy, setSosBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
    fetchActiveShares();
    fetchTrustedContact();
    const interval = setInterval(fetchActiveShares, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (preselectMatch && !trustedContact) {
      setShowTrustedContactForm(true);
    }
  }, [preselectMatch, trustedContact]);

  const fetchMatches = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/dating/matches`);
      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveShares = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/safety/my-active-shares`);
      if (response.ok) {
        const data = await response.json();
        setActiveShares(data);
      }
    } catch {
      /* ignore */
    }
  };

  const fetchTrustedContact = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/safety/trusted-contact`);
      if (response.ok) {
        const data = await response.json();
        setTrustedContact(data.trusted_contact);
        if (data.trusted_contact) {
          setContactForm({
            name: data.trusted_contact.name || "",
            phone: data.trusted_contact.phone || "",
            email: data.trusted_contact.email || "",
          });
        }
      }
    } catch {
      /* ignore */
    }
  };

  const saveTrustedContact = async () => {
    if (!contactForm.name || (!contactForm.phone && !contactForm.email)) {
      setStatusMsg("Provide a name and at least a phone or email");
      return;
    }
    try {
      const response = await authFetch(
        `${API_URL}/api/safety/trusted-contact/set`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactForm),
        }
      );
      if (response.ok) {
        setStatusMsg("Trusted contact saved");
        fetchTrustedContact();
        setShowTrustedContactForm(false);
      } else {
        const err = await response.json().catch(() => ({}));
        setStatusMsg(err.detail || "Could not save contact");
      }
    } catch {
      setStatusMsg("Could not save contact");
    }
  };

  const startLocationShare = async (matchId: string, duration = 120) => {
    if (!trustedContact) {
      setStatusMsg("Add a trusted emergency contact before sharing location");
      setShowTrustedContactForm(true);
      return;
    }
    try {
      const response = await authFetch(`${API_URL}/api/safety/share/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          duration_minutes: duration,
          emergency_contacts: [
            {
              name: trustedContact.name,
              phone: trustedContact.phone,
              email: trustedContact.email,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMsg(
          `Location sharing started — ${data.emergency_contacts_count || 1} contact linked`
        );
        fetchActiveShares();
        setShowStartShare(false);
        // Best-effort GPS
        if (navigator.geolocation && data.share_id) {
          navigator.geolocation.getCurrentPosition((pos) => {
            authFetch(`${API_URL}/api/safety/location/update`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                share_id: data.share_id,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            }).catch(() => null);
          });
        }
      } else {
        const err = await response.json().catch(() => ({}));
        setStatusMsg(err.detail || "Could not start sharing");
      }
    } catch {
      setStatusMsg("Could not start sharing");
    }
  };

  const stopShare = async (shareId: string) => {
    if (!window.confirm("Stop sharing your location?")) return;
    try {
      const response = await authFetch(
        `${API_URL}/api/safety/share/stop?share_id=${shareId}`,
        { method: "POST" }
      );
      if (response.ok) {
        setStatusMsg("Location sharing stopped");
        fetchActiveShares();
      }
    } catch {
      /* ignore */
    }
  };

  const sendCheckIn = async (shareId: string) => {
    try {
      const response = await authFetch(`${API_URL}/api/safety/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_id: shareId, message: "I'm safe ✓" }),
      });
      if (response.ok) setStatusMsg("Check-in sent");
    } catch {
      /* ignore */
    }
  };

  const sendSos = async (shareId?: string, matchId?: string) => {
    if (!trustedContact) {
      setStatusMsg("Add a trusted contact before using SOS");
      setShowTrustedContactForm(true);
      return;
    }
    if (
      !window.confirm(
        "Send an emergency alert to your trusted contact? Only use this if you need help."
      )
    ) {
      return;
    }
    setSosBusy(true);
    try {
      const body: Record<string, unknown> = {
        message: "Emergency — please check on me (Global Vibez date safety)",
        match_id: matchId || preselectMatch || undefined,
        share_id: shareId || undefined,
      };
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              body.latitude = pos.coords.latitude;
              body.longitude = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 4000 }
          );
        });
      }
      const response = await authFetch(`${API_URL}/api/safety/emergency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        setStatusMsg(
          `SOS sent — ${data.contacts_notified} contact(s) notified`
        );
      } else {
        const err = await response.json().catch(() => ({}));
        setStatusMsg(err.detail || "SOS failed");
      }
    } catch {
      setStatusMsg("SOS failed");
    } finally {
      setSosBusy(false);
    }
  };

  const matchLabel = (m: MatchRow) => m.user?.name || "Match";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 pb-20 text-white">
      <div className="bg-black/40 border-b border-white/10 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-white/70 hover:text-white"
          >
            ← Back
          </button>
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            <h1 className="text-lg font-bold">Date Safety</h1>
          </div>
          <Button
            onClick={() => setShowStartShare(!showStartShare)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            Going on a date
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {statusMsg && (
          <Card className="p-3 bg-cyan-950/50 border-cyan-500/40 text-cyan-100 text-sm">
            {statusMsg}
          </Card>
        )}

        <Card className="p-6 bg-blue-950/40 border-blue-400/30">
          <div className="flex items-start space-x-4">
            <Shield className="w-10 h-10 text-cyan-400 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold mb-1">Stay safe on your dates</h3>
              <p className="text-white/70 text-sm">
                Set a trusted emergency contact, share location while you meet,
                check in, and use SOS if you need help. Your contact is notified
                when safety features fire.
              </p>
            </div>
          </div>
        </Card>

        {/* Trusted contact */}
        <Card className="p-6 border-emerald-500/30 bg-emerald-950/30">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <Phone className="w-6 h-6 mr-2 text-emerald-400" />
            Emergency contact
          </h3>
          {trustedContact ? (
            <div>
              <div className="bg-black/40 p-4 rounded-lg mb-4">
                <p className="font-semibold">{trustedContact.name}</p>
                {trustedContact.phone && (
                  <p className="text-sm text-white/60">📱 {trustedContact.phone}</p>
                )}
                {trustedContact.email && (
                  <p className="text-sm text-white/60">📧 {trustedContact.email}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setShowTrustedContactForm(true)}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white"
                >
                  Update
                </Button>
                <Button
                  onClick={() => sendSos(undefined, preselectMatch || undefined)}
                  disabled={sosBusy}
                  className="bg-red-600 hover:bg-red-500 text-white"
                  size="sm"
                >
                  <Siren className="w-4 h-4 mr-1" />
                  SOS now
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-white/70 text-sm mb-4">
                Required before location share or SOS. Pick someone who can
                check on you during a date.
              </p>
              <Button
                onClick={() => setShowTrustedContactForm(true)}
                className="bg-emerald-600 text-white"
              >
                Add emergency contact
              </Button>
            </div>
          )}
        </Card>

        {showTrustedContactForm && (
          <Card className="p-6 border-emerald-500/20 bg-black/40">
            <h3 className="text-xl font-bold mb-4">Set emergency contact</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, name: e.target.value })
                  }
                  placeholder="Mom, best friend, roommate…"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={contactForm.phone || ""}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, phone: e.target.value })
                  }
                  placeholder="+1234567890"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={contactForm.email || ""}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, email: e.target.value })
                  }
                  placeholder="trusted@example.com"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={saveTrustedContact}
                  className="flex-1 bg-emerald-600 text-white"
                >
                  Save contact
                </Button>
                <Button
                  onClick={() => setShowTrustedContactForm(false)}
                  variant="outline"
                  className="border-white/20 text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Start share */}
        {showStartShare && (
          <Card className="p-6 bg-black/40 border-cyan-500/30">
            <h3 className="text-xl font-bold mb-2">Who are you meeting?</h3>
            <p className="text-sm text-white/60 mb-4">
              Shares live location for 2 hours and links your emergency contact.
            </p>
            {!trustedContact && (
              <p className="text-amber-300 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Add an emergency contact first
              </p>
            )}
            <div className="space-y-3">
              {matches.length === 0 && !loading && (
                <p className="text-white/50 text-sm">
                  No matches yet — discover people first, then arm safety before
                  you meet.
                </p>
              )}
              {matches.map((match) => (
                <button
                  key={match.match_id}
                  type="button"
                  onClick={() => startLocationShare(match.match_id)}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                    preselectMatch === match.match_id
                      ? "border-cyan-400 bg-cyan-950/50"
                      : "border-white/15 hover:border-cyan-400 hover:bg-cyan-950/30"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                      {(matchLabel(match)[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{matchLabel(match)}</p>
                      <p className="text-sm text-white/50">
                        Share 2 hours · emergency contact attached
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Active shares */}
        {activeShares.my_shares.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">You are sharing location</h2>
            <div className="space-y-4">
              {activeShares.my_shares.map((share) => (
                <Card
                  key={share.share_id}
                  className="p-6 border-cyan-500/30 bg-black/40"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <MapPin className="w-5 h-5 text-cyan-400" />
                        <span className="font-semibold">Active date share</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-white/60 mb-4">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Until {new Date(share.expires_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => sendCheckIn(share.share_id)}
                          size="sm"
                          className="bg-emerald-600 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          I&apos;m safe
                        </Button>
                        <Button
                          onClick={() =>
                            sendSos(share.share_id, share.match_id)
                          }
                          size="sm"
                          disabled={sosBusy}
                          className="bg-red-600 text-white"
                        >
                          <Siren className="w-4 h-4 mr-1" />
                          SOS
                        </Button>
                        <Button
                          onClick={() => stopShare(share.share_id)}
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-white"
                        >
                          End share
                        </Button>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-cyan-900/60 text-cyan-200 rounded-full text-sm font-medium">
                      Active
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeShares.shared_with_me.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Tracking others</h2>
            <div className="space-y-4">
              {activeShares.shared_with_me.map((share) => (
                <Card
                  key={share.share_id}
                  className="p-6 border-violet-500/30 bg-black/40"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold">
                        {share.user?.name || "Someone"}
                      </p>
                      <p className="text-sm text-white/60">
                        Sharing until{" "}
                        {new Date(share.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        navigate(`/safety/track/${share.share_id}`)
                      }
                      className="bg-violet-600 text-white"
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      View map
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeShares.my_shares.length === 0 &&
          activeShares.shared_with_me.length === 0 &&
          !loading &&
          !showStartShare && (
            <Card className="p-12 text-center bg-black/30 border-white/10">
              <Shield className="w-16 h-16 mx-auto text-white/30 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                No active date safety share
              </h3>
              <p className="text-white/60 mb-6">
                Before you meet someone, add your emergency contact and start
                sharing.
              </p>
              <Button
                onClick={() => setShowStartShare(true)}
                className="bg-cyan-600 text-white"
              >
                Going on a date
              </Button>
            </Card>
          )}
      </div>
    </div>
  );
}
