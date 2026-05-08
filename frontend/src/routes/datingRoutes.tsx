import { Route } from "react-router-dom";
import Dashboard from "@/pages/DashboardNew";
import DiscoverPage from "@/pages/DiscoverPage";
import Matches from "@/pages/Matches";
import Messages from "@/pages/Messages";
import Chat from "@/pages/Chat";
import Categories from "@/pages/Categories";
import DiscoverByCategory from "@/pages/DiscoverByCategory";
import SpeedDating from "@/pages/SpeedDating";
import SpeedDatingRoom from "@/pages/SpeedDatingRoom";
import SpeedDatingLobby from "@/pages/SpeedDatingLobby";
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

export const datingRoutes = (ProtectedRoute) => (
  <>
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
    <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
    <Route path="/discover-category/:categoryType/:categoryId" element={<ProtectedRoute><DiscoverByCategory /></ProtectedRoute>} />
    <Route path="/speed-dating" element={<ProtectedRoute><SpeedDating /></ProtectedRoute>} />
    <Route path="/speed-dating/room" element={<ProtectedRoute><SpeedDatingRoom /></ProtectedRoute>} />
    <Route path="/speed-dating/lobby" element={<ProtectedRoute><SpeedDatingLobby /></ProtectedRoute>} />
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
