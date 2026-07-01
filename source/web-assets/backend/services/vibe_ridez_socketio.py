"""
Vibe Ridez Socket.IO Events
Real-time location tracking and messaging for ride-sharing
"""

from datetime import datetime, timezone

# Get SocketIO instance from main multiplayer service
from services.multiplayer import sio
from config import db

# Vibe Ridez Socket.IO Events

@sio.on('vibe_ridez_join_ride')
async def handle_join_ride(sid, data):
    """
    Join a ride room for real-time updates
    data: { ride_id, user_id, role: 'driver' | 'passenger' }
    """
    try:
        ride_id = data.get('ride_id')
        user_id = data.get('user_id')
        role = data.get('role', 'passenger')
        
        if not ride_id or not user_id:
            await sio.emit('error', {'message': 'Missing ride_id or user_id'}, room=sid)
            return
        
        # Join ride room
        room = f"ride_{ride_id}"
        sio.enter_room(sid, room)
        
        # Store user info in session
        async with sio.session(sid) as session:
            session['ride_id'] = ride_id
            session['user_id'] = user_id
            session['role'] = role
        
        # Notify others in room
        await sio.emit('user_joined_ride', {
            'user_id': user_id,
            'role': role,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=room, skip_sid=sid)
        
        # Send confirmation
        await sio.emit('joined_ride', {
            'ride_id': ride_id,
            'room': room
        }, room=sid)
        
        print(f"User {user_id} ({role}) joined ride {ride_id}")
        
    except Exception as e:
        print(f"Error in join_ride: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.on('vibe_ridez_location_update')
async def handle_location_update(sid, data):
    """
    Driver sends location update
    data: { latitude, longitude, heading, speed }
    """
    try:
        async with sio.session(sid) as session:
            ride_id = session.get('ride_id')
            user_id = session.get('user_id')
            role = session.get('role')
        
        if not ride_id or role != 'driver':
            await sio.emit('error', {'message': 'Only drivers can send location updates'}, room=sid)
            return
        
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        heading = data.get('heading', 0)
        speed = data.get('speed', 0)
        
        if latitude is None or longitude is None:
            return
        
        # Store latest location in MongoDB
        await db.vibe_ridez_locations.update_one(
            {'ride_id': ride_id},
            {
                '$set': {
                    'driver_id': user_id,
                    'latitude': latitude,
                    'longitude': longitude,
                    'heading': heading,
                    'speed': speed,
                    'timestamp': datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        # Broadcast to all passengers in ride
        room = f"ride_{ride_id}"
        await sio.emit('driver_location', {
            'latitude': latitude,
            'longitude': longitude,
            'heading': heading,
            'speed': speed,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=room, skip_sid=sid)
        
    except Exception as e:
        print(f"Error in location_update: {e}")


@sio.on('vibe_ridez_start_ride')
async def handle_start_ride(sid, data):
    """
    Driver starts the ride (status: scheduled → active)
    """
    try:
        ride_id = data.get('ride_id')
        
        async with sio.session(sid) as session:
            user_id = session.get('user_id')
            role = session.get('role')
        
        if role != 'driver':
            await sio.emit('error', {'message': 'Only driver can start ride'}, room=sid)
            return
        
        # Update ride status
        result = await db.vibe_ridez_rides.update_one(
            {'ride_id': ride_id, 'driver_user_id': user_id},
            {'$set': {
                'status': 'active',
                'actual_start_time': datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count > 0:
            room = f"ride_{ride_id}"
            await sio.emit('ride_started', {
                'ride_id': ride_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=room)
            
            print(f"Ride {ride_id} started by {user_id}")
        
    except Exception as e:
        print(f"Error starting ride: {e}")


@sio.on('vibe_ridez_complete_ride')
async def handle_complete_ride(sid, data):
    """
    Driver completes the ride (status: active → completed)
    """
    try:
        ride_id = data.get('ride_id')
        
        async with sio.session(sid) as session:
            user_id = session.get('user_id')
            role = session.get('role')
        
        if role != 'driver':
            await sio.emit('error', {'message': 'Only driver can complete ride'}, room=sid)
            return
        
        # Update ride status
        result = await db.vibe_ridez_rides.update_one(
            {'ride_id': ride_id, 'driver_user_id': user_id},
            {'$set': {
                'status': 'completed',
                'actual_end_time': datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count > 0:
            # Update driver's total rides count
            await db.vibe_ridez_drivers.update_one(
                {'user_id': user_id},
                {'$inc': {'total_rides': 1}}
            )
            
            room = f"ride_{ride_id}"
            await sio.emit('ride_completed', {
                'ride_id': ride_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=room)
            
            print(f"Ride {ride_id} completed by {user_id}")
        
    except Exception as e:
        print(f"Error completing ride: {e}")


@sio.on('vibe_ridez_send_message')
async def handle_send_message(sid, data):
    """
    Send message in ride chat
    data: { ride_id, message }
    """
    try:
        async with sio.session(sid) as session:
            ride_id = session.get('ride_id')
            user_id = session.get('user_id')
            role = session.get('role')
        
        message_text = data.get('message')
        
        if not message_text:
            return
        
        # Store message in MongoDB
        message_doc = {
            'ride_id': ride_id,
            'user_id': user_id,
            'role': role,
            'message': message_text,
            'timestamp': datetime.now(timezone.utc)
        }
        
        await db.vibe_ridez_messages.insert_one(message_doc)
        
        # Broadcast to ride room
        room = f"ride_{ride_id}"
        await sio.emit('ride_message', {
            'user_id': user_id,
            'role': role,
            'message': message_text,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }, room=room)
        
    except Exception as e:
        print(f"Error sending message: {e}")


@sio.on('vibe_ridez_get_messages')
async def handle_get_messages(sid, data):
    """
    Get message history for ride
    """
    try:
        ride_id = data.get('ride_id')
        
        messages = await db.vibe_ridez_messages.find(
            {'ride_id': ride_id},
            {'_id': 0}
        ).sort('timestamp', 1).limit(100).to_list(length=100)
        
        await sio.emit('ride_messages_history', {
            'ride_id': ride_id,
            'messages': messages
        }, room=sid)
        
    except Exception as e:
        print(f"Error getting messages: {e}")


@sio.on('vibe_ridez_leave_ride')
async def handle_leave_ride(sid, data):
    """
    Leave ride room
    """
    try:
        async with sio.session(sid) as session:
            ride_id = session.get('ride_id')
            user_id = session.get('user_id')
            role = session.get('role')
        
        if ride_id:
            room = f"ride_{ride_id}"
            sio.leave_room(sid, room)
            
            # Notify others
            await sio.emit('user_left_ride', {
                'user_id': user_id,
                'role': role,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, room=room)
            
            print(f"User {user_id} left ride {ride_id}")
        
    except Exception as e:
        print(f"Error leaving ride: {e}")


@sio.on('disconnect')
async def handle_disconnect(sid):
    """
    Handle disconnect - leave ride room
    """
    try:
        async with sio.session(sid) as session:
            ride_id = session.get('ride_id')
            if ride_id:
                room = f"ride_{ride_id}"
                sio.leave_room(sid, room)
    except Exception:
        pass


print("✅ Vibe Ridez Socket.IO events loaded")
