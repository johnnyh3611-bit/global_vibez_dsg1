import React from 'react';
import RoomMenuBar from '@/components/games/RoomMenuBar';
import type { RoomTheme } from '@/components/games/RoomMenuBar';

const THEME_BY_GAME: Record<string, { theme: RoomTheme; title: string; subtitle?: string }> = {
  chess: { theme: 'default', title: 'Chess', subtitle: 'Classic 8×8' },
  connect4: { theme: 'matrix', title: 'Connect 4', subtitle: '4-in-a-row' },
  trivia: { theme: 'rummy', title: 'Trivia', subtitle: 'Brain Battle' },
  poker: { theme: 'baccarat', title: 'Poker', subtitle: "Texas Hold'em" },
  truthordare: { theme: 'crazyeights', title: 'Truth or Dare', subtitle: 'Party Mode' },
  checkers: { theme: 'spades', title: 'Checkers', subtitle: 'Classic Board' },
  blackjack: { theme: 'blackjack', title: 'Blackjack', subtitle: 'Dealer vs Player' },
  ludo: { theme: 'gofish', title: 'Ludo', subtitle: 'Roll & Race' },
  mancala: { theme: 'pinochle', title: 'Mancala', subtitle: 'Capture the Pit' },
  backgammon: { theme: 'pinochle', title: 'Backgammon', subtitle: 'Race to Bear-off' },
  chinesecheckers: { theme: 'gofish', title: 'Chinese Checkers', subtitle: '6-Star Hop' },
  parcheesi: { theme: 'crazyeights', title: 'Parcheesi', subtitle: 'Dice & Pawns' },
  mahjong: { theme: 'pinochle', title: 'Mahjong', subtitle: 'Tile Solitaire' },
  carrom: { theme: 'pinochle', title: 'Carrom', subtitle: 'Striker Showdown' },
  shogi: { theme: 'default', title: 'Shogi', subtitle: 'Japanese Chess' },
  xiangqi: { theme: 'war', title: 'Xiangqi', subtitle: 'Chinese Chess' },
  tictactoe: { theme: 'matrix', title: 'Tic-Tac-Toe', subtitle: 'The Matrix Edition' },
  uno: { theme: 'uno', title: 'UNO', subtitle: 'Card Frenzy' },
};

interface HttpRoomShellProps {
  gameType: string;
  children: React.ReactNode;
}

/**
 * Wrap every HttpMultiplayer* page (and TicTacToe / UNO) with the
 * shared themable RoomMenuBar so the menu bar visual is unified across
 * the entire game catalogue. Per-game theme + title + subtitle are
 * looked up by `gameType`; falls back to the neutral `default` theme.
 *
 * The inner page keeps its own bespoke layout — this wrapper only adds
 * the top bar and a sticky positioning context.
 */
const HttpRoomShell: React.FC<HttpRoomShellProps> = ({ gameType, children }) => {
  const meta = THEME_BY_GAME[gameType] || {
    theme: 'default' as RoomTheme,
    title: gameType.charAt(0).toUpperCase() + gameType.slice(1),
  };
  return (
    <div
      className="relative"
      data-testid={`http-room-shell-${gameType}`}
      data-room-theme={meta.theme}
    >
      <RoomMenuBar
        theme={meta.theme}
        title={meta.title}
        subtitle={meta.subtitle}
        backTo="/games"
        sticky
        testIdSuffix={`http-${gameType}`}
      />
      {children}
    </div>
  );
};

export default HttpRoomShell;
