/**
 * Media Master ecosystem routes — DSG TV, Vibe Radio, DSG Music Group.
 * Mounted from App.js alongside the other route blocks.
 */
import { Route } from 'react-router-dom';
import MediaMasterHub from '@/pages/MediaMasterHub';
import DsgTvChannelPage from '@/pages/DsgTvChannelPage';
import VibeRadioStationPage from '@/pages/VibeRadioStationPage';
import MusicGroupPage from '@/pages/MusicGroupPage';

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
  </>
);
