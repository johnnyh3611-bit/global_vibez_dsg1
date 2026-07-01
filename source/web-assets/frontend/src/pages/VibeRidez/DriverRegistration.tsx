import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, User, Phone, CreditCard, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DriverRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone_number: '',
    license_number: '',
    vehicle: {
      make: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      plate_number: '',
      seats: 4
    },
    bio: ''
  });

  const userId = localStorage.getItem('user_id') || 'demo_user';
  const username = localStorage.getItem('username') || 'Demo User';

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVehicleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      vehicle: { ...prev.vehicle, [field]: value }
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/vibe-ridez/driver/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          user_id: userId,
          username: username,
          ...formData
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setStep(3); // Success screen
        setTimeout(() => navigate('/vibe-ridez/driver-dashboard'), 2000);
      } else {
        alert(data.detail || 'Registration failed');
      }
    } catch (error) {
      // console.error('Registration error:', error);
      alert('Failed to register as driver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/vibe-ridez')}
          className="text-white hover:bg-white/10 mb-6"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold text-white mb-2 text-center">
            Become a <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Vibe Ridez</span> Driver
          </h1>
          <p className="text-gray-300 text-center mb-8">Connect with riders and earn on your own schedule</p>

          <Card className="bg-slate-800/50 border-slate-700 p-8">
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <User className="w-6 h-6 text-cyan-400" />
                  Driver Information
                </h2>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                      placeholder="(555) 123-4567"
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Driver's License Number</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      value={formData.license_number}
                      onChange={(e) => handleInputChange('license_number', e.target.value)}
                      placeholder="ABC123456"
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Bio (Optional)</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell riders a bit about yourself..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md text-white placeholder:text-gray-400"
                  />
                </div>

                <Button
                  onClick={() => setStep(2)}
                  disabled={!formData.phone_number || !formData.license_number}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800"
                >
                  Continue to Vehicle Info
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Car className="w-6 h-6 text-cyan-400" />
                  Vehicle Information
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block">Make</label>
                    <Input
                      type="text"
                      value={formData.vehicle.make}
                      onChange={(e) => handleVehicleChange('make', e.target.value)}
                      placeholder="Toyota"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block">Model</label>
                    <Input
                      type="text"
                      value={formData.vehicle.model}
                      onChange={(e) => handleVehicleChange('model', e.target.value)}
                      placeholder="Camry"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block">Year</label>
                    <Input
                      type="number"
                      value={formData.vehicle.year}
                      onChange={(e) => handleVehicleChange('year', parseInt(e.target.value))}
                      placeholder="2023"
                      min="2000"
                      max={new Date().getFullYear() + 1}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block">Color</label>
                    <Input
                      type="text"
                      value={formData.vehicle.color}
                      onChange={(e) => handleVehicleChange('color', e.target.value)}
                      placeholder="Black"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block">License Plate</label>
                    <Input
                      type="text"
                      value={formData.vehicle.plate_number}
                      onChange={(e) => handleVehicleChange('plate_number', e.target.value.toUpperCase())}
                      placeholder="ABC1234"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block">Available Seats</label>
                    <Input
                      type="number"
                      value={formData.vehicle.seats}
                      onChange={(e) => handleVehicleChange('seats', parseInt(e.target.value))}
                      min="1"
                      max="8"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 border-slate-700 text-white hover:bg-slate-700"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !formData.vehicle.make || !formData.vehicle.model || !formData.vehicle.plate_number}
                    className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                  >
                    {loading ? 'Registering...' : 'Complete Registration'}
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle className="w-24 h-24 text-green-400 mx-auto mb-4" />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">Registration Successful!</h2>
                <p className="text-gray-300 mb-4">Your driver profile is being verified.</p>
                <p className="text-sm text-gray-400">Redirecting to dashboard...</p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}