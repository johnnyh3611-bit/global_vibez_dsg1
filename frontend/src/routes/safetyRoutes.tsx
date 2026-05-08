import { Route } from "react-router-dom";
import Safety from "@/pages/Safety";
import AgeVerification from "@/pages/AgeVerification";
import VerificationStatus from "@/pages/VerificationStatus";
import IDVerificationUpload from "@/pages/IDVerificationUpload";
import BlockedUsersPage from "@/pages/BlockedUsersPage";

export const safetyRoutes = (ProtectedRoute) => (
  <>
    <Route path="/safety" element={<ProtectedRoute><Safety /></ProtectedRoute>} />
    <Route path="/age-verification" element={<ProtectedRoute><AgeVerification /></ProtectedRoute>} />
    <Route path="/verification/status" element={<ProtectedRoute><VerificationStatus /></ProtectedRoute>} />
    <Route path="/verification-status" element={<ProtectedRoute><VerificationStatus /></ProtectedRoute>} />
    <Route path="/verification/upload" element={<ProtectedRoute><IDVerificationUpload /></ProtectedRoute>} />
    <Route path="/blocked-users" element={<ProtectedRoute><BlockedUsersPage /></ProtectedRoute>} />
  </>
);
