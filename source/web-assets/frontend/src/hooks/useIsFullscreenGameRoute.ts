import { useLocation } from "react-router-dom";

/** Routes that own the entire viewport (h-[100dvh] + overflow-hidden).
 *  Global chrome bars and the mobile bottom nav should not mount on
 *  these pages so game CTAs stay reachable. */
export const FULLSCREEN_GAME_ROUTES = [
  "/spades",
  "/bid-whist",
  "/hearts",
  "/uno",
  "/euchre",
  "/pinochle",
  "/gin-rummy",
  "/rummy",
  "/war",
  "/crazy-eights",
  "/go-fish",
  "/baccarat",
  "/baccarat-aaa",
  "/blackjack",
  "/poker",
  "/three-card-poker",
  "/vibe-654",
  "/vibez-654",
  "/games/vibez-654",
  "/chess",
  "/checkers",
  "/connect4",
  "/practice/play",
  "/chess-hall",
  "/chess/blitz",
  "/chess/puzzle",
  "/chess/tournament",
  "/chess/multiplayer",
  "/sports-lounge",
  "/sportsbook",
  "/card-mp",
  "/cinema-room",
  "/cyber-casino",
  "/games/cyber-casino",
  "/casino-war",
  "/lottery",
  "/dsg6",
  "/underground-casino",
  "/underground",
];

export default function useIsFullscreenGameRoute(): boolean {
  const location = useLocation();
  const p = location.pathname;
  return FULLSCREEN_GAME_ROUTES.some((r) => p === r || p.startsWith(r + "/"));
}
