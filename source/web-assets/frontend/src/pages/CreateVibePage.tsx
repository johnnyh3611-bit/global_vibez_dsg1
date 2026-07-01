
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Video, 
  Image as ImageIcon, 
  Gamepad2, 
  Users,
  Sparkles,
  X,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CreateVibePage() {
  const navigate = useNavigate();
  const [userId] = useState(() => localStorage.getItem('user_id') || 'demo_user');
  
  const [contentType, setContentType] = useState('video'); // video, image, game_clip
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [gameId, setGameId] = useState('');
  const [isDualStream, setIsDualStream] = useState(false);
  const [partnerUserId, setPartnerUserId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [durationError, setDurationError] = useState(null);

  const MAX_VIDEO_DURATION = 300; // 5 minutes in seconds

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setDurationError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);

      // Get video duration if it's a video
      if (contentType === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          const duration = video.duration;
          setVideoDuration(duration);
          
          // Check duration limit for non-live videos
          if (!isLive && duration > MAX_VIDEO_DURATION) {
            setDurationError(
              `Video is ${Math.ceil(duration / 60)} minutes long. Max is 5 minutes for regular posts. Enable Live Stream mode for longer videos.`
            );
          }
        };
        video.src = URL.createObjectURL(selectedFile);
      }
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    // Check duration error
    if (durationError && !isLive) {
      alert(durationError);
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId);
      formData.append('content_type', contentType);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', JSON.stringify(tags));
      formData.append('game_id', gameId);
      formData.append('is_dual_stream', String(isDualStream));
      formData.append('partner_user_id', partnerUserId);
      formData.append('challenge_id', challengeId);
      formData.append('is_anonymous', String(isAnonymous));
      formData.append('is_live', String(isLive));
      if (videoDuration) {
        formData.append('video_duration', String(videoDuration));
      }

      const response = await fetch(`${API_URL}/api/my-vibez/post/create`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        alert(isLive ? 'Live stream started! 🔴' : 'Vibe posted! 🎉');
        navigate('/my-vibez');
      } else {
        alert('Failed to post: ' + (data.detail || 'Unknown error'));
      }
    } catch (error) {
      // console.error('Upload error:', error);
      alert('Failed to upload vibe');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-black text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text">
              Create Your Vibe
            </h1>
            <Button
              variant="outline"
              onClick={() => navigate('/my-vibez')}
              className="border-gray-600"
            >
              <X className="w-5 h-5 mr-2" />
              Cancel
            </Button>
          </div>
          <p className="text-gray-400">Share your gaming moments, date experiences, or just vibe!</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Content Type Selection */}
          <Card className="bg-slate-900/90 border-purple-500/30 p-6">
            <h3 className="text-xl font-bold mb-4">Content Type</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'video', label: 'Video', icon: Video },
                { id: 'image', label: 'Image', icon: ImageIcon },
                { id: 'game_clip', label: 'Game Clip', icon: Gamepad2 }
              ].map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  type="button"
                  onClick={() => setContentType(id)}
                  className={`flex flex-col gap-2 h-24 ${
                    contentType === id
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600'
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-8 h-8" />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </Card>

          {/* File Upload */}
          <Card className="bg-slate-900/90 border-purple-500/30 p-6">
            <h3 className="text-xl font-bold mb-4">Upload Content</h3>
            
            {/* Video Length Warning */}
            {contentType === 'video' && !isLive && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-200 flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  <span>Max video length: <strong>5 minutes</strong> (for longer videos, enable Live Stream)</span>
                </p>
              </div>
            )}

            {/* Duration Error */}
            {durationError && !isLive && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-200">⚠️ {durationError}</p>
              </div>
            )}
            
            {!preview ? (
              <label className="block border-2 border-dashed border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-purple-500 transition-colors">
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-400 mb-2">Click to upload or drag and drop</p>
                <p className="text-sm text-gray-500">
                  {contentType === 'video' 
                    ? (isLive ? 'Live Stream - Any length' : 'MP4, MOV up to 5 minutes (100MB max)') 
                    : 'JPG, PNG up to 10MB'}
                </p>
                <input
                  type="file"
                  accept={contentType === 'video' ? 'video/*' : 'image/*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative rounded-lg overflow-hidden">
                {contentType === 'video' ? (
                  <div>
                    <video src={preview} controls className="w-full max-h-96 bg-black" />
                    {videoDuration && (
                      <div className="mt-2 text-sm text-gray-400">
                        Duration: {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, '0')}
                        {videoDuration > MAX_VIDEO_DURATION && !isLive && (
                          <span className="ml-2 text-red-400 font-bold">
                            (Too long! Enable Live or trim to 5 min)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <img src={preview} alt="Preview" className="w-full max-h-96 object-contain bg-black" />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setVideoDuration(null);
                    setDurationError(null);
                  }}
                  className="absolute top-2 right-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>

          {/* Details */}
          <Card className="bg-slate-900/90 border-purple-500/30 p-6 space-y-4">
            <h3 className="text-xl font-bold">Details</h3>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Title</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your vibe a catchy title..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your vibe..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Tags</label>
              <div className="flex gap-2 mb-2">
                <Input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tags (e.g., gaming, date, funny)"
                  className="bg-slate-800 border-slate-700 text-white flex-1"
                />
                <Button type="button" onClick={addTag} size="sm">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span
                    key={`tags-${i}`}
                    className="px-3 py-1 bg-purple-600 rounded-full text-sm flex items-center gap-2"
                  >
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Advanced Options */}
          <Card className="bg-slate-900/90 border-purple-500/30 p-6 space-y-4">
            <h3 className="text-xl font-bold">Advanced Options</h3>

            {/* Live Stream Toggle */}
            {contentType === 'video' && (
              <div className="p-4 bg-gradient-to-r from-red-900/30 to-pink-900/30 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    id="liveStream"
                    checked={isLive}
                    onChange={(e) => {
                      setIsLive(e.target.checked);
                      if (e.target.checked) {
                        setDurationError(null); // Clear error when enabling live
                      }
                    }}
                    className="w-5 h-5 rounded"
                  />
                  <label htmlFor="liveStream" className="flex items-center gap-2 cursor-pointer font-semibold">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span>Live Stream Mode</span>
                  </label>
                </div>
                <p className="text-sm text-gray-400 ml-8">
                  Enable for live streaming or videos longer than 5 minutes. Live streams earn 2x XP!
                </p>
              </div>
            )}

            {contentType === 'game_clip' && (
              <div>
                <label className="block text-sm font-semibold mb-2">Game (Optional)</label>
                <Input
                  type="text"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  placeholder="e.g., spades, poker, ludo"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="dualStream"
                checked={isDualStream}
                onChange={(e) => setIsDualStream(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <label htmlFor="dualStream" className="flex items-center gap-2 cursor-pointer">
                <Users className="w-5 h-5 text-pink-400" />
                <span>Dual Stream (with partner)</span>
              </label>
            </div>

            {isDualStream && (
              <Input
                type="text"
                value={partnerUserId}
                onChange={(e) => setPartnerUserId(e.target.value)}
                placeholder="Partner's User ID"
                className="bg-slate-800 border-slate-700 text-white"
              />
            )}

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="anonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <label htmlFor="anonymous" className="cursor-pointer">
                Post Anonymously
              </label>
            </div>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={uploading || !file || (durationError && !isLive)}
              className="flex-1 py-6 text-lg font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 hover:from-pink-700 hover:via-purple-700 hover:to-blue-700 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="animate-spin mr-2">⏳</div>
                  Uploading...
                </>
              ) : isLive ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse mr-2" />
                  Start Live Stream 🔴
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 mr-2" />
                  Post Your Vibe
                </>
              )}
            </Button>
          </div>

          {/* Helpful Tips */}
          <div className="p-4 bg-slate-800/50 rounded-lg text-sm text-gray-400">
            <p className="font-semibold text-white mb-2">💡 Pro Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Regular videos: Max 5 minutes, 100MB (50 XP)</li>
              <li>Live streams: Unlimited length (100 XP + 2x engagement)</li>
              <li>Game clips with stats earn more visibility</li>
              <li>Dual streams get featured in Dating feed</li>
              <li>Use #gaming, #date tags for better reach</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
}
