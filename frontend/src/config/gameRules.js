// Game Rules Configuration for All Cultural Games

export const GAME_RULES = {
  ludo: {
    objective: "Race all 4 of your pieces from start to finish before your opponent does.",
    setup: "Each player has 4 pieces starting in their home base. The board is a cross-shaped track with 52 spaces.",
    howToPlay: [
      "Roll the dice on your turn to move your pieces",
      "Roll a 6 to bring a piece out of home base",
      "Move your piece clockwise around the board",
      "Land on an opponent's piece to send it back to their home",
      "Roll a 6 to get an extra turn"
    ],
    specialRules: [
      "You must roll a 6 to move a piece out of home base",
      "Rolling a 6 gives you another turn",
      "Landing on an opponent's piece sends it back to start",
      "Safe spaces protect your pieces from being captured"
    ],
    winning: "Get all 4 of your pieces to the finish area before your opponent."
  },

  dominoes: {
    objective: "Be the first player to play all your dominoes.",
    setup: "Each player receives 7 dominoes. Remaining dominoes form the boneyard.",
    howToPlay: [
      "Match your domino to either end of the chain",
      "The numbers on touching ends must match",
      "Draw from the boneyard if you can't play",
      "First player to use all dominoes wins"
    ],
    specialRules: [
      "Doubles can be played perpendicular to the chain",
      "If the boneyard is empty and you can't play, skip your turn",
      "The game ends when one player runs out or no one can play"
    ],
    winning: "Play all your dominoes before your opponent, or have the lowest pip count when blocked."
  },

  mancala: {
    objective: "Capture more stones than your opponent by the end of the game.",
    setup: "Board has 6 pits per player with 4 stones each, plus 2 stores (one per player).",
    howToPlay: [
      "Pick up all stones from one of your pits",
      "Drop one stone in each pit moving counter-clockwise",
      "Include your store but skip opponent's store",
      "If your last stone lands in your store, take another turn",
      "If your last stone lands in an empty pit on your side, capture opponent's stones opposite"
    ],
    specialRules: [
      "You can only pick up stones from your own pits",
      "Always skip your opponent's store when sowing",
      "Landing in your store earns an extra turn",
      "Capturing requires landing in an empty pit with stones opposite"
    ],
    winning: "Have the most stones in your store when all pits on one side are empty."
  },

  backgammon: {
    objective: "Move all your checkers around the board and bear them off before your opponent.",
    setup: "15 checkers per player positioned on specific points. Players move in opposite directions.",
    howToPlay: [
      "Roll two dice and move checkers based on the numbers shown",
      "Move checkers to open points (not blocked by 2+ opponent checkers)",
      "Land on a single opponent checker to send it to the bar",
      "Re-enter checkers from the bar before making other moves",
      "Bear off checkers once all are in your home board"
    ],
    specialRules: [
      "Doubles let you move each number twice (4 moves total)",
      "You must use both dice if possible",
      "Checkers on the bar must re-enter before other moves",
      "You can only bear off when all checkers are in your home board"
    ],
    winning: "Be the first to bear off all 15 of your checkers."
  },

  chinesecheckers: {
    objective: "Move all your pieces from your starting triangle to the opposite triangle.",
    setup: "10 pieces start in your home triangle on a star-shaped board.",
    howToPlay: [
      "Move one piece per turn to an adjacent empty space",
      "OR jump over adjacent pieces (yours or opponent's)",
      "Chain multiple jumps in a single turn",
      "Pieces can't move backward once they leave home",
      "First to fill the opposite triangle wins"
    ],
    specialRules: [
      "Jumps can be chained for long-distance moves",
      "You can jump over your own or opponent's pieces",
      "Can't stop in your own starting triangle once you leave",
      "Must fill the exact opposite triangle to win"
    ],
    winning: "Be the first player to move all 10 pieces into the opposite triangle."
  },

  parcheesi: {
    objective: "Move all 4 pawns from start to home before your opponent.",
    setup: "Each player has 4 pawns in their home circle. Board has 68 spaces around the perimeter.",
    howToPlay: [
      "Roll two dice and move pawns accordingly",
      "Roll a 5 to enter a pawn onto the board",
      "Move pawns clockwise around the board",
      "Land on opponent's pawn to send it back to start",
      "Form blockades with 2 pawns on the same space"
    ],
    specialRules: [
      "Safe spaces prevent captures",
      "Two pawns on the same space create a blockade",
      "You must use all dice if possible",
      "Doubles give you an extra turn",
      "Landing on an opponent sends them back unless on a safe space"
    ],
    winning: "Get all 4 pawns to your home space before your opponent."
  },

  mahjong: {
    objective: "Form a complete hand of 14 tiles with valid sets and pairs.",
    setup: "Each player draws 13 tiles from the wall. Players take turns drawing and discarding.",
    howToPlay: [
      "Draw a tile from the wall on your turn",
      "Discard one tile to the discard pile",
      "Form sets of 3 matching tiles (pung) or runs (chow)",
      "Declare Mahjong when you have 4 sets + 1 pair (14 tiles total)",
      "First to complete a valid hand wins"
    ],
    specialRules: [
      "A complete hand needs 4 sets and 1 pair",
      "Sets can be 3 identical tiles or 3 consecutive tiles",
      "Honor tiles (winds, dragons) can only form pungs, not chows",
      "You can claim discarded tiles for sets"
    ],
    winning: "Complete a valid Mahjong hand of 14 tiles (4 sets + 1 pair)."
  },

  carrom: {
    objective: "Pocket all your pieces (white or black) before your opponent.",
    setup: "9 white pieces, 9 black pieces, and 1 red queen arranged in center. Striker at bottom.",
    howToPlay: [
      "Flick the striker to hit your colored pieces",
      "Pocket your pieces into corner holes",
      "Adjust power and angle of your strike",
      "Pocket the red queen for bonus points",
      "Alternate turns between players"
    ],
    specialRules: [
      "Must pocket your own colored pieces",
      "Pocketing the queen requires covering it with another piece",
      "Foul if striker goes into pocket",
      "Opponent gets a turn if you miss"
    ],
    winning: "Pocket all your pieces first. Red queen is worth extra points."
  },

  shogi: {
    objective: "Checkmate your opponent's King.",
    setup: "9x9 board with 20 pieces per player. Pieces move differently from chess.",
    howToPlay: [
      "Move one piece per turn according to its movement rules",
      "Capture opponent pieces by landing on their square",
      "Promote pieces when they reach the far 3 rows",
      "Drop captured pieces back on the board as your own",
      "Check the King to threaten capture"
    ],
    specialRules: [
      "Captured pieces can be dropped back on the board",
      "Pieces promote (flip over) in the promotion zone",
      "Promoted pieces gain enhanced movement",
      "You can't drop a piece for immediate checkmate (with pawns)",
      "No castling like in chess"
    ],
    winning: "Checkmate the opponent's King (King can't escape capture)."
  },

  xiangqi: {
    objective: "Checkmate the opponent's General.",
    setup: "9x10 board with a river in the middle. 16 pieces per player.",
    howToPlay: [
      "Move one piece per turn based on its specific rules",
      "Capture opponent pieces by landing on them",
      "General must stay in the palace (3x3 area)",
      "Elephants can't cross the river",
      "Horses move in an 'L' shape but can be blocked"
    ],
    specialRules: [
      "Generals can't face each other with no pieces between",
      "Cannons capture by jumping over exactly one piece",
      "Advisors and Generals stay in the palace",
      "Elephants can't cross the river",
      "Soldiers gain sideways movement after crossing river"
    ],
    winning: "Checkmate the opponent's General (General can't escape check)."
  }
};
