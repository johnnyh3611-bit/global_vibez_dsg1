/**
 * Find Your Player 2 — gaming partner discovery page.
 *
 * Uses /api/matchmaking/* endpoints (already wired in backend).
 * Lets a user:
 *   - See/update their gaming profile (favorite games, skills, looking_for)
 *   - Browse compatible gaming partners sorted by compatibility_score
 *   - Send a "play together" request
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Gamepad2, Search, Sparkles, Send, Users, Trophy, Loader2, Check } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Games the matchmaker understands. Mirrors backend skill_scores keys.
const GAME_CATALOG = [
  { id: "spades", label: "Spades", emoji: "♠️" },
  { id: "hearts", label: "Hearts", emoji: "♥️" },
  { id: "uno", label: "UNO", emoji: "🌈" },
  { id: "gin_rummy", label: "Gin Rummy", emoji: "🃏" },
  { id: "poker", label: "Poker", emoji: "🎰" },
  { id: "blackjack", label: "Blackjack", emoji: "🂡" },
  { id: "bid_whist", label: "Bid Whist", emoji: "👑" },
  { id: "chess", label: "Chess", emoji: "♟️" },
  { id: "trivia", label: "Trivia", emoji: "🧠" },
  { id: "crazy_eights", label: "Crazy Eights", emoji: "8️⃣" },
  { id: "war", label: "War", emoji: "⚔️" },
  { id: "go_fish", label: "Go Fish", emoji: "🐟" },
];

type Preferences = {
  age_min: number;
  age_max: number;
  preferred_games: string[];
  skill_level_min: number;
  skill_level_max: number;
  distance_max: number;
  looking_for: "friendship" | "dating" | "gaming_partner";
};

type Profile = {
  user_id: string;
  name: string;
  age: number;
  bio?: string;
  favorite_games: string[];
  skill_scores?: Record<string, number>;
  total_games_played?: number;
  win_rate?: number;
  preferences: Preferences;
};

type MatchRow = {
  user: Profile;
  match_score: {
    compatibility_score: number;
    game_compatibility: number;
    skill_compatibility: number;
    preference_match: number;
    shared_interests: string[];
  };
};

const defaultProfile = (userId: string, name: string): Profile => ({
  user_id: userId,
  name,
  age: 25,
  bio: "",
  favorite_games: [],
  skill_scores: {},
  preferences: {
    age_min: 18,
    age_max: 99,
    preferred_games: [],
    skill_level_min: 1,
    skill_level_max: 10,
    distance_max: 100,
    looking_for: "gaming_partner",
  },
});

export default function FindPlayer2Page() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve current user
  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${API}/api/auth/me`, {});
        if (r.ok) {
          const me = await r.json();
          setUserId(me.user_id || me.id || "");
          setUserName(me.username || me.name || me.email?.split("@")[0] || "Player");
        } else {
          // Fallback: guest session
          const guestId = localStorage.getItem("mp_user_id") || "guest_" + Math.random().toString(36).slice(2, 10);
          localStorage.setItem("mp_user_id", guestId);
          setUserId(guestId);
          setUserName(localStorage.getItem("mp_user_name") || "Player");
        }
      } catch {
        const guestId = localStorage.getItem("mp_user_id") || "guest_" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("mp_user_id", guestId);
        setUserId(guestId);
        setUserName("Player");
      }
    };
    run();
  }, []);

  // Load (or auto-create) profile + matches
  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/matchmaking/profile/${userId}`, {});
      if (r.ok) {
        const data = await r.json();
        setProfile(data.profile as Profile);
      } else {
        // Auto-create a blank profile so matches endpoint works
        const fresh = defaultProfile(userId, userName);
        const c = await fetch(`${API}/api/matchmaking/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fresh),
        });
        if (c.ok) setProfile(fresh);
        else setError("Could not create a matchmaking profile.");
      }
    } catch (err) {
      setError("Network error loading profile.");
    } finally {
      setLoading(false);
    }
  }, [userId, userName]);

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId, loadProfile]);

  const findMatches = useCallback(async () => {
    if (!userId) return;
    setSearching(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/matchmaking/find-matches/${userId}?limit=20`, {});
      if (r.ok) {
        const data = await r.json();
        setMatches((data.matches || []) as MatchRow[]);
      } else {
        setError("Could not search for players.");
      }
    } catch {
      setError("Network error finding matches.");
    } finally {
      setSearching(false);
    }
  }, [userId]);

  const sendPlayRequest = async (toUserId: string) => {
    setPendingRequest(toUserId);
    try {
      const r = await fetch(
        `${API}/api/matchmaking/send-request?from_user_id=${encodeURIComponent(userId)}&to_user_id=${encodeURIComponent(toUserId)}&message=${encodeURIComponent("Want to be my Player 2? Let's game!")}`,
        { method: "POST",}
      );
      if (r.ok) {
        setSentRequests((prev) => new Set(prev).add(toUserId));
      } else {
        setError("Could not send request.");
      }
    } catch {
      setError("Network error sending request.");
    } finally {
      setPendingRequest(null);
    }
  };

  const toggleGame = (gameId: string) => {
    if (!profile) return;
    const has = profile.favorite_games.includes(gameId);
    setProfile({
      ...profile,
      favorite_games: has ? profile.favorite_games.filter((g) => g !== gameId) : [...profile.favorite_games, gameId],
    });
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/matchmaking/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, name: profile.name || userName }),
      });
      if (r.ok) {
        // Immediately refresh the match list
        await findMatches();
      } else {
        setError("Could not save profile.");
      }
    } catch {
      setError("Network error saving profile.");
    } finally {
      setSaving(false);
    }
  };

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => b.match_score.compatibility_score - a.match_score.compatibility_score),
    [matches]
  );

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-fuchsia-950 to-cyan-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-fuchsia-950 to-cyan-950 text-white p-4 md:p-8" data-testid="find-player-2-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/games-menu")} data-testid="find-p2-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">Player Discovery</div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
            Find Your Player 2
          </h1>
          <p className="text-white/60 mt-3 max-w-xl">
            Match on games you both love, skill you can both respect, and schedules that line up. Send a ping and run it back.
          </p>
        </motion.div>

        {error && (
          <div className="mb-6 p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm" data-testid="find-p2-error">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[360px_1fr]">
          {/* Left: my profile */}
          <Card className="p-5 bg-white/5 border border-white/10 text-white space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-fuchsia-300 mb-1">Your Gaming Profile</div>
              <div className="text-white/50 text-sm">Tell the matchmaker what you love.</div>
            </div>

            <div>
              <label className="text-xs text-white/60">Display Name</label>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1 bg-black/40 border-white/10 text-white"
                data-testid="find-p2-name-input"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Age</label>
              <Input
                type="number"
                min={18}
                max={99}
                value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value || "18", 10) })}
                className="mt-1 bg-black/40 border-white/10 text-white"
                data-testid="find-p2-age-input"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Bio <span className="text-white/30">(optional)</span></label>
              <textarea
                value={profile.bio || ""}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md bg-black/40 border border-white/10 text-white p-2 text-sm"
                placeholder="Late-night spades. Coffee-fueled UNO. Let's run it."
                data-testid="find-p2-bio-input"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">I'm looking for a…</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["gaming_partner", "friendship", "dating"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setProfile({ ...profile, preferences: { ...profile.preferences, looking_for: v } })}
                    className={`py-2 rounded-lg text-xs font-bold uppercase tracking-widest ${
                      profile.preferences.looking_for === v
                        ? "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black"
                        : "bg-white/5 text-white/60 border border-white/10"
                    }`}
                    data-testid={`find-p2-looking-${v}`}
                  >
                    {v.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Favorite Games <span className="text-white/30">({profile.favorite_games.length} picked)</span></label>
              <div className="flex flex-wrap gap-2 mt-2">
                {GAME_CATALOG.map((g) => {
                  const picked = profile.favorite_games.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGame(g.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        picked
                          ? "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black"
                          : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                      }`}
                      data-testid={`find-p2-game-chip-${g.id}`}
                    >
                      <span className="mr-1">{g.emoji}</span>{g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={saveProfile}
              disabled={saving}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-black italic uppercase tracking-widest"
              data-testid="find-p2-save-btn"
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : <>Save & Find Matches</>}
            </Button>
          </Card>

          {/* Right: matches */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={findMatches} disabled={searching} variant="ghost" className="text-fuchsia-300" data-testid="find-p2-refresh-btn">
                {searching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                Refresh Matches
              </Button>
              <div className="ml-auto text-xs text-white/50">
                {sortedMatches.length} {sortedMatches.length === 1 ? "match" : "matches"}
              </div>
            </div>

            {!searching && sortedMatches.length === 0 && (
              <Card className="p-10 bg-white/5 border border-white/10 text-center text-white/60" data-testid="find-p2-empty">
                <Users className="w-10 h-10 mx-auto mb-3 text-fuchsia-300" />
                <div className="text-lg font-bold text-white mb-1">No matches yet</div>
                <div className="text-sm">Pick at least one favorite game and hit <span className="text-fuchsia-300">Save & Find Matches</span>.</div>
              </Card>
            )}

            {sortedMatches.map((m) => (
              <motion.div
                key={m.user.user_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-5 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 text-white" data-testid={`find-p2-match-${m.user.user_id}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center text-xl font-black text-black flex-shrink-0">
                      {(m.user.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-lg font-bold">{m.user.name}</div>
                        <div className="text-xs text-white/50">· age {m.user.age}</div>
                        <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 text-xs font-bold tabular-nums">
                          <Sparkles className="w-3 h-3" /> {Math.round(m.match_score.compatibility_score)}% match
                        </div>
                      </div>
                      {m.user.bio && <div className="text-sm text-white/60 mt-1 line-clamp-2">{m.user.bio}</div>}

                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        <div className="rounded-lg bg-black/30 border border-white/5 p-2">
                          <div className="text-[10px] uppercase tracking-widest text-cyan-300">Games</div>
                          <div className="text-sm font-bold">{Math.round(m.match_score.game_compatibility)}%</div>
                        </div>
                        <div className="rounded-lg bg-black/30 border border-white/5 p-2">
                          <div className="text-[10px] uppercase tracking-widest text-fuchsia-300">Skill</div>
                          <div className="text-sm font-bold">{Math.round(m.match_score.skill_compatibility)}%</div>
                        </div>
                        <div className="rounded-lg bg-black/30 border border-white/5 p-2">
                          <div className="text-[10px] uppercase tracking-widest text-emerald-300">Prefs</div>
                          <div className="text-sm font-bold">{Math.round(m.match_score.preference_match)}%</div>
                        </div>
                      </div>

                      {m.match_score.shared_interests.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {m.match_score.shared_interests.slice(0, 6).map((g) => {
                            const meta = GAME_CATALOG.find((x) => x.id === g);
                            return (
                              <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                                {meta?.emoji} {meta?.label || g}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Button
                          onClick={() => sendPlayRequest(m.user.user_id)}
                          disabled={pendingRequest === m.user.user_id || sentRequests.has(m.user.user_id)}
                          className={`${
                            sentRequests.has(m.user.user_id)
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                              : "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black"
                          } font-bold`}
                          data-testid={`find-p2-request-${m.user.user_id}-btn`}
                        >
                          {sentRequests.has(m.user.user_id) ? (
                            <><Check className="w-4 h-4 mr-1" /> Request Sent</>
                          ) : pendingRequest === m.user.user_id ? (
                            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending…</>
                          ) : (
                            <><Send className="w-4 h-4 mr-1" /> Run It Back</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => navigate("/multiplayer")}
                          className="text-white/60"
                          data-testid={`find-p2-play-${m.user.user_id}-btn`}
                        >
                          <Gamepad2 className="w-4 h-4 mr-1" /> Go to Lobby
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer tip */}
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-5 flex items-center gap-3 text-sm text-white/60">
          <Trophy className="w-5 h-5 text-amber-300 flex-shrink-0" />
          <div>Skill ratings climb automatically every time you win a multiplayer match. Play more → match sharper.</div>
        </div>
      </div>
    </div>
  );
}
