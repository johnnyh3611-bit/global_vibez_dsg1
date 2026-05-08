import { Route } from "react-router-dom";
import Demo from "@/pages/Demo";
import ModernGamesShowcase from "@/pages/ModernGamesShowcase";
import EngagementPreview from "@/pages/EngagementPreview";
import SettingsPage from "@/pages/SettingsPage";
import AIDatePlannerPage from "@/pages/AIDatePlannerPage";
import Referral from "@/pages/Referral";
import CreditsWallet from "@/pages/CreditsWallet";
import Wallet from "@/pages/Wallet";
import PricingPage from "@/pages/PricingPage";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import CelebrationDemo from "@/pages/CelebrationDemo";
import Dashboard from "@/pages/Dashboard";
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

export const miscRoutes = (ProtectedRoute) => (
  <>
    {/* Hub & Main Pages */}
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/lounge" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
    <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
    <Route path="/upgrade" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
    <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
    <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
  </>
);
