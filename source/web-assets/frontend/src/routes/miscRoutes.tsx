import { Route, Navigate } from "react-router-dom";
import SweepstakesPage from "@/pages/SweepstakesPage";
import GlasshouseOwnershipPage from "@/pages/GlasshouseOwnershipPage";
import ChairLedgerPage from "@/pages/ChairLedgerPage";
import OperationsConsolePage from "@/pages/OperationsConsolePage";
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
import EconomicEnginePage from "@/pages/EconomicEnginePage";
import EquityMasterPage from "@/pages/EquityMasterPage";
import AmbassadorCarePackagePage from "@/pages/AmbassadorCarePackagePage";
import MyVibezThemedRoom from "@/pages/MyVibezThemedRoom";
import RoadmapHub from "@/pages/RoadmapHub";
import AgeVerificationPage from "@/pages/AgeVerificationPage";
import IdVerificationGate from "@/components/age_verification/IdVerificationGate";
import ContentRightsPage from "@/pages/ContentRightsPage";
import CinemaRoom from "@/pages/CinemaRoom";
import FreeTVCinemaRoom from "@/pages/FreeTVCinemaRoom";
import VibeSpotsPage from "@/pages/VibeSpotsPage";
import VibeEventsPage from "@/pages/VibeEventsPage";
import DashboardRouter from "@/pages/DashboardRouter";
import { DashboardViewRedirect } from "@/pages/DashboardViewRedirect";
import EarnHub from "@/pages/EarnHub";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import CelebrationDemo from "@/pages/CelebrationDemo";
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
import LegacyVaultPage from "@/pages/LegacyVaultPage";
import VibePhonePage from "@/pages/VibePhonePage";

export const miscRoutes = (ProtectedRoute) => (
  <>
    {/* Hub & Main Pages — /dashboard resolves to Volumetric (default) or
        classic via DashboardRouter preference. Alias URLs redirect. */}
    <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
    <Route path="/dashboard-classic" element={<ProtectedRoute><DashboardViewRedirect view="classic" /></ProtectedRoute>} />
    <Route path="/dashboard-volumetric" element={<ProtectedRoute><DashboardViewRedirect view="volumetric" /></ProtectedRoute>} />
    <Route path="/lounge" element={<Navigate to="/dashboard" replace />} />
    <Route path="/earn" element={<ProtectedRoute><EarnHub /></ProtectedRoute>} />
    <Route path="/earn/chair" element={<Navigate to="/chair-vault" replace />} />
    <Route path="/earn/referral" element={<Navigate to="/referral" replace />} />
    {/* Dead-link / typo aliases — keep tabs & old CTAs from hitting NotFound */}
    <Route path="/inbox" element={<Navigate to="/messages" replace />} />
    <Route path="/chat" element={<Navigate to="/messages" replace />} />
    <Route path="/auth" element={<Navigate to="/login" replace />} />
    <Route path="/auth/sign-in" element={<Navigate to="/login" replace />} />
    <Route path="/auth/signup" element={<Navigate to="/signup" replace />} />
    <Route path="/games-new" element={<Navigate to="/games" replace />} />
    <Route path="/roulette" element={<Navigate to="/european-roulette" replace />} />
    <Route path="/vibe-phone" element={<ProtectedRoute><VibePhonePage /></ProtectedRoute>} />
    <Route path="/viberidez" element={<Navigate to="/vibe-ridez" replace />} />
    <Route path="/feed" element={<Navigate to="/my-vibez" replace />} />
    <Route path="/chairs/vault" element={<Navigate to="/chair-vault" replace />} />
    <Route path="/tournament-leaderboard" element={<Navigate to="/leaderboard" replace />} />
    <Route path="/vibez-casino-blackjack" element={<Navigate to="/multiplayer-blackjack" replace />} />
    <Route path="/poker-room" element={<Navigate to="/multiplayer-poker" replace />} />
    <Route path="/grand-master-bid-whist" element={<Navigate to="/bid-whist" replace />} />
    <Route path="/multiplayer/uno" element={<Navigate to="/uno" replace />} />
    <Route path="/protocol-omega" element={<Navigate to="/practice/play/chess" replace />} />
    {/* Streaming IA: /tv* aliases → live streams / studio (Job Board canonical). */}
    <Route path="/tv" element={<Navigate to="/streams" replace />} />
    <Route path="/tv/discover" element={<Navigate to="/streams" replace />} />
    <Route path="/tv/broadcast" element={<Navigate to="/streamer/studio" replace />} />
    <Route path="/tv/analytics" element={<Navigate to="/streamer/analytics" replace />} />
    <Route path="/games/654" element={<Navigate to="/vibe-654-hall" replace />} />
    <Route path="/games/vibez-654" element={<Navigate to="/vibe-654-hall" replace />} />
    <Route path="/games/spade-plus" element={<Navigate to="/spades" replace />} />
    <Route path="/games/bid-whist" element={<Navigate to="/bid-whist" replace />} />
    <Route path="/games/tournaments" element={<Navigate to="/tournaments" replace />} />
    <Route path="/dating/speed-dating" element={<Navigate to="/speed-dating" replace />} />
    <Route path="/dating/profile" element={<Navigate to="/profile/edit" replace />} />
    <Route path="/chair-registry" element={<Navigate to="/chair-ledger" replace />} />
    <Route path="/dealer-lounge" element={<Navigate to="/dealers" replace />} />
    <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
    <Route path="/live" element={<ProtectedRoute><LiveStreamingPage /></ProtectedRoute>} />

    {/* Vibe Yellow Pages — 4th Pillar (May 2026). New listings require 18+ ID. */}
    <Route path="/yellow-pages" element={<YellowPagesDirectory />} />
    <Route path="/yellow-pages/new" element={<ProtectedRoute><IdVerificationGate surfaceName="Yellow Pages listings"><YellowPagesNewListing /></IdVerificationGate></ProtectedRoute>} />
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
    <Route path="/wallet" element={<ProtectedRoute><IdVerificationGate surfaceName="Wallet"><Wallet /></IdVerificationGate></ProtectedRoute>} />
    <Route path="/pricing" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/upgrade" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/tiers" element={<ProtectedRoute><SovereignTiers /></ProtectedRoute>} />
    <Route path="/pricing-legacy" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
    <Route path="/underground-live" element={<ProtectedRoute><UndergroundLive /></ProtectedRoute>} />
    <Route path="/receipts" element={<ProtectedRoute><ReceiptsPage /></ProtectedRoute>} />
    {/* Public DSG Economic Engine spec page — investor / user transparency. */}
    <Route path="/economic-engine" element={<EconomicEnginePage />} />
    <Route path="/equity" element={<ProtectedRoute><EquityMasterPage /></ProtectedRoute>} />
    <Route path="/equity-master" element={<ProtectedRoute><EquityMasterPage /></ProtectedRoute>} />
    <Route path="/ambassador" element={<ProtectedRoute><AmbassadorCarePackagePage /></ProtectedRoute>} />
    <Route path="/ambassador-care-package" element={<ProtectedRoute><AmbassadorCarePackagePage /></ProtectedRoute>} />
    <Route path="/my-vibez/themed" element={<ProtectedRoute><MyVibezThemedRoom /></ProtectedRoute>} />
    <Route path="/my-vibez-themed" element={<ProtectedRoute><MyVibezThemedRoom /></ProtectedRoute>} />
    <Route path="/roadmap" element={<ProtectedRoute><RoadmapHub /></ProtectedRoute>} />
    <Route path="/roadmap-hub" element={<ProtectedRoute><RoadmapHub /></ProtectedRoute>} />
    {/* 21+ Age Verification Protocol — restricted goods (alcohol/tobacco).
        Distinct from the platform-wide 18+ gate at /age-verification.
        Consumers (HungryVibes alcohol checkout, after-dark TV) use
        AgeVerificationGate with category="alcohol"|"tobacco". */}
    <Route path="/restricted-goods-verification" element={<ProtectedRoute><AgeVerificationPage /></ProtectedRoute>} />
    {/* Public Content Rights & IP Anti-Piracy Policy + DMCA filing form. */}
    <Route path="/content-rights" element={<ContentRightsPage />} />
    {/* Volumetric Dashboard "Cinema Date" tile lands here. */}
    <Route path="/cinema-room" element={<ProtectedRoute><CinemaRoom /></ProtectedRoute>} />
    <Route path="/free-tv" element={<ProtectedRoute><FreeTVCinemaRoom /></ProtectedRoute>} />
    <Route path="/free-tv/:roomId" element={<ProtectedRoute><FreeTVCinemaRoom /></ProtectedRoute>} />
    {/* Volumetric Dashboard "Vibez Spots" tile lands here. */}
    <Route path="/vibe-spots" element={<ProtectedRoute><VibeSpotsPage /></ProtectedRoute>} />
    <Route path="/vibe-events" element={<ProtectedRoute><VibeEventsPage /></ProtectedRoute>} />
    <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
    <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />

    {/* Legacy Vault — Production Security & Phase Gating
        (Ultimate Blueprint v3 §4). Read-only investor / brand
        artifact viewer; locks 13.5% Sovereign Tax + 70/30 split. */}
    <Route path="/legacy-vault" element={<ProtectedRoute><LegacyVaultPage /></ProtectedRoute>} />

    {/* ── New features merged from Genius Phase (2026-07) ── */}
    {/* Weekly sweepstakes draw for chair holders */}
    <Route path="/sweepstakes" element={<ProtectedRoute><SweepstakesPage /></ProtectedRoute>} />
    {/* Wallet proof-of-ownership / Celestial Glasshouse dashboard */}
    <Route path="/glasshouse" element={<ProtectedRoute><GlasshouseOwnershipPage /></ProtectedRoute>} />
    {/* DSG Circulation Ledger — chair registry */}
    <Route path="/chair-ledger" element={<ProtectedRoute><ChairLedgerPage /></ProtectedRoute>} />
    {/* Ops console — authenticated platform health dashboard */}
    <Route path="/operations" element={<ProtectedRoute><OperationsConsolePage /></ProtectedRoute>} />
  </>
);
