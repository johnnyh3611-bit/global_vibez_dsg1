import React, { useState, useEffect } from 'react';
import { Brain, Trophy, Flame } from 'lucide-react';

export default function PracticeTrivia({
  game,
  onMove,
  makingMove,
}: {
  game?: any;
  onMove?: (move: any) => void;
  makingMove?: boolean;
}) {
  const gameState = game?.game_state || {};
  const questions = gameState.questions || [];
  const currentQuestionIndex = gameState.current_question_index ?? 0;
  const score = gameState.player_score ?? 0;
  const streak = gameState.streak ?? 0;
  const isGameOver = game?.status === 'completed';

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Reset selected answer when the server advances the question
  useEffect(() => {
    setSelectedAnswer(null);
  }, [currentQuestionIndex]);

  const question = questions[currentQuestionIndex];

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null || makingMove || isGameOver || !onMove) return;
    setSelectedAnswer(index);
    onMove({
      action: 'answer',
      answer: index,
      question_index: currentQuestionIndex,
    });
  };

  if (isGameOver) {
    const total = questions.length || 10;
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400 text-center max-w-2xl w-full">
          <div className="text-6xl mb-4"><Trophy className="w-20 h-20 text-yellow-400 mx-auto" /></div>
          <h2 className="text-4xl font-bold text-white mb-4">Quiz Complete</h2>
          <p className="text-3xl text-yellow-400 mb-2">Final Score: {score}</p>
          <p className="text-xl text-orange-300">Great job finishing the trivia challenge</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <p className="text-white text-xl">Loading trivia questions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
            TRIVIA QUEST
          </h1>
          <p className="text-purple-300">Test your knowledge</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 border-2 border-blue-400">
            <div className="text-blue-100 text-sm">Question</div>
            <div className="text-3xl font-bold text-white">{currentQuestionIndex + 1}/{questions.length}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-4 border-2 border-yellow-400">
            <div className="text-yellow-100 text-sm">Score</div>
            <div className="text-3xl font-bold text-white">{score}</div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-cyan-600 rounded-xl p-4 border-2 border-green-400">
            <div className="text-green-100 text-sm">Streak</div>
            <div className="text-3xl font-bold text-white flex items-center justify-center gap-1">
              {streak}<Flame className="w-5 h-5 text-orange-300" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 border-4 border-purple-500">
          <div className="text-center mb-8">
            <div className="inline-block bg-purple-700 px-4 py-2 rounded-full text-purple-200 text-sm mb-4">
              {question.category}
            </div>
            <h2 className="text-3xl font-bold text-white mb-6">{question.q}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {question.a.map((answer: string, i: number) => {
              const isSelected = selectedAnswer === i;
              const isCorrect = i === question.correct;
              const showResult = selectedAnswer !== null;

              return (
                <button
                  key={`option-${i}`}
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null || makingMove}
                  className={`p-6 rounded-xl text-xl font-bold transition-all border-4 ${
                    showResult && isCorrect
                      ? 'bg-green-600 border-green-400 scale-105'
                      : showResult && isSelected && !isCorrect
                      ? 'bg-red-600 border-red-400'
                      : 'bg-purple-700 border-purple-500 hover:scale-105 hover:bg-purple-600'
                  } disabled:cursor-not-allowed text-white`}
                >
                  {answer}
                  {showResult && isCorrect && ' (correct)'}
                  {showResult && isSelected && !isCorrect && ' (wrong)'}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
