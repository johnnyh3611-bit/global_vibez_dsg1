// Enhanced Avatar System with Backend Persistence
// Migrates from localStorage to MongoDB

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const DEFAULT_AVATARS = [
  { id: 'avatar_1', emoji: '😎', name: 'Cool Player', background: 'blue', border_color: 'cyan' },
  { id: 'avatar_2', emoji: '🎮', name: 'Gamer', background: 'purple', border_color: 'pink' },
  { id: 'avatar_3', emoji: '🌟', name: 'Star', background: 'yellow', border_color: 'orange' },
  { id: 'avatar_4', emoji: '🔥', name: 'Fire', background: 'red', border_color: 'rose' },
  { id: 'avatar_5', emoji: '💎', name: 'Diamond', background: 'cyan', border_color: 'blue' },
  { id: 'avatar_6', emoji: '🎯', name: 'Target', background: 'green', border_color: 'emerald' },
  { id: 'avatar_7', emoji: '👑', name: 'King', background: 'yellow', border_color: 'amber' },
  { id: 'avatar_8', emoji: '🚀', name: 'Rocket', background: 'indigo', border_color: 'purple' },
];

/**
 * Fetch user's avatar from backend
 */
export async function fetchAvatarFromBackend() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const response = await fetch(`${API_URL}/api/avatars/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      return data.avatar;
    }
  } catch (error) {
    // console.error('Failed to fetch avatar from backend:', error);
  }
  return null;
}

/**
 * Save avatar to backend
 */
export async function saveAvatarToBackend(avatarData) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      localStorage.setItem('userAvatar', JSON.stringify(avatarData));
      return false;
    }

    const response = await fetch(`${API_URL}/api/avatars/save`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(avatarData)
    });

    if (response.ok) {
      // Also save to localStorage as cache
      localStorage.setItem('userAvatar', JSON.stringify(avatarData));
      return true;
    }
  } catch (error) {
    // console.error('Failed to save avatar to backend:', error);
    // Fallback to localStorage
    localStorage.setItem('userAvatar', JSON.stringify(avatarData));
  }
  return false;
}

/**
 * Migrate avatar from localStorage to backend
 * This runs automatically on login/page load
 */
export async function migrateAvatarToBackend() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;

    // Check if there's localStorage data
    const localStorageAvatar = localStorage.getItem('userAvatar');
    if (!localStorageAvatar) return false;

    const avatarData = JSON.parse(localStorageAvatar);

    const response = await fetch(`${API_URL}/api/avatars/migrate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(avatarData)
    });

    if (response.ok) {
      return true;
    }
  } catch (error) {
    // console.error('Failed to migrate avatar:', error);
  }
  return false;
}

/**
 * Get user's avatar (checks backend first, then localStorage)
 */
export async function getUserAvatar() {
  // Try backend first
  const backendAvatar = await fetchAvatarFromBackend();
  if (backendAvatar) {
    // Update localStorage cache
    localStorage.setItem('userAvatar', JSON.stringify(backendAvatar));
    return backendAvatar;
  }

  // Fallback to localStorage
  const localAvatar = localStorage.getItem('userAvatar');
  if (localAvatar) {
    try {
      return JSON.parse(localAvatar);
    } catch {
      return DEFAULT_AVATARS[1]; // Default Gamer
    }
  }

  return DEFAULT_AVATARS[1]; // Default Gamer
}

/**
 * Update user's avatar
 */
export async function updateUserAvatar(avatarData) {
  const saved = await saveAvatarToBackend(avatarData);
  if (saved) {
    return avatarData;
  }
  // Even if backend fails, localStorage is updated
  return avatarData;
}

/**
 * Initialize avatar system (call on app load)
 */
export async function initializeAvatarSystem() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Attempt migration from localStorage to backend
  await migrateAvatarToBackend();

  // Fetch latest from backend
  return await getUserAvatar();
}

// Legacy functions for backward compatibility
export function getRandomAvatar() {
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
}

export function getAvatarById(id) {
  return DEFAULT_AVATARS.find(a => a.id === id) || DEFAULT_AVATARS[0];
}

// Avatar Component (React)
export function AvatarDisplay({ avatar, size = 'md', showGradient = true }) {
  const sizes = {
    sm: 'w-12 h-12 text-2xl',
    md: 'w-20 h-20 text-4xl',
    lg: 'w-32 h-32 text-6xl',
  };

  const backgroundColors = {
    blue: 'from-blue-400 to-cyan-400',
    purple: 'from-purple-400 to-pink-400',
    yellow: 'from-yellow-400 to-orange-400',
    red: 'from-red-400 to-rose-400',
    cyan: 'from-cyan-400 to-blue-400',
    green: 'from-green-400 to-emerald-400',
    indigo: 'from-indigo-400 to-purple-400',
  };

  if (typeof avatar === 'string') {
    // If it's just an emoji string
    return (
      <div className={`${sizes[size]} flex items-center justify-center`}>
        <span>{avatar}</span>
      </div>
    );
  }

  // If it's a full avatar object
  const gradient = avatar.background ? backgroundColors[avatar.background] : 'from-purple-400 to-pink-400';

  return (
    <div className={`${sizes[size]} rounded-full ${showGradient ? `bg-gradient-to-br ${gradient}` : 'bg-gray-700'} flex items-center justify-center shadow-lg`}>
      <span className="text-center">{avatar.emoji}</span>
    </div>
  );
}
