"""
Matchmaking Socket.IO Events
Real-time queue updates and match notifications
"""
from services.matchmaking import (
    join_matchmaking_queue,
    leave_matchmaking_queue,
    get_queue_status,
    get_all_queues_status,
    MatchmakingMode,
    GameType
)


def register_matchmaking_events(sio: object) -> None:
    """Register matchmaking Socket.IO events"""
    
    @sio.event
    async def join_queue(sid: str, data: dict) -> None:
        """Join matchmaking queue"""
        try:
            user_id = data.get('user_id')
            player_name = data.get('player_name', 'Player')
            game_type = data.get('game_type', GameType.BID_WHIST)
            mode = data.get('mode', MatchmakingMode.QUICK_MATCH)
            elo_rating = data.get('elo_rating', 1000)
            wager = data.get('wager', 0)
            
            if not user_id:
                await sio.emit('matchmaking_error', {
                    'message': 'User ID required'
                }, room=sid)
                return
            
            # Join queue
            result = join_matchmaking_queue(
                session_id=sid,
                user_id=user_id,
                player_name=player_name,
                game_type=game_type,
                mode=mode,
                elo_rating=elo_rating,
                wager=wager
            )
            
            if 'error' in result:
                await sio.emit('matchmaking_error', {
                    'message': result['error']
                }, room=sid)
                return
            
            # If matched immediately
            if result['status'] == 'matched':
                room_code = result['room_code']
                
                # Enter Socket.IO room
                await sio.enter_room(sid, room_code)
                
                # Notify all matched players
                for player in result['players']:
                    await sio.emit('match_found', {
                        'room_code': room_code,
                        'game_type': game_type,
                        'players': [p['player_name'] for p in result['players']]
                    }, room=player['session_id'])
                
                print(f"🎮 Match created: {room_code} ({game_type})")
            else:
                # In queue, send status
                await sio.emit('queue_joined', {
                    'status': 'queued',
                    'position': result['position'],
                    'estimated_wait': result['estimated_wait']
                }, room=sid)
                
                print(f"⏳ {player_name} joined {game_type} queue (position {result['position']})")
        
        except Exception as e:
            print(f"Error joining queue: {e}")
            await sio.emit('matchmaking_error', {
                'message': f'Failed to join queue: {str(e)}'
            }, room=sid)
    
    
    @sio.event
    async def leave_queue(sid: str, data: dict) -> None:
        """Leave matchmaking queue"""
        try:
            success = leave_matchmaking_queue(sid)
            
            if success:
                await sio.emit('queue_left', {
                    'message': 'Left matchmaking queue'
                }, room=sid)
            
        except Exception as e:
            print(f"Error leaving queue: {e}")
    
    
    @sio.event
    async def get_queue_status_event(sid: str, data: dict) -> None:
        """Get current queue status"""
        try:
            status = get_queue_status(sid)
            
            await sio.emit('queue_status', status, room=sid)
            
        except Exception as e:
            print(f"Error getting queue status: {e}")
    
    
    @sio.event
    async def get_all_queues(sid: str, data: dict) -> None:
        """Get status of all queues"""
        try:
            status = get_all_queues_status()
            
            await sio.emit('all_queues_status', status, room=sid)
            
        except Exception as e:
            print(f"Error getting all queues: {e}")


print("✅ Matchmaking Socket.IO events loaded")
