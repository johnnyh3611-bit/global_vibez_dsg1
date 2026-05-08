import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Upload, Plus, X, DollarSign, Store, User } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RestaurantSubmit() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: basic info, 2: details, 3: menu, 4: payment
  const [submitting, setSubmitting] = useState(false);
  const [restaurantId, setRestaurantId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: '',
    reservation_link: '',
    cuisine_type: [],
    ambiance: [],
    price_range: '$$',
    average_meal_cost: '',
    photos: [],
    cover_photo: '',
    special_offers: '',
    features: [],
    hours_of_operation: '',
    submitter_type: 'business'
  });

  const cuisineOptions = ['Italian', 'Japanese', 'Mexican', 'Chinese', 'Indian', 'American', 'French', 'Thai', 'Mediterranean', 'Korean', 'Vietnamese', 'Greek', 'Spanish', 'Brazilian'];
  
  const ambianceOptions = ['Romantic', 'Casual', 'Upscale', 'Family-Friendly', 'Trendy', 'Quiet', 'Lively', 'Cozy', 'Modern', 'Traditional'];
  
  const featureOptions = ['Outdoor Seating', 'Live Music', 'Private Dining', 'Bar', 'Wine Selection', 'Vegan Options', 'Gluten-Free Options', 'Parking Available', 'Wheelchair Accessible', 'Pet-Friendly'];

  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      const response = await fetch(`${API}/api/restaurants/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to submit restaurant');
      }

      const data = await response.json();
      setRestaurantId(data.restaurant_id);
      setStep(4); // Move to payment step
    } catch (err) {
      // console.error('Error submitting restaurant:', err);
      alert(err.message || 'Failed to submit restaurant');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArrayItem = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  // Step 1: Basic Info
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 p-6">
        <div className="max-w-3xl mx-auto">
          <Button
            onClick={() => navigate('/restaurants')}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Card className="p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">List Your Restaurant</h1>
              <p className="text-gray-600">Get priority placement when users search in your area</p>
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-orange-900">💎 Monthly Subscription: $49.99/month</p>
                <p className="text-xs text-orange-700 mt-1">✓ 1st priority in your location ✓ Featured in AI Date Planner</p>
              </div>
            </div>

            {/* Submitter Type */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">I am a:</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setFormData({...formData, submitter_type: 'business'})}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.submitter_type === 'business'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Store className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                  <p className="font-semibold">Business Owner</p>
                </button>
                <button
                  onClick={() => setFormData({...formData, submitter_type: 'user'})}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.submitter_type === 'user'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <User className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                  <p className="font-semibold">Recommending a Spot</p>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Restaurant Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="e.g., La Bella Vita"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg h-24"
                  placeholder="Tell us about this restaurant..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="123 Main Street"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Zip Code</label>
                  <input
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.name || !formData.address || !formData.city}
              className="w-full mt-6 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-3"
            >
              Next: Details & Features
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Details
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Details & Features</h2>

            <div className="space-y-6">
              {/* Cuisine Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Cuisine Type (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {cuisineOptions.map(cuisine => (
                    <button
                      key={cuisine}
                      onClick={() => toggleArrayItem('cuisine_type', cuisine)}
                      className={`px-4 py-2 rounded-full text-sm transition-all ${
                        formData.cuisine_type.includes(cuisine)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ambiance */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Ambiance (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {ambianceOptions.map(amb => (
                    <button
                      key={amb}
                      onClick={() => toggleArrayItem('ambiance', amb)}
                      className={`px-4 py-2 rounded-full text-sm transition-all ${
                        formData.ambiance.includes(amb)
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {amb}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Price Range</label>
                <div className="grid grid-cols-4 gap-3">
                  {['$', '$$', '$$$', '$$$$'].map(price => (
                    <button
                      key={price}
                      onClick={() => setFormData({...formData, price_range: price})}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.price_range === price
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-xl font-bold">{price}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Average Meal Cost */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Average Meal Cost (per person)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    value={formData.average_meal_cost}
                    onChange={(e) => setFormData({...formData, average_meal_cost: e.target.value})}
                    className="w-full p-3 pl-10 border border-gray-300 rounded-lg"
                    placeholder="25"
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Features</label>
                <div className="flex flex-wrap gap-2">
                  {featureOptions.map(feature => (
                    <button
                      key={feature}
                      onClick={() => toggleArrayItem('features', feature)}
                      className={`px-4 py-2 rounded-full text-sm transition-all ${
                        formData.features.includes(feature)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {feature}
                    </button>
                  ))}
                </div>
              </div>

              {/* Website & Reservations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Reservation Link</label>
                  <input
                    type="url"
                    value={formData.reservation_link}
                    onChange={(e) => setFormData({...formData, reservation_link: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Special Offers */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Special Offers for Couples</label>
                <input
                  type="text"
                  value={formData.special_offers}
                  onChange={(e) => setFormData({...formData, special_offers: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="e.g., '20% off for couples on Wednesdays'"
                />
              </div>

              {/* Hours */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Hours of Operation</label>
                <textarea
                  value={formData.hours_of_operation}
                  onChange={(e) => setFormData({...formData, hours_of_operation: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg h-20"
                  placeholder="Mon-Fri: 11am-10pm, Sat-Sun: 10am-11pm"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold"
              >
                Next: Review & Submit
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Review
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Review & Submit</h2>

            <div className="bg-gray-50 rounded-lg p-6 mb-6 space-y-3 text-sm">
              <div><span className="font-semibold">Name:</span> {formData.name}</div>
              <div><span className="font-semibold">Address:</span> {formData.address}, {formData.city}</div>
              <div><span className="font-semibold">Cuisine:</span> {formData.cuisine_type.join(', ') || 'Not specified'}</div>
              <div><span className="font-semibold">Ambiance:</span> {formData.ambiance.join(', ') || 'Not specified'}</div>
              <div><span className="font-semibold">Price Range:</span> {formData.price_range}</div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-orange-900 font-semibold mb-2">Monthly Subscription: $49.99/month</p>
              <ul className="text-xs text-orange-700 space-y-1">
                <li>✓ 1st priority when users search in your zone</li>
                <li>✓ Featured in AI Date Planner suggestions</li>
                <li>✓ Priority in "near me" searches</li>
                <li>✓ Analytics dashboard access</li>
              </ul>
              <p className="text-xs text-orange-600 mt-2">Your listing will be reviewed within 24-48 hours</p>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold"
              >
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Step 4: Payment
  if (step === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Restaurant Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your restaurant has been submitted for review. Subscribe for priority placement!
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">Monthly Subscription: <span className="font-bold text-xl">$49.99</span></p>
            <ul className="text-xs text-gray-600 space-y-1 text-left">
              <li>✓ 1st priority in your location</li>
              <li>✓ Featured in AI Date Planner</li>
              <li>✓ Analytics dashboard</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">Billed monthly • Cancel anytime</p>
          </div>
          <Button
            onClick={() => navigate(`/payment/restaurant-subscription/${restaurantId}`)}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold mb-3"
          >
            Subscribe Now - $49.99/mo
          </Button>
          <Button
            onClick={() => navigate('/restaurants')}
            variant="outline"
            className="w-full"
          >
            Maybe Later (Free Listing)
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}
