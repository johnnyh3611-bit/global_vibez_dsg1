/**
 * Notification and Sound Effects Utility
 * Simple helpers for better UX
 */

// Play sound effects
export const playSound = (type) => {
  try {
    const sounds = {
      match: '/sounds/match-found.mp3',
      move: '/sounds/move.mp3',
      win: '/sounds/win.mp3',
      lose: '/sounds/lose.mp3',
      click: '/sounds/click.mp3'
    };

    const audio = new Audio(sounds[type]);
    audio.volume = 0.3;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Notification sound failed:", err);
    }
    // Silently fail if sounds not available
  }
};

// Show browser notification
export const showNotification = (title, body, options = {}) => {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      ...options
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body, icon: '/logo192.png', ...options });
      }
    });
  }
};

// Request notification permission on app load
export const requestNotificationPermission = () => {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
};

// Vibrate (mobile)
export const vibrate = (pattern = [100]) => {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
};

// Celebrate with effects
export const celebrate = () => {
  playSound('win');
  vibrate([100, 50, 100, 50, 200]);
  showNotification('🏆 You Win!', 'Congratulations on your victory!');
};

// Notify turn
export const notifyTurn = () => {
  playSound('move');
  vibrate([50]);
  showNotification('🎮 Your Turn!', 'Make your move!');
};

// Notify match found
export const notifyMatchFound = (opponentName) => {
  playSound('match');
  vibrate([200]);
  showNotification('🎮 Match Found!', `You're playing against ${opponentName}`);
};
