/**
 * GameVoiceDockMounter — route-aware voice/video chat injector.
 *
 * Founder ask (2026-02-16): "in every game, we did implement it so people
 * could actually virtually talk to each other and play the game from
 * each other's phone… is that active for every game in the app?"
 *
 * Answer: now yes. This single component auto-mounts the canonical
 * <GameVoiceDock> on every multiplayer URL pattern in the app. The
 * dock derives its channel name from the URL so two players on the
 * same room land on the same Agora channel automatically.
 *
 * Mount this once globally in App.js — it activates only on the
 * multiplayer routes listed below and renders nothing elsewhere.
 *
 * Covered URL patterns (regex)
 *   /multiplayer/<game>/<roomCode>     → channel = mp-<game>-<roomCode>
 *   /http-multiplayer/<game>/<id>      → channel = http-mp-<game>-<id>
 *   /game/multiplayer/...              → same convention
 *   /vibez-654/<roomId>                → channel = v654-<roomId>
 *   /spades-aaa, /hearts-aaa, /bid-whist-aaa, /pinochle-aaa, /euchre-aaa,
 *     /crazy-eights-aaa, /gin-rummy-aaa, /go-fish-aaa, /dominoes-aaa,
 *     /baccarat-premium, /blackjack-universal, /poker-practice
 *     → channel = solo-<gameSlug> (still works — friends can join voice
 *       even in single-player demo mode)
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import GameVoiceDock from '@/components/games/GameVoiceDock';

interface MatchSpec {
  /** RegExp on `pathname`. */
  re: RegExp;
  /** Pretty label shown on the dock. */
  label: string;
  /** Build the Agora channel name from the regex match. */
  channel: (m: RegExpMatchArray) => string;
}

const MATCHERS: MatchSpec[] = [
  // Socket.IO multiplayer router pages: /multiplayer/<game>/<roomCode>
  {
    re: /^\/multiplayer\/([\w-]+)\/([\w-]+)/,
    label: 'Multiplayer',
    channel: (m) => `mp-${m[1]}-${m[2]}`,
  },
  // HTTP polling-based multiplayer: /http-multiplayer/<game>/<gameId>
  {
    re: /^\/http-multiplayer\/([\w-]+)\/([\w-]+)/,
    label: 'Multiplayer',
    channel: (m) => `http-mp-${m[1]}-${m[2]}`,
  },
  // Vibez 654 with room id (some flows include one)
  {
    re: /^\/vibez-654\/([\w-]+)/,
    label: 'Vibez 654',
    channel: (m) => `v654-${m[1]}`,
  },
  // AAA standalone tables — channels namespaced by table id where present
  {
    re: /^\/(spades-aaa|hearts-aaa|bid-whist-aaa|pinochle-aaa|euchre-aaa|crazy-eights-aaa|gin-rummy-aaa|go-fish-aaa|dominoes-aaa)(?:\/([\w-]+))?/,
    label: 'AAA Table',
    channel: (m) => `aaa-${m[1]}-${m[2] || 'open'}`,
  },
  // Casino floor — premium tables that already host real-time multi-seat
  {
    re: /^\/(blackjack-universal|baccarat-premium|poker-practice|three-card-poker|caribbean-stud|sic-bo|craps|chemin-de-fer|european-roulette|roulette-aaa)(?:\/([\w-]+))?/,
    label: 'Casino Table',
    channel: (m) => `casino-${m[1]}-${m[2] || 'open'}`,
  },
  // Card-MP shared room
  {
    re: /^\/card-mp-room\/([\w-]+)/,
    label: 'Card Room',
    channel: (m) => `card-mp-${m[1]}`,
  },
  // Vibe Coliseum (already had voice; keep it routed through canonical path)
  {
    re: /^\/vibe-coliseum/,
    label: 'Coliseum',
    channel: () => 'coliseum-arena',
  },
  // ─────── Streaming pages (LOCKED 2026-02-16 per founder ask: "is multi-video
  //   attached to all the places it's supposed to be within the system?") ───────
  // Vibe TV channel + episode rooms
  {
    re: /^\/vibe-tv(?:\/([\w-]+))?/,
    label: 'Vibe TV',
    channel: (m) => `vibe-tv-${m[1] || 'main'}`,
  },
  // Memory Bank Cinema dates (sync-watch with your match)
  {
    re: /^\/dsg\/memory-bank(?:\/([\w-]+))?/,
    label: 'Cinema Date',
    channel: (m) => `cinema-${m[1] || 'lobby'}`,
  },
  // Live POV — VibeRidez driver dashcam viewers can chat with the driver
  {
    re: /^\/vibe-ridez\/live-pov(?:\/([\w-]+))?/,
    label: 'Live POV',
    channel: (m) => `live-pov-${m[1] || 'open'}`,
  },
  // Vigilant Matchmaking — voice rooms during compatibility quizzes
  {
    re: /^\/dsg\/matchmaking(?:\/([\w-]+))?/,
    label: 'Matchmaking',
    channel: (m) => `vmm-${m[1] || 'lobby'}`,
  },
  // Beat Vault — auction floor voice room
  {
    re: /^\/dsg\/beat-vault(?:\/([\w-]+))?/,
    label: 'Beat Vault',
    channel: (m) => `beat-vault-${m[1] || 'floor'}`,
  },
  // Just for the Night live rooms
  {
    re: /^\/just-for-the-night\/(?:room|dashboard)\/?([\w-]*)/,
    label: 'Just for the Night',
    channel: (m) => `jftn-${m[1] || 'open'}`,
  },
];

// Founder rule (2026-05-09): NO floating buttons on fullscreen game
// rooms. The inline PageActionStrip + the top-right
// <InRoomCommsLauncher /> Jitsi pill cover comms in those rooms, so
// the legacy bottom-right voice dock would create a FAB collision.
// Mirror App.js → FULLSCREEN_GAME_ROUTES so the suppression doesn't
// drift between files.
const FULLSCREEN_PREFIXES = [
  '/spades', '/bid-whist', '/hearts', '/uno', '/euchre', '/pinochle',
  '/gin-rummy', '/rummy', '/war', '/crazy-eights', '/go-fish', '/baccarat',
  '/baccarat-aaa', '/blackjack', '/poker', '/three-card-poker',
  '/vibe-654', '/vibez-654', '/games/vibez-654',
  '/chess', '/checkers', '/connect4', '/practice/play',
  '/card-mp', '/cinema-room',
  '/cyber-casino', '/games/cyber-casino', '/casino-war',
  '/lottery', '/dsg6',  // DSG 6 Quantum Vault Lottery (May 2026)
];

function isFullscreenGameRoute(pathname: string): boolean {
  return FULLSCREEN_PREFIXES.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export function GameVoiceDockMounter() {
  const { pathname } = useLocation();

  const match = useMemo(() => {
    for (const spec of MATCHERS) {
      const m = pathname.match(spec.re);
      if (m) {
        return { channel: spec.channel(m), label: spec.label, key: m[0] };
      }
    }
    return null;
  }, [pathname]);

  if (!match) return null;

  // Hide the legacy bottom-right voice dock on fullscreen game routes —
  // <InRoomCommsLauncher /> at top-right covers comms there.
  if (isFullscreenGameRoute(pathname)) return null;

  // `key` forces a remount when navigating between distinct rooms so we
  // don't leak the previous channel's Agora session.
  return (
    <GameVoiceDock
      key={match.key}
      channel={match.channel}
      gameLabel={match.label}
    />
  );
}

export default GameVoiceDockMounter;
