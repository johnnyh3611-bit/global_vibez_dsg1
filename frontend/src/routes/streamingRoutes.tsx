import { Route } from 'react-router-dom';
import LiveStreamingPage from '@/pages/LiveStreamingPage';
import StreamerDashboard from '@/pages/StreamerDashboard';

export const streamingRoutes = (ProtectedRoute) => (
  <>
    <Route 
      path="/streams" 
      element={
        <ProtectedRoute>
          <LiveStreamingPage />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/my-streams" 
      element={
        <ProtectedRoute>
          <StreamerDashboard />
        </ProtectedRoute>
      } 
    />
  </>
);
