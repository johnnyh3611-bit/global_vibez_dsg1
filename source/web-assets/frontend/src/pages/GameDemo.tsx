import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gamepad2 } from 'lucide-react';

export default function GameDemo() {
  const [selectedGame, setSelectedGame] = useState('tictactoe');

  const gameCategories = {
    social: [
      { id: 'would_you_rather', name: 'Would You Rather', emoji: '🤔' },
      { id: 'truth_or_dare', name: 'Truth or Dare', emoji: '😈' },
      { id: 'trivia', name: 'Trivia', emoji: '🧠' },
    ],
    board: [
      { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '⭕' },
      { id: 'connect_four', name: 'Connect Four', emoji: '🔴' },
      { id: 'checkers', name: 'Checkers', emoji: '🟤' },
      { id: 'battleship', name: 'Battleship', emoji: '🚢' },
      { id: 'dots_and_boxes', name: 'Dots & Boxes', emoji: '📦' },
      { id: 'hangman', name: 'Hangman', emoji: '🔤' },
    ],
    cards: [
      { id: 'spades', name: 'Spades', emoji: '♠️' },
      { id: 'hearts', name: 'Hearts', emoji: '♥️' },
      { id: 'tonk', name: 'Tonk', emoji: '🃏' },
      { id: 'go_fish', name: 'Go Fish', emoji: '🎣' },
      { id: 'crazy_eights', name: 'Crazy Eights', emoji: '8️⃣' },
      { id: 'war', name: 'War', emoji: '⚔️' },
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Gamepad2 className="w-16 h-16 mx-auto text-purple-600 mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Game Examples</h1>
          <p className="text-gray-600 mb-2">16 Games Available! See what they all look like</p>
          <p className="text-sm text-purple-600 font-semibold">
            🎮 5 Social Games • 🎯 6 Board Games • 🃏 6 Card Games
          </p>
        </div>

        {/* Game Categories */}
        <div className="mb-8">
          <div className="space-y-6">
            {/* Social Games */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">🎭 Social & Party Games</h3>
              <div className="flex flex-wrap gap-2">
                {gameCategories.social.map((game) => (
                  <Button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className={`${
                      selectedGame === game.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-700 border-2 border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{game.emoji}</span>
                    {game.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Board Games */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">🎯 Board & Strategy Games</h3>
              <div className="flex flex-wrap gap-2">
                {gameCategories.board.map((game) => (
                  <Button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className={`${
                      selectedGame === game.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border-2 border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{game.emoji}</span>
                    {game.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Card Games */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">🃏 Classic Card Games</h3>
              <div className="flex flex-wrap gap-2">
                {gameCategories.cards.map((game) => (
                  <Button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className={`${
                      selectedGame === game.id
                        ? 'bg-red-600 text-white'
                        : 'bg-white text-gray-700 border-2 border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{game.emoji}</span>
                    {game.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Game Display */}
        {selectedGame === 'tictactoe' && <TicTacToeDemo />}
        {selectedGame === 'connect_four' && <ConnectFourDemo />}
        {selectedGame === 'would_you_rather' && <WouldYouRatherDemo />}
        {selectedGame === 'truth_or_dare' && <TruthOrDareDemo />}
        {selectedGame === 'trivia' && <TriviaDemo />}
        {selectedGame === 'spades' && <SpadesDemo />}
        {selectedGame === 'hearts' && <HeartsDemo />}
        {selectedGame === 'tonk' && <TonkDemo />}
        {selectedGame === 'go_fish' && <GoFishDemo />}
        {selectedGame === 'crazy_eights' && <CrazyEightsDemo />}
        {selectedGame === 'war' && <WarDemo />}
        {selectedGame === 'checkers' && <CheckersDemo />}
        {selectedGame === 'battleship' && <BattleshipDemo />}
        {selectedGame === 'dots_and_boxes' && <DotsAndBoxesDemo />}
        {selectedGame === 'hangman' && <HangmanDemo />}
      </div>
    </div>
  );
}

function TicTacToeDemo() {
  const [board, setBoard] = useState(['X', 'O', 'X', '', 'O', '', '', '', '']);

  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">⭕ Tic-Tac-Toe</h2>
      <p className="text-center text-gray-600 mb-6">
        Classic 3x3 grid game. Get three in a row to win!
      </p>
      
      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
        {board.map((cell, index) => (
          <div
            key={`board-${index}`}
            className="aspect-square text-6xl font-bold rounded-xl border-4 border-purple-300 bg-white flex items-center justify-center"
          >
            {cell}
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-600">You are: <span className="font-bold text-purple-600 text-xl">X</span></p>
        <p className="text-sm text-gray-500 mt-2">Click empty squares to make your move</p>
      </div>
    </Card>
  );
}

function ConnectFourDemo() {
  const demoBoard = [
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '🔴', '', '', ''],
    ['', '', '🔴', '🟡', '', '', ''],
    ['', '🟡', '🔴', '🟡', '', '', ''],
    ['🔴', '🟡', '🔴', '🟡', '🔴', '', ''],
  ];

  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">🔴 Connect Four</h2>
      <p className="text-center text-gray-600 mb-6">
        Drop your pieces and connect 4 in a row (horizontal, vertical, or diagonal)!
      </p>
      
      <div className="bg-blue-600 p-4 rounded-xl mb-6">
        <div className="grid grid-cols-7 gap-2">
          {demoBoard.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`aspect-square rounded-full text-4xl flex items-center justify-center
                  ${cell ? 'bg-white' : 'bg-blue-400'}
                `}
              >
                {cell}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-600">You are: <span className="font-bold text-3xl">🔴</span></p>
        <p className="text-sm text-gray-500 mt-2">Click a column to drop your piece</p>
      </div>
    </Card>
  );
}

function WouldYouRatherDemo() {
  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">🤔</span>
        <h2 className="text-2xl font-bold mb-2">Would You Rather</h2>
        <p className="text-gray-600">Make tough choices and see what your match picks!</p>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-center mb-6 text-gray-800">
          Would you rather have the ability to fly or be invisible?
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <Button className="p-8 h-auto bg-gradient-to-br from-purple-500 to-pink-500 text-white text-lg hover:scale-105 transition-transform">
            ✈️ Fly
          </Button>
          <Button className="p-8 h-auto bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-lg hover:scale-105 transition-transform">
            👻 Be Invisible
          </Button>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500">
        5 rounds of fun questions to get to know each other!
      </p>
    </Card>
  );
}

function TruthOrDareDemo() {
  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">😈</span>
        <h2 className="text-2xl font-bold mb-2">Truth or Dare</h2>
        <p className="text-gray-600">Classic party game - choose your challenge!</p>
      </div>

      <div className="space-y-4 mb-8">
        <Button className="w-full p-8 text-xl bg-blue-600 hover:bg-blue-700 text-white">
          💬 Truth
        </Button>
        <Button className="w-full p-8 text-xl bg-red-600 hover:bg-red-700 text-white">
          🎯 Dare
        </Button>
      </div>

      <Card className="p-6 bg-purple-50 mb-6">
        <p className="text-sm text-gray-600 mb-2 font-semibold">Example Truth:</p>
        <p className="text-base">"What's your biggest fear in a relationship?"</p>
      </Card>

      <Card className="p-6 bg-red-50">
        <p className="text-sm text-gray-600 mb-2 font-semibold">Example Dare:</p>
        <p className="text-base">"Send a voice message singing a love song"</p>
      </Card>
    </Card>
  );
}

function TriviaDemo() {
  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">🧠</span>
        <h2 className="text-2xl font-bold mb-2">Trivia Quiz</h2>
        <p className="text-gray-600">Test your knowledge and compete!</p>
        <div className="flex justify-center gap-8 mt-4">
          <div>
            <p className="text-sm text-gray-600">You</p>
            <p className="text-3xl font-bold text-purple-600">2</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Opponent</p>
            <p className="text-3xl font-bold text-pink-600">1</p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-center mb-6 text-gray-800">
        What is the capital of France?
      </h3>

      <div className="grid gap-3">
        {['London', 'Paris', 'Berlin', 'Rome'].map((option, index) => (
          <Button
            key={`item-${index}`}
            className={`p-4 text-lg hover:scale-105 transition-transform
              ${index === 1 ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-purple-500'}
            `}
          >
            {option}
          </Button>
        ))}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        3 questions per game • Multiple choice format
      </p>
    </Card>
  );
}



// ==================== CARD GAMES ====================

function SpadesDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">♠️</span>
        <h2 className="text-2xl font-bold mb-2">Spades</h2>
        <p className="text-gray-600">Classic trick-taking card game - bid and win tricks!</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Your Hand (13 cards):</h3>
        <div className="grid grid-cols-7 gap-2">
          {['♠️ A', '♠️ K', '♠️ 5', '♥️ Q', '♥️ 8', '♦️ J', '♦️ 7'].map((card, idx) => (
            <div key={`item-${idx}`} className="bg-white border-2 border-gray-300 rounded-lg p-3 text-center font-bold">
              {card}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-green-100 p-4 rounded-lg mb-4">
        <p className="text-sm font-semibold text-green-800">Current Trick:</p>
        <div className="flex gap-3 mt-2">
          <div className="bg-white border-2 border-green-600 rounded-lg p-3 text-center font-bold">
            ♠️ 10
          </div>
          <div className="bg-white border-2 border-gray-300 rounded-lg p-3 text-center font-bold">
            ?
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-gray-600">
        <p>Your Tricks: <span className="font-bold text-purple-600">3</span></p>
        <p className="mt-2">Lead with your highest spade to win the trick!</p>
      </div>
    </Card>
  );
}

function HeartsDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">♥️</span>
        <h2 className="text-2xl font-bold mb-2">Hearts</h2>
        <p className="text-gray-600">Avoid taking hearts and the Queen of Spades!</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Your Hand:</h3>
        <div className="grid grid-cols-6 gap-2">
          {['♣️ A', '♣️ 9', '♦️ K', '♦️ 8', '♠️ 7', '♥️ 3'].map((card, idx) => (
            <div key={`item-${idx}`} className={`bg-white border-2 rounded-lg p-3 text-center font-bold ${
              card.includes('♥️') ? 'border-red-500' : 'border-gray-300'
            }`}>
              {card}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Your Hearts</p>
          <p className="text-3xl font-bold text-red-600">2</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Total Points</p>
          <p className="text-3xl font-bold text-purple-600">12</p>
        </div>
      </div>

      <p className="text-center text-sm text-gray-600">
        ⚠️ Lowest score wins! Each ♥️ = 1 point, ♠️ Q = 13 points
      </p>
    </Card>
  );
}

function TonkDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">🃏</span>
        <h2 className="text-2xl font-bold mb-2">Tonk</h2>
        <p className="text-gray-600">Rummy-style game - get the lowest score to win!</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Your Hand (5 cards):</h3>
        <div className="flex justify-center gap-3">
          {['♠️ 7', '♥️ 7', '♦️ 7', '♣️ K', '♠️ 2'].map((card, idx) => (
            <div key={`item-${idx}`} className="bg-white border-2 border-gray-300 rounded-lg p-4 text-center font-bold text-lg">
              {card}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Discard Pile</p>
            <p className="text-2xl font-bold">♦️ 9</p>
          </div>
          <Button className="bg-blue-600">Draw Card</Button>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-600">Your Score: <span className="font-bold text-purple-600">33</span></p>
        <p className="text-xs text-gray-500 mt-2">Make sets of 3+ matching cards to reduce your score!</p>
      </div>
    </Card>
  );
}

function GoFishDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">🎣</span>
        <h2 className="text-2xl font-bold mb-2">Go Fish</h2>
        <p className="text-gray-600">Collect matching pairs - ask your opponent for cards!</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Your Hand:</h3>
        <div className="flex justify-center gap-2 flex-wrap">
          {['♠️ 8', '♥️ 8', '♦️ K', '♣️ 5', '♠️ 3', '♥️ A'].map((card, idx) => (
            <div key={`item-${idx}`} className="bg-white border-2 border-gray-300 rounded-lg p-3 text-center font-bold">
              {card}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg mb-4">
        <p className="text-center font-semibold text-yellow-800">
          "Do you have any 8s?"
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Your Pairs</p>
          <p className="text-3xl font-bold text-purple-600">2</p>
        </div>
        <div className="bg-pink-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Opponent Pairs</p>
          <p className="text-3xl font-bold text-pink-600">1</p>
        </div>
      </div>
    </Card>
  );
}

function CrazyEightsDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">8️⃣</span>
        <h2 className="text-2xl font-bold mb-2">Crazy Eights</h2>
        <p className="text-gray-600">Match the suit or rank - 8s are wild!</p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Your Hand:</h3>
        <div className="flex justify-center gap-2">
          {['♠️ 5', '♥️ 8', '♦️ K', '♣️ 5'].map((card, idx) => (
            <div key={`item-${idx}`} className={`bg-white border-2 rounded-lg p-4 text-center font-bold ${
              card.includes('8') ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300'
            }`}>
              {card}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-green-100 p-6 rounded-lg mb-4 text-center">
        <p className="text-sm text-gray-600 mb-2">Top Card:</p>
        <div className="inline-block bg-white border-4 border-green-600 rounded-lg p-6 text-center font-bold text-2xl">
          ♠️ 9
        </div>
        <p className="text-sm text-green-800 font-semibold mt-3">Current Suit: ♠️ Spades</p>
      </div>

      <p className="text-center text-sm text-gray-600">
        Play a ♠️ card, any 9, or an 8 to change suit!
      </p>
    </Card>
  );
}

function WarDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">⚔️</span>
        <h2 className="text-2xl font-bold mb-2">War</h2>
        <p className="text-gray-600">High card wins! Battle for the deck!</p>
      </div>

      <div className="bg-gradient-to-r from-red-100 to-blue-100 p-6 rounded-lg mb-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Your Card</p>
            <div className="bg-white border-4 border-red-600 rounded-lg p-6 text-3xl font-bold">
              ♥️ K
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Opponent Card</p>
            <div className="bg-white border-4 border-blue-600 rounded-lg p-6 text-3xl font-bold">
              ♠️ 10
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mb-4">
        <p className="text-2xl font-bold text-green-600 mb-2">🎉 You Win This Round!</p>
        <p className="text-sm text-gray-600">King beats 10</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Your Deck</p>
          <p className="text-2xl font-bold text-red-600">28 cards</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Opponent Deck</p>
          <p className="text-2xl font-bold text-blue-600">24 cards</p>
        </div>
      </div>
    </Card>
  );
}

// ==================== BOARD GAMES ====================

function CheckersDemo() {
  const board = Array(8).fill(null).map(() => Array(8).fill(''));
  // Add some pieces for demo
  board[1][1] = '⚫'; board[1][3] = '⚫'; board[2][2] = '⚫';
  board[5][4] = '⚪'; board[6][5] = '⚪'; board[6][7] = '⚪';

  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">🟤</span>
        <h2 className="text-2xl font-bold mb-2">Checkers</h2>
        <p className="text-gray-600">Jump over opponent pieces to capture them!</p>
      </div>

      <div className="bg-amber-900 p-4 rounded-xl mb-6">
        <div className="grid grid-cols-8 gap-0">
          {board.map((row, rowIdx) =>
            row.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`aspect-square flex items-center justify-center text-4xl ${
                  (rowIdx + colIdx) % 2 === 0 ? 'bg-amber-100' : 'bg-amber-700'
                }`}
              >
                {cell}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-center text-sm text-gray-600">
        <p>You are: <span className="text-3xl">⚪</span></p>
        <p className="mt-2">Move diagonally, capture by jumping over opponent pieces!</p>
      </div>
    </Card>
  );
}

function BattleshipDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">🚢</span>
        <h2 className="text-2xl font-bold mb-2">Battleship</h2>
        <p className="text-gray-600">Sink your opponent's fleet! Call coordinates to attack</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-center">Your Fleet</h3>
          <div className="bg-blue-100 p-4 rounded-lg">
            <div className="grid grid-cols-5 gap-1">
              {Array(25).fill(0).map((_, idx) => (
                <div key={`item-${idx}`} className={`aspect-square rounded ${
                  [2, 7, 12].includes(idx) ? 'bg-gray-700' : 
                  [8, 13].includes(idx) ? 'bg-red-500' : 'bg-blue-300'
                }`}></div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-center">Opponent Grid</h3>
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="grid grid-cols-5 gap-1">
              {Array(25).fill(0).map((_, idx) => (
                <div key={`item-${idx}`} className={`aspect-square rounded ${
                  [5, 10].includes(idx) ? 'bg-red-500' : 
                  [3, 8, 18].includes(idx) ? 'bg-blue-200' : 'bg-gray-300'
                }`}></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-gray-600">
        <p className="mb-2">🔴 = Hit • 💧 = Miss • ⬛ = Your Ship</p>
        <p>Call your shot! Click a square to attack</p>
      </div>
    </Card>
  );
}

function DotsAndBoxesDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">📦</span>
        <h2 className="text-2xl font-bold mb-2">Dots & Boxes</h2>
        <p className="text-gray-600">Connect dots to complete boxes and claim them!</p>
      </div>

      <div className="bg-white p-6 rounded-lg mb-6 border-2 border-gray-200">
        <div className="grid grid-cols-5 gap-8 relative">
          {Array(25).fill(0).map((_, idx) => (
            <div key={`item-${idx}`} className="w-3 h-3 bg-gray-800 rounded-full"></div>
          ))}
        </div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{top: '24px', left: '24px'}}>
          <line x1="0" y1="0" x2="80" y2="0" stroke="purple" strokeWidth="3" />
          <line x1="0" y1="0" x2="0" y2="80" stroke="purple" strokeWidth="3" />
          <line x1="80" y1="0" x2="80" y2="80" stroke="blue" strokeWidth="3" />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Your Boxes</p>
          <p className="text-3xl font-bold text-purple-600">3</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Opponent Boxes</p>
          <p className="text-3xl font-bold text-blue-600">2</p>
        </div>
      </div>

      <p className="text-center text-sm text-gray-600">
        Click between dots to draw lines and complete boxes!
      </p>
    </Card>
  );
}

function HangmanDemo() {
  return (
    <Card className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-6xl mb-4 block">🔤</span>
        <h2 className="text-2xl font-bold mb-2">Hangman</h2>
        <p className="text-gray-600">Guess the word letter by letter!</p>
      </div>

      <div className="mb-8">
        <div className="flex justify-center gap-3 mb-6">
          {['R', 'O', 'M', 'A', 'N', 'C', 'E'].map((letter, idx) => (
            <div key={`item-${idx}`} className="w-12 h-16 border-b-4 border-purple-600 flex items-center justify-center text-2xl font-bold">
              {[0, 1, 5].includes(idx) ? letter : '_'}
            </div>
          ))}
        </div>

        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <p className="text-sm text-gray-600 mb-2 text-center">Guessed Letters:</p>
          <div className="flex justify-center flex-wrap gap-2">
            {['R', 'O', 'C', 'T', 'S'].map((letter, idx) => (
              <span key={`item-${idx}`} className={`px-3 py-1 rounded ${
                ['R', 'O', 'C'].includes(letter) ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
              }`}>
                {letter}
              </span>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Wrong Guesses: <span className="font-bold text-red-600">2/6</span></p>
          <div className="text-6xl">🙂</div>
        </div>
      </div>

      <div className="grid grid-cols-9 gap-2">
        {['A','B','C','D','E','F','G','H','I'].map((letter, idx) => (
          <Button key={`item-${idx}`} variant="outline" className="aspect-square p-0">
            {letter}
          </Button>
        ))}
      </div>
    </Card>
  );
}
