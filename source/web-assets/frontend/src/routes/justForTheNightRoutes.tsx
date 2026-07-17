import { Route } from "react-router-dom";
import type { ReactNode } from "react";
import RoomDiscovery from "@/pages/just-for-the-night/RoomDiscovery";
import RoomPage from "@/pages/just-for-the-night/RoomPage";
import CreatorDashboard from "@/pages/just-for-the-night/CreatorDashboard";
import CreateRoom from "@/pages/just-for-the-night/CreateRoom";
import IdVerificationGate from "@/components/age_verification/IdVerificationGate";

const withIdGate = (surfaceName: string, node: ReactNode) => (
  <IdVerificationGate surfaceName={surfaceName}>{node}</IdVerificationGate>
);

export const justForTheNightRoutes = (ProtectedRoute) => (
  <>
    <Route
      path="/just-for-the-night"
      element={<ProtectedRoute>{withIdGate("Just For The Night", <RoomDiscovery />)}</ProtectedRoute>}
    />
    <Route
      path="/just-for-the-night/room/:roomId"
      element={<ProtectedRoute>{withIdGate("Just For The Night room", <RoomPage />)}</ProtectedRoute>}
    />
    <Route
      path="/just-for-the-night/dashboard"
      element={<ProtectedRoute>{withIdGate("Just For The Night dashboard", <CreatorDashboard />)}</ProtectedRoute>}
    />
    <Route
      path="/just-for-the-night/create"
      element={<ProtectedRoute>{withIdGate("Create JFTN room", <CreateRoom />)}</ProtectedRoute>}
    />
  </>
);
