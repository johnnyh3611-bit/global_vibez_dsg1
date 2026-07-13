import { Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Dashboard from "@/pages/DashboardNew";
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
import PageLoader from "@/components/common/PageLoader";

// Lazy: SpeedDatingLobby pulls SpeedDatingVideo which previously crashed the
// entire SPA at import time when REACT_APP_BACKEND_URL was missing.
const SpeedDatingLobby = lazy(() => import("@/pages/SpeedDatingLobby"));

const LazyLobby = (
  <Suspense fallback={<PageLoader message="Loading..." />}>
    <SpeedDatingLobby />
  </Suspense>
);

export const datingRoutes = (ProtectedRoute) => (
  <>
    {/* /dashboard duplicated here for backward compat — routes to the
        DashboardRouter (Volumetric default, Classic on opt-out). */}
    <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
    <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
    <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
    <Route path="/discover-category/:categoryType/:categoryId" element={<ProtectedRoute><DiscoverByCategory /></ProtectedRoute>} />
    <Route path="/speed-dating" element={<ProtectedRoute><SpeedDating /></ProtectedRoute>} />
    {/* Volumetric Dashboard "Dating · Universe" tile lands here. */}
    <Route path="/dating" element={<ProtectedRoute><DatingDiscovery /></ProtectedRoute>} />
    <Route path="/speed-dating/room" element={<ProtectedRoute><SpeedDatingRoom /></ProtectedRoute>} />
    <Route path="/speed-dating/lobby" element={<ProtectedRoute>{LazyLobby}</ProtectedRoute>} />
    <Route path="/dating/profile/setup" element={<ProtectedRoute><DatingProfileSetup /></ProtectedRoute>} />
    <Route path="/dating/cultural-onboarding" element={<ProtectedRoute><CulturalOnboardingWizard /></ProtectedRoute>} />
    <Route path="/dating/discover" element={<ProtectedRoute><DatingDiscovery /></ProtectedRoute>} />
    <Route path="/dating/matches" element={<ProtectedRoute><DatingMatches /></ProtectedRoute>} />
    <Route path="/dating-game/:gameId" element={<ProtectedRoute><PartnerQuizGame /></ProtectedRoute>} />
    <Route path="/quiz/dating" element={<ProtectedRoute><DatingQuiz /></ProtectedRoute>} />
    <Route path="/vr-dating" element={<ProtectedRoute><VRDatingRoom /></ProtectedRoute>} />
    <Route path="/vr-date/:roomId" element={<ProtectedRoute><VRDatingRoom /></ProtectedRoute>} />
    <Route path="/bonds" element={<ProtectedRoute><BondsPage /></ProtectedRoute>} />
    <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
    <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
    <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
  </>
);
