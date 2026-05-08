import React, { useState } from 'react';
import { Brain, Trophy, RotateCcw } from 'lucide-react';

const TRIVIA_QUESTIONS = [
  { q: 'What is the capital of France?', a: ['Paris', 'London', 'Berlin', 'Madrid'], correct: 0, category: 'Geography' },
  { q: 'Who painted the Mona Lisa?', a: ['Van Gogh', 'Da Vinci', 'Picasso', 'Monet'], correct: 1, category: 'Art' },
  { q: 'What is 2 + 2?', a: ['3', '4', '5', '6'], correct: 1, category: 'Math' },
  { q: 'What year did WW2 end?', a: ['1943', '1944', '1945', '1946'], correct: 2, category: 'History' },
  { q: 'What is the largest planet?', a: ['Earth', 'Mars', 'Jupiter', 'Saturn'], correct: 2, category: 'Science' },
  { q: 'Who wrote Romeo and Juliet?', a: ['Dickens', 'Shakespeare', 'Austen', 'Hemingway'], correct: 1, category: 'Literature' },
  { q: 'What is H2O?', a: ['Oxygen', 'Hydrogen', 'Water', 'Carbon'], correct: 2, category: 'Science' },
  { q: 'How many continents are there?', a: ['5', '6', '7', '8'], correct: 2, category: 'Geography' },
  { q: 'What is the speed of light?', a: ['200k km/s', '300k km/s', '400k km/s', '500k km/s'], correct: 1, category: 'Science' },
  { q: 'Who invented the telephone?', a: ['Edison', 'Bell', 'Tesla', 'Franklin'], correct: 1, category: 'History' }
];

export default function PracticeTrivia({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);

  const handleAnswer = (index) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(index);
    const correct = index === TRIVIA_QUESTIONS[currentQuestion].correct;
    
    if (correct) {
      setScore(score + 10 + streak * 5);
      setStreak(streak + 1);
    } else {
      setStreak(0);
    }

    setTimeout(() => {
      if (currentQuestion + 1 >= TRIVIA_QUESTIONS.length) {
        setGameOver(true);
      } else {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(null);
      }
    }, 2000);
  };

  const resetGame = () => {
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setGameOver(false);
    setStreak(0);
  };

  const question = TRIVIA_QUESTIONS[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
            🎯 TRIVIA QUEST
          </h1>
          <p className="text-purple-300">Test your knowledge!</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 border-2 border-blue-400">
            <div className="text-blue-100 text-sm">Question</div>
            <div className="text-3xl font-bold text-white">{currentQuestion + 1}/{TRIVIA_QUESTIONS.length}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 border-2 border-yellow-400">
            <div className="text-yellow-100 text-sm">Score</div>
            <div className="text-3xl font-bold text-white">{score}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-cyan-600 rounded-xl p-4 border-2 border-green-400">
            <div className="text-green-100 text-sm">Streak</div>
            <div className="text-3xl font-bold text-white">{streak}🔥</div>
          </div>
        </div>

        {!gameOver ? (
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 border-4 border-purple-500">
            <div className="text-center mb-8">
              <div className="inline-block bg-purple-700 px-4 py-2 rounded-full text-purple-200 text-sm mb-4">
                {question.category}
              </div>
              <h2 className="text-3xl font-bold text-white mb-6">{question.q}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {question.a.map((answer, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = i === question.correct;
                const showResult = selectedAnswer !== null;

                return (
                  <button
                    key={`option-${i}`}
                    onClick={() => handleAnswer(i)}
                    disabled={selectedAnswer !== null}
                    className={`p-6 rounded-xl text-xl font-bold transition-all border-4 ${
                      showResult && isCorrect
                        ? 'bg-green-600 border-green-400 scale-105'
                        : showResult && isSelected && !isCorrect
                        ? 'bg-red-600 border-red-400'
                        : 'bg-purple-700 border-purple-500 hover:scale-105 hover:bg-purple-600'
                    } disabled:cursor-not-allowed text-white`}
                  >
                    {answer}
                    {showResult && isCorrect && ' ✅'}
                    {showResult && isSelected && !isCorrect && ' ❌'}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-4xl font-bold text-white mb-4">Quiz Complete!</h2>
            <p className="text-3xl text-yellow-400 mb-2">Final Score: {score}</p>
            <p className="text-xl text-orange-300 mb-6">Correct: {score / 10} / {TRIVIA_QUESTIONS.length}</p>
            <button
              onClick={resetGame}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-6 h-6" />
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}