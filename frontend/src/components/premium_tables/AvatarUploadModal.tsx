import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Camera, User } from 'lucide-react';
import { DEFAULT_AVATARS } from './avatarSystem';

export function AvatarUploadModal({ isOpen, onClose, onSave, currentAvatar }: { isOpen?: any, onClose?: any, onSave?: any, currentAvatar?: any }) {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result);
        setUploadedImage(file);
        setSelectedAvatar(null); // Deselect emoji avatars
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (uploadPreview) {
      // Save uploaded image
      onSave({
        type: 'upload',
        url: uploadPreview,
        name: 'You',
      });
    } else if (selectedAvatar) {
      // Save selected emoji avatar
      onSave(selectedAvatar);
    }
    onClose();
  };

  const handleEmojiSelect = (avatar) => {
    setSelectedAvatar(avatar);
    setUploadPreview(null);
    setUploadedImage(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-gray-900 to-black rounded-3xl border-2 border-purple-500 max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-8 h-8 text-white" />
                <h2 className="text-3xl font-black text-white">Choose Your Avatar</h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Upload Section */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-fuchsia-400" />
                  Upload Your Photo
                </h3>
                
                <div className="flex gap-4 items-center">
                  {/* Upload Preview */}
                  <div className="flex-shrink-0">
                    <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-500 p-1">
                      <div className="w-full h-full bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
                        {uploadPreview ? (
                          <img 
                            src={uploadPreview} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-12 h-12 text-gray-600" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upload Button */}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Choose Photo
                    </button>
                    <p className="text-gray-400 text-sm mt-2">
                      JPG, PNG, or GIF • Max 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-gray-500 text-sm font-bold">OR CHOOSE AN EMOJI</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              {/* Emoji Avatar Grid */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Default Avatars</h3>
                <div className="grid grid-cols-4 gap-4">
                  {DEFAULT_AVATARS.map((avatar) => (
                    <motion.button
                      key={avatar.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleEmojiSelect(avatar)}
                      className={`aspect-square rounded-2xl transition-all ${
                        selectedAvatar?.id === avatar.id && !uploadPreview
                          ? 'bg-gradient-to-br from-fuchsia-500 to-purple-500 p-1'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <div className={`w-full h-full rounded-xl flex flex-col items-center justify-center ${
                        selectedAvatar?.id === avatar.id && !uploadPreview
                          ? 'bg-gray-900'
                          : ''
                      }`}>
                        <span className="text-5xl mb-2">{avatar.emoji}</span>
                        <span className="text-white text-xs font-bold">{avatar.name}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-900/50 border-t border-gray-800 flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedAvatar && !uploadPreview}
                className={`flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all ${
                  selectedAvatar || uploadPreview
                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500'
                    : 'bg-gray-700 cursor-not-allowed opacity-50'
                }`}
              >
                Save Avatar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
