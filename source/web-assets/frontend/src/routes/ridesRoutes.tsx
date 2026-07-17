import { Route, Navigate } from "react-router-dom";
import RidesLanding from "@/pages/RidesLanding";
import RideBooking from "@/pages/RideBooking";
import RideIntegration from "@/pages/RideIntegration";
import RideHistory from "@/pages/RideHistory";
import DriverRegistration from "@/pages/DriverRegistration";
import SafeRideTracking from "@/pages/SafeRideTracking";
import SafetySettings from "@/pages/SafetySettings";
import DriverLicenseVerification from "@/pages/DriverLicenseVerification";
import DriverVerificationStatus from "@/pages/DriverVerificationStatus";
import AdminDriverVerification from "@/pages/AdminDriverVerification";
import InsuranceVerification from "@/pages/InsuranceVerification";
import InsuranceVerificationStatus from "@/pages/InsuranceVerificationStatus";
import AdminInsuranceVerification from "@/pages/AdminInsuranceVerification";
import DriverComplianceGate from "@/components/age_verification/DriverComplianceGate";
import IdVerificationGate from "@/components/age_verification/IdVerificationGate";

// Vibe Ridez - New Ride-Sharing Platform
import VibeRidezHome from "@/pages/VibeRidez/VibeRidezHome";
import VibeDriverRegistration from "@/pages/VibeRidez/DriverRegistration";
import VibeDriverDashboard from "@/pages/VibeRidez/DriverDashboard";
import DriverDispatch from "@/pages/VibeRidez/DriverDispatch";
import RiderTracking from "@/pages/VibeRidez/RiderTracking";
import BecomeDriverLanding from "@/pages/VibeRidez/BecomeDriverLanding";
import PostRide from "@/pages/VibeRidez/PostRide";
import RideSearch from "@/pages/VibeRidez/RideSearch";
import PaymentSuccess from "@/pages/VibeRidez/PaymentSuccess";
import PaymentCancel from "@/pages/VibeRidez/PaymentCancel";
import DriverEarnings from "@/pages/VibeRidez/DriverEarnings";
import DriverDashcam from "@/pages/VibeRidez/DriverDashcam";
import LivePOVViewer from "@/pages/VibeRidez/LivePOVViewer";
import DriverWalletSetup from "@/pages/VibeRidez/DriverWalletSetup";
import ELDDashboard from "@/pages/VibeRidez/ELDDashboard";
import TripTracking from "@/pages/VibeRidez/TripTracking";

export const ridesRoutes = (ProtectedRoute) => (
  <>
    {/* Legacy Rides Routes */}
    <Route path="/rides" element={<ProtectedRoute><RideIntegration /></ProtectedRoute>} />
    <Route path="/rides/landing" element={<RidesLanding />} />
    <Route path="/ride/book" element={<ProtectedRoute><RideBooking /></ProtectedRoute>} />
    <Route path="/rides/history" element={<ProtectedRoute><RideHistory /></ProtectedRoute>} />
    <Route path="/ride/track/:rideId" element={<ProtectedRoute><SafeRideTracking /></ProtectedRoute>} />
    <Route path="/rides/safety-settings" element={<ProtectedRoute><SafetySettings /></ProtectedRoute>} />
    <Route path="/driver/register" element={<ProtectedRoute><DriverRegistration /></ProtectedRoute>} />
    {/* 2026-05-12 fix: legacy /driver/dashboard hung indefinitely on
        'Loading driver dashboard...' for authenticated users (the old
        DriverDashboard.tsx awaited a fetch that never resolved). Redirect
        to the working /vibe-ridez/driver-dashboard so legacy bookmarks +
        in-app links resolve cleanly. */}
    <Route path="/driver/dashboard" element={<Navigate to="/vibe-ridez/driver-dashboard" replace />} />
    <Route path="/driver-registration" element={<ProtectedRoute><DriverRegistration /></ProtectedRoute>} />
    <Route path="/driver-license-verification" element={<ProtectedRoute><IdVerificationGate surfaceName="driver license verification"><DriverLicenseVerification /></IdVerificationGate></ProtectedRoute>} />
    <Route path="/driver-verification-status" element={<ProtectedRoute><DriverVerificationStatus /></ProtectedRoute>} />
    <Route path="/admin-driver-verification" element={<ProtectedRoute><AdminDriverVerification /></ProtectedRoute>} />
    <Route path="/insurance-verification" element={<ProtectedRoute><InsuranceVerification /></ProtectedRoute>} />
    <Route path="/insurance-verification/status" element={<ProtectedRoute><InsuranceVerificationStatus /></ProtectedRoute>} />
    <Route path="/admin-insurance-verification" element={<ProtectedRoute><AdminInsuranceVerification /></ProtectedRoute>} />
    <Route path="/admin/insurance" element={<ProtectedRoute><AdminInsuranceVerification /></ProtectedRoute>} />

    {/* Vibe Ridez - New Ride-Sharing Platform */}
    <Route path="/vibe-ridez" element={<ProtectedRoute><VibeRidezHome /></ProtectedRoute>} />
    <Route path="/become-a-driver" element={<BecomeDriverLanding />} />
    <Route path="/vibe-ridez/become-a-driver" element={<BecomeDriverLanding />} />
    <Route path="/vibe-ridez/register" element={<ProtectedRoute><IdVerificationGate surfaceName="driver registration"><VibeDriverRegistration /></IdVerificationGate></ProtectedRoute>} />
    <Route path="/vibe-ridez/search" element={<ProtectedRoute><RideSearch /></ProtectedRoute>} />
    <Route path="/vibe-ridez/driver-registration" element={<ProtectedRoute><IdVerificationGate surfaceName="driver registration"><VibeDriverRegistration /></IdVerificationGate></ProtectedRoute>} />
    <Route path="/vibe-ridez/driver-dashboard" element={<ProtectedRoute><DriverComplianceGate surfaceName="driver dashboard"><VibeDriverDashboard /></DriverComplianceGate></ProtectedRoute>} />
    <Route path="/vibe-ridez/dispatch" element={<ProtectedRoute><DriverComplianceGate surfaceName="driver dispatch"><DriverDispatch /></DriverComplianceGate></ProtectedRoute>} />
    <Route path="/vibe-ridez/track" element={<ProtectedRoute><RiderTracking /></ProtectedRoute>} />
    <Route path="/driver" element={<ProtectedRoute><DriverComplianceGate surfaceName="driver dispatch"><DriverDispatch /></DriverComplianceGate></ProtectedRoute>} />
    <Route path="/vibe-ridez/post-ride" element={<ProtectedRoute><DriverComplianceGate surfaceName="posting rides"><PostRide /></DriverComplianceGate></ProtectedRoute>} />
    <Route path="/vibe-ridez/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
    <Route path="/vibe-ridez/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />

    {/* VibeRidez fare splitter + WebRTC POV (May 2026) */}
    <Route path="/driver/earnings" element={<ProtectedRoute><DriverEarnings /></ProtectedRoute>} />
    <Route path="/driver/wallet" element={<ProtectedRoute><DriverWalletSetup /></ProtectedRoute>} />
    <Route path="/driver/dashcam/:rideId" element={<ProtectedRoute><DriverDashcam /></ProtectedRoute>} />
    <Route path="/live-pov/:rideId" element={<ProtectedRoute><LivePOVViewer /></ProtectedRoute>} />

    {/* ELD / Fleet Tracking */}
    <Route path="/vibe-ridez/eld" element={<ProtectedRoute><ELDDashboard /></ProtectedRoute>} />
    <Route path="/vibe-ridez/eld/track/:tripId" element={<ProtectedRoute><TripTracking /></ProtectedRoute>} />
  </>
);
