/**
 * Date Spot Finder — Global Vibez DSG
 *
 * Spec source: GlobalVibez_Mission_v3.pdf
 *   • "Mom & Pop" first. Restaurants + Entertainment venues.
 *   • Neon Purple Vibe-Ring around paid Business Partnership cards
 *     ($30/month flat fee — priority placement + in-app commercials).
 *   • Zip-code first discovery, then radial fallback.
 *   • Brand-aligned with Global Vibez DSG neon-purple aesthetic
 *     (replaces the older orange/pink "Date Spot Discovery" skin).
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Search,
  Filter,
  MapPin,
  Star,
  Plus,
  Utensils,
  Music,
  Sparkles,
  Crown,
  ArrowRight,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Restaurant = {
  restaurant_id: string;
  name: string;
  description?: string;
  city?: string;
  zip_code?: string;
  venue_type?: "restaurant" | "entertainment";
  cuisine_type?: string[];
  ambiance?: string[];
  price_range?: string;
  average_rating?: number;
  review_count?: number;
  cover_photo?: string;
  special_offers?: string;
  commercial_video_url?: string;
  subscription_active?: boolean;
  is_promoted?: boolean;
  distance_miles?: number | null;
};

const ENTERTAINMENT_TYPES = [
  "Bar / Lounge",
  "Live Music",
  "Pool Hall",
  "Bowling",
  "Arcade",
  "Club",
  "Rooftop",
];

const CUISINE_TYPES = [
  "American",
  "Italian",
  "Japanese",
  "Mexican",
  "Chinese",
  "French",
  "Thai",
  "Soul Food",
  "Caribbean",
];

export default function Restaurants() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [promoted, setPromoted] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    city: "",
    zip_code: "",
    venue_type: "all", // all | restaurant | entertainment
    cuisine_type: "",
    ambiance: "",
    price_range: "",
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {},
      );
    }
    fetchPromoted();
  }, []);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.city) params.append("city", filters.city);
      if (filters.zip_code) params.append("zip_code", filters.zip_code);
      if (filters.venue_type && filters.venue_type !== "all")
        params.append("venue_type", filters.venue_type);
      if (filters.cuisine_type) params.append("cuisine_type", filters.cuisine_type);
      if (filters.ambiance) params.append("ambiance", filters.ambiance);
      if (filters.price_range) params.append("price_range", filters.price_range);
      if (userLocation) {
        params.append("user_lat", String(userLocation.lat));
        params.append("user_lng", String(userLocation.lng));
      }
      const response = await fetch(`${API}/api/restaurants/list?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setRestaurants(data.restaurants || []);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromoted = async () => {
    const response = await fetch(`${API}/api/restaurants/promoted`);
    if (response.ok) {
      const data = await response.json();
      setPromoted(data.promoted_restaurants || []);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchRestaurants, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, userLocation]);

  const filteredRestaurants = useMemo(
    () =>
      restaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [restaurants, searchTerm],
  );

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="date-spot-finder-page">
      {/* Hero / Header */}
      <div className="relative overflow-hidden border-b border-fuchsia-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,3,15,0)_0%,rgba(7,3,15,0.92)_100%)]" />
        <div className="relative max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_18px_rgba(217,70,239,0.55)]" data-testid="date-spot-header-logo">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
                  Global Vibez DSG · Utility Room
                </p>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                  <span className="text-white">Date Spot</span>{" "}
                  <span className="text-transparent bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-300 bg-clip-text">
                    Finder
                  </span>
                </h1>
                <p className="text-sm text-purple-300/80 mt-1">
                  Mom &amp; Pop restaurants and entertainment venues — curated by the community.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/restaurants/submit")}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold shadow-[0_0_22px_rgba(217,70,239,0.45)]"
              data-testid="list-venue-btn"
            >
              <Plus className="w-5 h-5 mr-2" /> List Your Venue
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-8 max-w-3xl">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-fuchsia-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or vibe…"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0F0720] border border-fuchsia-500/30 text-white placeholder:text-purple-400/60 focus:outline-none focus:border-fuchsia-400"
              data-testid="date-spot-search-input"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {/* Filters */}
        <Card className="p-6 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-fuchsia-400" />
            <h3 className="font-bold text-lg">Filters</h3>
          </div>

          {/* Venue-type pill toggle */}
          <div className="flex gap-2 mb-5" data-testid="venue-type-toggle">
            {[
              { key: "all", label: "All Spots", icon: Sparkles },
              { key: "restaurant", label: "Restaurants", icon: Utensils },
              { key: "entertainment", label: "Entertainment", icon: Music },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = filters.venue_type === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setFilters({ ...filters, venue_type: opt.key })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    active
                      ? "bg-fuchsia-600 text-white shadow-[0_0_18px_rgba(217,70,239,0.55)]"
                      : "bg-[#1A0D2E] text-purple-300 hover:text-white border border-fuchsia-500/20"
                  }`}
                  data-testid={`venue-type-${opt.key}`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            <FilterField label="City">
              <input
                type="text"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                placeholder="San Francisco"
                className="w-full p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-white placeholder:text-purple-400/50"
                data-testid="filter-city"
              />
            </FilterField>
            <FilterField label="Zip Code">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={filters.zip_code}
                onChange={(e) => setFilters({ ...filters, zip_code: e.target.value })}
                placeholder="94110"
                className="w-full p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-white placeholder:text-purple-400/50"
                data-testid="filter-zip"
              />
            </FilterField>
            {filters.venue_type !== "entertainment" && (
              <FilterField label="Cuisine">
                <select
                  value={filters.cuisine_type}
                  onChange={(e) => setFilters({ ...filters, cuisine_type: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-white"
                  data-testid="filter-cuisine"
                >
                  <option value="">All Cuisines</option>
                  {CUISINE_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FilterField>
            )}
            {filters.venue_type === "entertainment" && (
              <FilterField label="Entertainment Type">
                <select
                  value={filters.ambiance}
                  onChange={(e) => setFilters({ ...filters, ambiance: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-white"
                  data-testid="filter-entertainment-type"
                >
                  <option value="">All Types</option>
                  {ENTERTAINMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </FilterField>
            )}
            <FilterField label="Ambiance">
              <select
                value={filters.ambiance}
                onChange={(e) => setFilters({ ...filters, ambiance: e.target.value })}
                className="w-full p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-white"
                data-testid="filter-ambiance"
              >
                <option value="">All Vibes</option>
                <option value="Romantic">Romantic</option>
                <option value="Casual">Casual</option>
                <option value="Upscale">Upscale</option>
                <option value="Cozy">Cozy</option>
              </select>
            </FilterField>
            <FilterField label="Price">
              <select
                value={filters.price_range}
                onChange={(e) => setFilters({ ...filters, price_range: e.target.value })}
                className="w-full p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-white"
                data-testid="filter-price"
              >
                <option value="">All Prices</option>
                <option value="$">$ — Budget</option>
                <option value="$$">$$ — Moderate</option>
                <option value="$$$">$$$ — Upscale</option>
                <option value="$$$$">$$$$ — Fine Dining</option>
              </select>
            </FilterField>
          </div>
        </Card>

        {/* Business Partner CTA */}
        <PartnerCTA />

        {/* Sponsored / Vibe-Ring Featured */}
        {promoted.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-6 h-6 text-fuchsia-400" />
              <h2 className="text-2xl font-black">Vibe-Ring Partners</h2>
              <span className="ml-2 text-xs uppercase tracking-widest text-fuchsia-400/80">
                Priority Placement
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {promoted.slice(0, 3).map((r) => (
                <VenueCard key={r.restaurant_id} r={r} featured />
              ))}
            </div>
          </div>
        )}

        {/* All venues */}
        <div>
          <div className="flex items-end justify-between mb-4 gap-2 flex-wrap">
            <div>
              <h2 className="text-2xl font-black">
                {userLocation ? "Spots Near You" : "All Date Spots"}
              </h2>
              <p className="text-sm text-purple-300/70">
                {userLocation
                  ? "Vibe-Ring partners + nearby picks sorted by proximity."
                  : `${filteredRestaurants.length} venues found`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-purple-300/80">Loading the Date Spot Finder…</p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <Card className="p-12 text-center bg-[#0F0720] border border-fuchsia-500/20">
              <Utensils className="w-16 h-16 mx-auto mb-4 text-fuchsia-400" />
              <h3 className="text-xl font-bold mb-2">No venues found</h3>
              <p className="text-purple-300/70 mb-4">
                Try widening your filters or be the first to list in your area.
              </p>
              <Button
                onClick={() => navigate("/restaurants/submit")}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                data-testid="empty-list-venue-btn"
              >
                List the first venue
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredRestaurants.map((r) => (
                <VenueCard key={r.restaurant_id} r={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── helpers ───────── */

const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className="block text-xs font-mono uppercase tracking-widest text-purple-300/70 mb-2">
      {label}
    </label>
    {children}
  </div>
);

const VenueCard: React.FC<{ r: Restaurant; featured?: boolean }> = ({ r, featured }) => {
  const navigate = useNavigate();
  const hasVibeRing = r.subscription_active || featured;
  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/restaurants/${r.restaurant_id}`)}
      className="cursor-pointer"
      data-testid={`venue-card-${r.restaurant_id}`}
    >
      <div
        className={`relative rounded-2xl overflow-hidden bg-[#0F0720] border transition-all ${
          hasVibeRing
            ? "border-fuchsia-400/70 shadow-[0_0_28px_rgba(217,70,239,0.55)] hover:shadow-[0_0_42px_rgba(217,70,239,0.85)]"
            : "border-fuchsia-500/10 hover:border-fuchsia-400/40"
        }`}
      >
        {hasVibeRing && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-fuchsia-400/60 animate-pulse"
          />
        )}
        {hasVibeRing && (
          <div className="absolute top-3 left-3 z-10">
            <span
              className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold bg-fuchsia-600/90 text-white shadow-[0_0_14px_rgba(217,70,239,0.7)]"
              data-testid="vibe-ring-badge"
            >
              ◉ Vibe-Ring Partner
            </span>
          </div>
        )}
        {r.cover_photo ? (
          <img
            src={r.cover_photo}
            alt={r.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-fuchsia-900/60 to-purple-900/60 flex items-center justify-center">
            {r.venue_type === "entertainment" ? (
              <Music className="w-16 h-16 text-fuchsia-300/70" />
            ) : (
              <Utensils className="w-16 h-16 text-fuchsia-300/70" />
            )}
          </div>
        )}
        <div className="p-4">
          <h3 className="text-xl font-black mb-1">{r.name}</h3>
          <div className="flex items-center gap-2 text-sm text-purple-300/80 mb-2">
            <MapPin className="w-4 h-4" />
            <span>
              {r.city}
              {r.zip_code ? ` · ${r.zip_code}` : ""}
            </span>
            {r.distance_miles != null && (
              <span className="text-fuchsia-400 font-semibold">
                · {r.distance_miles} mi
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              {(r.average_rating ?? 0) > 0 ? (
                <>
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{r.average_rating}</span>
                  <span className="text-xs text-purple-300/60">
                    ({r.review_count ?? 0})
                  </span>
                </>
              ) : (
                <span className="text-xs text-purple-300/60">No reviews yet</span>
              )}
            </div>
            {r.price_range && (
              <span className="text-fuchsia-400 font-bold">{r.price_range}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {(r.cuisine_type || []).slice(0, 2).map((c, i) => (
              <span
                key={`c-${i}`}
                className="text-[10px] uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-300 px-2 py-1 rounded-full border border-fuchsia-500/20"
              >
                {c}
              </span>
            ))}
            {(r.ambiance || []).slice(0, 1).map((a, i) => (
              <span
                key={`a-${i}`}
                className="text-[10px] uppercase tracking-wider bg-purple-500/10 text-purple-300 px-2 py-1 rounded-full border border-purple-500/20"
              >
                {a}
              </span>
            ))}
          </div>
          {r.special_offers && (
            <div className="mt-3 text-xs text-cyan-300 font-semibold">
              ✦ {r.special_offers}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const PartnerCTA: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Card
      className="relative overflow-hidden p-8 bg-gradient-to-br from-fuchsia-950/70 via-purple-950/60 to-[#0F0720] border border-fuchsia-400/40 rounded-2xl"
      data-testid="partner-cta-card"
    >
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-fuchsia-500/20 blur-3xl rounded-full" />
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/90">
            Business Partnership · $30 / month
          </p>
          <h3 className="text-2xl md:text-3xl font-black mt-1">
            Own your corner of the Date Spot Finder.
          </h3>
          <p className="text-sm text-purple-200/80 mt-2 max-w-xl">
            Flat $30/month unlocks the <span className="text-fuchsia-300 font-semibold">Neon Purple
            Vibe-Ring</span>, priority placement in zip-code search,
            and in-app commercials. Pays for itself in 2–3 customer
            visits.
          </p>
        </div>
        <Button
          onClick={() => navigate("/restaurants/submit?partner=1")}
          className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold px-6 py-6 rounded-xl shadow-[0_0_26px_rgba(217,70,239,0.55)]"
          data-testid="become-partner-btn"
        >
          Become a Partner <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </Card>
  );
};
