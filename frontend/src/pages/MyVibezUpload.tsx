import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Image as ImageIcon, Video, Type, X, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * My Vibez Upload - Create and share your vibe
 */
export default function MyVibezUpload() {
  const navigate = useNavigate();
  const [contentType, setContentType] = useState('text'); // text, image, video
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [location, setLocation] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  
  const userId = localStorage.getItem('user_id') || 'demo_user';
  const username = localStorage.getItem('username') || 'Player';

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (contentType === 'image' && !file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (contentType === 'video' && !file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    setMediaFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (contentType !== 'text' && !mediaFile) {
      setError(`Please select a ${contentType} file`);
      return;
    }

    if (!caption.trim() && contentType === 'text') {
      setError('Please enter some text for your vibe');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('username', username);
      formData.append('content_type', contentType);
      formData.append('caption', caption);
      formData.append('hashtags', hashtags);
      formData.append('location', location);
      
      if (mediaFile) {
        formData.append('media_file', mediaFile);
      }

      const response = await fetch(`${API}/api/vibez/content/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Success - navigate to feed
        navigate('/vibez');
      } else {
        setError(data.message || 'Failed to upload');
      }
    } catch (err) {
      setError('Upload failed. Please try again.');
      // console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/vibez')}
            className="mb-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Feed
          </button>

          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-2">
            Share Your Vibe
          </h1>
          <p className="text-gray-400 text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Create content that connects
          </p>
        </div>

        {/* Content Type Selector */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setContentType('text'); clearMedia(); }}
            className={`p-6 rounded-2xl border-2 transition-all ${
              contentType === 'text'
                ? 'border-cyan-500 bg-cyan-500/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <Type className="w-8 h-8 mx-auto mb-2 text-white" />
            <p className="text-white font-semibold">Text Vibe</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setContentType('image')}
            className={`p-6 rounded-2xl border-2 transition-all ${
              contentType === 'image'
                ? 'border-purple-500 bg-purple-500/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-white" />
            <p className="text-white font-semibold">Image Vibe</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setContentType('video')}
            className={`p-6 rounded-2xl border-2 transition-all ${
              contentType === 'video'
                ? 'border-pink-500 bg-pink-500/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <Video className="w-8 h-8 mx-auto mb-2 text-white" />
            <p className="text-white font-semibold">Video Vibe</p>
          </motion.button>
        </div>

        {/* Upload Area */}
        <div className="bg-gray-800/50 backdrop-blur-sm border-2 border-cyan-500/30 rounded-2xl p-8">
          {/* Media Upload for Image/Video */}
          {(contentType === 'image' || contentType === 'video') && (
            <div className="mb-6">
              {mediaPreview ? (
                <div className="relative">
                  {contentType === 'image' ? (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-xl"
                    />
                  ) : (
                    <video
                      src={mediaPreview}
                      className="w-full h-64 object-cover rounded-xl"
                      controls
                    />
                  )}
                  <button
                    onClick={clearMedia}
                    className="absolute top-2 right-2 p-2 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-64 border-2 border-dashed border-gray-600 rounded-xl hover:border-cyan-500 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-gray-400" />
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">
                      Upload {contentType === 'image' ? 'Image' : 'Video'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Click to select {contentType === 'image' ? 'an image' : 'a video'}
                    </p>
                  </div>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={contentType === 'image' ? 'image/*' : 'video/*'}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Caption */}
          <div className="mb-6">
            <label className="block text-white font-semibold mb-2">
              {contentType === 'text' ? 'Your Vibe' : 'Caption'}
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={contentType === 'text' ? 'Share what\'s on your mind...' : 'Add a caption...'}
              className="w-full px-4 py-3 rounded-xl bg-gray-700 border-2 border-gray-600 text-white focus:border-cyan-500 focus:outline-none resize-none"
              rows={contentType === 'text' ? 8 : 4}
              maxLength={500}
            />
            <p className="text-gray-400 text-sm mt-1 text-right">{caption.length}/500</p>
          </div>

          {/* Hashtags */}
          <div className="mb-6">
            <label className="block text-white font-semibold mb-2">
              Hashtags
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#dating, #love, #fun (comma separated)"
              className="w-full px-4 py-3 rounded-xl bg-gray-700 border-2 border-gray-600 text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Location */}
          <div className="mb-6">
            <label className="block text-white font-semibold mb-2">
              Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., New York, NY"
              className="w-full px-4 py-3 rounded-xl bg-gray-700 border-2 border-gray-600 text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border-2 border-red-500 rounded-xl text-red-300">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sharing Your Vibe...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Share to Global Vibez
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
