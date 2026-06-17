import { Route } from "react-router-dom";
import RoomDiscovery from "@/pages/just-for-the-night/RoomDiscovery";
import RoomPage from "@/pages/just-for-the-night/RoomPage";
import CreatorDashboard from "@/pages/just-for-the-night/CreatorDashboard";
import CreateRoom from "@/pages/just-for-the-night/CreateRoom";

export const justForTheNightRoutes = (ProtectedRoute) => (
  <>
    <Route 
      path="/just-for-the-night" 
      element={<ProtectedRoute><RoomDiscovery /></ProtectedRoute>} 
    />
    <Route 
      path="/just-for-the-night/room/:roomId" 
      element={<ProtectedRoute><RoomPage /></ProtectedRoute>} 
    />
    <Route 
      path="/just-for-the-night/dashboard" 
      element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} 
    />
    <Route 
      path="/just-for-the-night/create" 
      element={<ProtectedRoute><CreateRoom /></ProtectedRoute>} 
    />
  </>
);
