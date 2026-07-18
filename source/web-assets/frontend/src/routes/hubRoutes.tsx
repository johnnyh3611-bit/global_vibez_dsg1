import { Navigate, Route } from "react-router-dom";
import HubDashboard from "@/pages/hubs/HubDashboard";

export const hubRoutes = (ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) => (
  <>
    <Route
      path="/hub/:hubId"
      element={
        <ProtectedRoute>
          <HubDashboard />
        </ProtectedRoute>
      }
    />
    <Route path="/viberise" element={<Navigate to="/hub/viberise" replace />} />
    <Route path="/vibe-rise" element={<Navigate to="/hub/viberise" replace />} />
    <Route path="/vibe-vineyards" element={<Navigate to="/hub/vineyards" replace />} />
    <Route path="/hubs" element={<Navigate to="/hub/vibe" replace />} />
  </>
);
