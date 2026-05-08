import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, StopCircle, Upload, Camera } from 'lucide-react';
import { GlassCard } from '../GlassCard';

const API = process.env.REACT_APP_BACKEND_URL;
const MAX_DURATION = 300; // 5 minutes in seconds

export function VideoRecorder({ isOpen, onClose, onVideoUploaded }) {
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1080, height: 1920, facingMode: 'user' },
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setError(null);
    } catch (err) {
      // console.error('Camera error:', err);
      setError('Failed to access camera. Please grant permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      stopCamera();
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setRecording(true);
    setDuration(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setDuration((prev) => {
        if (prev >= MAX_DURATION) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const uploadVideo = async () => {
    if (!recordedBlob || !title.trim()) {
      setError('Please add a title for your video');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // STREAMING UPLOAD (LOCKED 2026-02-16) — fixes the device-side
      // "I don't have the memory to post it" bug.
      //
      // Old flow: FileReader.readAsDataURL → entire video held in memory
      //          as a JS base64 string (33% larger) → JSON POST blew up
      //          phone RAM around 200–300 MB.
      // New flow: multipart FormData streams the blob directly to
      //          /api/my-vibez/upload — zero base64 inflation, no
      //          full-blob copy in JS heap.

      // 1. Generate the thumbnail blob (small jpeg, fits in memory fine).
      const thumbnailBlob = await createThumbnailBlob(recordedBlob);

      // 2. Build multipart payload.
      const form = new FormData();
      form.append('title', title.trim());
      if (description.trim()) form.append('description', description.trim());
      form.append('hashtags', JSON.stringify(extractHashtags(title + ' ' + description)));
      form.append('duration', String(duration));
      form.append('video', recordedBlob, `vibez_${Date.now()}.webm`);
      if (thumbnailBlob) {
        form.append('thumbnail', thumbnailBlob, `thumb_${Date.now()}.jpg`);
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API}/api/my-vibez/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        // Don't set Content-Type — the browser fills the boundary in.
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      onVideoUploaded(data);
      onClose();
    } catch (err) {
      // console.error('Upload error:', err);
      const msg = (err && (err as any).message) || '';
      const friendly = /quota|memory|storage|out of/i.test(msg)
        ? "Your phone ran low on memory while uploading. Try a shorter clip or close other apps and retry."
        : (msg || 'Failed to upload video. Please try again.');
      setError(friendly);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Capture a thumbnail jpeg blob from the recorded video.
   * Returns a small Blob (~30-100KB) — safe to hold in memory.
   */
  const createThumbnailBlob = (blob) => {
    return new Promise<Blob | null>((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(blob);

      video.onloadeddata = () => {
        video.currentTime = 0.1; // Capture frame at 0.1s
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 720;
        canvas.height = 1280;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          URL.revokeObjectURL(video.src);
          resolve(b);
        }, 'image/jpeg', 0.8);
      };

      video.onerror = () => resolve(null);
    });
  };

  const extractHashtags = (text) => {
    const hashtags = text.match(/#[a-zA-Z0-9_]+/g) || [];
    return hashtags.map(tag => tag.slice(1).toLowerCase());
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const retake = () => {
    setRecordedBlob(null);
    setDuration(0);
    setTitle('');
    setDescription('');
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-2xl w-full"
        >
          <GlassCard variant="gaming" className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Camera className="w-7 h-7 text-fuchsia-400" />
                  {recordedBlob ? 'Review & Upload' : (recording ? 'Recording...' : 'Record Video')}
                </h2>
                <p className="text-white/70 text-sm">
                  {recordedBlob ? 'Add details and upload your video' : 'Max 5 minutes'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Video Preview / Recorder */}
            {!recordedBlob ? (
              <div className="mb-6">
                <div className="aspect-[9/16] max-h-[500px] mx-auto rounded-2xl overflow-hidden bg-black relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {/* Recording Indicator */}
                  {recording && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-red-600 rounded-full">
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-3 h-3 bg-white rounded-full"
                      />
                      <span className="text-white font-bold">{formatTime(duration)}</span>
                    </div>
                  )}

                  {/* Duration Limit Warning */}
                  {recording && duration >= MAX_DURATION - 10 && (
                    <div className="absolute top-16 left-4 px-3 py-2 bg-yellow-600/90 rounded-xl text-white text-sm font-bold">
                      {MAX_DURATION - duration}s remaining
                    </div>
                  )}
                </div>

                {/* Record Controls */}
                <div className="flex justify-center gap-4 mt-4">
                  {!recording ? (
                    <button
                      onClick={startRecording}
                      className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-2xl hover:from-red-500 hover:to-red-600 transition-all shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center gap-2"
                    >
                      <Video size={24} />
                      Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold rounded-2xl hover:from-gray-600 hover:to-gray-700 transition-all flex items-center gap-2"
                    >
                      <StopCircle size={24} />
                      Stop Recording
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-6">
                {/* Video Preview */}
                <div className="aspect-[9/16] max-h-[400px] mx-auto rounded-2xl overflow-hidden bg-black mb-4">
                  <video
                    src={URL.createObjectURL(recordedBlob)}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Video Details Form */}
                <div className="space-y-4">
                  <div>
                    <label className="text-white font-bold mb-2 block">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Give your video a catchy title..."
                      maxLength={100}
                      className="w-full bg-white/5 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-fuchsia-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-white font-bold mb-2 block">
                      Description (optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add hashtags like #gaming #dating #fun"
                      maxLength={500}
                      rows={3}
                      className="w-full bg-white/5 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-fuchsia-400 focus:outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="text-white/60 text-sm">
                    Duration: {formatTime(duration)} • {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                {/* Upload Controls */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={retake}
                    disabled={uploading}
                    className="flex-1 bg-white/10 border-2 border-white/20 text-white py-3 rounded-xl hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                  >
                    Retake
                  </button>
                  <button
                    onClick={uploadVideo}
                    disabled={uploading || !title.trim()}
                    className="flex-2 px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold rounded-xl hover:from-fuchsia-500 hover:to-pink-500 transition-all shadow-[0_0_30px_rgba(232,121,249,0.6)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={20} />
                        Upload Video
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
