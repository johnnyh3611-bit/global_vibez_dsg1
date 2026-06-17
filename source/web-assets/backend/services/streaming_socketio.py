"""
Streaming Socket.IO Events
Real-time events for live streaming (viewer join/leave, gift effects)
"""
from websocket_server import sio
import logging

logger = logging.getLogger(__name__)

# Active streams and their viewers
active_streams = {}  # {stream_id: {viewers: set(), streamer_sid: str}}


@sio.event
async def stream_join(sid, data):
    """Viewer joins a stream"""
    try:
        stream_id = data.get('stream_id')
        user_id = data.get('user_id')
        username = data.get('username', 'Anonymous')
        
        if not stream_id:
            return {'success': False, 'error': 'stream_id required'}
        
        # Initialize stream if not exists
        if stream_id not in active_streams:
            active_streams[stream_id] = {
                'viewers': set(),
                'streamer_sid': None
            }
        
        # Add viewer
        active_streams[stream_id]['viewers'].add(sid)
        
        # Join Socket.IO room
        await sio.enter_room(sid, f"stream_{stream_id}")
        
        viewer_count = len(active_streams[stream_id]['viewers'])
        
        # Notify stream about new viewer
        await sio.emit('viewer_joined', {
            'user_id': user_id,
            'username': username,
            'viewer_count': viewer_count
        }, room=f"stream_{stream_id}")
        
        logger.info(f"Viewer {username} joined stream {stream_id}")
        
        return {
            'success': True,
            'viewer_count': viewer_count
        }
        
    except Exception as e:
        logger.error(f"Error in stream_join: {str(e)}")
        return {'success': False, 'error': str(e)}


@sio.event
async def stream_leave(sid, data):
    """Viewer leaves a stream"""
    try:
        stream_id = data.get('stream_id')
        
        if not stream_id or stream_id not in active_streams:
            return {'success': False}
        
        # Remove viewer
        if sid in active_streams[stream_id]['viewers']:
            active_streams[stream_id]['viewers'].remove(sid)
        
        # Leave Socket.IO room
        await sio.leave_room(sid, f"stream_{stream_id}")
        
        viewer_count = len(active_streams[stream_id]['viewers'])
        
        # Notify stream
        await sio.emit('viewer_left', {
            'viewer_count': viewer_count
        }, room=f"stream_{stream_id}")
        
        logger.info(f"Viewer left stream {stream_id}")
        
        return {'success': True, 'viewer_count': viewer_count}
        
    except Exception as e:
        logger.error(f"Error in stream_leave: {str(e)}")
        return {'success': False, 'error': str(e)}


@sio.event
async def disconnect(sid):
    """Handle viewer disconnect"""
    try:
        # Remove from all streams
        for stream_id, stream_data in active_streams.items():
            if sid in stream_data['viewers']:
                stream_data['viewers'].remove(sid)
                
                viewer_count = len(stream_data['viewers'])
                
                await sio.emit('viewer_left', {
                    'viewer_count': viewer_count
                }, room=f"stream_{stream_id}")
                
    except Exception as e:
        logger.error(f"Error in disconnect handler: {str(e)}")


# Gift effect is emitted from streaming.py route after successful transaction
# No need to handle it here - just receives 'new_gift_effect' event

logger.info("✅ Streaming Socket.IO events loaded")
