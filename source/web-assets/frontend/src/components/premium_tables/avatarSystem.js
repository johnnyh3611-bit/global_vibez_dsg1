// Default Avatar System for Players

export const DEFAULT_AVATARS = [
  {
    id: 'avatar_1',
    emoji: '😎',
    name: 'Cool Player',
    gradient: 'from-blue-400 to-cyan-400',
  },
  {
    id: 'avatar_2',
    emoji: '🎮',
    name: 'Gamer',
    gradient: 'from-purple-400 to-pink-400',
  },
  {
    id: 'avatar_3',
    emoji: '🌟',
    name: 'Star',
    gradient: 'from-yellow-400 to-orange-400',
  },
  {
    id: 'avatar_4',
    emoji: '🔥',
    name: 'Fire',
    gradient: 'from-red-400 to-rose-400',
  },
  {
    id: 'avatar_5',
    emoji: '💎',
    name: 'Diamond',
    gradient: 'from-cyan-400 to-blue-400',
  },
  {
    id: 'avatar_6',
    emoji: '🎯',
    name: 'Target',
    gradient: 'from-green-400 to-emerald-400',
  },
  {
    id: 'avatar_7',
    emoji: '👑',
    name: 'King',
    gradient: 'from-yellow-400 to-amber-400',
  },
  {
    id: 'avatar_8',
    emoji: '🚀',
    name: 'Rocket',
    gradient: 'from-indigo-400 to-purple-400',
  },
];

export function getRandomAvatar() {
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
}

export function getAvatarById(id) {
  return DEFAULT_AVATARS.find(a => a.id === id) || DEFAULT_AVATARS[0];
}

// Avatar Component for rendering
export function AvatarDisplay({ avatar, size = 'md', showGradient = true }) {
  const sizes = {
    sm: 'w-12 h-12 text-2xl',
    md: 'w-20 h-20 text-4xl',
    lg: 'w-32 h-32 text-6xl',
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
  return (
    <div className={`${sizes[size]} rounded-full ${showGradient ? `bg-gradient-to-br ${avatar.gradient}` : 'bg-gray-700'} flex items-center justify-center shadow-lg`}>
      <span className="text-center">{avatar.emoji}</span>
    </div>
  );
}
