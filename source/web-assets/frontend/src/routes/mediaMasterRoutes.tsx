/**
 * Media Master ecosystem routes — DSG TV, Vibe Radio, DSG Music Group.
 * Mounted from App.js alongside the other route blocks.
 */
import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import MediaMasterHub from '@/pages/MediaMasterHub';
import DsgTvChannelPage from '@/pages/DsgTvChannelPage';
import VibeRadioStationPage from '@/pages/VibeRadioStationPage';
import MusicGroupPage from '@/pages/MusicGroupPage';
import MediaMasterPulsePage from '@/pages/MediaMasterPulsePage';
import BroadcastDirectorPage from '@/pages/BroadcastDirectorPage';
import PageLoader from '@/components/common/PageLoader';

// Lazy: keep createXRStore / @react-three/xr off the critical path.
const VrTvLounge = lazy(() => import('@/pages/VrTvLounge'));

export const mediaMasterRoutes = (ProtectedRoute) => (
  <>
    <Route
      path="/media-master"
      element={
        <ProtectedRoute>
          <MediaMasterHub />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dsg-tv/:channelId"
      element={
        <ProtectedRoute>
          <DsgTvChannelPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/vr-tv/:channelId"
      element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader message="Loading VR lounge…" />}>
            <VrTvLounge />
          </Suspense>
        </ProtectedRoute>
      }
    />
    <Route
      path="/vibe-radio/:stationId"
      element={
        <ProtectedRoute>
          <VibeRadioStationPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/music-group"
      element={
        <ProtectedRoute>
          <MusicGroupPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/media-master-pulse"
      element={
        <ProtectedRoute>
          <MediaMasterPulsePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard/streamer/broadcast-director"
      element={
        <ProtectedRoute>
          <BroadcastDirectorPage />
        </ProtectedRoute>
      }
    />
  </>
);
