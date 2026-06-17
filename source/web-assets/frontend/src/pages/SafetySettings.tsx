import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SafetySettings() {
  const [preferences, setPreferences] = useState({
    prefer_same_gender: false,
    require_female_driver: false,
    share_live_location: true,
    enable_route_monitoring: true,
    enable_auto_checkins: true
  });
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    relationship: 'friend'
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    fetchPreferences();
    fetchEmergencyContacts();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch(`${API}/api/rides/safety/preferences/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      // console.error('Error fetching preferences:', error);
    }
  };

  const fetchEmergencyContacts = async () => {
    try {
      const response = await fetch(`${API}/api/rides/safety/emergency-contacts/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setEmergencyContacts(data.contacts || []);
      }
    } catch (error) {
      // console.error('Error fetching contacts:', error);
    }
  };

  const updatePreferences = async (newPrefs) => {
    try {
      const response = await fetch(`${API}/api/rides/safety/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ...newPrefs
        })
      });

      if (response.ok) {
        setPreferences(newPrefs);
      }
    } catch (error) {
      // console.error('Error updating preferences:', error);
    }
  };

  const addEmergencyContact = async () => {
    if (!newContact.name || !newContact.phone) {
      alert('Please fill in name and phone');
      return;
    }

    try {
      const response = await fetch(`${API}/api/rides/safety/emergency-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          contact_name: newContact.name,
          contact_phone: newContact.phone,
          contact_email: newContact.email,
          relationship: newContact.relationship
        })
      });

      if (response.ok) {
        fetchEmergencyContacts();
        setNewContact({ name: '', phone: '', email: '', relationship: 'friend' });
        setShowAddContact(false);
      }
    } catch (error) {
      // console.error('Error adding contact:', error);
    }
  };

  const removeContact = async (contactId) => {
    if (!window.confirm('Remove this emergency contact?')) return;

    try {
      const response = await fetch(`${API}/api/rides/safety/emergency-contact/${contactId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchEmergencyContacts();
      }
    } catch (error) {
      // console.error('Error removing contact:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Shield className="w-10 h-10 text-green-400" />
          Safety Settings
        </h1>
        <p className="text-gray-400 mb-8">Manage your ride safety preferences and emergency contacts</p>

        {/* Safety Preferences */}
        <div className="mb-8 bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Safety Preferences</h2>

          <div className="space-y-4">
            {/* Gender Preferences */}
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl">
              <div>
                <p className="text-white font-semibold">👩 Prefer Female Drivers Only</p>
                <p className="text-gray-400 text-sm">Only match with female drivers</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.require_female_driver}
                  onChange={(e) => updatePreferences({ ...preferences, require_female_driver: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl">
              <div>
                <p className="text-white font-semibold">🤝 Prefer Same-Gender Drivers</p>
                <p className="text-gray-400 text-sm">Match with drivers of your gender when possible</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.prefer_same_gender}
                  onChange={(e) => updatePreferences({ ...preferences, prefer_same_gender: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Location Sharing */}
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl">
              <div>
                <p className="text-white font-semibold">📍 Share Live Location</p>
                <p className="text-gray-400 text-sm">Let emergency contacts track your ride in real-time</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.share_live_location}
                  onChange={(e) => updatePreferences({ ...preferences, share_live_location: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Route Monitoring */}
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl">
              <div>
                <p className="text-white font-semibold">🗺️ Route Monitoring</p>
                <p className="text-gray-400 text-sm">Alert if driver deviates from expected route</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.enable_route_monitoring}
                  onChange={(e) => updatePreferences({ ...preferences, enable_route_monitoring: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Auto Check-ins */}
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl">
              <div>
                <p className="text-white font-semibold">✅ Automatic Safety Check-ins</p>
                <p className="text-gray-400 text-sm">Periodic check-ins during ride</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.enable_auto_checkins}
                  onChange={(e) => updatePreferences({ ...preferences, enable_auto_checkins: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-cyan-400" />
              Emergency Contacts
            </h2>
            <motion.button
              onClick={() => setShowAddContact(!showAddContact)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-white font-semibold flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-5 h-5" />
              Add Contact
            </motion.button>
          </div>

          {/* Add Contact Form */}
          {showAddContact && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 bg-black/40 rounded-xl border border-green-500/50"
            >
              <h3 className="text-white font-bold mb-4">Add Emergency Contact</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="w-full px-4 py-2 bg-black/60 border border-gray-700 rounded-xl text-white"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-black/60 border border-gray-700 rounded-xl text-white"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full px-4 py-2 bg-black/60 border border-gray-700 rounded-xl text-white"
                />
                <select
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                  className="w-full px-4 py-2 bg-black/60 border border-gray-700 rounded-xl text-white"
                >
                  <option value="friend">Friend</option>
                  <option value="family">Family</option>
                  <option value="partner">Partner</option>
                  <option value="roommate">Roommate</option>
                </select>
                <div className="flex gap-3">
                  <button
                    onClick={addEmergencyContact}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-white font-semibold"
                  >
                    Add Contact
                  </button>
                  <button
                    onClick={() => setShowAddContact(false)}
                    className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-xl text-white font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Contacts List */}
          {emergencyContacts.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <p className="text-white font-bold text-lg mb-2">No Emergency Contacts</p>
              <p className="text-gray-400">Add trusted contacts who will be notified during rides</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 bg-black/40 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl">
                      {contact.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold">{contact.name}</p>
                        {contact.verified && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{contact.relationship} • {contact.phone}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeContact(contact.id)}
                    className="p-2 bg-red-600/20 hover:bg-red-600/40 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
