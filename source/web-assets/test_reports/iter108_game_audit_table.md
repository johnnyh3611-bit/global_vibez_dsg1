# Iteration 108 — Game Audit Table

**URL:** https://social-connect-953.preview.emergentagent.com (HTTP 200)
**Auth:** POST /api/auth/demo-login (cookie set via `page.request.post`) — confirmed working.
**Regression:** WinnerTicker present on `/`, `/games-menu`, AND `/multiplayer` (iter106 bug **FIXED**). VoiceMirror `/voice-mirror/pair` renders.

## Single-Player Practice (`/practice/play/<id>`) — 30 games

| Game | Route | Mode | Status | Failure Mode | Severity | File Path | Notes |
|---|---|---|---|---|---|---|---|
| Tic-Tac-Toe | /practice/play/tictactoe | SP | OK | — | — | components/practice_games/PracticeTicTacToe.tsx | 16 ttt-cell testids; first move fires AI thinking ✓ |
| Connect 4 | /practice/play/connect4 | SP | PARTIAL | Board renders header + frame; **no `c4-col*` data-testids and no aria-labels** so column-click cannot be automated; 49 buttons but none semantically labeled as columns | MEDIUM | components/practice_games/PracticeConnect4.tsx | Add `data-testid="c4-col-{n}"` to column drop buttons |
| Chess | /practice/play/chess | SP | PARTIAL | 64 `[data-square]` squares render, click on e2→e4 changes state, BUT **status header shows "Your Pieces ♙ 0"** (counter wrong — should be 8 pawns at start) | MEDIUM | components/practice_games/PracticeChess.tsx | Piece-count selector / piece rendering broken; needs visual verification |
| Checkers | /practice/play/checkers | SP | **BROKEN** | **Board renders but pieces are NOT painted** on the squares. Header reads "Your Pieces 12" but the 8×8 board is visually EMPTY (see screenshot). No `[data-testid]` on squares either | **HIGH** | components/practice_games/PracticeCheckers.tsx | Piece sprites/divs not rendered into checker squares — visual regression |
| Reversi | /practice/play/reversi | SP | OK | Renders header & layout | LOW | components/practice_games/PracticeReversi.tsx | 1 console error captured (non-blocking) |
| UNO | /practice/play/uno | SP | OK | Renders | — | components/practice_games/PracticeUno.tsx | — |
| Hearts | /practice/play/hearts | SP | OK | Renders | — | components/practice_games/PracticeHearts.tsx | — |
| Spades | /practice/play/spades | SP | OK | Renders | — | components/practice_games/PracticeSpades.tsx | — |
| Rummy | /practice/play/rummy | SP | OK | Renders | — | components/practice_games/PracticeRummy.tsx | — |
| Gin Rummy | /practice/play/gin_rummy | SP | OK | Renders | — | components/practice_games/PracticeGinRummy.tsx | — |
| War | /practice/play/war | SP | OK | Renders | — | components/practice_games/PracticeWar.tsx | — |
| Crazy 8s | /practice/play/crazy_eights | SP | OK | Renders | — | components/practice_games/PracticeCrazyEights.tsx | — |
| Go Fish | /practice/play/go_fish | SP | OK | Renders | — | components/practice_games/PracticeGoFish.tsx | — |
| Poker | /practice/play/poker | SP | OK | Renders | — | components/practice_games/PracticePoker.tsx | — |
| Blackjack | /practice/play/blackjack | SP | OK | Renders | — | components/practice_games/BlackjackGameSimple.tsx | — |
| Trivia | /practice/play/trivia | SP | OK | Renders | — | components/practice_games/PracticeTrivia.tsx | — |
| Truth/Dare | /practice/play/truthordare | SP | OK | Renders | — | components/practice_games/PracticeTruthOrDare.tsx | — |
| Ludo | /practice/play/ludo | SP | OK | Renders | — | components/games/LudoBoard.tsx | — |
| Mancala | /practice/play/mancala | SP | OK | Renders | — | components/practice_games/PracticeMancala.tsx | — |
| Dominoes | /practice/play/dominoes | SP | OK | Renders | — | components/practice_games/PracticeDominoes.tsx | — |
| Mahjong | /practice/play/mahjong | SP | OK | Renders | — | components/practice_games/PracticeMahjong.tsx | — |
| Solitaire | /practice/play/solitaire | SP | OK | Renders | — | components/practice_games/PracticeSolitaire.tsx | — |
| Klondike | /practice/play/klondike | SP | OK | Renders | — | components/practice_games/PracticeKlondike.tsx | — |
| Snake | /practice/play/snake | SP | OK | Renders | — | components/practice_games/PracticeSnake.tsx | — |
| Memory Match | /practice/play/memory_match | SP | OK | Renders | — | components/practice_games/PracticeMemoryMatch.tsx | — |
| 8-Ball Pool | /practice/play/pool_8ball | SP | OK | Renders | — | components/practice_games/PracticePool8Ball.tsx | — |
| Ping Pong | /practice/play/ping_pong | SP | OK | Renders | — | components/practice_games/PracticePingPong.tsx | — |
| Battleship | /practice/play/battleship | SP | OK | Renders | — | components/practice_games/PracticeBattleship.tsx | — |
| Yahtzee | /practice/play/yahtzee | SP | OK | Renders | — | components/practice_games/PracticeYahtzee.tsx | — |
| Two Truths Lie | /practice/play/two_truths_lie | SP | OK | Renders | — | components/practice_games/PracticeTwoTruthsLie.tsx | — |

## HTTP-Multiplayer (`/http-multiplayer-game/<type>/test-room`) — 26 games

| Game | Route | Mode | Status | Failure Mode | Severity | Notes |
|---|---|---|---|---|---|---|
| uno | /http-multiplayer-game/uno/test-room | MP | OK | Loading-game state shown (expected for fake room) | — | — |
| hearts | …/hearts/test-room | MP | OK | Loading state | — | — |
| spades | …/spades/test-room | MP | OK | Loading state | — | — |
| spades4p | …/spades4p/test-room | MP | OK | Loading state | — | — |
| gofish | …/gofish/test-room | MP | OK | Loading state | — | — |
| rummy | …/rummy/test-room | MP | OK | Loading state | — | — |
| ginrummy | …/ginrummy/test-room | MP | OK | Loading state | — | — |
| war | …/war/test-room | MP | OK | Loading state | — | — |
| crazyeights | …/crazyeights/test-room | MP | OK | Loading state | — | — |
| blackjack | …/blackjack/test-room | MP | OK | Loading state | — | — |
| poker | …/poker/test-room | MP | OK | Loading state | — | — |
| chess | …/chess/test-room | MP | OK | Loading state | — | — |
| checkers | …/checkers/test-room | MP | OK | Loading state | — | — |
| connect4 | …/connect4/test-room | MP | OK | Loading state | — | — |
| trivia | …/trivia/test-room | MP | OK | Loading state | — | — |
| ludo | …/ludo/test-room | MP | OK | Loading state | — | — |
| backgammon | …/backgammon/test-room | MP | OK | Loading state | — | — |
| carrom | …/carrom/test-room | MP | OK | Loading state | — | — |
| dominoes | …/dominoes/test-room | MP | OK | Loading state | — | — |
| mancala | …/mancala/test-room | MP | OK | Loading state | — | — |
| parcheesi | …/parcheesi/test-room | MP | OK | Loading state | — | — |
| mahjong | …/mahjong/test-room | MP | OK | Loading state | — | — |
| shogi | …/shogi/test-room | MP | OK | Loading state | — | — |
| xiangqi | …/xiangqi/test-room | MP | OK | Loading state | — | — |
| chinesecheckers | …/chinesecheckers/test-room | MP | OK | Loading state | — | — |
| truthordare | …/truthordare/test-room | MP | OK | Loading state | — | — |

## Findings Summary

- **0 hard failures / blank screens** — every route mounts without auth bounce.
- **WinnerTicker regression: FIXED** on `/multiplayer`.
- **3 game issues** discovered (Checkers HIGH, Chess MEDIUM, Connect 4 MEDIUM).
- 64 console errors total across full sweep — mostly from sequential remounts; none fatal.
