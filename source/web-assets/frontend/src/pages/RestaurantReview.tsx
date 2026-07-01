import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Star, Upload, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RestaurantReview() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [dateVisited, setDateVisited] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const tagOptions = ['Romantic', 'Loud', 'Expensive', 'Great Service', 'Fast Service', 'Cozy', 'Crowded', 'Hidden Gem', 'Instagram Worthy', 'Good for Groups'];

  useEffect(() => {
    fetchRestaurant();
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      const response = await fetch(`${API}/api/restaurants/${restaurantId}`);
      if (!response.ok) throw new Error('Restaurant not found');
      const data = await response.json();
      setRestaurant(data);
    } catch (err) {
      // console.error('Error:', err);
      alert('Restaurant not found');
      navigate('/restaurants');
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (!dateVisited) {
      setError('Please enter the date you visited');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API}/api/restaurants/${restaurantId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          restaurant_id: restaurantId,
          rating: rating,
          review_text: reviewText,
          photos: [],
          tags: selectedTags,
          date_visited: dateVisited
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit review');
      }

      alert('✅ Review submitted successfully!');
      navigate(`/restaurants/${restaurantId}`);
    } catch (err) {
      // console.error('Error submitting review:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-red-50 p-6">
      <div className="max-w-3xl mx-auto">
        <Button
          onClick={() => navigate(`/restaurants/${restaurantId}`)}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Restaurant
        </Button>

        <Card className="p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Leave a Review</h1>
            <p className="text-lg text-gray-600">{restaurant.name}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
              <p className="text-sm text-green-800">✓ Verified Visit - You visited via AI Date Planner</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star Rating */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-3">
                Overall Rating *
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-12 h-12 ${
                        star <= (hoverRating || rating)
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Very Good'}
                  {rating === 5 && 'Excellent'}
                </p>
              )}
            </div>

            {/* Date Visited */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date of Visit *
              </label>
              <input
                type="date"
                value={dateVisited}
                onChange={(e) => setDateVisited(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full p-3 border border-gray-300 rounded-lg"
                required
              />
            </div>

            {/* Review Text */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Experience (optional)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Tell us about your experience at this restaurant..."
                className="w-full p-3 border border-gray-300 rounded-lg h-32"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Add Tags (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || rating === 0}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-4 text-lg"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}