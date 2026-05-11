import { Route } from "react-router-dom";
import FriendsPage from "@/pages/FriendsPage";
import FindFriends from "@/pages/FindFriends";
import FriendsQuiz from "@/pages/FriendsQuiz";
import GroupOutingPlanner from "@/pages/GroupOutingPlanner";
import MyVibezPage from "@/pages/MyVibezPage";
import CreateVibePage from "@/pages/CreateVibePage";
import LiveStreamPage from "@/pages/LiveStreamPage";
import ViewStreamPage from "@/pages/ViewStreamPage";
import BrowseStreamsPage from "@/pages/BrowseStreamsPage";
import VideoCallPage from "@/pages/VideoCallPage";
import { HouseViews } from "@/pages/HouseViews";
import Restaurants from "@/pages/Restaurants";
import RestaurantSubmit from "@/pages/RestaurantSubmit";
import RestaurantDetail from "@/pages/RestaurantDetail";
import RestaurantReview from "@/pages/RestaurantReview";
import AdminRestaurants from "@/pages/AdminRestaurants";
import HungryVibez from "@/pages/HungryVibez";
import VibeVenues from "@/pages/vibe-venues/VibeVenues";
import VibeVenuesHost from "@/pages/vibe-venues/VibeVenuesHost";
import VibeVenuesHostDashboard from "@/pages/vibe-venues/VibeVenuesHostDashboard";
import VibeVenuesArtisan from "@/pages/vibe-venues/VibeVenuesArtisan";
import VibeVenuesBookingDetail from "@/pages/vibe-venues/VibeVenuesBookingDetail";
import VibeVenuesArtisanDashboard from "@/pages/vibe-venues/VibeVenuesArtisanDashboard";
import VibeVenuesVenueDetail from "@/pages/vibe-venues/VibeVenuesVenueDetail";
import VibeVenuesDisputeAdmin from "@/pages/admin/VibeVenuesDisputeAdmin";
import FriendRequests from '@/pages/FriendRequests';
import Messaging from '@/pages/Messaging';
import GuildsClans from '@/pages/GuildsClans';
import FindPlayer2Page from '@/pages/FindPlayer2Page';
import MyVibezProfilePage from '@/pages/MyVibezProfilePage';

export const socialRoutes = (ProtectedRoute) => (
  <>
    {/* Friends */}
    <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
    <Route path="/find-friends" element={<ProtectedRoute><FindFriends /></ProtectedRoute>} />
    <Route path="/quiz/friends" element={<ProtectedRoute><FriendsQuiz /></ProtectedRoute>} />
    <Route path="/group-outing-planner" element={<ProtectedRoute><GroupOutingPlanner /></ProtectedRoute>} />
    
    {/* MY VIBEZ Content */}
    <Route path="/my-vibez" element={<ProtectedRoute><MyVibezPage /></ProtectedRoute>} />
    <Route path="/my-vibez/create" element={<ProtectedRoute><CreateVibePage /></ProtectedRoute>} />
    <Route path="/my-vibez/profile" element={<ProtectedRoute><MyVibezProfilePage /></ProtectedRoute>} />
    <Route path="/me" element={<ProtectedRoute><MyVibezProfilePage /></ProtectedRoute>} />

    {/* Find Your Player 2 — gaming partner discovery */}
    <Route path="/find-player-2" element={<ProtectedRoute><FindPlayer2Page /></ProtectedRoute>} />
    <Route path="/player2" element={<ProtectedRoute><FindPlayer2Page /></ProtectedRoute>} />
    
    {/* Live Streaming */}
    <Route path="/live-stream" element={<ProtectedRoute><LiveStreamPage /></ProtectedRoute>} />
    <Route path="/view-stream/:streamId" element={<ProtectedRoute><ViewStreamPage /></ProtectedRoute>} />
    <Route path="/browse-streams" element={<ProtectedRoute><BrowseStreamsPage /></ProtectedRoute>} />
    
    {/* Video Calls */}
    <Route path="/video-call/:callId" element={<ProtectedRoute><VideoCallPage /></ProtectedRoute>} />
    
    {/* House Views */}
    <Route path="/house-views" element={<ProtectedRoute><HouseViews /></ProtectedRoute>} />
    
    {/* Restaurants — Date Spot Finder + Hungry Vibez utility rooms (v3 spec) */}
    <Route path="/restaurants" element={<ProtectedRoute><Restaurants /></ProtectedRoute>} />
    <Route path="/date-spot-finder" element={<ProtectedRoute><Restaurants /></ProtectedRoute>} />
    <Route path="/hungry-vibez" element={<ProtectedRoute><HungryVibez /></ProtectedRoute>} />

    {/* Vibe Venues — hourly-housing + Vibe Artisan utility room (Master Lock-In v1) */}
    <Route path="/vibe-venues" element={<ProtectedRoute><VibeVenues /></ProtectedRoute>} />
    <Route path="/vibe-venues/host" element={<ProtectedRoute><VibeVenuesHost /></ProtectedRoute>} />
    <Route path="/vibe-venues/host-dashboard" element={<ProtectedRoute><VibeVenuesHostDashboard /></ProtectedRoute>} />
    <Route path="/vibe-venues/artisan" element={<ProtectedRoute><VibeVenuesArtisan /></ProtectedRoute>} />
    <Route path="/vibe-venues/booking/:bookingId" element={<ProtectedRoute><VibeVenuesBookingDetail /></ProtectedRoute>} />
    <Route path="/vibe-venues/artisan/dashboard" element={<ProtectedRoute><VibeVenuesArtisanDashboard /></ProtectedRoute>} />
    <Route path="/vibe-venues/:venueId" element={<ProtectedRoute><VibeVenuesVenueDetail /></ProtectedRoute>} />
    <Route path="/vibe-vault-admin/disputes" element={<ProtectedRoute><VibeVenuesDisputeAdmin /></ProtectedRoute>} />
    <Route path="/restaurants/submit" element={<ProtectedRoute><RestaurantSubmit /></ProtectedRoute>} />
    <Route path="/restaurants/:restaurantId" element={<ProtectedRoute><RestaurantDetail /></ProtectedRoute>} />
    <Route path="/restaurants/:restaurantId/review" element={<ProtectedRoute><RestaurantReview /></ProtectedRoute>} />
    <Route path="/admin/restaurants" element={<ProtectedRoute><AdminRestaurants /></ProtectedRoute>} />
    
    {/* Social Features */}
    <Route 
      path="/friend-requests" 
      element={<ProtectedRoute><FriendRequests /></ProtectedRoute>} 
    />
    <Route 
      path="/messages" 
      element={<ProtectedRoute><Messaging /></ProtectedRoute>} 
    />
    <Route 
      path="/guilds" 
      element={<ProtectedRoute><GuildsClans /></ProtectedRoute>} 
    />
  </>
);
