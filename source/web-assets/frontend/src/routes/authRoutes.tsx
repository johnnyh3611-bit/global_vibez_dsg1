import { Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import LandingNeonGaming from "@/pages/LandingNeonGaming";
import SignupPage from "@/pages/SignupPage";
import LoginPage from "@/pages/LoginPage";
import AuthCallback from "@/pages/AuthCallback";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import VibeStakesPortal from "@/pages/VibeStakesPortal";
import BetaTester from "@/pages/BetaTester";

export const authRoutes = (
  <>
    <Route path="/" element={<LandingNeonGaming />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/auth-callback" element={<AuthCallback />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    {/* Public privacy policy — used for Uber, Privy and Google API consent screens */}
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
    {/* Vibe Stakes — profit-sharing program (NOT a security). */}
    <Route path="/vibe-stakes" element={<VibeStakesPortal />} />
    <Route path="/profit-share" element={<VibeStakesPortal />} />
    {/* /equity is now owned by the new Equity Master page (Feb 2026 PDF —
        Crewmate Architecture). Vibe Stakes remains at /vibe-stakes,
        /profit-share, and /invest. */}
    <Route path="/invest" element={<VibeStakesPortal />} />
    {/* Public Beta Tester waitlist (Feb 2026). */}
    <Route path="/beta-tester" element={<BetaTester />} />
    <Route path="/beta" element={<BetaTester />} />
  </>
);
