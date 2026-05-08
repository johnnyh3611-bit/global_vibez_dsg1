
import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, ARButton, XR, DefaultXRController, DefaultXRHand } from '@react-three/xr';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useParams, useNavigate } from 'react-router-dom';
import { VRAvatarEnhanced } from '../components/vr/VRAvatarEnhanced';
import { VREnvironment } from '../components/vr/VREnvironment';
import { VoiceStatusOverlay } from '../components/vr/VoiceIndicator';
import { GesturePanel, AvatarCustomizationPanel, QuickActionsPanel } from '../components/vr/ControlPanels';
import { InteractiveBall, Rose, FloatingHeart, ChampagneGlasses, ParticleEffect } from '../components/vr/InteractiveObjects';
import { Button } from '../components/ui/button';
import { useVRVoiceChat } from '../hooks/useVRVoiceChat';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * VR Dating Room - Immersive WebXR dating experience
 */
export default function VRDatingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [environment, setEnvironment] = useState('restaurant');
  const [otherUserPosition, setOtherUserPosition] = useState([2, 1.6, 0]);
  const [localPosition, setLocalPosition] = useState([-1, 1.6, 0]);
  const [inVR, setInVR] = useState(false);
  const [localGesture, setLocalGesture] = useState(null);
  const [remoteGesture, setRemoteGesture] = useState(null);
  const [avatarColor, setAvatarColor] = useState('#ff69b4');
  const [remoteColor, setRemoteColor] = useState('#00bfff');
  const [showInteractive, setShowInteractive] = useState({
    ball: false,
    rose: true,
    hearts: false,
    champagne: true
  });
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef([]);
  
  // Voice chat integration
  const {
    muted,
    connected: voiceConnected,
    speaking,
    remoteSpeaking,
    toggleMute,
    updateSpatialAudio,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    setWebSocket
  } = useVRVoiceChat(roomId, localStorage.getItem('userId'), (err) => {
    // console.error('Voice chat error:', err);
  });

  useEffect(() => {
    // For now, mock the room data since backend isn't implemented yet
    setRoom({
      room_id: roomId,
      user1_id: localStorage.getItem('userId'),
      user2_id: 'other-user',
      environment: 'restaurant',
      status: 'active'
    });
    setLoading(false);
    
    // Setup WebSocket connection for real-time sync
    setupWebSocket();
    
    return () => {
      // Cleanup WebSocket and reconnect timeout on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId]);

  const setupWebSocket = () => {
    const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/vr-dating/${roomId}`);
    
    ws.onopen = () => {

      reconnectAttemptsRef.current = 0; // Reset reconnection attempts
      
      // Send initial state
      ws.send(JSON.stringify({
        type: 'init',
        userId: localStorage.getItem('userId'),
        position: localPosition,
        avatarColor: avatarColor
      }));
      
      // Send any queued messages
      while (messageQueueRef.current.length > 0) {
        const queuedMsg = messageQueueRef.current.shift();
        ws.send(JSON.stringify(queuedMsg));
      }
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'room_state':
          // Initialize room with existing users
          if (data.users) {
            const otherUsers = Object.values(data.users) as any[];
            if (otherUsers.length > 0) {
              setOtherUserPosition(otherUsers[0].position);
              setRemoteColor(otherUsers[0].color);
            }
          }
          break;
        
        case 'position_update':
          if (data.userId !== localStorage.getItem('userId')) {
            setOtherUserPosition(data.position);
            updateSpatialAudio(data.position, localPosition);
          }
          break;
        
        case 'gesture':
          if (data.userId !== localStorage.getItem('userId')) {
            setRemoteGesture(data.gestureId);
            setTimeout(() => setRemoteGesture(null), 3000);
          }
          break;
        
        case 'avatar_color':
          if (data.userId !== localStorage.getItem('userId')) {
            setRemoteColor(data.color);
          }
          break;
        
        case 'environment_change':
          setEnvironment(data.environment);
          break;
        
        case 'user_disconnected':

          break;
        
        case 'kicked':
          alert(`You have been removed from the room: ${data.reason}`);
          navigate('/chat');
          break;
          
        default:

      }
    };
    
    ws.onerror = (error) => {
      // console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {

      // Attempt to reconnect with exponential backoff
      if (reconnectAttemptsRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setupWebSocket();
        }, delay);
      } else {
        // console.error('❌ Max reconnection attempts reached');
        setError('Connection lost. Please refresh the page.');
      }
    };
    
    wsRef.current = ws;
    
    // Share WebSocket with voice chat hook
    setWebSocket(ws);
  };

  const sendPosition = (position) => {
    setLocalPosition(position);
    
    // Update spatial audio based on positions
    updateSpatialAudio(otherUserPosition, position);
    
    // Send position update via WebSocket with queuing
    const message = {
      type: 'position_update',
      userId: localStorage.getItem('userId'),
      position: position
    };
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message if disconnected (max 100 messages)
      if (messageQueueRef.current.length < 100) {
        messageQueueRef.current.push(message);
      }
    }
  };

  const changeEnvironment = (newEnv) => {
    setEnvironment(newEnv);
  };

  const handleGesture = (gestureId) => {
    setLocalGesture(gestureId);
    setTimeout(() => setLocalGesture(null), 3000); // Gesture lasts 3 seconds
    
    // Send gesture to other user via WebSocket with queuing
    const message = {
      type: 'gesture',
      userId: localStorage.getItem('userId'),
      gestureId: gestureId
    };
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue gesture (important events)
      if (messageQueueRef.current.length < 100) {
        messageQueueRef.current.push(message);
      }
    }
  };

  const handleColorChange = (color) => {
    setAvatarColor(color);
    
    // Send avatar color change via WebSocket with queuing
    const message = {
      type: 'avatar_color',
      userId: localStorage.getItem('userId'),
      color: color
    };
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue color change (important customization)
      if (messageQueueRef.current.length < 100) {
        messageQueueRef.current.push(message);
      }
    }
  };

  const handleAction = (actionId) => {
    switch (actionId) {
      case 'rose':
        setShowInteractive(prev => ({ ...prev, rose: true }));
        break;
      case 'ball':
        setShowInteractive(prev => ({ ...prev, ball: true }));
        break;
      case 'toast':
        handleGesture('heart'); // Toast gesture
        break;
      case 'hearts':
        setShowInteractive(prev => ({ ...prev, hearts: true }));
        setTimeout(() => setShowInteractive(prev => ({ ...prev, hearts: false })), 5000);
        break;
      default:
        break;
    }
  };

  const leaveRoom = () => {
    navigate('/chat');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading VR Room...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Controls Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white text-2xl font-bold">VR Date Room</h1>
            <p className="text-white/60 text-sm">Global Vibez DSG™ Virtual Dating</p>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={toggleMute}
              className={`${muted ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
            >
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </Button>
            <Button
              onClick={leaveRoom}
              className="bg-red-600 hover:bg-red-700"
            >
              🚪 Leave
            </Button>
          </div>
        </div>
      </div>

      {/* Voice Status Overlay */}
      <VoiceStatusOverlay
        connected={voiceConnected}
        localSpeaking={speaking}
        remoteSpeaking={remoteSpeaking}
        localMuted={muted}
        localName="You"
        remoteName="Date"
      />

      {/* Environment Selector */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/80 p-4 rounded-xl backdrop-blur-md">
        <p className="text-white text-sm mb-2">Choose Location:</p>
        <div className="flex gap-2">
          {['restaurant', 'beach', 'rooftop', 'space'].map((env) => (
            <button
              key={env}
              onClick={() => changeEnvironment(env)}
              className={`px-4 py-2 rounded-lg capitalize transition-all ${
                environment === env
                  ? 'bg-pink-500 text-white'
                  : 'bg-white/20 text-white/70 hover:bg-white/30'
              }`}
            >
              {env}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 z-10 bg-black/80 p-4 rounded-xl backdrop-blur-md max-w-xs">
        <p className="text-white text-sm font-bold mb-2">Controls:</p>
        <ul className="text-white/70 text-xs space-y-1">
          <li>🖱️ Mouse: Look around</li>
          <li>⌨️ WASD: Move (with OrbitControls)</li>
          <li>🥽 VR: Click "Enter VR" button</li>
          <li>🎮 VR Controllers: Move & interact</li>
        </ul>
      </div>

      {/* VR/AR Buttons */}
      <div className="absolute top-20 right-4 z-20 flex flex-col gap-2">
        {(() => {
          // @react-three/xr v6 requires `store` prop; legacy session callbacks still work at runtime.
          const VRButtonAny = VRButton as any;
          return (
            <VRButtonAny
              onSessionStart={() => setInVR(true)}
              onSessionEnd={() => setInVR(false)}
            />
          );
        })()}
        <ARButton {...({} as any)} />
      </div>

      {/* Gesture Control Panel */}
      <GesturePanel onGesture={handleGesture} disabled={inVR} />
      
      {/* Avatar Customization */}
      <AvatarCustomizationPanel 
        currentColor={avatarColor} 
        onColorChange={handleColorChange}
        disabled={inVR}
      />
      
      {/* Quick Actions */}
      <QuickActionsPanel 
        onAction={handleAction}
        disabled={inVR}
      />

      {/* 3D Canvas */}
      <Canvas shadows>
        {/* @ts-expect-error — @react-three/xr v6 requires `store` prop; see session setup above. */}
        <XR>
          {/* Camera */}
          <PerspectiveCamera makeDefault position={[-1, 1.6, 3]} />
          
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 10, 5]}
            intensity={1}
            castShadow
          />
          
          {/* Environment */}
          <VREnvironment location={environment} />
          
          {/* Interactive Objects */}
          {showInteractive.ball && (
            <InteractiveBall position={[0, 1, -1]} />
          )}
          {showInteractive.rose && (
            <Rose position={[0, 0.76, -0.5]} />
          )}
          {showInteractive.champagne && environment === 'restaurant' && (
            <ChampagneGlasses position={[0, 0.76, 0]} />
          )}
          {showInteractive.hearts && (
            <>
              <FloatingHeart position={[-0.5, 2, 0]} delay={0} />
              <FloatingHeart position={[0.5, 2.2, 0]} delay={0.5} />
              <FloatingHeart position={[0, 2.4, 0]} delay={1} />
              <ParticleEffect position={[0, 2, 0]} type="hearts" />
            </>
          )}
          
          {/* Local Avatar with gestures */}
          <VRAvatarEnhanced
            userId="local"
            position={localPosition}
            isLocal={true}
            onPositionUpdate={sendPosition}
            color={avatarColor}
            gesture={localGesture}
            userName="You"
          />
          
          {/* Remote Avatar with gestures */}
          {/* @ts-expect-error — `onPositionUpdate` is required for local avatars only; remote avatar receives position via network. */}
          <VRAvatarEnhanced
            userId="remote"
            position={otherUserPosition}
            isLocal={false}
            color={remoteColor}
            gesture={remoteGesture}
            userName="Date"
          />
          
          {/* VR Controllers & Hands */}
          <DefaultXRController />
          <DefaultXRHand />
          
          {/* Desktop controls */}
          <OrbitControls target={[0, 1, 0]} />
        </XR>
      </Canvas>
    </div>
  );
}
