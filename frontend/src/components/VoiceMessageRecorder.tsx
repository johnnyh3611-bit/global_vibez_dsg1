import { useState, useRef } from 'react';
import { Mic, Square, Play, Pause, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VoiceMessageRecorder({ onSend, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState('');
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioURL = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioURL(audioURL);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      // console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64Audio = reader.result;
      onSend(base64Audio, duration);
      
      // Cleanup
      setAudioBlob(null);
      setAudioURL('');
      setDuration(0);
      if (audioRef.current) {
        URL.revokeObjectURL(audioURL);
      }
    };
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    
    // Cleanup
    setAudioBlob(null);
    setAudioURL('');
    setDuration(0);
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    
    onCancel();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">🎤 Voice Message</h3>
        <button onClick={handleCancel} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Recording UI */}
      {!audioBlob && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-red-600 to-pink-600 flex items-center justify-center">
            {isRecording ? (
              <div className="w-20 h-20 rounded-full bg-red-500 animate-pulse" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-mono text-white">{formatDuration(duration)}</p>
            {isRecording && (
              <p className="text-sm text-red-400 mt-1">Recording...</p>
            )}
          </div>

          {!isRecording ? (
            <Button
              onClick={startRecording}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white"
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Recording
            </Button>
          )}
        </div>
      )}

      {/* Playback UI */}
      {audioBlob && audioURL && (
        <div className="space-y-4">
          <audio
            ref={audioRef}
            src={audioURL}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={isPlaying ? pauseAudio : playAudio}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center hover:from-cyan-700 hover:to-blue-700"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white" />
              )}
            </button>
            
            <div className="flex-1">
              <div className="h-2 bg-white/10 rounded-full">
                <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: '0%' }} />
              </div>
              <p className="text-sm text-gray-400 mt-1">{formatDuration(duration)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 border-gray-600 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              Send Voice Message
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
