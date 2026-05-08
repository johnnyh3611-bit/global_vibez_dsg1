
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import Confetti from 'react-confetti';

const API = process.env.REACT_APP_BACKEND_URL;

const CompatibilityQuiz = ({ quizType }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQuiz();
  }, [quizType]);

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`${API}/api/quiz/${quizType}/questions`, {
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load quiz');
      }

      const data = await response.json();
      setQuiz(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (optionId) => {
    setSelectedOption(optionId);
  };

  const handleNext = () => {
    if (!selectedOption) return;

    // Save answer
    const question = quiz.questions[currentQuestion];
    setAnswers({
      ...answers,
      [question.id]: selectedOption
    });

    // Move to next question or finish
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedOption(null);
    } else {
      submitQuiz();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestion = quiz.questions[currentQuestion - 1];
      setSelectedOption(answers[prevQuestion.id] || null);
    }
  };

  const submitQuiz = async () => {
    setSubmitting(true);

    // Prepare submission data
    const submission = {
      answers: Object.entries({...answers, [quiz.questions[currentQuestion].id]: selectedOption}).map(([questionId, optionId]) => ({
        question_id: questionId,
        selected_option: optionId
      }))
    };

    try {
      const response = await fetch(`${API}/api/quiz/${quizType}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify(submission)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit quiz');
      }

      const result = await response.json();
      setCompleted(true);
      setShowConfetti(true);

      // Stop confetti after 5 seconds
      setTimeout(() => setShowConfetti(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900">
        <div className="text-white text-2xl">Loading quiz...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
        <Card className="p-8 max-w-md text-center bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">⚠️ Oops!</h2>
          <p className="text-gray-200 mb-6">{error}</p>
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-white text-purple-600 hover:bg-gray-100"
          >
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
        {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}
        
        <Card className="p-12 max-w-2xl text-center bg-white shadow-2xl">
          <div className="mb-6">
            <Sparkles className="w-20 h-20 mx-auto text-yellow-400 animate-pulse" />
          </div>
          
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🎉 Quiz Complete!
          </h1>
          
          <p className="text-xl text-gray-600 mb-6">
            Your {quizType === 'friends' ? 'friend' : 'dating'} compatibility profile has been saved!
          </p>
          
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-8">
            <p className="text-gray-700">
              <strong>What's next?</strong>
            </p>
            <p className="text-gray-600 mt-2">
              We'll use your answers to find your perfect {quizType === 'friends' ? 'friends' : 'matches'} with high compatibility scores. 
              Start swiping to see your compatibility percentage with each person!
            </p>
            <p className="text-sm text-gray-500 mt-4">
              💡 You can retake this quiz in 3 months to update your preferences.
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="px-8"
            >
              Dashboard
            </Button>
            <Button
              onClick={() => navigate(quizType === 'friends' ? '/find-friends' : '/discover')}
              className="px-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Start Matching! ✨
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <h1 className="text-3xl font-bold text-white mb-2">
            {quiz.title}
          </h1>
          <p className="text-gray-300">{quiz.description}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-white mb-2">
            <span className="text-sm">Question {currentQuestion + 1} of {quiz.total_questions}</span>
            <span className="text-sm font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <Card className="p-8 bg-white shadow-2xl mb-6 transition-all duration-300 hover:shadow-3xl">
          <div className="mb-6">
            <div className="text-6xl mb-4 text-center">{question.emoji}</div>
            <h2 className="text-2xl font-bold text-gray-800 text-center">
              {question.question}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  selectedOption === option.id
                    ? 'border-purple-500 bg-purple-50 shadow-lg transform scale-105'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-lg ${
                    selectedOption === option.id ? 'font-semibold text-purple-700' : 'text-gray-700'
                  }`}>
                    {option.text}
                  </span>
                  {selectedOption === option.id && (
                    <Check className="h-6 w-6 text-purple-500" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            onClick={handleBack}
            disabled={currentQuestion === 0}
            variant="outline"
            className="bg-white/10 text-white border-white/30 hover:bg-white/20 disabled:opacity-30"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <Button
            onClick={handleNext}
            disabled={!selectedOption || submitting}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8"
          >
            {submitting ? 'Submitting...' : currentQuestion === quiz.questions.length - 1 ? 'Finish' : 'Next'}
            {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        {/* Question Indicator Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {quiz.questions.map((_, index) => (
            <div
              key={_.id || _.name || `questions-${index}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentQuestion
                  ? 'w-8 bg-white'
                  : index < currentQuestion
                  ? 'w-2 bg-green-400'
                  : 'w-2 bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompatibilityQuiz;
