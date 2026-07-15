import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FULLSCREEN_GAME_ROUTES } from '@/hooks/useIsFullscreenGameRoute';
import RoomCommsDock from './RoomCommsDock';

// Regexes for non-fullscreen social / dating / streaming / tournament rooms.
const SOCIAL_ROOM_PATTERNS: RegExp[] = [
  // Social / dating
  /^\/(dating|speed-dating|vr-dating|table-for-two|private-suites|just-for-the-night)(?:\/|$)/,
  // Streaming / co-watch
  /^\/(free-tv|dsg-tv|vibe-tv|cinema-room|memory-bank)(?:\/|$)/,
  // Matchmaking / events
  /^\/(matchmaking|beat-vault|vibe-coliseum|vibe-ridez\/live-pov)(?:\/|$)/,
  // Tournaments
  /^\/(friends-tournaments|couples-tournaments)(?:\/|$)/,
  // HTTP / socket multiplayer routers
  /^\/(multiplayer|http-multiplayer)\/[\w-]+\/[\w-]+(?:\/|$)/,
  /^\/(multiplayer-uno|card-mp-room)(?:\/|$)/,
  // Vibez 654 room variants
  /^\/vibez-654\/[\w-]+(?:\/|$)/,
];

const GAME_LABEL_OVERRIDES: Record<string, string> = {
  'spades': 'Spades',
  'hearts': 'Hearts',
  'poker': 'Poker',
  'blackjack': 'Blackjack',
  'uno': 'UNO',
  'chess': 'Chess',
  'checkers': 'Checkers',
  'connect4': 'Connect 4',
  'baccarat': 'Baccarat',
  'dating': 'Dating',
  'speed-dating': 'Speed Dating',
  'vr-dating': 'VR Dating',
  'free-tv': 'Free TV',
  'vibe-tv': 'Vibe TV',
  'dsg-tv': 'DSG TV',
  'cinema-room': 'Cinema',
  'memory-bank': 'Memory Bank',
  'matchmaking': 'Matchmaking',
  'vibe-coliseum': 'Coliseum',
  'friends-tournaments': 'Tournaments',
  'couples-tournaments': 'Tournaments',
  'multiplayer': 'Multiplayer',
  'http-multiplayer': 'Multiplayer',
};

// Solo/AI-only fullscreen paths that should not prompt for room video.
const EXCLUDED_PREFIXES = ['/practice/play'];

function isRoomRoute(pathname: string): boolean {
  if (pathname === '/') return false;
  if (EXCLUDED_PREFIXES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return false;
  }
  if (FULLSCREEN_GAME_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    return true;
  }
  if (SOCIAL_ROOM_PATTERNS.some((re) => re.test(pathname))) {
    return true;
  }
  return false;
}

function sanitizeRoomId(pathname: string): string {
  const slug = pathname
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .slice(0, 60);
  return `vibezdsg-${slug || 'room'}`;
}

function makeLabel(pathname: string): string {
  const clean = pathname.replace(/^\/|\/$/g, '');
  const first = clean.split('/')[0].toLowerCase();
  if (GAME_LABEL_OVERRIDES[first]) return GAME_LABEL_OVERRIDES[first];
  const second = clean.split('/')[1]?.toLowerCase();
  if (second && GAME_LABEL_OVERRIDES[second]) return GAME_LABEL_OVERRIDES[second];
  return first
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export default function RoomCommsMounter() {
  const { pathname } = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const uid = window.localStorage.getItem('user_id');
    if (uid) setUserId(uid);
    const name =
      window.localStorage.getItem('name') ||
      window.localStorage.getItem('user_name') ||
      window.localStorage.getItem('email') ||
      undefined;
    if (name) setUserName(name);
  }, []);

  const roomId = useMemo(() => sanitizeRoomId(pathname), [pathname]);
  const label = useMemo(() => makeLabel(pathname), [pathname]);

  if (!isRoomRoute(pathname) || !userId) return null;

  return <RoomCommsDock roomId={roomId} userId={userId} userName={userName} label={label} />;
}
