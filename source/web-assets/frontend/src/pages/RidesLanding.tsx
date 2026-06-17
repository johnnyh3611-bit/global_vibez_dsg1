import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Car, DollarSign, Shield, Star, TrendingUp, Users, Zap, Heart } from 'lucide-react';
import Logo from '@/components/Logo';

export default function RidesLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Logo size="3xl" className="drop-shadow-2xl" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Global Vibez DSG Rides
            </h1>
            <p className="text-2xl md:text-3xl mb-4 text-blue-100">
              Rides for Everyone. Better for Drivers.
            </p>
            <p className="text-xl mb-8 text-blue-50">
              15% cheaper than legacy rideshare • Drivers earn 60% + tips
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/ride/book')}
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6"
              >
                <Car className="w-6 h-6 mr-2" />
                Book a Ride
              </Button>
              <Button
                onClick={() => navigate('/driver/register')}
                className="bg-green-600 text-white hover:bg-green-700 text-lg px-8 py-6"
              >
                <DollarSign className="w-6 h-6 mr-2" />
                Become a Driver
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Why Choose Us - Riders */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center mb-12">Why Ride with Us?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-8 text-center hover:shadow-xl transition-all">
            <DollarSign className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h3 className="text-2xl font-bold mb-3">15% Cheaper</h3>
            <p className="text-gray-600">
              Save money on every ride. A typical 3-mile trip costs only $8.90 compared to legacy rideshare at ~$15.
            </p>
          </Card>

          <Card className="p-8 text-center hover:shadow-xl transition-all">
            <Shield className="w-16 h-16 mx-auto text-blue-600 mb-4" />
            <h3 className="text-2xl font-bold mb-3">Safety First</h3>
            <p className="text-gray-600">
              Set trusted contacts who get notified. Track your ride in real-time. Verified drivers.
            </p>
          </Card>

          <Card className="p-8 text-center hover:shadow-xl transition-all">
            <Star className="w-16 h-16 mx-auto text-yellow-600 mb-4" />
            <h3 className="text-2xl font-bold mb-3">Quality Drivers</h3>
            <p className="text-gray-600">
              Our drivers earn more, so they're happier and provide better service. Rated 4.8/5 average.
            </p>
          </Card>
        </div>
      </div>

      {/* Pricing Comparison */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">Transparent Pricing</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-8 border-2 border-gray-200">
              <h3 className="text-2xl font-bold mb-6 text-gray-700">Legacy Rideshare</h3>
              <div className="space-y-3 text-lg">
                <div className="flex justify-between">
                  <span>Base Fare:</span>
                  <span className="font-semibold">$2.50</span>
                </div>
                <div className="flex justify-between">
                  <span>Per Mile:</span>
                  <span className="font-semibold">$1.50</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Fee:</span>
                  <span className="font-semibold">$2.50</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-xl">
                  <span className="font-bold">3 Miles:</span>
                  <span className="font-bold text-red-600">~$15</span>
                </div>
              </div>
            </Card>

            <Card className="p-8 border-4 border-blue-600 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold">
                  BEST VALUE
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-6 text-blue-600">Global Vibez DSG</h3>
              <div className="space-y-3 text-lg">
                <div className="flex justify-between">
                  <span>Base Fare:</span>
                  <span className="font-semibold">$1.50</span>
                </div>
                <div className="flex justify-between">
                  <span>Per Mile:</span>
                  <span className="font-semibold">$1.20</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Fee:</span>
                  <span className="font-semibold">$1.80</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-xl">
                  <span className="font-bold">3 Miles:</span>
                  <span className="font-bold text-green-600">~$9</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Driver Benefits */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center mb-4">Drive & Earn More</h2>
        <p className="text-xl text-center text-gray-600 mb-12">
          Better earnings. Flexible hours. Happier drivers.
        </p>
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="p-6 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-green-600 mb-3" />
            <h3 className="text-3xl font-bold text-green-600 mb-2">60%</h3>
            <p className="text-gray-600">of every ride + 100% tips</p>
            <p className="text-sm text-gray-500 mt-2">(Industry avg: ~25%)</p>
          </Card>

          <Card className="p-6 text-center">
            <Zap className="w-12 h-12 mx-auto text-blue-600 mb-3" />
            <h3 className="text-3xl font-bold text-blue-600 mb-2">Fast</h3>
            <p className="text-gray-600">Weekly payouts</p>
            <p className="text-sm text-gray-500 mt-2">Get paid quickly</p>
          </Card>

          <Card className="p-6 text-center">
            <Users className="w-12 h-12 mx-auto text-purple-600 mb-3" />
            <h3 className="text-3xl font-bold text-purple-600 mb-2">Open</h3>
            <p className="text-gray-600">To everyone</p>
            <p className="text-sm text-gray-500 mt-2">Not just dating users</p>
          </Card>

          <Card className="p-6 text-center">
            <Heart className="w-12 h-12 mx-auto text-rose-600 mb-3" />
            <h3 className="text-3xl font-bold text-rose-600 mb-2">Fair</h3>
            <p className="text-gray-600">Transparent pricing</p>
            <p className="text-sm text-gray-500 mt-2">No hidden fees</p>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Button
            onClick={() => navigate('/driver/register')}
            className="bg-gradient-to-r from-green-600 to-blue-600 text-white text-xl px-12 py-6"
          >
            Start Driving Today →
          </Button>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-2xl font-bold mb-3">Request</h3>
              <p className="text-blue-100">
                Enter your destination and see the price upfront. No surprises.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-2xl font-bold mb-3">Match</h3>
              <p className="text-blue-100">
                Get matched with a nearby driver. See their rating and vehicle info.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-2xl font-bold mb-3">Ride</h3>
              <p className="text-blue-100">
                Track your ride in real-time. Rate your driver and add a tip if you'd like.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Ready to Save Money?
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Join thousands of riders and drivers who've switched to Global Vibez DSG
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => navigate('/ride/book')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg px-10 py-6"
          >
            Book Your First Ride
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="text-lg px-10 py-6"
          >
            Learn More About Global Vibez DSG
          </Button>
        </div>
      </div>
    </div>
  );
}
