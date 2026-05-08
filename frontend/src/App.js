import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, Suspense } from "react";
import "@/App.css";

// Install global guard FIRST — before any third-party SDK imports run —
// so harmless Privy/Firebase analytics throws can't break the page.
import { installGlobalErrorGuard } from "@/utils/errorGuard";
installGlobalErrorGuard();

// Bulletproof DOM-walking translator (replaces the Google Translate
// widget which kept failing on production). Listens for the same
// `gv:locale-changed` event the Cultural Hub modal already dispatches.
import { installDomTranslator } from "@/utils/domTranslator";
installDomTranslator();

// Import modular routes
import {
  authRoutes,
  datingRoutes,
  gamesRoutes,
  ridesRoutes,
  socialRoutes,
  adminRoutes,
  safetyRoutes,
  miscRoutes,
  monetizationRoutes,
  streamingRoutes,
  justForTheNightRoutes,
  adminVaultRoutes,
  dsgRoutes
} from "@/routes";

// Import notification components
import { NotificationProvider } from "@/contexts/NotificationContext";
import { VoiceMirrorProvider } from "@/contexts/VoiceMirrorContext";
import SolanaWalletProvider from "@/components/web3/SolanaWalletProvider";
import LedgerSignerProvider from "@/components/web3/LedgerSignerProvider";
import PhantomConnectProvider from "@/components/web3/PhantomConnectProvider";
import PrivyAuthProvider from "@/components/web3/PrivyAuthProvider";

// Import production polish components
import ErrorBoundary from "@/components/common/ErrorBoundary";
import PageLoader from "@/components/common/PageLoader";
import FreshDropsLauncher from "@/components/common/FreshDropsLauncher";
import WhatsNewBanner from "@/components/common/WhatsNewBanner";
import VoiceMirrorDock from "@/components/common/VoiceMirrorDock";
import IncomingCallModal from "@/components/voice/IncomingCallModal";
import BetaFeedbackButton from "@/components/common/BetaFeedbackButton";
import FriendEventToaster from "@/components/common/FriendEventToaster";
import { LogDesignLesson } from "@/components/vibez/LogDesignLesson";
// v8 — International Globalization Protocol v2.0 (Globe FAB / Cultural Hub)
import GlobeFAB from "@/components/GlobeFAB";
// v8 — universal voice/video chat dock auto-mounted on every multiplayer URL
import GameVoiceDockMounter from "@/components/games/GameVoiceDockMounter";

// Import version manager for cache busting
import { startVersionMonitoring } from "@/utils/versionManager";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ProtectedRoute Component
function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async (retryCount = 0) => {
      try {
        // ✅ FIX (race condition): if a login just completed, the redirect to
        // /dashboard can fire BEFORE localStorage.setItem flushes (especially
        // under StrictMode double-invocation). Retry up to 2× with a 100ms
        // gap so we don't wipe a token that's about to land.
        const token = localStorage.getItem('auth_token');
        if (!token && retryCount < 2) {
          await new Promise((r) => setTimeout(r, 100));
          if (cancelled) return;
          return checkAuth(retryCount + 1);
        }

        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers,
        });

        if (cancelled) return;
        setIsAuthenticated(res.ok);
        if (!res.ok && location.pathname !== "/") {
          // Clear invalid token
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          navigate("/login", { replace: true });
        }
      } catch (error) {
        if (cancelled) return;
        // If this fetch was aborted because the page is unloading/reloading
        // (e.g. versionManager triggered window.location.reload), do NOT
        // redirect to /login — the new page load will re-run this check.
        // Browsers throw TypeError/AbortError when a request is cancelled
        // mid-flight by navigation. Bouncing to /login here was eating the
        // demo-login flow.
        if (error?.name === 'AbortError' || document.visibilityState === 'hidden') {
          return;
        }
        setIsAuthenticated(false);
        navigate("/login", { replace: true });
      }
    };

    checkAuth();
    return () => { cancelled = true; };
  }, [navigate, location.pathname]);

  if (isAuthenticated === null) {
    return <PageLoader message="Authenticating..." />;
  }

  return isAuthenticated ? children : null;
}

// Main App Router
function AppRouter() {
  return (
    <>
      <FreshDropsLauncher />
      <WhatsNewBanner />
      <VoiceMirrorDock />
      <IncomingCallModal />
      <BetaFeedbackButton />
      <LogDesignLesson />
      <FriendEventToaster />
      <GlobeFAB />
      <GameVoiceDockMounter />
      <Routes>
        {/* Public Routes */}
        {authRoutes}
        
        {/* Dating & Social Routes */}
        {datingRoutes(ProtectedRoute)}
        
        {/* Games Routes */}
        {gamesRoutes(ProtectedRoute)}
        
        {/* Vibe Ridez Routes */}
        {ridesRoutes(ProtectedRoute)}
        
        {/* Social & Content Routes */}
        {socialRoutes(ProtectedRoute)}
        
        {/* Admin Routes */}
        {adminRoutes(ProtectedRoute)}
        
        {/* Safety & Trust Routes */}
        {safetyRoutes(ProtectedRoute)}
        
        {/* Miscellaneous Routes */}
        {miscRoutes(ProtectedRoute)}
        
        {/* Monetization Routes */}
        {monetizationRoutes(ProtectedRoute)}
        
        {/* Streaming Routes */}
        {streamingRoutes(ProtectedRoute)}
        
        {/* Just for the Night Routes */}
        {justForTheNightRoutes(ProtectedRoute)}
        
        {/* Admin Vault Routes (God Mode) */}
        {adminVaultRoutes()}

        {/* DSG v6.5 / v7 Routes — Vigilant Matchmaking, Beat Vault, Memory Bank */}
        {dsgRoutes(ProtectedRoute)}

        {/* Tombstone redirects — 3D Poker rooms deleted 2026-02-16 (founder
            directive). Send any cached bookmark to /games so users land on
            something useful instead of a blank chrome shell. */}
        <Route path="/poker-3d" element={<Navigate to="/games" replace />} />
        <Route path="/poker-css3d" element={<Navigate to="/games" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

// Main App Component
export default function App() {
  // Start version monitoring on app mount
  useEffect(() => {
    startVersionMonitoring();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NotificationProvider>
          <VoiceMirrorProvider>
            <PrivyAuthProvider>
              <PhantomConnectProvider>
                <SolanaWalletProvider>
                  <LedgerSignerProvider>
                    <Suspense fallback={<PageLoader message="Loading..." />}>
                      <AppRouter />
                    </Suspense>
                  </LedgerSignerProvider>
                </SolanaWalletProvider>
              </PhantomConnectProvider>
            </PrivyAuthProvider>
          </VoiceMirrorProvider>
        </NotificationProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
