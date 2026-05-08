import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Categories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedTab, setSelectedTab] = useState('intents');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories/all`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      // console.error('Error fetching categories:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories/stats`, {
        
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      // console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (type, id) => {
    navigate(`/discover-category/${type}/${id}`);
  };

  if (loading || !categories) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-gray-600">Loading categories...</div>
      </div>
    );
  }

  const intents = categories.relationship_intents || [];
  const interests = categories.interest_categories || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-900">Browse by Category</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-sm border-b sticky top-[73px] z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setSelectedTab('intents')}
              className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === 'intents'
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Relationship Goals
            </button>
            <button
              onClick={() => setSelectedTab('interests')}
              className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === 'interests'
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Interests & Hobbies
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {selectedTab === 'intents' && (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm mb-4">
              Find people looking for the same type of connection as you
            </p>
            {intents.map((intent) => (
              <button
                key={intent.id}
                onClick={() => handleCategoryClick('intent', intent.id)}
                className="w-full bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-pink-200 transition-all text-left group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <span className="text-4xl">{intent.emoji}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-pink-600 transition-colors">
                        {intent.label}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{intent.description}</p>
                      {stats?.relationship_intents?.[intent.id] && (
                        <p className="text-xs text-gray-400 mt-2">
                          {stats.relationship_intents[intent.id].count} users
                        </p>
                      )}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 group-hover:text-pink-500 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedTab === 'interests' && (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm mb-4">
              Connect with people who share your passions
            </p>
            {interests.map((interest) => (
              <button
                key={interest.id}
                onClick={() => handleCategoryClick('interest', interest.id)}
                className="w-full bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all text-left group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <span className="text-4xl">{interest.emoji}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                        {interest.label}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{interest.description}</p>
                      {stats?.interest_categories?.[interest.id] && (
                        <p className="text-xs text-gray-400 mt-2">
                          {stats.interest_categories[interest.id].count} users
                        </p>
                      )}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
