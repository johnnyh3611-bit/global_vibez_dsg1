import { Route } from 'react-router-dom';
import LiveStreamingPage from '@/pages/LiveStreamingPage';
import StreamerDashboard from '@/pages/StreamerDashboard';
import StreamerStudio from '@/pages/streaming/StreamerStudio';
import LiveNowWall from '@/pages/streaming/LiveNowWall';
import WatchRoom from '@/pages/streaming/WatchRoom';

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
    <Route
      path="/streamer/studio"
      element={
        <ProtectedRoute>
          <StreamerStudio />
        </ProtectedRoute>
      }
    />
    {/* Public discovery surface — no auth gate, so search engines can
        index it and word-of-mouth shares load instantly. */}
    <Route path="/streams/live" element={<LiveNowWall />} />
    <Route path="/streams/watch/:inputId" element={<WatchRoom />} />
  </>
);
