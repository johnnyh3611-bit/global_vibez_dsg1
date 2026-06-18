import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, VideoOff, Mic, MicOff, Phone, Clock, Heart, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const WS_URL = API_URL.replace('http', 'ws');

export default function SpeedDatingVideo({ roomId, userId, partnerName, durationMinutes = 5 }) {
  const navigate = useNavigate();
  
  // Video refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // State
  const [connectionState, setConnectionState] = useState('connecting');
  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(5);
  const [interested, setInterested] = useState(false);
  
  // ICE servers configuration (free STUN servers)
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };
  
  useEffect(() => {
    initializeVideoCall();
    
    return () => {
      cleanup();
    };
  }, []);
  
  // Timer countdown
  useEffect(() => {
    if (connectionState !== 'connected' || timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          endCall();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [connectionState, timeRemaining]);
  
  const initializeVideoCall = async () => {
    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Create peer connection
      peerConnectionRef.current = new RTCPeerConnection(iceServers);
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });
      
      // Handle incoming remote stream
      peerConnectionRef.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setConnectionState('connected');
      };
      
      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          sendMessage({
            type: 'ice-candidate',
            candidate: event.candidate
          });
        }
      };
      
      // Connect to signaling WebSocket
      connectWebSocket();
      
    } catch (error) {
      // console.error('Error accessing media devices:', error);
      setConnectionState('error');
      alert('Failed to access camera/microphone. Please grant permissions.');
    }
  };
  
  const connectWebSocket = () => {
    const ws = new WebSocket(`${WS_URL}/api/speed-dating/ws/${roomId}/${userId}`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      setConnectionState('ready');
    };
    
    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      await handleSignalingMessage(message);
    };
    
    ws.onerror = (error) => {
      // console.error('WebSocket error:', error);
      setConnectionState('error');
    };
    
    ws.onclose = () => {
    };
  };
  
  const handleSignalingMessage = async (message) => {
    const pc = peerConnectionRef.current;
    
    switch (message.type) {
      case 'user-joined':
        // Another user joined, create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendMessage({
          type: 'offer',
          sdp: offer
        });
        break;
        
      case 'offer':
        // Received offer, create answer
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendMessage({
          type: 'answer',
          sdp: answer
        });
        break;
        
      case 'answer':
        // Received answer
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        break;
        
      case 'ice-candidate':
        // Received ICE candidate
        if (message.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;
        
      case 'user-left':
        // Other user left
        alert('Your partner has left the call');
        endCall();
        break;
    }
  };
  
  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };
  
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };
  
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };
  
  const endCall = () => {
    cleanup();
    setShowFeedback(true);
  };
  
  const cleanup = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
  };
  
  const submitFeedback = async () => {
    try {
      await fetch(`${API_URL}/api/speed-dating/room/${roomId}/feedback?rating=${rating}&interested=${interested}`, {
        method: 'POST',
      });
      
      navigate('/dashboard');
    } catch (error) {
      // console.error('Failed to submit feedback:', error);
      navigate('/dashboard');
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (showFeedback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-center mb-6">How was your match?</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Rate your experience:</label>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => setRating(num)}
                  className={`text-3xl ${rating >= num ? 'text-yellow-400' : 'text-gray-300'} hover:scale-110 transition-transform`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <label className="flex items-center justify-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={interested}
                onChange={(e) => setInterested(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="text-lg">I'm interested in connecting further</span>
              <Heart className={`w-5 h-5 ${interested ? 'text-red-500 fill-current' : 'text-gray-400'}`} />
            </label>
          </div>
          
          <Button onClick={submitFeedback} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-6 text-lg">
            Submit Feedback
          </Button>
        </Card>
      </div>
    );
  }
  
  if (connectionState === 'error') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <X className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-4">Connection Error</h2>
          <p className="text-gray-600 mb-6">Failed to connect to video call</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header with timer */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="w-6 h-6" />
            <span className="text-lg font-semibold">Speed Dating with {partnerName}</span>
          </div>
          <div className="flex items-center space-x-2 text-2xl font-bold">
            <Clock className="w-6 h-6" />
            <span className={timeRemaining < 60 ? 'text-yellow-300 animate-pulse' : ''}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Video container */}
      <div className="flex-1 grid md:grid-cols-2 gap-4 p-4">
        {/* Remote video (partner) */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {connectionState !== 'connected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Connecting to {partnerName}...</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded">
            <span className="text-white font-medium">{partnerName}</span>
          </div>
        </div>
        
        {/* Local video (you) */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
          />
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded">
            <span className="text-white font-medium">You</span>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center space-x-4">
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white transition-colors`}
          >
            {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
          
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white transition-colors`}
          >
            {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          
          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            <Phone className="w-6 h-6 transform rotate-135" />
          </button>
        </div>
      </div>
      
      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
