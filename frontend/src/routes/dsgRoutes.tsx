/**
 * DSG Routes — v6.5 / v7 OMNI Blueprint frontend pages.
 *
 * Mounts under root paths:
 *   /dsg/music-group        — Pillar 01 hub (Beat Vault, Battles, Collab, Totem)
 *   /dsg/vibe-tv            — Pillar 02 hub (Live, Episodes, Cinema, Scheduler)
 *   /dsg/vibe-tv-scheduler  — Existing scheduler component
 *   /dsg/vigilant-room      — Vigilant Matchmaking Room (98% Synergy)
 *   /dsg/matchmaking        — Alias for /dsg/vigilant-room (dashboard CTA target)
 *   /dsg/beat-vault         — Beat Vault marketplace + auctions
 *   /dsg/memory-bank        — Memory Bank cinema marketplace
 *   /vibe-tv                — Top-level Vibe TV redirect → /dsg/vibe-tv
 */
import { Route, Navigate } from "react-router-dom";
import VigilantMatchmakingRoom from "@/pages/dsg/VigilantMatchmakingRoom";
import BeatVaultMarketplace from "@/pages/dsg/BeatVaultMarketplace";
import MemoryBankMarketplace from "@/pages/dsg/MemoryBankMarketplace";
import DSGMusicGroupHub from "@/pages/dsg/DSGMusicGroupHub";
import VibeTvHub from "@/pages/dsg/VibeTvHub";
import VibeTvChannelPlayer from "@/pages/dsg/VibeTvChannelPlayer";
import VibeTvScheduler from "@/pages/dsg/VibeTvScheduler";
import MemoryBankCinemaRoom from "@/pages/dsg/MemoryBankCinemaRoom";

// Pattern matches gamesRoutes — accepts ProtectedRoute so all DSG pages
// require an authenticated user.
export const dsgRoutes = (ProtectedRoute) => (
  <>
    <Route path="/dsg/music-group" element={<ProtectedRoute><DSGMusicGroupHub /></ProtectedRoute>} />
    <Route path="/dsg/vibe-tv" element={<ProtectedRoute><VibeTvHub /></ProtectedRoute>} />
    <Route path="/dsg/vibe-tv-scheduler" element={<ProtectedRoute><VibeTvScheduler /></ProtectedRoute>} />
    {/* Top-level convenience aliases — match dashboard tile paths. */}
    <Route path="/vibe-tv" element={<ProtectedRoute><VibeTvHub /></ProtectedRoute>} />
    <Route path="/vibe-tv/main" element={<ProtectedRoute><VibeTvChannelPlayer /></ProtectedRoute>} />
    <Route path="/vibe-tv/episodes" element={<ProtectedRoute><VibeTvHub /></ProtectedRoute>} />
    <Route path="/dsg/vigilant-room" element={<ProtectedRoute><VigilantMatchmakingRoom /></ProtectedRoute>} />
    {/* Alias so the dashboard tile path /dsg/matchmaking lands on the
        canonical Vigilant room rather than 404. */}
    <Route path="/dsg/matchmaking" element={<ProtectedRoute><VigilantMatchmakingRoom /></ProtectedRoute>} />
    <Route path="/dsg/beat-vault" element={<ProtectedRoute><BeatVaultMarketplace /></ProtectedRoute>} />
    <Route path="/dsg/memory-bank" element={<ProtectedRoute><MemoryBankMarketplace /></ProtectedRoute>} />
    {/* Sync-watch cinema room — supports both lobby and per-room URLs. */}
    <Route path="/dsg/memory-bank/room/:roomId" element={<ProtectedRoute><MemoryBankCinemaRoom /></ProtectedRoute>} />
    <Route path="/dsg/memory-bank/room/:roomId/:contentId" element={<ProtectedRoute><MemoryBankCinemaRoom /></ProtectedRoute>} />
  </>
);

export default dsgRoutes;
