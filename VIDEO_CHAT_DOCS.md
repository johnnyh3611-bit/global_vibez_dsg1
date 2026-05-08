# WebRTC Video Chat - Feature Documentation

## Overview
Real-time peer-to-peer video chat integrated with card games and dating features. Supports both Picture-in-Picture (mobile) and Split-Screen (desktop) modes.

## Features

### 1. **Picture-in-Picture (PiP) Mode** 📱
- **Best For**: Mobile devices during gameplay
- **Features**:
  - Floating, draggable video bubble
  - Minimizable to save screen space
  - Local video preview in corner
  - Quick toggle for camera/mic
  - Auto-positions in corner of screen

### 2. **Split-Screen Mode** 💻
- **Best For**: Tablets and PCs
- **Features**:
  - Dedicated side panel (30% width)
  - Multiple participant video grid
  - Larger video feeds for better visibility
  - Overlay mode option
  - Full chat controls

### 3. **Auto-Detection**
- Automatically selects PiP for mobile (< 768px width)
- Automatically selects Split-Screen for desktop
- Users can manually override mode preference

## Technical Implementation

### Backend (FastAPI)
**File**: `/app/backend/routes/video_chat.py`

**Endpoints**:
- `GET /api/video-chat/rooms` - List active rooms
- `POST /api/video-chat/create-room` - Create new video room
- `GET /api/video-chat/room/{room_id}` - Get room info
- `WS /api/ws/video-chat/{room_id}` - WebSocket signaling

**WebSocket Signaling Events**:
```json
// Client → Server
{
  "type": "join",
  "user_id": "user123",
  "username": "John"
}

{
  "type": "offer",
  "to_user": "user456",
  "offer": { "sdp": "...", "type": "offer" }
}

{
  "type": "answer",
  "to_user": "user123",
  "answer": { "sdp": "...", "type": "answer" }
}

{
  "type": "ice-candidate",
  "to_user": "user456",
  "candidate": { ... }
}

// Server → Client
{
  "type": "joined",
  "room_id": "room_abc123",
  "participants": ["user123", "user456"]
}

{
  "type": "user-joined",
  "user_id": "user789",
  "username": "Alice"
}

{
  "type": "user-left",
  "user_id": "user456"
}
```

### Frontend (React)

**Components**:
- `/app/frontend/src/components/video/VideoChat.jsx` - Main wrapper
- `/app/frontend/src/components/video/VideoPiP.jsx` - Picture-in-Picture
- `/app/frontend/src/components/video/VideoSplitScreen.jsx` - Split-screen
- `/app/frontend/src/hooks/useWebRTC.js` - WebRTC connection hook

**Hook Usage**:
```javascript
import { useWebRTC } from '@/hooks/useWebRTC';

function MyGame() {
  const {
    localStream,
    remoteStreams,
    isConnected,
    participants,
    error,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio
  } = useWebRTC('room_123', 'user_456', 'John');

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay />
    </div>
  );
}
```

**Component Usage**:
```javascript
import VideoChat from '@/components/video/VideoChat';

function SpadesGame() {
  return (
    <VideoChat
      roomId="room_abc123"
      userId="user_456"
      username="John"
      mode="auto" // or 'pip', 'split'
      onClose={() => console.log('Call ended')}
    >
      {/* Your game content */}
      <div>Spades Game Board</div>
    </VideoChat>
  );
}
```

## WebRTC Flow

### 1. **Connection Setup**
```
User A                  Signaling Server              User B
  |                            |                          |
  |----join------------------>|                          |
  |<---joined-----------------|                          |
  |                            |<------join---------------|
  |                            |-------user-joined------->|
  |                            |-------user-joined------->|
```

### 2. **Peer Connection**
```
User A                                                  User B
  |                                                        |
  |----create offer----------------------------------->   |
  |                                                        |
  |   <----create answer----------------------------------| 
  |                                                        |
  |----exchange ICE candidates------------------------->  |
  |   <----exchange ICE candidates-----------------------| 
  |                                                        |
  |================== P2P Connection ====================| 
  |                                                        |
  | <---------- video/audio streams ------------------>  |
```

### 3. **Media Handling**
- **Camera**: 1280x720 ideal resolution
- **Audio**: Echo cancellation, noise suppression, auto gain
- **Codec**: Browser default (VP8/VP9 video, Opus audio)
- **STUN Servers**: Google STUN (stun.l.google.com)

## Integration Examples

### Spades Game with Video Chat
```javascript
import VideoChat from '@/components/video/VideoChat';
import SpadesGameContent from './SpadesGameContent';

function SpadesWithVideo() {
  const [roomId, setRoomId] = useState('spades_room_123');

  return (
    <VideoChat
      roomId={roomId}
      userId={currentUserId}
      username={currentUsername}
      mode="auto"
    >
      <SpadesGameContent />
    </VideoChat>
  );
}
```

### Dating Match with Video
```javascript
<VideoChat
  roomId={`dating_${matchId}`}
  userId={userId}
  username={userName}
  mode="pip"
  onClose={() => navigate('/dating/matches')}
>
  <DatingProfileView match={currentMatch} />
</VideoChat>
```

## Testing

### Demo Page
Visit: `/video-call-demo`

Features:
- Create or join rooms
- Test PiP and Split-Screen modes
- Simulate different game scenarios
- Test with multiple browser tabs

### Backend Tests
```bash
cd /app/backend
pytest tests/test_video_chat.py -v
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebRTC | ✅ | ✅ | ✅ | ✅ |
| getUserMedia | ✅ | ✅ | ✅* | ✅ |
| ICE | ✅ | ✅ | ✅ | ✅ |

*Safari requires HTTPS for camera/mic access

## Performance Optimization

### Mobile
- Default resolution: 1280x720
- Downgrade to 640x480 on poor connection
- PiP mode minimizes rendering overhead

### Desktop
- Up to 1920x1080 resolution
- Multiple peer connections (up to 8 users)
- Hardware acceleration enabled

## Security

1. **HTTPS Required**: WebRTC requires secure context
2. **STUN Only**: Using public STUN servers (no TURN for now)
3. **No Recording**: Video streams not recorded server-side
4. **Peer-to-Peer**: Direct connections, minimal server involvement

## Future Enhancements

- [ ] TURN server for NAT traversal
- [ ] Screen sharing support
- [ ] Virtual backgrounds
- [ ] Beauty filters
- [ ] Recording functionality
- [ ] Group video (4+ users)
- [ ] Spatial audio positioning
- [ ] AI background blur

## Troubleshooting

### Camera Not Working
- Check browser permissions
- Ensure HTTPS connection
- Try different browser
- Check camera not in use by another app

### Poor Video Quality
- Check network connection
- Reduce video resolution
- Close other bandwidth-heavy apps
- Use wired connection if possible

### Audio Echo
- Enable echo cancellation (default)
- Use headphones
- Reduce speaker volume
- Check microphone positioning

## API Reference

### Create Room
```bash
curl -X POST https://api.globalvibez.com/api/video-chat/create-room \
  -H "Content-Type: application/json" \
  -d '{"game_type": "spades"}'

# Response
{
  "success": true,
  "room_id": "room_abc123xyz",
  "signaling_url": "/api/ws/video-chat/room_abc123xyz"
}
```

### Get Active Rooms
```bash
curl https://api.globalvibez.com/api/video-chat/rooms

# Response
{
  "success": true,
  "rooms": [
    {
      "room_id": "room_abc123",
      "game_type": "spades",
      "participant_count": 2,
      "participants": ["user123", "user456"],
      "created_at": "2025-12-10T..."
    }
  ]
}
```

---

## Quick Start

1. **Navigate to demo**: `http://localhost:3000/video-call-demo`
2. **Create room**: Click "Create Room"
3. **Share room ID**: Send room ID to friend
4. **Join**: Friend enters room ID and clicks "Join"
5. **Allow permissions**: Grant camera/mic access
6. **Start gaming**: Video chat active during gameplay!

---

**Video Chat Route**: `/video-call-demo`
**Backend API**: `/api/video-chat/*`
**WebSocket**: `/api/ws/video-chat/{room_id}`
