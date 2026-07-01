import { useState } from "react";
import { Star, X, CheckCircle2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const REVIEW_TAGS = [
  "safe_driving",
  "friendly",
  "clean_vehicle",
  "on_time",
  "smooth_ride",
  "professional",
];

export default function RateDriverModal({ ride, onClose, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API}/api/ratings/ride`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_id: ride.ride_id,
          driver_id: ride.driver_id,
          rating,
          review_text: reviewText || null,
          review_tags: selectedTags,
        }),
        
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to submit rating");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 via-black to-pink-900 border border-cyan-500/30 rounded-2xl max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">Rate Your Ride</h2>
        <p className="text-gray-300 mb-6">
          How was your experience with {ride.driver_name || "your driver"}?
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
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
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-600"
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-cyan-400 font-semibold mb-6">
            {rating === 5 && "Excellent! 🌟"}
            {rating === 4 && "Great! 👍"}
            {rating === 3 && "Good"}
            {rating === 2 && "Could be better"}
            {rating === 1 && "Needs improvement"}
          </p>
        )}

        {/* Review Tags */}
        <div className="mb-6">
          <p className="text-sm text-gray-300 mb-3">What did you like? (Optional)</p>
          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-cyan-500 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {tag.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Review Text */}
        <div className="mb-6">
          <label className="block text-sm text-gray-300 mb-2">
            Write a review (Optional)
          </label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share details about your experience..."
            className="w-full bg-black/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none"
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? "Submitting..." : "Submit Rating"}
        </button>
      </div>
    </div>
  );
}
