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
  dsgRoutes,
  mediaMasterRoutes
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
import CommHubDropdown from "@/components/common/CommHubDropdown";
import VigilantDesignAgent from "@/components/common/VigilantDesignAgent";
import { OrientationApplier, OrientationFAB } from "@/components/common/OrientationToggle";
import IncomingCallModal from "@/components/voice/IncomingCallModal";
import BetaFeedbackButton from "@/components/common/BetaFeedbackButton";
import FriendEventToaster from "@/components/common/FriendEventToaster";
import PushForegroundBridge from "@/components/notifications/PushForegroundBridge";
import VipCrownBadge from "@/components/vip/VipCrownBadge";
import VipConcierge from "@/components/vip/VipConcierge";
import BreakInBanner from "@/components/media/BreakInBanner";
import NetworkPulseMiniWidget from "@/components/media/NetworkPulseMiniWidget";
import { LogDesignLesson } from "@/components/vibez/LogDesignLesson";
// v8 — International Globalization Protocol v2.0 (Globe FAB / Cultural Hub)
import GlobeFAB from "@/components/GlobeFAB";
// v8 — universal voice/video chat dock auto-mounted on every multiplayer URL
import GameVoiceDockMounter from "@/components/games/GameVoiceDockMounter";
import FloatingFoodMenu from "@/components/common/FloatingFoodMenu";
import PageActionStrip from "@/components/common/PageActionStrip";
import NotFound from "@/pages/NotFound";
import CinemaRoom from "@/pages/CinemaRoom";
import InRoomCommsLauncher from "@/components/common/InRoomCommsLauncher";
import RoomInfoCube from "@/components/common/RoomInfoCube";
import RoomVisitLogger from "@/components/common/RoomVisitLogger";
import RoleSwitcher from "@/components/common/RoleSwitcher";
import LandscapeRotateHint from "@/components/common/LandscapeRotateHint";

// Routes that own the entire viewport (h-[100dvh] + overflow-hidden) —
// e.g. card rooms, dice games, casino tables, full-screen tools. The
// inline PageActionStrip MUST NOT mount on these because it eats vertical
// space and pushes the game's bottom CTAs (Ante In / Roll / Bid Now) off
// the visible viewport. Founder bug report 2026-02-09: "Vibe Dice 654
// solo I can't make a bet, can't push a button, room is too compressed."
const FULLSCREEN_GAME_ROUTES = [
  "/spades", "/bid-whist", "/hearts", "/uno", "/euchre", "/pinochle",
  "/gin-rummy", "/rummy", "/war", "/crazy-eights", "/go-fish", "/baccarat",
  "/baccarat-aaa", "/blackjack", "/poker", "/three-card-poker",
  "/vibe-654", "/vibez-654",
  "/games/vibez-654",
  "/chess", "/checkers", "/connect4", "/practice/play",
  "/chess-hall", "/chess/blitz", "/chess/puzzle", "/chess/tournament", "/chess/multiplayer",
  "/sports-lounge", "/sportsbook",
  "/card-mp",  // multiplayer card rooms
  "/cinema-room",  // The Cinema Room — sync-watch viewer
  "/cyber-casino", "/games/cyber-casino", "/casino-war",
  "/lottery", "/dsg6",  // DSG 6 Quantum Vault (May 2026)
  "/underground-casino", "/underground",  // Private high-limit lounge
];

function useIsFullscreenGameRoute() {
  const location = useLocation();
  const p = location.pathname;
  return FULLSCREEN_GAME_ROUTES.some((r) => p === r || p.startsWith(r + "/"));
}

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

  // Founder directive 2026-02-09 — every protected page auto-renders the
  // inline PageActionStrip at the top of its content area. The strip
  // scrolls with the page (NEVER `position: fixed`) and sets
  // `body.dataset.chromeBarActive="1"` so all 8 legacy floating FABs
  // (Beta Feedback / Voice Mirror / Orientation / Globe / Fresh Drops /
  // Floating Food / etc.) hide their triggers via useCornerDockTrigger.
  //
  // EXCEPTION (founder bug fix 2026-05-09): full-viewport game rooms
  // (Vibe 654, Spades, Bid Whist, etc) use `h-[100dvh] + overflow-hidden`
  // so their bottom CTAs (Ante In / Roll / Bid Now) stay reachable. The
  // strip would push those CTAs off-screen, making the room "feel
  // compressed and non-functional" (founder report). Skip the strip on
  // those routes — the games already have their own RoomMenuBar.
  if (!isAuthenticated) return null;
  return <ProtectedRouteContent>{children}</ProtectedRouteContent>;
}

function ProtectedRouteContent({ children }) {
  const isFullscreenGame = useIsFullscreenGameRoute();

  // Founder bug fix 2026-05-09 — Voice Mirror and Floating Food were
  // leaking onto the Vibe 654 solo viewport even after we disabled the
  // strip itself. Toggle `chromebar:active` here so the legacy FABs
  // stay hidden via `useCornerDockTrigger`.
  useEffect(() => {
    if (!isFullscreenGame) return;
    document.body.dataset.chromeBarActive = "1";
    window.dispatchEvent(new CustomEvent("chromebar:active", { detail: true }));
    return () => {
      delete document.body.dataset.chromeBarActive;
      window.dispatchEvent(new CustomEvent("chromebar:active", { detail: false }));
    };
  }, [isFullscreenGame]);

  if (isFullscreenGame) {
    // Founder directive 2026-05-09 — every game/cinema room gets a
    // top-right "Chat & Video" pill via the global <GlobalCommsMounter />
    // higher up the tree. Inside ProtectedRoute we just render children
    // (the global mounter handles the pill for protected + unprotected
    // routes alike). No PageActionStrip in fullscreen rooms.
    return <>{children}</>;
  }
  return (
    <>
      <div className="px-4 pt-3 max-w-7xl mx-auto" data-testid="protected-route-action-strip">
        <PageActionStrip align="end" />
      </div>
      {children}
    </>
  );
}

// Global chromebar-active dispatcher — fires for ALL fullscreen game
// routes regardless of auth status. Replaces the previous version that
// only fired inside ProtectedRouteContent and missed unprotected
// routes like /games/cyber-casino root and /games/cyber-casino/roulette.
function ChromebarActiveDispatcher() {
  const isFullscreenGame = useIsFullscreenGameRoute();
  useEffect(() => {
    if (!isFullscreenGame) return;
    document.body.dataset.chromeBarActive = "1";
    window.dispatchEvent(new CustomEvent("chromebar:active", { detail: true }));
    return () => {
      delete document.body.dataset.chromeBarActive;
      window.dispatchEvent(new CustomEvent("chromebar:active", { detail: false }));
    };
  }, [isFullscreenGame]);
  return null;
}

// Global comms launcher mount — top-right Chat & Video pill appears on
// EVERY fullscreen game route, including unprotected ones like
// /games/cyber-casino. Replaces the previous ProtectedRouteContent-only
// mount that left the cyber-casino tree without comms (flagged by the
// 2026-05 launch-readiness sweep).
function GlobalCommsMounter() {
  const isFullscreenGame = useIsFullscreenGameRoute();
  if (!isFullscreenGame) return null;
  return (
    <>
      <InRoomCommsLauncher />
      <LandscapeRotateHint />
    </>
  );
}

// Main App Router
function AppRouter() {
  return (
    <>
      <ChromebarActiveDispatcher />
      <GlobalCommsMounter />
      <RoleSwitcher />
      <RoomInfoCube />
      <RoomVisitLogger />
      <FreshDropsLauncher />
      <WhatsNewBanner />
      <CommHubDropdown />
      <VigilantDesignAgent />
      <OrientationApplier />
      <OrientationFAB />
      <VoiceMirrorDock />
      <IncomingCallModal />
      <BetaFeedbackButton />
      <LogDesignLesson />
      <FriendEventToaster />
      <PushForegroundBridge />
      <VipCrownBadge />
      <VipConcierge />
      <BreakInBanner />
      <NetworkPulseMiniWidget />
      <GlobeFAB />
      <GameVoiceDockMounter />
      <FloatingFoodMenu />
      {/* Founder directive 2026-02-09 — chrome menu MUST be inline
          (scroll with the page, never sticky). Public Landing mounts
          its own <PageActionStrip /> under the WinnerTicker; every
          protected page gets one auto-mounted at the top of its
          content area inside ProtectedRoute. The legacy CornerDock
          (floating bottom-corner pop-out) and UnifiedChromeBar
          (floating top bar) are both DELETED — they were the exact
          regression the founder kept reporting. The 8 underlying FAB
          components stay mounted (they own their modals/panels) but
          their trigger buttons hide via `useCornerDockTrigger` once
          the strip dispatches `chromebar:active`. */}
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

        {/* Media Master ecosystem — DSG TV, Vibe Radio, DSG Music Group */}
        {mediaMasterRoutes(ProtectedRoute)}

        {/* Tombstone redirects — 3D Poker rooms deleted 2026-02-16 (founder
            directive). Send any cached bookmark to /games so users land on
            something useful instead of a blank chrome shell. */}
        <Route path="/poker-3d" element={<Navigate to="/games" replace />} />
        <Route path="/poker-css3d" element={<Navigate to="/games" replace />} />

        {/* The Cinema Room — public sync-watch (free legal content).
            DISTINCT from /dsg/memory-bank which is the founder's own
            user-content cinema. Lobby renders catalog + active rooms;
            /:roomId opens the synced player. */}
        <Route path="/cinema-room" element={<ProtectedRoute><CinemaRoom /></ProtectedRoute>} />
        <Route path="/cinema-room/:roomId" element={<ProtectedRoute><CinemaRoom /></ProtectedRoute>} />

        {/* Founder fix Feb 2026: replace the silent wildcard redirect with
            an honest 404 page so dead routes surface visibly instead of
            quietly bouncing to the landing. */}
        <Route path="*" element={<NotFound />} />
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
