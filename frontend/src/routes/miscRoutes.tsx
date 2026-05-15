import { Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Demo from "@/pages/Demo";
import ModernGamesShowcase from "@/pages/ModernGamesShowcase";
import EngagementPreview from "@/pages/EngagementPreview";
import SettingsPage from "@/pages/SettingsPage";
import AIDatePlannerPage from "@/pages/AIDatePlannerPage";
import Referral from "@/pages/Referral";
import CreditsWallet from "@/pages/CreditsWallet";
import Wallet from "@/pages/Wallet";
import PricingPage from "@/pages/PricingPage";
import SovereignTiers from "@/pages/SovereignTiers";
import UndergroundLive from "@/pages/UndergroundLive";
import ReceiptsPage from "@/pages/ReceiptsPage";
import StripeConnectWizard from "@/pages/payouts/StripeConnectWizard";
import EconomicEnginePage from "@/pages/EconomicEnginePage";
import EquityMasterPage from "@/pages/EquityMasterPage";
import AmbassadorCarePackagePage from "@/pages/AmbassadorCarePackagePage";
import AgeVerificationPage from "@/pages/AgeVerificationPage";
import ContentRightsPage from "@/pages/ContentRightsPage";
import CinemaRoom from "@/pages/CinemaRoom";
import VibeSpotsPage from "@/pages/VibeSpotsPage";
// Lazy-load Volumetric Galaxy bundle (Three.js ~500KB) — only loaded when user
// actually visits the volumetric route or has it as their dashboard view.
const VolumetricDashboard = lazy(() => import("@/pages/VolumetricDashboard"));
import DashboardRouter from "@/pages/DashboardRouter";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import CelebrationDemo from "@/pages/CelebrationDemo";
import Dashboard from "@/pages/DashboardNew";
import DiscoverPage from "@/pages/DiscoverPage";
import LiveStreamingPage from "@/pages/LiveStreamingPage";
import TournamentDemo from "@/pages/TournamentDemo";
import ModerationDashboard from "@/pages/ModerationDashboard";
import ChatDemo from "@/pages/ChatDemo";
import MetaHumanDealerDemo from "@/pages/MetaHumanDealerEnhanced";
import PrivateVibeSuites from "@/pages/PrivateVibeSuites";
import SkillBasedMatchmaking from "@/pages/SkillBasedMatchmaking";
import Treasury from "@/pages/Treasury";
import YellowPagesDirectory from "@/pages/yellow_pages/YellowPagesDirectory";
import YellowPagesNewListing from "@/pages/yellow_pages/YellowPagesNewListing";
import YellowPagesListingDetail from "@/pages/yellow_pages/YellowPagesListingDetail";
import TopUpSuccess from "@/pages/wallet/TopUpSuccess";
import LegacyVaultPage from "@/pages/LegacyVaultPage";

export const miscRoutes = (ProtectedRoute) => (
  <>
    {/* Hub & Main Pages — /dashboard now resolves to either the Volumetric
        Galaxy (default per founder ask 2026-05-12) or the classic grid
        based on the user's stored preference. */}
    <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
    <Route path="/dashboard-classic" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/lounge" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
    <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
    <Route path="/live" element={<ProtectedRoute><LiveStreamingPage /></ProtectedRoute>} />

    {/* Vibez Coin top-up — Stripe redirect callback (May 2026) */}
    <Route path="/wallet/topup-success" element={<TopUpSuccess />} />
    <Route path="/wallet/topup-cancelled" element={<TopUpSuccess />} />

    {/* Vibe Yellow Pages — 4th Pillar (May 2026) */}
    <Route path="/yellow-pages" element={<YellowPagesDirectory />} />
    <Route path="/yellow-pages/new" element={<ProtectedRoute><YellowPagesNewListing /></ProtectedRoute>} />
    <Route path="/yellow-pages/:listingId" element={<YellowPagesListingDetail />} />
    
    {/* Public Demo Pages */}
    <Route path="/demo" element={<Demo />} />
    <Route path="/treasury" element={<Treasury />} />
    <Route path="/chat-demo" element={<ChatDemo />} />
    <Route path="/modern-games" element={<ModernGamesShowcase />} />
    <Route path="/engagement-preview" element={<EngagementPreview />} />
    <Route path="/celebration-demo" element={<CelebrationDemo />} />
    <Route path="/tournament-demo" element={<TournamentDemo />} />  {/* UE5 MetaHuman Integration Demo */}
    <Route path="/metahuman-dealer" element={<MetaHumanDealerDemo />} />  {/* Smart Table Demo */}
    <Route path="/private-suites" element={<PrivateVibeSuites />} />  {/* Private Vibe Suites */}
    <Route path="/matchmaking" element={<SkillBasedMatchmaking />} />  {/* Skill-Based Dating Matchmaking */}
    
    {/* Settings & Profile */}
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    
    {/* AI Features */}
    <Route path="/ai-date-planner" element={<ProtectedRoute><AIDatePlannerPage /></ProtectedRoute>} />
    <Route path="/moderation" element={<ProtectedRoute><ModerationDashboard /></ProtectedRoute>} />  {/* AI Moderation Dashboard */}
    
    {/* Monetization */}
    <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
    <Route path="/wallet-legacy" element={<ProtectedRoute><CreditsWallet /></ProtectedRoute>} />
    <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
    <Route path="/pricing" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/upgrade" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/tiers" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/pricing-legacy" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
    <Route path="/underground-live" element={<ProtectedRoute><UndergroundLive /></ProtectedRoute>} />
    <Route path="/receipts" element={<ProtectedRoute><ReceiptsPage /></ProtectedRoute>} />
    <Route path="/payouts/setup" element={<ProtectedRoute><StripeConnectWizard /></ProtectedRoute>} />
    {/* Public DSG Economic Engine spec page — investor / user transparency. */}
    <Route path="/economic-engine" element={<EconomicEnginePage />} />
    <Route path="/equity" element={<ProtectedRoute><EquityMasterPage /></ProtectedRoute>} />
    <Route path="/equity-master" element={<ProtectedRoute><EquityMasterPage /></ProtectedRoute>} />
    <Route path="/ambassador" element={<ProtectedRoute><AmbassadorCarePackagePage /></ProtectedRoute>} />
    <Route path="/ambassador-care-package" element={<ProtectedRoute><AmbassadorCarePackagePage /></ProtectedRoute>} />
    {/* 21+ Age Verification Protocol — restricted goods (alcohol/tobacco).
        Distinct from the platform-wide 18+ gate at /age-verification. */}
    <Route path="/restricted-goods-verification" element={<ProtectedRoute><AgeVerificationPage /></ProtectedRoute>} />
    {/* Public Content Rights & IP Anti-Piracy Policy + DMCA filing form. */}
    <Route path="/content-rights" element={<ContentRightsPage />} />
    {/* Volumetric Dashboard "Cinema Date" tile lands here. */}
    <Route path="/cinema-room" element={<ProtectedRoute><CinemaRoom /></ProtectedRoute>} />
    {/* Volumetric Dashboard "Vibez Spots" tile lands here. */}
    <Route path="/vibe-spots" element={<ProtectedRoute><VibeSpotsPage /></ProtectedRoute>} />
    <Route path="/dashboard-volumetric" element={<ProtectedRoute><Suspense fallback={<div data-testid="volumetric-route-loading" className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0d1117] text-fuchsia-300 text-sm uppercase tracking-[0.3em]">Loading Galaxy…</div>}><VolumetricDashboard /></Suspense></ProtectedRoute>} />
    <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
    <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />

    {/* Legacy Vault — Production Security & Phase Gating
        (Ultimate Blueprint v3 §4). Read-only investor / brand
        artifact viewer; locks 13.5% Sovereign Tax + 70/30 split. */}
    <Route path="/legacy-vault" element={<ProtectedRoute><LegacyVaultPage /></ProtectedRoute>} />
  </>
);
