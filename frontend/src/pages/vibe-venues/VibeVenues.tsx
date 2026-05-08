/**
 * Vibe Venues — main browse page.
 * Spec: Vibe_Venues_Master_Lock_In.pdf
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Home,
  Search,
  MapPin,
  Clock,
  ChefHat,
  ArrowRight,
  Box,
  ShieldCheck,
  Users,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Venue = {
  venue_id: string;
  name: string;
  description: string;
  city: string;
  zip_code: string;
  capacity: number;
  cover_photo?: string;
  walkthrough_3d_url?: string;
  base_hourly_rate_usd: number;
  amenities?: string[];
  average_rating?: number;
  review_count?: number;
};

type Config = {
  hourly_blocks: number[];
  platform_rental_fee_pct: number;
  prep_fee_pct: number;
  artisan_membership_fee_usd: number;
};

export default function VibeVenues() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

  useEffect(() => {
    fetch(`${API}/api/vibe-venues/config`)
      .then((r) => r.json())
      .then(setCfg);
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (city) p.append("city", city);
    if (zip) p.append("zip_code", zip);
    fetch(`${API}/api/vibe-venues/venues?${p}`)
      .then((r) => r.json())
      .then((d) => setVenues(d.venues || []))
      .finally(() => setLoading(false));
  }, [city, zip]);

  const filtered = useMemo(
    () =>
      venues.filter(
        (v) =>
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          v.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [venues, search],
  );

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="vibe-venues-page">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-fuchsia-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.18),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_18px_rgba(217,70,239,0.55)]">
                <Home className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
                  Global Vibez DSG · Utility Room
                </p>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                  <span className="text-white">Vibe</span>{" "}
                  <span className="text-transparent bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-300 bg-clip-text">
                    Venues
                  </span>
                </h1>
                <p className="text-sm text-purple-300/80 mt-1">
                  Hourly private spaces, paired with Vibe Artisans, locked in $DSG smart escrow.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => navigate("/vibe-venues/host")}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold shadow-[0_0_22px_rgba(217,70,239,0.45)]"
                data-testid="vv-list-house-btn"
              >
                List a House
              </Button>
              <Button
                onClick={() => navigate("/vibe-venues/artisan")}
                variant="outline"
                className="border-orange-400/40 text-orange-200 hover:bg-orange-500/10 hover:text-white"
                data-testid="vv-become-artisan-btn"
              >
                <ChefHat className="w-4 h-4 mr-2" /> Become a Vibe Artisan · $20/mo
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-8 grid md:grid-cols-3 gap-3 max-w-3xl">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-fuchsia-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or vibe…"
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0F0720] border border-fuchsia-500/30 text-white placeholder:text-purple-400/60 focus:outline-none focus:border-fuchsia-400"
                data-testid="vv-search-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="px-3 py-3 rounded-xl bg-[#0F0720] border border-fuchsia-500/30 text-white placeholder:text-purple-400/60 focus:outline-none focus:border-fuchsia-400"
                data-testid="vv-city-input"
              />
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="Zip"
                className="px-3 py-3 rounded-xl bg-[#0F0720] border border-fuchsia-500/30 text-white placeholder:text-purple-400/60 focus:outline-none focus:border-fuchsia-400"
                data-testid="vv-zip-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hourly blocks */}
        {cfg && (
          <Card className="p-5 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-fuchsia-300" />
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80">
                Hourly Rental Blocks
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cfg.hourly_blocks.map((h) => (
                <span
                  key={h}
                  className="px-4 py-2 rounded-full text-sm font-black bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-500/30"
                >
                  {h} hr
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* How it works */}
        <Card className="p-6 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl">
          <h2 className="text-2xl font-black mb-4">How Vibe Venues Works</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <Step n={1} icon={Home} title="Pick a House" body="Browse hourly blocks, walk through in 360°." />
            <Step n={2} icon={ChefHat} title="Add an Artisan" body="Optional chef / setter — $20/mo members." />
            <Step n={3} icon={ShieldCheck} title="$DSG Escrow" body="Total locked. Prep-fee released to chef on confirm." />
            <Step n={4} icon={Users} title="Vibe-Check Releases" body="Submit your review — balance pays out." />
          </div>
        </Card>

        {/* Listings */}
        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black">All Venues</h2>
              <p className="text-sm text-purple-300/70">{filtered.length} houses listed</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-purple-300/80">Loading venues…</p>
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center bg-[#0F0720] border border-fuchsia-500/20">
              <Home className="w-16 h-16 mx-auto mb-4 text-fuchsia-400" />
              <h3 className="text-xl font-bold mb-2">No venues yet</h3>
              <p className="text-purple-300/70 mb-4">
                Be the first to list a house in your area.
              </p>
              <Button
                onClick={() => navigate("/vibe-venues/host")}
                className="bg-fuchsia-600 hover:bg-fuchsia-500"
                data-testid="vv-empty-list-btn"
              >
                List the first house <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filtered.map((v) => (
                <VenueCard key={v.venue_id} v={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Step: React.FC<{ n: number; icon: React.ElementType; title: string; body: string }> = ({
  n,
  icon: Icon,
  title,
  body,
}) => (
  <div className="p-4 rounded-2xl bg-[#0B0618] border border-fuchsia-500/20">
    <div className="flex items-center gap-2 mb-2">
      <span className="w-7 h-7 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs font-black flex items-center justify-center border border-fuchsia-500/40">
        {n}
      </span>
      <Icon className="w-4 h-4 text-fuchsia-300" />
    </div>
    <p className="text-sm font-black text-white mb-1">{title}</p>
    <p className="text-xs text-purple-300/80 leading-relaxed">{body}</p>
  </div>
);

const VenueCard: React.FC<{ v: Venue }> = ({ v }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/vibe-venues/${v.venue_id}`)}
      className="cursor-pointer rounded-2xl overflow-hidden bg-[#0F0720] border border-fuchsia-500/15 hover:border-fuchsia-400/50 transition-all"
      data-testid={`venue-card-${v.venue_id}`}
    >
      {v.cover_photo ? (
        <img src={v.cover_photo} alt={v.name} className="w-full h-48 object-cover" />
      ) : (
        <div className="w-full h-48 bg-gradient-to-br from-fuchsia-900/60 to-purple-900/60 flex items-center justify-center">
          <Home className="w-16 h-16 text-fuchsia-300/70" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-black truncate">{v.name}</h3>
          {v.walkthrough_3d_url && (
            <span className="text-[10px] uppercase tracking-widest bg-cyan-500/15 text-cyan-300 px-2 py-1 rounded-full border border-cyan-500/30">
              <Box className="w-3 h-3 inline" /> 3D
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-purple-300/80 mb-3">
          <MapPin className="w-4 h-4" />
          {v.city} · {v.zip_code}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-fuchsia-400 font-black text-lg">
            ${v.base_hourly_rate_usd}
            <span className="text-purple-300/60 text-xs font-normal"> / hr</span>
          </span>
          <span className="text-xs text-purple-300/60">cap {v.capacity}</span>
        </div>
      </div>
    </motion.div>
  );
};
