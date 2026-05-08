import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Car, Upload, CheckCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DriverRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    plate_number: '',
    vehicle_type: 'sedan'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/drivers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          vehicle: formData
        })
      });

      if (response.ok) {
        alert('Driver registration submitted! Our team will review your application.');
        navigate('/driver/dashboard');
      } else {
        const error = await response.json();
        alert(error.detail || 'Registration failed');
      }
    } catch (error) {
      // console.error('Error registering:', error);
      alert('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 pb-20">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
            ← Back
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="p-8">
          <div className="text-center mb-8">
            <Car className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Become a Driver</h1>
            <p className="text-gray-600">Start earning by giving rides to Global Vibez DSG users</p>
          </div>

          <div className="bg-green-50 p-6 rounded-lg mb-8">
            <h3 className="font-bold text-green-900 mb-3">Why Drive with Global Vibez DSG?</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li>✅ <strong>60% earnings</strong> (vs industry avg 25%)</li>
              <li>✅ <strong>Keep 100% of tips</strong></li>
              <li>✅ <strong>Flexible schedule</strong> - drive when you want</li>
              <li>✅ <strong>Open to everyone</strong> - not just dating users</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Vehicle Information</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Make</label>
                <input
                  type="text"
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({...formData, make: e.target.value})}
                  placeholder="Toyota"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  placeholder="Camry"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <input
                  type="number"
                  required
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                  min="2010"
                  max={new Date().getFullYear() + 1}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <input
                  type="text"
                  required
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  placeholder="Black"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">License Plate</label>
                <input
                  type="text"
                  required
                  value={formData.plate_number}
                  onChange={(e) => setFormData({...formData, plate_number: e.target.value})}
                  placeholder="ABC-1234"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({...formData, vehicle_type: e.target.value})}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none"
                >
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="van">Van</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> You can upload your driver's license, insurance, and registration documents after submitting this form. Our team will review your application within 24-48 hours.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-6 text-lg font-semibold"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
