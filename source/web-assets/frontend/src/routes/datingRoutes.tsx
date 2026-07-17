import { Route } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import DashboardRouter from "@/pages/DashboardRouter";
import DiscoverPage from "@/pages/DiscoverPage";
import Matches from "@/pages/Matches";
import Messages from "@/pages/Messages";
import Chat from "@/pages/Chat";
import Categories from "@/pages/Categories";
import DiscoverByCategory from "@/pages/DiscoverByCategory";
import SpeedDating from "@/pages/SpeedDating";
import SpeedDatingRoom from "@/pages/SpeedDatingRoom";
import { DatingProfileSetup } from "@/pages/DatingProfileSetup";
import { DatingDiscovery } from "@/pages/DatingDiscovery";
import { DatingMatches } from "@/pages/DatingMatches";
import DatingQuiz from "@/pages/DatingQuiz";
import PartnerQuizGame from "@/pages/PartnerQuizGame";
import VRDatingRoom from "@/pages/VRDatingRoom";
import ProfileSetup from "@/pages/ProfileSetup";
import ProfileEdit from "@/pages/ProfileEdit";
import BondsPage from "@/pages/BondsPage";
import CulturalOnboardingWizard from "@/pages/CulturalOnboardingWizard";
import VibeCheck from "@/pages/VibeCheck";
import PageLoader from "@/components/common/PageLoader";
import IdVerificationGate from "@/components/age_verification/IdVerificationGate";

// Lazy: SpeedDatingLobby pulls SpeedDatingVideo which previously crashed the
// entire SPA at import time when REACT_APP_BACKEND_URL was missing.
const SpeedDatingLobby = lazy(() => import("@/pages/SpeedDatingLobby"));

const LazyLobby = (
  <Suspense fallback={<PageLoader message="Loading..." />}>
    <SpeedDatingLobby />
  </Suspense>
);

const withIdGate = (surfaceName: string, node: ReactNode) => (
  <IdVerificationGate surfaceName={surfaceName}>{node}</IdVerificationGate>
);

export const datingRoutes = (ProtectedRoute) => (
  <>
    {/* /dashboard duplicated here for backward compat — routes to the
        DashboardRouter (Volumetric default, Classic on opt-out). */}
    <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
    <Route path="/discover" element={<ProtectedRoute>{withIdGate("Discover", <DiscoverPage />)}</ProtectedRoute>} />
    <Route path="/categories" element={<ProtectedRoute>{withIdGate("Dating categories", <Categories />)}</ProtectedRoute>} />
    <Route path="/discover-category/:categoryType/:categoryId" element={<ProtectedRoute>{withIdGate("Category discover", <DiscoverByCategory />)}</ProtectedRoute>} />
    <Route path="/speed-dating" element={<ProtectedRoute>{withIdGate("Speed dating", <SpeedDating />)}</ProtectedRoute>} />
    {/* Volumetric Dashboard "Dating · Universe" tile lands here. */}
    <Route path="/dating" element={<ProtectedRoute>{withIdGate("Dating", <DatingDiscovery />)}</ProtectedRoute>} />
    <Route path="/speed-dating/room" element={<ProtectedRoute>{withIdGate("Speed dating room", <SpeedDatingRoom />)}</ProtectedRoute>} />
    <Route path="/speed-dating/lobby" element={<ProtectedRoute>{withIdGate("Speed dating lobby", LazyLobby)}</ProtectedRoute>} />
    <Route path="/dating/profile/setup" element={<ProtectedRoute>{withIdGate("Dating profile setup", <DatingProfileSetup />)}</ProtectedRoute>} />
    <Route path="/dating/cultural-onboarding" element={<ProtectedRoute>{withIdGate("Cultural onboarding", <CulturalOnboardingWizard />)}</ProtectedRoute>} />
    <Route path="/dating/vibe-check" element={<ProtectedRoute>{withIdGate("Vibe check", <VibeCheck />)}</ProtectedRoute>} />
    <Route path="/dating/discover" element={<ProtectedRoute>{withIdGate("Dating discover", <DatingDiscovery />)}</ProtectedRoute>} />
    <Route path="/dating/matches" element={<ProtectedRoute>{withIdGate("Dating matches", <DatingMatches />)}</ProtectedRoute>} />
    <Route path="/dating-game/:gameId" element={<ProtectedRoute>{withIdGate("Dating game", <PartnerQuizGame />)}</ProtectedRoute>} />
    <Route path="/quiz/dating" element={<ProtectedRoute>{withIdGate("Dating quiz", <DatingQuiz />)}</ProtectedRoute>} />
    <Route path="/vr-dating" element={<ProtectedRoute>{withIdGate("VR dating", <VRDatingRoom />)}</ProtectedRoute>} />
    <Route path="/vr-date/:roomId" element={<ProtectedRoute>{withIdGate("VR date", <VRDatingRoom />)}</ProtectedRoute>} />
    <Route path="/bonds" element={<ProtectedRoute>{withIdGate("Bonds", <BondsPage />)}</ProtectedRoute>} />
    <Route path="/matches" element={<ProtectedRoute>{withIdGate("Matches", <Matches />)}</ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
    <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
    <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
  </>
);
