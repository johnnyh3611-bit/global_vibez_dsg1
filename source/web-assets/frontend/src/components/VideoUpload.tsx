import React, { useState, useRef } from 'react';
import { Upload, X, Video, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const VideoUpload = ({ videoType, currentVideoUrl, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentVideoUrl || null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload MP4, WebM, or MOV files only.');
      return false;
    }

    if (file.size > maxSize) {
      setError('File too large. Maximum size is 50MB.');
      return false;
    }

    setError(null);
    return true;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && validateFile(file)) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress for user feedback
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`${API}/api/profile/upload-video/${videoType}`, {
        method: 'POST',
        
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await response.json();
      setPreview(`${API}${data.video_url}`);
      
      if (onUploadSuccess) {
        onUploadSuccess(data.video_url);
      }

      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      setError(err.message);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      const response = await fetch(`${API}/api/profile/video/${videoType}`, {
        method: 'DELETE',
        
      });

      if (!response.ok) {
        throw new Error('Failed to delete video');
      }

      setPreview(null);
      if (onUploadSuccess) {
        onUploadSuccess(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-200 mb-2">
        {videoType === 'friends' ? 'What You\'re Looking for in Friends' : 'What You\'re Looking for in a Relationship'}
      </label>

      {preview ? (
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            src={preview}
            controls
            className="w-full max-h-64 object-contain"
          >
            Your browser does not support the video tag.
          </video>
          <Button
            onClick={handleDelete}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 p-2 rounded-full"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-600 bg-gray-800/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 text-purple-500 animate-spin" />
              <p className="text-gray-300">Uploading... {uploadProgress}%</p>
              <div className="w-full max-w-xs h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Video className="h-12 w-12 text-gray-400" />
              <div>
                <p className="text-gray-300 mb-1">
                  Drag and drop your video here, or
                </p>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Browse Files
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                MP4, WebM, or MOV (max 50MB)
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-400">
        Record a short video describing what you're looking for. This helps others understand your preferences better.
      </p>
    </div>
  );
};

export default VideoUpload;
