
import React from 'react';
import { X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const GAME_RULES = {
  // CARD GAMES
  tictactoe: {
    title: 'Tic-Tac-Toe Rules',
    objective: 'Get 3 in a row (horizontally, vertically, or diagonally)',
    rules: [
      'Players take turns placing X or O on a 3x3 grid',
      'First player to get 3 marks in a row wins',
      'If all 9 squares are filled with no winner, it\'s a tie',
      'Strategy tip: Control the center square for best winning chances'
    ],
    howToWin: 'Create a line of 3 symbols before your opponent'
  },
  
  blackjack: {
    title: 'Blackjack Rules',
    objective: 'Get closer to 21 than the dealer without going over',
    rules: [
      'Number cards (2-10) = face value',
      'Face cards (J, Q, K) = 10 points',
      'Ace = 1 or 11 points (your choice)',
      'Hit = Take another card',
      'Stand = Keep current hand',
      'Bust = Go over 21 (you lose)',
      'Blackjack = Ace + 10-value card (21 in 2 cards)'
    ],
    howToWin: 'Beat the dealer\'s hand without busting'
  },

  roulette: {
    title: 'Roulette Rules',
    objective: 'Bet on where the ball will land on the spinning wheel',
    rules: [
      'Place chips on numbers (0-36) or betting areas',
      'Straight bet (single number): 35:1 payout',
      'Red/Black: 1:1 payout',
      'Even/Odd: 1:1 payout',
      'Low (1-18) / High (19-36): 1:1 payout',
      'Dozens (1-12, 13-24, 25-36): 2:1 payout',
      'Nova (AI dealer) announces "No more bets!" before spin'
    ],
    howToWin: 'Correctly predict where the ball lands'
  },

  vibes_slots: {
    title: 'Vibes Slots Rules',
    objective: 'Match symbols across the middle row to win credits',
    rules: [
      '💎 Diamond (3 in a row): 100x bet',
      '⭐ Star: 50x bet',
      '🔥 Fire: 40x bet',
      '💜 Vibe: 30x bet',
      '🎮 Game: 20x bet',
      '🌟 Glitter: 15x bet',
      '⚡ Bolt: 10x bet',
      '🎯 Target: 5x bet',
      'Two matching symbols: 2x bet',
      'Bet amount: 10-100 credits'
    ],
    howToWin: 'Match 3 symbols on the middle row for massive payouts!'
  },

  vibes_wheel: {
    title: 'Vibes Wheel Rules',
    objective: 'Spin the wheel and win credits based on where it lands',
    rules: [
      'You get 5 free spins',
      'Prizes range from 10 to 1000 credits',
      'JACKPOT segment = 1000 credits!',
      'LOSE segments = 0 credits',
      'Wheel spins for 4 seconds',
      'Come back daily for more spins!'
    ],
    howToWin: 'Land on high-value segments or hit the JACKPOT!'
  },

  vibes_darts: {
    title: 'Vibes Darts (501) Rules',
    objective: 'Reduce your score from 501 to exactly 0',
    rules: [
      'Start with 501 points',
      '3 darts per round',
      'Single = face value (20 = 20 points)',
      'Double = 2x value (20 = 40 points)',
      'Triple = 3x value (20 = 60 points)',
      'Bullseye = 50 points',
      'Subtract your score from 501',
      'Nova dealer celebrates big shots!'
    ],
    howToWin: 'Reach exactly 0 points!'
  },

  snake: {
    title: 'Snake Rules',
    objective: 'Eat food to grow without hitting walls or yourself',
    rules: [
      'Use arrow keys to control the snake',
      'Eat red food to grow longer',
      'Each food = +10 points',
      'Snake moves faster as you grow',
      'Hitting walls = game over',
      'Hitting yourself = game over',
      'Spacebar = pause game'
    ],
    howToWin: 'Get the highest score before crashing!'
  },

  memory_match: {
    title: 'Memory Match Rules',
    objective: 'Find all matching pairs of cards',
    rules: [
      'Click cards to flip them over',
      'Find 2 matching cards',
      'Matching pair = stays revealed (+100 points)',
      'Non-matching = flips back over',
      'Each turn = +1 move count',
      'Lower moves = better score!',
      '8 pairs total to find'
    ],
    howToWin: 'Match all pairs in the fewest moves!'
  },

  war: {
    title: 'Card War Rules',
    objective: 'Win all the cards by having higher cards than opponent',
    rules: [
      'Deck split evenly between you and AI',
      'Both flip top card simultaneously',
      'Higher card wins both cards',
      'Ace = highest (14), 2 = lowest',
      'Tie = "War!" (both cards discarded)',
      'Winner collects all cards',
      'Game ends when one player has no cards'
    ],
    howToWin: 'Collect all 52 cards!'
  },

  pool_8ball: {
    title: '8-Ball Pool Rules',
    objective: 'Pocket all your balls (solids or stripes) then sink the 8-ball',
    rules: [
      'First ball pocketed determines your type (solids 1-7 or stripes 9-15)',
      'Pocket all your balls before opponent',
      'Finally, pocket the 8-ball to win',
      'Sinking 8-ball early = you lose!',
      'Miss = opponent\'s turn',
      'Hit = go again'
    ],
    howToWin: 'Clear your balls, then sink the 8-ball last!'
  },

  ping_pong: {
    title: 'Ping Pong Rules',
    objective: 'Score 11 points before your opponent',
    rules: [
      'Move mouse to control your paddle',
      'Ball bounces off paddles and walls',
      'Miss the ball = opponent scores',
      'First to 11 points wins',
      'Ball speeds up during rallies'
    ],
    howToWin: 'Reach 11 points first!'
  },

  battleship: {
    title: 'Battleship Rules',
    objective: 'Sink all 5 of your opponent\'s ships before they sink yours',
    rules: [
      'Ships: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)',
      'Ships placed randomly on 10x10 grid',
      'Click enemy grid to fire',
      '💥 Hit = red, 💨 Miss = blue',
      'Sink all segments of a ship to destroy it',
      'First to sink all 5 enemy ships wins'
    ],
    howToWin: 'Destroy all enemy ships!'
  },

  yahtzee: {
    title: 'Yahtzee Rules',
    objective: 'Score points by rolling specific dice combinations',
    rules: [
      '5 dice, 3 rolls per turn',
      'Click dice to lock/unlock between rolls',
      'Choose a scoring category after 3 rolls',
      'Each category can only be used once',
      'Upper Section: Score sum of specific numbers (1s, 2s, etc.)',
      'Lower Section: Score combinations (3-of-kind, 4-of-kind, etc.)',
      'Full House (3+2) = 25 points',
      'Small Straight (4 sequence) = 30 points',
      'Large Straight (5 sequence) = 40 points',
      'Yahtzee (5 of a kind) = 50 points!'
    ],
    howToWin: 'Complete all categories with highest total score!'
  },

  mancala: {
    title: 'Mancala Rules',
    objective: 'Collect more stones in your store than your opponent',
    rules: [
      '14 pits total: 6 pits per player + 1 store each',
      'Click your pit to pick up all stones',
      'Drop one stone in each pit counter-clockwise',
      'Skip opponent\'s store',
      'Land in your store = go again!',
      'Land in empty pit on your side = capture opposite stones',
      'Game ends when one side is empty',
      'Player with most stones in store wins'
    ],
    howToWin: 'Collect more stones than opponent!'
  },

  dominoes: {
    title: 'Dominoes Rules',
    objective: 'Be first to play all your dominoes',
    rules: [
      'Each player gets 7 dominoes',
      'Match numbers on chain ends',
      'First domino can be any',
      'Subsequent plays must match end numbers',
      'Can\'t play? Pass your turn',
      'First to play all dominoes wins!'
    ],
    howToWin: 'Empty your hand before opponent!'
  },

  solitaire: {
    title: 'Solitaire (Klondike) Rules',
    objective: 'Move all cards to 4 foundation piles (Ace to King by suit)',
    rules: [
      'Tableau: 7 columns, build down in alternating colors',
      'Foundation: 4 piles, build up by suit (A→K)',
      'Stock: Draw 1 card at a time',
      'Waste: Discard pile, top card playable',
      'Move Kings to empty tableau columns',
      'Only Aces start foundation piles',
      'Reveal face-down cards by removing cards above'
    ],
    howToWin: 'Complete all 4 foundation piles!'
  },

  gin_rummy: {
    title: 'Gin Rummy Rules',
    objective: 'Form melds (sets/runs) and knock with low deadwood',
    rules: [
      'Each player gets 10 cards',
      'Draw from deck or discard pile',
      'Discard 1 card per turn',
      'Meld = 3+ cards (sets or runs)',
      'Set = same rank (7♠ 7♥ 7♣)',
      'Run = sequence same suit (4♥ 5♥ 6♥)',
      'Knock when deadwood ≤ 10 points',
      'Gin = all cards in melds (0 deadwood)'
    ],
    howToWin: 'Form melds and knock before opponent!'
  },

  trivia: {
    title: 'Trivia Quest Rules',
    objective: 'Answer questions correctly to score points',
    rules: [
      '10 questions from various categories',
      'Geography, Art, Math, History, Science, Literature',
      'Correct answer = 10 points',
      'Wrong answer = 0 points',
      'Streak bonus: +5 points per consecutive correct answer',
      'Total possible: 550 points (with max streak)'
    ],
    howToWin: 'Get the highest score by answering correctly!'
  },

  two_truths_lie: {
    title: 'Two Truths & A Lie Rules',
    objective: 'Guess which statement is the lie',
    rules: [
      'AI presents 3 statements',
      '2 are true, 1 is a lie',
      'Click the statement you think is false',
      'Correct guess = +1 point',
      'Wrong guess = AI gets +1 point',
      'Your turn: Enter 2 truths and 1 lie',
      'Mark which one is your lie',
      'Best of multiple rounds!'
    ],
    howToWin: 'Spot more lies than opponent!'
  },

  truth_or_dare: {
    title: 'Truth or Dare Rules',
    objective: 'Complete truths or dares to earn points',
    rules: [
      'Choose Truth or Dare',
      'Truth = personal question (+10 points if answered)',
      'Dare = challenge to complete (+20 points if done)',
      'Click "I Did It!" after completing',
      'Click "Skip" to pass (no points)',
      'Higher risk = higher reward!',
      'Play with friends for maximum fun!'
    ],
    howToWin: 'Complete the most challenges!'
  },

  checkers: {
    title: 'Checkers Rules',
    objective: 'Capture all opponent pieces or block them from moving',
    rules: [
      'Move diagonally forward on dark squares',
      'Jump over opponent pieces to capture them',
      'Multiple jumps allowed in one turn',
      'Reach opposite end = become a King 👑',
      'Kings can move backward and forward',
      'Must capture if jump is available',
      'Capturing removes opponent piece from board'
    ],
    howToWin: 'Capture all opponent pieces or block all their moves!'
  },

  chess: {
    title: 'Chess Rules',
    objective: 'Checkmate the opponent\'s King',
    rules: [
      'Each piece moves differently (Pawn, Rook, Knight, Bishop, Queen, King)',
      'Pawns: 1 square forward (2 on first move)',
      'Rooks: Any distance horizontally/vertically',
      'Knights: L-shape (2+1 squares)',
      'Bishops: Any distance diagonally',
      'Queen: Any distance in any direction',
      'King: 1 square in any direction',
      'Check = King under attack',
      'Checkmate = King has no escape',
      'Capture opponent pieces by landing on their square'
    ],
    howToWin: 'Trap the opponent King in checkmate!'
  },

  connect4: {
    title: 'Connect 4 Rules',
    objective: 'Connect 4 discs in a row before your opponent',
    rules: [
      'Drop discs into columns (7 columns, 6 rows)',
      'Discs fall to lowest available position',
      'Players alternate turns',
      'Connect 4 in a row to win:',
      '  • Horizontal (left-right)',
      '  • Vertical (up-down)',
      '  • Diagonal (any direction)',
      'Game is a draw if board fills with no winner'
    ],
    howToWin: 'Connect 4 of your colored discs in a row!'
  },

  crazy_eights: {
    title: 'Crazy Eights Rules',
    objective: 'Be first to play all your cards',
    rules: [
      'Each player gets 7 cards',
      'Match the top card by rank or suit',
      '8s are WILD - play anytime, choose new suit',
      'Can\'t play? Draw a card',
      'Drawn card is playable? Must play it',
      'Special cards: 8 = Wild, 2 = Draw 2, Queen = Skip',
      'First to empty hand wins!'
    ],
    howToWin: 'Play all your cards before opponent!'
  },

  go_fish: {
    title: 'Go Fish Rules',
    objective: 'Collect the most 4-of-a-kind sets',
    rules: [
      'Each player gets 7 cards',
      'Ask opponent for a specific rank (e.g., "Got any 7s?")',
      'Must have at least 1 of that rank to ask',
      'Opponent gives ALL cards of that rank',
      'If opponent has none: "GO FISH!" - draw 1 card',
      'Make a set of 4? Lay it down immediately',
      'Deck runs out? Play with current hands',
      'Most sets wins!'
    ],
    howToWin: 'Collect more 4-of-a-kind sets than opponent!'
  },

  hearts: {
    title: 'Hearts Rules',
    objective: 'Avoid taking hearts and the Queen of Spades',
    rules: [
      'Each player gets 13 cards',
      'Must follow suit if possible',
      'Highest card of led suit takes the trick',
      'Each heart = 1 penalty point',
      'Queen of Spades ♠️ = 13 penalty points',
      'Can\'t lead hearts until hearts are "broken"',
      '"Shoot the Moon" = take ALL hearts + Q♠️ (0 points for you, 26 for others)',
      'Lowest score after all rounds wins'
    ],
    howToWin: 'Have the lowest penalty points!'
  },

  poker: {
    title: 'Texas Hold\'em Poker Rules',
    objective: 'Win chips by making the best 5-card hand or bluffing',
    rules: [
      'Each player gets 2 hole cards (face down)',
      '5 community cards dealt in center (shared by all)',
      'Betting rounds: Pre-flop, Flop (3 cards), Turn (1 card), River (1 card)',
      'Actions: Fold (quit), Call (match bet), Raise (increase bet)',
      'Hand rankings (highest to lowest):',
      '  Royal Flush > Straight Flush > 4 of a Kind > Full House > Flush > Straight > 3 of a Kind > 2 Pair > Pair > High Card',
      'Best 5-card hand using hole cards + community cards wins',
      'Win by having best hand OR making everyone else fold'
    ],
    howToWin: 'Make the best hand or bluff opponents into folding!'
  },

  reversi: {
    title: 'Reversi (Othello) Rules',
    objective: 'Have more discs than opponent when board is full',
    rules: [
      'Place disc to trap opponent discs between yours',
      'Trapped discs flip to your color',
      'Must flip at least 1 disc per move',
      'Flip in all 8 directions (horizontal, vertical, diagonal)',
      'No valid moves? Pass your turn',
      'Game ends when board is full or no moves left',
      'Count discs: Most discs wins!'
    ],
    howToWin: 'Control more discs than opponent at game end!'
  },

  rummy: {
    title: 'Rummy Rules',
    objective: 'Form sets and runs, then go out by melding all cards',
    rules: [
      'Each player gets 10 cards',
      'Draw from deck or discard pile',
      'Discard 1 card per turn',
      'Meld = 3+ cards (sets or runs)',
      'Set = same rank (7♠ 7♥ 7♣)',
      'Run = sequence same suit (4♥ 5♥ 6♥)',
      'Go out = meld all cards (1 final discard)',
      'Deadwood = cards not in melds',
      'Lower deadwood = better score'
    ],
    howToWin: 'Meld all your cards before opponent!'
  },

  spades: {
    title: 'Spades Rules',
    objective: 'Win tricks to meet your bid (team-based)',
    rules: [
      'Partners sit across from each other',
      'Each player gets 13 cards',
      'Bid how many tricks you\'ll win (0-13)',
      'Spades are ALWAYS trump (beats other suits)',
      'Must follow suit if possible',
      'Highest card wins trick (Spades beat all)',
      'Meet/exceed bid = +10 points per trick',
      'Fail bid = -10 points per trick bid',
      'Overtricks (bags) = +1 each, 10 bags = -100 points',
      'First team to 500 wins!'
    ],
    howToWin: 'Meet your bid exactly to maximize points!'
  },

  uno: {
    title: 'UNO Rules',
    objective: 'Be first to play all your cards',
    rules: [
      'Each player gets 7 cards',
      'Match top card by color, number, or symbol',
      'Special cards:',
      '  • Skip = Next player loses turn',
      '  • Reverse = Direction reverses',
      '  • Draw 2 = Next player draws 2 cards',
      '  • Wild = Change color to any suit',
      '  • Wild Draw 4 = Change color + next player draws 4',
      'Say "UNO!" when you have 1 card left',
      'Forget to say UNO? Draw 2 penalty cards',
      'First to empty hand wins!'
    ],
    howToWin: 'Play all cards before opponents (don\'t forget UNO!)'
  },

  // NEW CASINO TABLE GAMES
  baccarat: {
    title: 'Baccarat Rules',
    objective: 'Bet on Player, Banker, or Tie - Closest to 9 wins',
    rules: [
      'Bet on Player, Banker, or Tie before cards dealt',
      'Two hands dealt: Player hand and Banker hand',
      'Cards: Face cards/10s = 0, Aces = 1, others = face value',
      'If total exceeds 9, subtract 10 (e.g., 7+8=15 becomes 5)',
      'Natural 8 or 9 wins immediately',
      'Banker bet has lowest house edge (1.06%)'
    ],
    howToWin: 'Correctly predict which hand gets closest to 9'
  },

  caribbean_stud: {
    title: 'Caribbean Stud Poker Rules',
    objective: 'Beat the dealer with best 5-card poker hand',
    rules: [
      'Place ante bet to start',
      'Receive 5 cards face-up, dealer gets 5 (one face-up)',
      'Fold (lose ante) or Raise (bet 2x ante)',
      'Dealer must have Ace-King or better to qualify',
      'If dealer doesn\'t qualify, you win ante only',
      'Payouts: Royal Flush 100:1, Straight Flush 50:1, Four of a Kind 20:1'
    ],
    howToWin: 'Have better poker hand than dealer when they qualify'
  },

  three_card_poker: {
    title: 'Three Card Poker Rules',
    objective: 'Beat dealer with 3-card poker hand',
    rules: [
      'Place ante bet, receive 3 cards',
      'Fold (lose ante) or Play (match ante)',
      'Dealer needs Queen-high or better to qualify',
      'Straight beats flush in 3-card poker!',
      'Pair Plus side bet pays regardless of dealer',
      'Payouts: Straight Flush 40:1, Three of a Kind 30:1, Straight 6:1'
    ],
    howToWin: 'Beat dealer with better 3-card hand'
  },

  pai_gow: {
    title: 'Pai Gow Rules',
    objective: 'Arrange 4 tiles into 2 winning pairs',
    rules: [
      'Receive 4 dominoes (tiles)',
      'Arrange into High pair and Low pair',
      'Each pair scored 0-9 (like Baccarat)',
      'Both pairs must beat dealer to win',
      'One win + one loss = Push (tie)',
      'Dealer wins all ties'
    ],
    howToWin: 'Beat dealer with both your High and Low pairs'
  },

  chemin_de_fer: {
    title: 'Chemin de Fer Rules',
    objective: 'VIP Baccarat - Get closest to 9',
    rules: [
      'Players rotate as banker (vs standard Baccarat)',
      'Banker bets against other players',
      'Same scoring as Baccarat (closest to 9)',
      'Player can "take" or "stand" on 5 (player\'s choice)',
      'More player control than standard Baccarat',
      'Popular in high-roller rooms'
    ],
    howToWin: 'Get closer to 9 than banker (or banker beats players)'
  },

  casino_war: {
    title: 'Casino War Rules',
    objective: 'Get higher card than dealer',
    rules: [
      'You and dealer each get 1 card face-up',
      'Higher card wins (Aces are high)',
      'Tie: Surrender (lose half) or go to "War"',
      'War: Double bet, deal 3 cards each, compare 4th',
      'Win war = original bet paid, tie war = lose',
      'Fastest casino game - pure luck!'
    ],
    howToWin: 'Draw higher card than dealer'
  },

  european_roulette: {
    title: 'European Roulette Rules',
    objective: 'Predict where ball lands - Better odds than American',
    rules: [
      'Wheel has 37 pockets: 0-36 (NO double-zero)',
      'Bet on: Single number, color, odd/even, high/low, dozens',
      'House edge 2.7% (better than American 5.26%)',
      'Payouts: Single number 35:1, Color 1:1, Dozen 2:1',
      'European version favors player'
    ],
    howToWin: 'Correctly predict winning number or group'
  },

  // NEW CASINO DICE GAMES
  craps: {
    title: 'Craps Rules',
    objective: 'Roll winning dice combinations',
    rules: [
      'Come-out roll: 7 or 11 = win, 2/3/12 = lose (Craps)',
      'Any other number (4,5,6,8,9,10) becomes "Point"',
      'Roll Point again before 7 to win',
      'Roll 7 before Point = lose',
      'Dozens of side bets available',
      'Pass/Don\'t Pass have best odds (1.4% house edge)'
    ],
    howToWin: 'Hit Point before rolling 7 (or bet Don\'t Pass)'
  },

  sic_bo: {
    title: 'Sic Bo Rules',
    objective: 'Bet on outcome of 3 dice',
    rules: [
      'Dealer shakes 3 dice in covered cage',
      'Bet before reveal: Total, triples, doubles, combos',
      'Small (4-10) or Big (11-17) are safest bets',
      'Specific triple pays 180:1',
      'Popular Asian casino game',
      'Small/Big bets have ~2.8% house edge'
    ],
    howToWin: 'Correctly predict dice outcome'
  },

  hazard: {
    title: 'Hazard Rules',
    objective: 'Medieval dice game - Roll the Main',
    rules: [
      'Caster picks "Main" (5-9)',
      'Roll 2 dice to match Main = instant win',
      'Roll "Chance" (not Main, not loss)',
      'Keep rolling to hit Chance before Main',
      'Predecessor to Craps (17th century England)',
      'Complex medieval rules'
    ],
    howToWin: 'Roll Chance before rolling Main again'
  },

  chuck_a_luck: {
    title: 'Chuck-A-Luck Rules',
    objective: 'Predict dice in birdcage',
    rules: [
      'Bet on any number 1-6',
      'Dealer rolls 3 dice in cage',
      'Number appears once = 1:1 payout',
      'Number appears twice = 2:1 payout',
      'Number appears three times = 3:1 payout',
      'Carnival/fair game - simple and fast'
    ],
    howToWin: 'Your number appears on dice roll'
  },

  // NEW CASINO WHEEL GAMES
  big_six_wheel: {
    title: 'Big Six Wheel Rules',
    objective: 'Bet on winning money symbol',
    rules: [
      'Large vertical wheel with $1, $2, $5, $10, $20, Joker',
      'Place bet on money amount or Joker',
      'Dealer spins wheel, pointer stops on winner',
      'Payout matches symbol (bet $5 on $5 = $5 win)',
      'Joker pays 40:1 or 45:1',
      'Also called "Wheel of Fortune"'
    ],
    howToWin: 'Pointer lands on your bet amount'
  },

  // NEW VIDEO/ELECTRONIC GAMES
  jacks_or_better: {
    title: 'Jacks or Better Video Poker Rules',
    objective: 'Make best 5-card poker hand',
    rules: [
      'Dealt 5 cards',
      'Choose which to Hold (keep)',
      'Discard unwanted cards',
      'Draw new cards to replace',
      'Win with pair of Jacks or better',
      'Royal Flush pays 800:1 with max bet'
    ],
    howToWin: 'Get Jacks or better (or higher poker hands)'
  },

  keno: {
    title: 'Keno Rules',
    objective: 'Match drawn numbers',
    rules: [
      'Pick 1-10 numbers from 1-80',
      '20 random numbers drawn',
      'More matches = bigger payout',
      'Catch all numbers = jackpot',
      'Like lottery or bingo',
      'Best odds: Pick 4-8 numbers'
    ],
    howToWin: 'Match as many numbers as possible'
  },

  bingo: {
    title: 'Bingo Rules',
    objective: 'Complete pattern first',
    rules: [
      '5×5 card with random numbers (B-I-N-G-O columns)',
      'Numbers called randomly (1-75)',
      'Mark matching numbers on card',
      'First to complete row, column, or pattern wins',
      'Call "BINGO!" to claim win',
      'Social game - play with others'
    ],
    howToWin: 'Complete winning pattern before others'
  },

  // NEW CLASSIC GAMES
  fan_tan: {
    title: 'Fan-Tan Rules',
    objective: 'Predict remainder when dividing by 4',
    rules: [
      'Dealer covers pile of coins/beads',
      'Bet on remainder: 1, 2, 3, or 4',
      'Dealer removes 4 coins at a time',
      'Final remainder determines winner',
      'Ancient Chinese game (2000+ years old)',
      'Each number has 25% probability'
    ],
    howToWin: 'Correctly predict the remainder'
  },

  faro: {
    title: 'Faro Rules',
    objective: 'Bet on winning card rank',
    rules: [
      'Bet on any card rank (Ace-King)',
      'Dealer draws pairs of cards',
      'First card = Banker wins that rank',
      'Second card = Player wins that rank',
      'Popular in Old West saloons (1800s)',
      'Once had lowest house edge'
    ],
    howToWin: 'Your bet rank appears as Player card'
  },

  // NEW BOARD GAMES
  mahjong: {
    title: 'Mahjong Rules',
    objective: 'Form complete sets and pairs',
    rules: [
      'Draw and discard tiles each turn',
      'Form: Pongs (3 identical), Chows (3 in sequence)',
      'Complete hand: 4 sets + 1 pair = "Mahjong!"',
      'Claim discards from other players',
      'Complex scoring based on hand',
      'Chinese strategy game - many variations'
    ],
    howToWin: 'Complete 4 sets + 1 pair first'
  },

  yahtzee_v2: {
    title: 'Yahtzee Rules',
    objective: 'Score highest with dice combos',
    rules: [
      'Roll 5 dice up to 3 times per turn',
      'Choose which dice to keep after each roll',
      'Score in categories: Ones-Sixes, 3/4 of a Kind, Full House, Straights',
      'Each category used once (13 rounds total)',
      'Yahtzee = 5 of a kind = 50 points',
      'Highest total score wins'
    ],
    howToWin: 'Get highest score across 13 categories'
  },
  klondike: {
    title: 'Klondike Solitaire Rules',
    objective: 'Move all cards to foundations',
    rules: [
      'Build 4 foundation piles (Ace to King, same suit)',
      'Tableau: Build down, alternating colors',
      'Move Kings to empty columns',
      'Draw from stock pile when stuck',
      'Classic solitaire variant',
      'Reveal hidden cards early for strategy'
    ],
    howToWin: 'Complete all 4 foundation piles (Ace through King)'
  }
};

export default function GameRulesModal({ gameType, isOpen, onClose }: { gameType?: any; isOpen?: boolean; onClose?: () => void; title?: string; rules?: any }) {
  if (!isOpen || !gameType) return null;

  const rules = GAME_RULES[gameType] || {
    title: `Game Rules`,
    objective: 'Play to win!',
    rules: ['Rules coming soon...'],
    howToWin: 'Be the best player!'
  };

  // Game emoji mapping
  const gameEmojis = {
    // Card Games
    tictactoe: '⭕', blackjack: '🃏', poker: '♠️', uno: '🎴', go_fish: '🎣',
    hearts: '♥️', spades: '♠️', chess: '♟️', checkers: '🟤', connect4: '🔴',
    solitaire: '🂡', war: '⚔️', gin_rummy: '🥃', rummy: '🎰', crazy_eights: '8️⃣',
    klondike: '🂡',
    
    // Casino Table Games
    roulette: '🎰', baccarat: '🎴', caribbean_stud: '🏝️', three_card_poker: '🃏',
    pai_gow: '🀄', chemin_de_fer: '🎩', casino_war: '⚔️', european_roulette: '🇪🇺',
    
    // Casino Dice Games
    craps: '🎲', sic_bo: '🎲', hazard: '🎲', chuck_a_luck: '🎲',
    
    // Casino Wheel Games
    big_six_wheel: '🎡', vibes_wheel: '🎡',
    
    // Video/Electronic
    jacks_or_better: '🎰', vibes_slots: '🎰', keno: '🎱', bingo: '🅱️',
    
    // Classic Games
    fan_tan: '🪙', faro: '🎴', vibes_darts: '🎯',
    
    // Board Games
    reversi: '⚫', battleship: '🚢', mancala: '🪨', dominoes: '🀰',
    mahjong: '🀄', yahtzee: '🎲',
    
    // Arcade
    pool_8ball: '🎱', snake: '🐍', memory_match: '🧠', ping_pong: '🏓',
    
    // Party
    trivia: '🧠', truth_or_dare: '💘', two_truths_lie: '🤥'
  };

  const emoji = gameEmojis[gameType] || '🎮';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-2xl border-4 border-cyan-500 shadow-2xl shadow-cyan-500/50"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-600 to-purple-600 p-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="text-6xl">{emoji}</div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">{rules.title}</h2>
                  <p className="text-cyan-200 text-lg">Learn how to play and win!</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Objective */}
              <div className="bg-yellow-900/30 border-2 border-yellow-500 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-xl font-bold text-yellow-400">Objective</h3>
                </div>
                <p className="text-white text-lg">{rules.objective}</p>
              </div>

              {/* Rules */}
              <div>
                <h3 className="text-2xl font-bold text-cyan-400 mb-4">Game Rules</h3>
                <ul className="space-y-3">
                  {rules.rules.map((rule, index) => (
                    <li key={`item-${index}-${Math.random()}`} className="flex gap-3 text-white">
                      <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </span>
                      <span className="pt-1">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* How to Win */}
              <div className="bg-green-900/30 border-2 border-green-500 rounded-xl p-4">
                <h3 className="text-xl font-bold text-green-400 mb-2">🏆 How to Win</h3>
                <p className="text-white text-lg">{rules.howToWin}</p>
              </div>

              {/* Play button */}
              <button
                onClick={onClose}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform border-2 border-green-400"
              >
                Got It! Let's Play! 🎮
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}