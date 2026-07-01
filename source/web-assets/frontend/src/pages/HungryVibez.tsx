/**
 * Hungry Vibez — Utility Room
 *
 * Spec source: GlobalVibez_Mission_v3.pdf
 *   "Hungry Vibez utility room — anchored by the Hungry Vibez logo.
 *    Flat-fee partnership for Mom & Pop venues, interlocks with VibeRidez
 *    for transit, powered by $DSG on Solana."
 *
 * This is the landing/entry surface for the food-utility room.
 * Driver dispatch + live orders wire through the existing VibeRidez
 * pipeline — this room is the customer-facing menu shelf.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  UtensilsCrossed,
  Bike,
  Store,
  Crown,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function HungryVibez() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="hungry-vibez-page">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-orange-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.2),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-fuchsia-600 shadow-[0_0_18px_rgba(249,115,22,0.55)]" data-testid="hungry-vibez-logo">
              <UtensilsCrossed className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-orange-300/90">
                Global Vibez DSG · Utility Room
              </p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                <span className="text-transparent bg-gradient-to-r from-orange-400 via-fuchsia-400 to-purple-400 bg-clip-text">
                  Hungry
                </span>{" "}
                <span className="text-white">Vibez</span>
              </h1>
              <p className="text-sm text-orange-200/80 mt-1 max-w-xl">
                Mom &amp; Pop kitchens — delivered by neighbors, powered by $DSG,
                dispatched through VibeRidez. No predatory fees.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <Button
              onClick={() => navigate("/restaurants?venue_type=restaurant")}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold shadow-[0_0_22px_rgba(217,70,239,0.45)]"
              data-testid="hungry-browse-kitchens-btn"
            >
              Browse Kitchens <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/vibe-ridez")}
              className="border-orange-400/40 text-orange-200 hover:bg-orange-500/10 hover:text-white"
              data-testid="hungry-viberidez-btn"
            >
              <Bike className="w-4 h-4 mr-2" /> Drive for Hungry Vibez
            </Button>
          </div>
        </div>
      </div>

      {/* Three-pillar grid */}
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        <section className="grid md:grid-cols-3 gap-6">
          <Pillar
            icon={Store}
            title="Mom & Pop First"
            body="Curated partner kitchens, capped membership so the feed never monopolizes. $30/month unlocks priority + Vibe-Ring."
            testid="pillar-mompop"
          />
          <Pillar
            icon={Bike}
            title="Powered by VibeRidez"
            body="Every Hungry Vibez order hands off to our VibeRidez driver network — 70% driver / chair-pool split, on-chain USDC payouts."
            testid="pillar-viberidez"
          />
          <Pillar
            icon={Sparkles}
            title="Closed-Loop $DSG"
            body="Solana-native checkout. Customer spend flows back to drivers, partners, and the community chair pool."
            testid="pillar-vibez"
          />
        </section>

        {/* Partnership pitch */}
        <Card
          className="relative overflow-hidden p-8 bg-gradient-to-br from-orange-950/60 via-fuchsia-950/50 to-[#0F0720] border border-orange-400/30 rounded-2xl"
          data-testid="hungry-partner-cta"
        >
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-orange-500/20 blur-3xl rounded-full" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-orange-300/90">
                Restaurant Partnership · $30 / month
              </p>
              <h3 className="text-2xl md:text-3xl font-black mt-1">
                Your kitchen, your neighborhood, no predator fees.
              </h3>
              <p className="text-sm text-orange-100/80 mt-2 max-w-xl">
                Flat-fee membership. Keep 100% of your menu price, pay no
                per-order rake. Customers get you through the Date Spot Finder
                and Hungry Vibez rooms.
              </p>
            </div>
            <Button
              onClick={() => navigate("/restaurants/submit?partner=1&tab=hungry")}
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-6 rounded-xl shadow-[0_0_26px_rgba(249,115,22,0.55)]"
              data-testid="hungry-become-partner-btn"
            >
              Partner with Hungry Vibez <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </Card>

        {/* Roadmap note */}
        <div className="text-center text-xs font-mono uppercase tracking-[0.3em] text-purple-300/50">
          <Crown className="inline w-4 h-4 mr-2 text-fuchsia-400" />
          More room coming — live menus, on-chain receipts, driver live-stream ETA
        </div>
      </div>
    </div>
  );
}

const Pillar: React.FC<{
  icon: React.ElementType;
  title: string;
  body: string;
  testid?: string;
}> = ({ icon: Icon, title, body, testid }) => (
  <Card
    className="p-6 bg-[#0F0720] border border-fuchsia-500/15 rounded-2xl hover:border-fuchsia-400/40 transition-all"
    data-testid={testid}
  >
    <div className="w-12 h-12 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-fuchsia-300" />
    </div>
    <h4 className="text-lg font-black mb-2">{title}</h4>
    <p className="text-sm text-purple-300/80 leading-relaxed">{body}</p>
  </Card>
);
