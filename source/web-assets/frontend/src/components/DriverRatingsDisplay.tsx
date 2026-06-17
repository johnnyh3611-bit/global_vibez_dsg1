
import { useState, useEffect } from "react";
import { Star, ThumbsUp, TrendingUp } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function DriverRatingsDisplay({ driverId }) {
  const [ratings, setRatings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent'); // 'recent' or 'helpful'

  useEffect(() => {
    fetchRatings();
  }, [driverId]);

  const fetchRatings = async () => {
    try {
      const res = await fetch(`${API}/api/ratings/driver/${driverId}`);
      if (res.ok) {
        const data = await res.json();
        setRatings(data);
      }
    } catch (err) {
      // console.error("Failed to fetch ratings:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-gray-400 text-sm">Loading ratings...</div>
    );
  }

  if (!ratings || ratings.total_ratings === 0) {
    return (
      <div className="text-gray-400 text-sm">No ratings yet</div>
    );
  }

  const { average_rating, total_ratings, rating_breakdown, recent_reviews } = ratings;
  
  // Sort reviews based on selection
  const sortedReviews = [...recent_reviews].sort((a, b) => {
    if (sortBy === 'helpful') {
      return (b.helpful_count || 0) - (a.helpful_count || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // recent
  });

  return (
    <div className="space-y-4">
      {/* Overall Rating */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-yellow-400">{average_rating}</div>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(average_rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-600"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">{total_ratings} ratings</p>
        </div>

        {/* Rating Breakdown */}
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = rating_breakdown[star] || 0;
            const percentage = total_ratings > 0 ? (count / total_ratings) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 w-8">{star}★</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-gray-400 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Reviews */}
      {recent_reviews.length > 0 && (
        <div className="space-y-3 mt-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-300">Reviews</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortBy('helpful')}
                className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                  sortBy === 'helpful'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                Most Helpful
              </button>
            </div>
          </div>
          {sortedReviews.slice(0, 3).map((review) => (
            <div
              key={review.rating_id}
              className="bg-black/30 border border-gray-700 rounded-lg p-3"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {review.passenger_photo && (
                    <img
                      src={review.passenger_photo}
                      alt={review.passenger_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {review.passenger_name || "Anonymous"}
                    </p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>

              {review.review_tags && review.review_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {review.review_tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full"
                    >
                      {tag.replace("_", " ")}
                    </span>
                  ))}
                </div>
              )}

              {review.review_text && (
                <p className="text-sm text-gray-300">{review.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
