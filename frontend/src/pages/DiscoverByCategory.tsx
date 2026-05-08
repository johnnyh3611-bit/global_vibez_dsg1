import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DiscoverByCategory() {
  const { categoryType, categoryId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryInfo, setCategoryInfo] = useState(null);

  useEffect(() => {
    fetchCategoryUsers();
    fetchCategoryInfo();
  }, [categoryType, categoryId]);

  const fetchCategoryInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories/all`);
      const data = await response.json();
      
      const allCategories = [
        ...data.relationship_intents,
        ...data.interest_categories
      ];
      
      const category = allCategories.find(c => c.id === categoryId);
      setCategoryInfo(category);
    } catch (error) {
      // console.error('Error fetching category info:', error);
    }
  };

  const fetchCategoryUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/categories/discover/${categoryType}/${categoryId}?limit=50`,
        { }
      );
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else if (response.status === 401) {
        navigate('/');
      }
    } catch (error) {
      // console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    const currentUser = users[currentIndex];
    if (!currentUser) return;

    try {
      const response = await fetch(`${API_URL}/api/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          target_user_id: currentUser.user_id,
          action: action,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.is_match) {
          alert(`🎉 It's a match with ${currentUser.name}!`);
        }
        // Move to next user
        if (currentIndex < users.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          // No more users
          alert('No more users in this category!');
          navigate('/categories');
        }
      }
    } catch (error) {
      // console.error('Error swiping:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
        <div className="max-w-md mx-auto px-4 py-8">
          <button
            onClick={() => navigate('/categories')}
            className="text-pink-600 hover:text-pink-700 mb-4"
          >
            ← Back to Categories
          </button>
          <div className="bg-white rounded-xl p-8 shadow-lg text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              No users found
            </h2>
            <p className="text-gray-600 mb-6">
              There are no users in this category yet. Check back later!
            </p>
            <button
              onClick={() => navigate('/categories')}
              className="bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-pink-600 transition-colors"
            >
              Browse Other Categories
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentUser = users[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/categories')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            {categoryInfo && (
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{categoryInfo.emoji}</span>
                <span className="font-semibold text-gray-900">{categoryInfo.label}</span>
              </div>
            )}
            <div className="text-sm text-gray-500">
              {currentIndex + 1}/{users.length}
            </div>
          </div>
        </div>
      </div>

      {/* User Card */}
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Profile Picture */}
          <div className="relative h-96 bg-gradient-to-br from-pink-200 to-purple-200">
            {currentUser.picture || currentUser.photos?.[0] ? (
              <img
                src={currentUser.picture || currentUser.photos[0]}
                alt={currentUser.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">
                👤
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentUser.name}
                {currentUser.age && <span className="text-gray-600">, {currentUser.age}</span>}
              </h2>
              {currentUser.membership_type === 'premium' && (
                <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  ⭐ Premium
                </span>
              )}
            </div>

            {currentUser.location && (
              <p className="text-gray-600 mb-3">📍 {currentUser.location}</p>
            )}

            {currentUser.bio && (
              <p className="text-gray-700 mb-4">{currentUser.bio}</p>
            )}

            {currentUser.relationship_intent && (
              <div className="mb-3">
                <span className="text-sm text-gray-500">Looking for:</span>
                <span className="ml-2 text-sm font-medium text-pink-600">
                  {currentUser.relationship_intent}
                </span>
              </div>
            )}

            {currentUser.interests?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Interests:</p>
                <div className="flex flex-wrap gap-2">
                  {currentUser.interests.map((interest, idx) => (
                    <span
                      key={`interests-${idx}`}
                      className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {currentUser.interest_categories?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Categories:</p>
                <div className="flex flex-wrap gap-2">
                  {currentUser.interest_categories.map((cat, idx) => (
                    <span
                      key={`interest_categories-${idx}`}
                      className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center space-x-6 pb-8">
            <button
              onClick={() => handleSwipe('dislike')}
              className="w-16 h-16 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-3xl transition-all hover:scale-110"
            >
              ❌
            </button>
            <button
              onClick={() => handleSwipe('like')}
              className="w-20 h-20 rounded-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 flex items-center justify-center text-4xl transition-all hover:scale-110 shadow-lg"
            >
              ❤️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
