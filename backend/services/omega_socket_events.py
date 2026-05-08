"""
PROTOCOL: OMEGA - Socket.IO Integration
Real-time multiplayer events for the Data-Stream Battleground
"""
from services.protocol_omega import (
    omega_tables,
    create_omega_table,
    initialize_board,
    execute_combat,
    activate_singularity,
    execute_turn,
    get_board_state,
    OmegaGameState
)

def register_omega_events(sio):
    """Register all Protocol: Omega Socket.IO events"""
    
    @sio.event
    async def omega_create_game(sid, data):
        """Create a new Protocol: Omega game"""
        try:
            room_code = data.get('room_code')
            player_name = data.get('player_name', 'Commander')
            
            if room_code in omega_tables:
                await sio.emit('omega_error', {
                    'message': 'Room already exists'
                }, room=sid)
                return
            
            # Create table
            table = create_omega_table(room_code, sid, player_name)
            omega_tables[room_code] = table
            
            # Join Socket.IO room
            await sio.enter_room(sid, room_code)
            
            await sio.emit('omega_game_created', {
                'room_code': room_code,
                'player_name': player_name
            }, room=sid)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'Failed to create game: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def omega_join_game(sid, data):
        """Join an existing Protocol: Omega game"""
        try:
            room_code = data.get('room_code')
            player_name = data.get('player_name', 'Commander')
            
            if room_code not in omega_tables:
                await sio.emit('omega_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = omega_tables[room_code]
            
            if len(table['players']) >= 2:
                await sio.emit('omega_error', {
                    'message': 'Room is full'
                }, room=sid)
                return
            
            # Add second player (Magenta team)
            table['players'][sid] = {
                'session_id': sid,
                'name': player_name,
                'team': 'magenta',
                'is_ready': False,
                'king_id': None,
                'queen_id': None,
                'total_integrity': 0,
                'total_energy': 0
            }
            
            # Join Socket.IO room
            await sio.enter_room(sid, room_code)
            
            # Get player IDs
            player_ids = list(table['players'].keys())
            
            # Initialize board
            initialize_board(table, player_ids[0], player_ids[1])
            
            # Notify all players
            await sio.emit('omega_game_started', {
                'room_code': room_code,
                'board_state': get_board_state(table)
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'Failed to join game: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def omega_move_program(sid, data):
        """Move an Energy Program"""
        try:
            room_code = data.get('room_code')
            program_id = data.get('program_id')
            new_position = tuple(data.get('new_position'))  # (x, y)
            new_layer = data.get('new_layer')
            
            if room_code not in omega_tables:
                await sio.emit('omega_error', {'message': 'Room not found'}, room=sid)
                return
            
            table = omega_tables[room_code]
            
            # Verify it's player's turn
            if table['current_player'] != sid:
                await sio.emit('omega_error', {
                    'message': 'Not your turn'
                }, room=sid)
                return
            
            # Find program
            program = None
            old_layer = None
            for layer_idx, layer in table['layers'].items():
                if program_id in layer['programs']:
                    program = layer['programs'][program_id]
                    old_layer = layer_idx
                    break
            
            if not program:
                await sio.emit('omega_error', {
                    'message': 'Program not found'
                }, room=sid)
                return
            
            # Verify ownership
            if program.team.value != table['players'][sid]['team']:
                await sio.emit('omega_error', {
                    'message': 'Not your program'
                }, room=sid)
                return
            
            # TODO: Add move validation (check if move is legal)
            
            # Execute move
            if new_layer is not None and new_layer != old_layer:
                # Move between layers
                del table['layers'][old_layer]['programs'][program_id]
                program.layer = new_layer
                program.position = new_position
                table['layers'][new_layer]['programs'][program_id] = program
            else:
                # Move within same layer
                program.position = new_position
            
            # Log event
            table['combat_log'].append({
                'event': 'MOVE',
                'turn': table['current_turn'],
                'program_id': program_id,
                'from': {'layer': old_layer, 'position': program.position},
                'to': {'layer': new_layer or old_layer, 'position': new_position}
            })
            
            # Broadcast updated state
            await sio.emit('omega_program_moved', {
                'program_id': program_id,
                'new_position': new_position,
                'new_layer': new_layer or old_layer,
                'board_state': get_board_state(table)
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'Move failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def omega_attack(sid, data):
        """Execute attack between programs"""
        try:
            room_code = data.get('room_code')
            attacker_id = data.get('attacker_id')
            defender_id = data.get('defender_id')
            
            if room_code not in omega_tables:
                await sio.emit('omega_error', {'message': 'Room not found'}, room=sid)
                return
            
            table = omega_tables[room_code]
            
            # Verify it's player's turn
            if table['current_player'] != sid:
                await sio.emit('omega_error', {
                    'message': 'Not your turn'
                }, room=sid)
                return
            
            # Execute combat
            result = execute_combat(table, attacker_id, defender_id)
            
            if not result['success']:
                await sio.emit('omega_error', {
                    'message': f"Attack failed: {result.get('reason', 'unknown')}"
                }, room=sid)
                return
            
            # Broadcast combat result
            await sio.emit('omega_combat', {
                'attacker_id': attacker_id,
                'defender_id': defender_id,
                'result': result,
                'board_state': get_board_state(table)
            }, room=room_code)
            
            # Check for game over
            if table['game_state'] == OmegaGameState.GAME_OVER.value:
                await sio.emit('omega_game_over', {
                    'winner': table['winner'],
                    'reason': table['game_over_reason']
                }, room=room_code)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'Attack failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def omega_activate_singularity(sid, data):
        """Activate King's Singularity ability"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in omega_tables:
                await sio.emit('omega_error', {'message': 'Room not found'}, room=sid)
                return
            
            table = omega_tables[room_code]
            team = table['players'][sid]['team']
            
            # Activate Singularity
            result = activate_singularity(table, team)
            
            if not result['success']:
                await sio.emit('omega_error', {
                    'message': f"Singularity failed: {result.get('reason', 'unknown')}"
                }, room=sid)
                return
            
            # Broadcast Singularity event
            await sio.emit('omega_singularity', {
                'team': team,
                'programs_deleted': result['programs_deleted'],
                'board_state': get_board_state(table)
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'Singularity failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def omega_toggle_aegis(sid, data):
        """Toggle Queen's Reflective Aegis"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in omega_tables:
                await sio.emit('omega_error', {'message': 'Room not found'}, room=sid)
                return
            
            table = omega_tables[room_code]
            team = table['players'][sid]['team']
            
            # Toggle Aegis
            table['aegis_active'][team] = not table['aegis_active'][team]
            
            # Broadcast Aegis status
            await sio.emit('omega_aegis_toggled', {
                'team': team,
                'active': table['aegis_active'][team],
                'board_state': get_board_state(table)
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'Aegis toggle failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def omega_end_turn(sid, data):
        """End current turn and execute turn mechanics"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in omega_tables:
                await sio.emit('omega_error', {'message': 'Room not found'}, room=sid)
                return
            
            table = omega_tables[room_code]
            
            # Verify it's player's turn
            if table['current_player'] != sid:
                await sio.emit('omega_error', {
                    'message': 'Not your turn'
                }, room=sid)
                return
            
            # Execute turn-end mechanics
            execute_turn(table)
            
            # Switch player
            player_ids = list(table['players'].keys())
            current_idx = player_ids.index(sid)
            next_idx = (current_idx + 1) % len(player_ids)
            table['current_player'] = player_ids[next_idx]
            
            # Broadcast turn end
            await sio.emit('omega_turn_ended', {
                'next_player': table['current_player'],
                'board_state': get_board_state(table)
            }, room=room_code)
            
            # Check for System Refrag
            if table['game_state'] == OmegaGameState.SYSTEM_REFRAG.value:
                await sio.emit('omega_system_refrag', {
                    'message': '⚠️ SYSTEM REFRAG INITIATED'
                }, room=room_code)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'End turn failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def omega_get_state(sid, data):
        """Get current game state"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in omega_tables:
                await sio.emit('omega_error', {'message': 'Room not found'}, room=sid)
                return
            
            table = omega_tables[room_code]
            
            await sio.emit('omega_state_update', {
                'board_state': get_board_state(table)
            }, room=sid)
            
        except Exception as e:
            await sio.emit('omega_error', {
                'message': f'Get state failed: {str(e)}'
            }, room=sid)
