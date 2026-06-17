/**
 * MobileBottomNav — Sticky bottom-tab navigator for phone-class
 * viewports. Only renders when window width < 768px (Tailwind md
 * breakpoint). Lives at the App shell layer so every protected
 * route gets it for free.
 *
 * Six tabs: Home · Vibez 654 · Plex · Studio · Explore · Profile
 * Active tab highlighted in fuchsia. Active route detected from
 * useLocation, so deep-linking + browser back keep state aligned.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Dice6, Sparkles, Mic2, Compass, User,
} from 'lucide-react';

const TABS = [
  { key: 'home', route: '/dashboard', label: 'Home', Icon: Home },
  { key: 'vibe-654', route: '/vibe-654-hall', label: '654', Icon: Dice6 },
  { key: 'plex', route: '/plex', label: 'Plex', Icon: Sparkles },
  { key: 'studio', route: '/artist/dashboard', label: 'Studio', Icon: Mic2 },
  { key: 'explore', route: '/explore', label: 'Explore', Icon: Compass },
  { key: 'profile', route: '/profile/edit', label: 'Me', Icon: User },
];

function useIsMobile(): boolean {
  const [is, setIs] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const onResize = () => setIs(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return is;
}

const HIDDEN_ROUTES = ['/', '/auth', '/login', '/signup'];

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (!isMobile) return null;
  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  const isActive = (route: string) => {
    if (route === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname === route || location.pathname.startsWith(`${route}/`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-black/85 backdrop-blur-xl border-t border-fuchsia-400/30 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="mobile-bottom-nav"
    >
      <div className="grid grid-cols-6">
        {TABS.map(({ key, route, label, Icon }) => {
          const active = isActive(route);
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(route)}
              data-testid={`mobile-nav-${key}`}
              className={`flex flex-col items-center justify-center py-2 transition-colors ${
                active
                  ? 'text-fuchsia-300'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'drop-shadow-[0_0_8px_rgba(232,121,249,0.6)]' : ''}`} />
              <span className="text-[9px] uppercase tracking-widest font-bold mt-0.5">
                {label}
              </span>
              {active && (
                <span className="absolute top-0 w-8 h-0.5 bg-fuchsia-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
