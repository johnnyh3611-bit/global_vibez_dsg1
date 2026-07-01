import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Shield, AlertTriangle, Clock, Phone, CheckCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Safety() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [activeShares, setActiveShares] = useState({ my_shares: [], shared_with_me: [] });
  const [showStartShare, setShowStartShare] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trustedContact, setTrustedContact] = useState(null);
  const [showTrustedContactForm, setShowTrustedContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    fetchMatches();
    fetchActiveShares();
    fetchTrustedContact();
    const interval = setInterval(fetchActiveShares, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matches`, {
        
      });
      if (response.ok) {
        const data = await response.json();
        setMatches(data);
      }
    } catch (error) {
      // console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveShares = async () => {
    try {
      const response = await fetch(`${API_URL}/api/safety/my-active-shares`, {
        
      });
      if (response.ok) {
        const data = await response.json();
        setActiveShares(data);
      }
    } catch (error) {
      // console.error('Error fetching shares:', error);
    }
  };

  const startLocationShare = async (matchId, duration = 120) => {
    try {
      const response = await fetch(`${API_URL}/api/safety/share/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          match_id: matchId,
          duration_minutes: duration,
          emergency_contacts: []
        }),
      });

      if (response.ok) {
        alert('Location sharing started!');
        fetchActiveShares();
        setShowStartShare(false);
      }
    } catch (error) {
      // console.error('Error starting share:', error);
    }
  };

  const stopShare = async (shareId) => {
    if (!window.confirm('Stop sharing your location?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/safety/share/stop?share_id=${shareId}`, {
        method: 'POST',
        
      });
      if (response.ok) {
        alert('Location sharing stopped');
        fetchActiveShares();
      }
    } catch (error) {
      // console.error('Error stopping share:', error);
    }
  };

  const sendCheckIn = async (shareId) => {
    try {
      const response = await fetch(`${API_URL}/api/safety/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          share_id: shareId,
          message: "I'm safe ✓"
        }),
      });
      if (response.ok) {
        alert('Check-in sent!');
      }
    } catch (error) {
      // console.error('Error sending check-in:', error);
    }
  };

  const fetchTrustedContact = async () => {
    try {
      const response = await fetch(`${API_URL}/api/safety/trusted-contact`, {
        
      });
      if (response.ok) {
        const data = await response.json();
        setTrustedContact(data.trusted_contact);
        if (data.trusted_contact) {
          setContactForm(data.trusted_contact);
        }
      }
    } catch (error) {
      // console.error('Error fetching trusted contact:', error);
    }
  };

  const saveTrustedContact = async () => {
    if (!contactForm.name || (!contactForm.phone && !contactForm.email)) {
      alert('Please provide name and at least phone or email');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/safety/trusted-contact/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify(contactForm),
      });

      if (response.ok) {
        alert('Trusted contact saved!');
        fetchTrustedContact();
        setShowTrustedContactForm(false);
      }
    } catch (error) {
      // console.error('Error saving trusted contact:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <div className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Safety Tracking</h1>
            </div>
            <Button
              onClick={() => setShowStartShare(!showStartShare)}
              className="bg-blue-600 text-white"
            >
              Share Location
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Info Banner */}
        <Card className="p-6 bg-blue-50 border-blue-200 mb-8">
          <div className="flex items-start space-x-4">
            <Shield className="w-12 h-12 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Stay Safe on Your Dates</h3>
              <p className="text-gray-700 text-sm">
                Share your real-time location with trusted matches for a limited time. They'll know where you are and
                when you check in. Your safety is our priority.
              </p>
            </div>
          </div>
        </Card>

        {/* Trusted Contact Section */}
        <Card className="p-6 mb-8 border-green-200 bg-green-50">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Phone className="w-6 h-6 mr-2 text-green-600" />
            Trusted Contact
          </h3>
          {trustedContact ? (
            <div>
              <div className="bg-white p-4 rounded-lg mb-4">
                <p className="font-semibold text-gray-900">{trustedContact.name}</p>
                {trustedContact.phone && (
                  <p className="text-sm text-gray-600">📱 {trustedContact.phone}</p>
                )}
                {trustedContact.email && (
                  <p className="text-sm text-gray-600">📧 {trustedContact.email}</p>
                )}
              </div>
              <Button
                onClick={() => setShowTrustedContactForm(true)}
                variant="outline"
                size="sm"
              >
                Update Contact
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-gray-700 text-sm mb-4">
                Add a trusted person who will be notified when you book rides or activate safety features.
              </p>
              <Button
                onClick={() => setShowTrustedContactForm(true)}
                className="bg-green-600 text-white"
              >
                Add Trusted Contact
              </Button>
            </div>
          )}
        </Card>

        {/* Trusted Contact Form */}
        {showTrustedContactForm && (
          <Card className="p-6 mb-8 border-green-200">
            <h3 className="text-xl font-bold mb-4">Set Trusted Contact</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                  placeholder="Mom, Best Friend, etc."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={contactForm.phone || ''}
                  onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                  placeholder="+1234567890"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={contactForm.email || ''}
                  onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                  placeholder="trusted@example.com"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={saveTrustedContact} className="flex-1 bg-green-600 text-white">
                  Save Contact
                </Button>
                <Button onClick={() => setShowTrustedContactForm(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Start Share Dialog */}
        {showStartShare && (
          <Card className="p-6 mb-8">
            <h3 className="text-xl font-bold mb-4">Share Location With</h3>
            <div className="space-y-3">
              {matches.map((match) => (
                <button
                  key={match.match_id}
                  onClick={() => startLocationShare(match.match_id)}
                  className="w-full p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold">
                      {match.user.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{match.user.name}</p>
                      <p className="text-sm text-gray-600">Share for 2 hours (default)</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Active Shares - My Broadcasts */}
        {activeShares.my_shares.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📍 You're Sharing Location</h2>
            <div className="space-y-4">
              {activeShares.my_shares.map((share) => (
                <Card key={share.share_id} className="p-6 border-blue-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold">Sharing with match</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Expires: {new Date(share.expires_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => sendCheckIn(share.share_id)}
                          size="sm"
                          className="bg-green-600 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Send Check-In
                        </Button>
                        <Button
                          onClick={() => stopShare(share.share_id)}
                          size="sm"
                          variant="outline"
                        >
                          Stop Sharing
                        </Button>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        Active
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Shared With Me */}
        {activeShares.shared_with_me.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">👀 Tracking Others</h2>
            <div className="space-y-4">
              {activeShares.shared_with_me.map((share) => (
                <Card key={share.share_id} className="p-6 border-purple-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                        {share.user?.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{share.user?.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">is sharing location with you</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Until: {new Date(share.expires_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/safety/track/${share.share_id}`)}
                      className="bg-purple-600 text-white"
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      View Map
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Active Shares */}
        {activeShares.my_shares.length === 0 && activeShares.shared_with_me.length === 0 && !loading && (
          <Card className="p-12 text-center">
            <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Location Sharing</h3>
            <p className="text-gray-600 mb-6">
              Start sharing your location before going on a date for added safety!
            </p>
            <Button
              onClick={() => setShowStartShare(true)}
              className="bg-blue-600 text-white"
            >
              Share Location
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
