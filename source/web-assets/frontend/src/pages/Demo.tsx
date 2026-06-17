import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Gamepad2, Brain, Trophy, Heart, Users, MapPin, Utensils, Shield, Video } from 'lucide-react';

export default function Demo() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Gamepad2 className="w-12 h-12" />,
      title: "Try AI Games",
      description: "Play Tic-Tac-Toe, Connect 4, and more against AI",
      action: () => navigate('/practice'),
      color: "from-purple-500 to-indigo-500"
    },
    {
      icon: <Brain className="w-12 h-12" />,
      title: "Trivia Challenge",
      description: "Test your knowledge across 8 categories",
      action: () => navigate('/trivia'),
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Utensils className="w-12 h-12" />,
      title: "Discover Restaurants",
      description: "Browse date spots and venue recommendations",
      action: () => navigate('/restaurants'),
      color: "from-orange-500 to-yellow-500"
    },
    {
      icon: <Trophy className="w-12 h-12" />,
      title: "View Leaderboards",
      description: "See top trivia players and game champions",
      action: () => navigate('/trivia/leaderboard'),
      color: "from-green-500 to-emerald-500"
    }
  ];

  const protectedFeatures = [
    { icon: <Heart />, name: "Smart Matching" },
    { icon: <Users />, name: "Friend Finding" },
    { icon: <MapPin />, name: "Group Outings" },
    { icon: <Video />, name: "Video Chat" },
    { icon: <Shield />, name: "Safety Features" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <h1 className="text-5xl font-bold text-white mb-3">🎮 Demo Mode</h1>
          <p className="text-xl text-purple-200">
            Explore Global Vibez DSG features without signing in!
          </p>
        </div>

        {/* Available Features */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">✨ Try These Features Now</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, idx) => (
              <Card
                key={`features-${idx}`}
                className="p-6 bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/20 transition-all cursor-pointer"
                onClick={feature.action}
              >
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.color} text-white mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-white/70 mb-4">{feature.description}</p>
                <Button className="bg-white text-purple-900 hover:bg-gray-100">
                  Try It Now →
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Protected Features */}
        <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20 mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">🔒 Sign In to Unlock</h2>
          <p className="text-white/80 mb-6">
            These premium features require a Global Vibez DSG account:
          </p>
          <div className="grid md:grid-cols-5 gap-4 mb-6">
            {protectedFeatures.map((feature, idx) => (
              <div key={`protectedFeatures-${idx}`} className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-white/10 flex items-center justify-center text-white">
                  {feature.icon}
                </div>
                <p className="text-white/70 text-sm">{feature.name}</p>
              </div>
            ))}
          </div>
          <Button
            onClick={() => {
              const redirectUrl = `${window.location.origin}/dashboard`;
              window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
            }}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-6 text-lg"
          >
            Sign in with Google to Access All Features
          </Button>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20 text-center">
            <p className="text-4xl font-bold text-white mb-2">17+</p>
            <p className="text-white/70">Games Available</p>
          </Card>
          <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20 text-center">
            <p className="text-4xl font-bold text-white mb-2">11</p>
            <p className="text-white/70">AI Opponents</p>
          </Card>
          <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20 text-center">
            <p className="text-4xl font-bold text-white mb-2">8</p>
            <p className="text-white/70">Trivia Categories</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
