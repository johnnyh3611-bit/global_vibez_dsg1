import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { AvatarUploadModal } from './AvatarUploadModal';
import { getRandomAvatar } from './avatarSystem';
import SecureStorage from '@/utils/SecureStorage';

// Local storage key for user avatar
const AVATAR_STORAGE_KEY = 'globalvibez_user_avatar';

export function UserAvatarManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);

  // Load avatar from SecureStorage on mount
  useEffect(() => {
    const loadAvatar = async () => {
      const savedAvatar = await SecureStorage.getItem(AVATAR_STORAGE_KEY);
      if (savedAvatar) {
        try {
          setUserAvatar(typeof savedAvatar === 'string' ? JSON.parse(savedAvatar) : savedAvatar);
        } catch (e) {
          // If parsing fails, set a random avatar
          const randomAvatar = getRandomAvatar();
          setUserAvatar(randomAvatar);
          await SecureStorage.setItem(AVATAR_STORAGE_KEY, randomAvatar);
        }
      } else {
        // First time user - set random avatar
        const randomAvatar = getRandomAvatar();
        setUserAvatar(randomAvatar);
        await SecureStorage.setItem(AVATAR_STORAGE_KEY, randomAvatar);
      }
    };
    loadAvatar();
  }, []);

  const handleSaveAvatar = async (avatar) => {
    setUserAvatar(avatar);
    await SecureStorage.setItem(AVATAR_STORAGE_KEY, avatar);
  };

  return (
    <>
      {/* Floating Avatar Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className="fixed top-4 right-4 z-50 w-16 h-16 bg-gradient-to-br from-fuchsia-600 to-purple-600 rounded-2xl shadow-2xl border-2 border-white/20 flex items-center justify-center"
        title="Change Avatar"
      >
        {userAvatar ? (
          userAvatar.type === 'upload' && userAvatar.url ? (
            <img src={userAvatar.url} alt="Your avatar" className="w-full h-full object-cover rounded-xl" loading="lazy" />
          ) : userAvatar.emoji ? (
            <span className="text-3xl">{userAvatar.emoji}</span>
          ) : (
            <User className="w-8 h-8 text-white" />
          )
        ) : (
          <User className="w-8 h-8 text-white" />
        )}
      </motion.button>

      {/* Avatar Upload Modal */}
      <AvatarUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAvatar}
        currentAvatar={userAvatar}
      />
    </>
  );
}

// Hook to get current user avatar
export function useUserAvatar() {
  const [userAvatar, setUserAvatar] = useState(null);

  useEffect(() => {
    const loadAvatar = async () => {
      const savedAvatar = await SecureStorage.getItem(AVATAR_STORAGE_KEY);
      if (savedAvatar) {
        try {
          setUserAvatar(typeof savedAvatar === 'string' ? JSON.parse(savedAvatar) : savedAvatar);
        } catch (e) {
          const randomAvatar = getRandomAvatar();
          setUserAvatar(randomAvatar);
        }
      } else {
        const randomAvatar = getRandomAvatar();
        setUserAvatar(randomAvatar);
        await SecureStorage.setItem(AVATAR_STORAGE_KEY, randomAvatar);
      }
    };
    loadAvatar();
  }, []);

  return userAvatar;
}
