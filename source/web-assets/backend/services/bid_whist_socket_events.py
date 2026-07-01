"""
GRAND MASTER BID WHIST - Socket.IO Integration
Real-time multiplayer events for the Imperial Four-Color Edition
"""
from services.bid_whist_grand_master import (
    bid_whist_tables,
    create_grand_master_table,
    join_grand_master_table,
    start_grand_master_hand,
    place_bid,
    finalize_bidding,
    discard_from_kitty,
    play_card,
    get_card_history_summary
)

def register_bid_whist_events(sio: object) -> dict:
    """Register all Grand Master Bid Whist Socket.IO events"""
    
    @sio.event
    async def bid_whist_create_game(sid: str, data: dict) -> None:
        """Create a new Grand Master Bid Whist game"""
        try:
            room_code = data.get('room_code')
            player_name = data.get('player_name', 'Player')
            tight_kitty = data.get('tight_kitty', True)
            enable_nullo = data.get('enable_nullo', True)
            enable_wheel = data.get('enable_wheel', True)
            
            if room_code in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room already exists'
                }, room=sid)
                return
            
            # Create table with premium features
            table = create_grand_master_table(
                room_code=room_code,
                host_session_id=sid,
                host_name=player_name,
                tight_kitty=tight_kitty,
                enable_nullo=enable_nullo,
                enable_wheel=enable_wheel
            )
            bid_whist_tables[room_code] = table
            
            # Join Socket.IO room
            await sio.enter_room(sid, room_code)
            
            await sio.emit('bid_whist_game_created', {
                'room_code': room_code,
                'player_name': player_name,
                'tight_kitty': tight_kitty,
                'enable_nullo': enable_nullo,
                'enable_wheel': enable_wheel
            }, room=sid)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Failed to create game: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_join_game(sid: str, data: dict) -> None:
        """Join an existing Grand Master Bid Whist game"""
        try:
            room_code = data.get('room_code')
            player_name = data.get('player_name', 'Player')
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Join table
            success = join_grand_master_table(table, sid, player_name)
            
            if not success:
                await sio.emit('bid_whist_error', {
                    'message': 'Table is full (max 4 players)'
                }, room=sid)
                return
            
            # Join Socket.IO room
            await sio.enter_room(sid, room_code)
            
            # Notify all players
            await sio.emit('bid_whist_player_joined', {
                'player_name': player_name,
                'player_count': len(table['player_order']),
                'players': {
                    sid: {
                        'name': p['name'],
                        'team': p['team'],
                        'is_ready': p['is_ready']
                    }
                    for sid, p in table['players'].items()
                }
            }, room=room_code)
            
            # Start game if 4 players
            if len(table['player_order']) == 4:
                start_grand_master_hand(table)
                
                await sio.emit('bid_whist_hand_started', {
                    'game_state': table['game_state'],
                    'current_player': table['player_order'][table['current_player_index']],
                    'tight_kitty': table['tight_kitty'],
                    'kitty_size': table['kitty_size']
                }, room=room_code)
                
                # Send each player their hand
                for player_sid in table['player_order']:
                    player = table['players'][player_sid]
                    await sio.emit('bid_whist_hand_dealt', {
                        'hand': [
                            {
                                'suit': c['suit'],
                                'rank': c['rank'],
                                'id': c['id'],
                                'color': c['color']
                            }
                            for c in player['hand']
                        ]
                    }, room=player_sid)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Failed to join game: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_place_bid(sid: str, data: dict) -> None:
        """Place a bid"""
        try:
            room_code = data.get('room_code')
            bid_amount = data.get('bid_amount')
            bid_type = data.get('bid_type')  # uptown, downtown, no_trump, nullo
            trump_suit = data.get('trump_suit')  # spades, hearts, diamonds, clubs
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Place bid
            success = place_bid(table, sid, bid_amount, bid_type, trump_suit)
            
            if not success:
                await sio.emit('bid_whist_error', {
                    'message': 'Invalid bid (must be higher than current or Nullo)'
                }, room=sid)
                return
            
            # Broadcast bid
            await sio.emit('bid_whist_bid_placed', {
                'player_id': sid,
                'player_name': table['players'][sid]['name'],
                'bid_amount': bid_amount,
                'bid_type': bid_type,
                'trump_suit': trump_suit,
                'current_bid': table['current_bid'],
                'next_player': table['player_order'][table['current_player_index']]
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Bid failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_pass_bid(sid: str, data: dict) -> None:
        """Pass on bidding"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Move to next player
            table['current_player_index'] = (table['current_player_index'] + 1) % len(table['player_order'])
            
            # Check if bidding round complete (all players acted)
            # For simplicity, assume 1 round of bidding
            # TODO: Implement multi-round bidding logic
            
            await sio.emit('bid_whist_player_passed', {
                'player_id': sid,
                'player_name': table['players'][sid]['name'],
                'next_player': table['player_order'][table['current_player_index']]
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Pass failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_finalize_bidding(sid: str, data: dict) -> None:
        """Finalize bidding and move to kitty selection"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Finalize bidding
            finalize_bidding(table)
            
            if not table['current_bid']:
                # No bids - redeal
                await sio.emit('bid_whist_no_bids', {
                    'message': 'No bids placed - redealing'
                }, room=room_code)
                
                start_grand_master_hand(table)
                return
            
            # Send kitty to winner
            winner_sid = table['bid_winner']
            winner = table['players'][winner_sid]
            
            await sio.emit('bid_whist_bidding_complete', {
                'winner_id': winner_sid,
                'winner_name': winner['name'],
                'winning_bid': table['current_bid'],
                'trump_suit': table['trump_suit'],
                'trump_direction': table['trump_direction']
            }, room=room_code)
            
            # Send kitty to winner
            await sio.emit('bid_whist_kitty_received', {
                'kitty': [
                    {
                        'suit': c['suit'],
                        'rank': c['rank'],
                        'id': c['id'],
                        'color': c['color']
                    }
                    for c in table['kitty']
                ]
            }, room=winner_sid)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Finalize bidding failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_discard_kitty(sid: str, data: dict) -> None:
        """Bid winner discards cards back to kitty"""
        try:
            room_code = data.get('room_code')
            cards_to_discard = data.get('cards_to_discard')  # List of card IDs
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Discard cards
            success = discard_from_kitty(table, sid, cards_to_discard)
            
            if not success:
                await sio.emit('bid_whist_error', {
                    'message': f'Must discard exactly {table["kitty_size"]} cards'
                }, room=sid)
                return
            
            # Start playing phase
            await sio.emit('bid_whist_playing_started', {
                'current_player': table['player_order'][table['current_player_index']],
                'trump_suit': table['trump_suit'],
                'trump_direction': table['trump_direction']
            }, room=room_code)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Discard failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_play_card(sid: str, data: dict) -> None:
        """Play a card"""
        try:
            room_code = data.get('room_code')
            card_id = data.get('card_id')
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Play card
            success = play_card(table, sid, card_id)
            
            if not success:
                await sio.emit('bid_whist_error', {
                    'message': 'Invalid card play (must follow suit)'
                }, room=sid)
                return
            
            # Get the played card
            played_card = None
            for play in table['current_trick']:
                if play['player_id'] == sid:
                    played_card = play['card']
                    break
            
            # Broadcast card played
            await sio.emit('bid_whist_card_played', {
                'player_id': sid,
                'player_name': table['players'][sid]['name'],
                'card': {
                    'suit': played_card['suit'],
                    'rank': played_card['rank'],
                    'id': played_card['id'],
                    'color': played_card['color']
                },
                'current_trick': [
                    {
                        'player_id': p['player_id'],
                        'card': {
                            'suit': p['card']['suit'],
                            'rank': p['card']['rank'],
                            'id': p['card']['id'],
                            'color': p['card']['color']
                        }
                    }
                    for p in table['current_trick']
                ],
                'next_player': table['player_order'][table['current_player_index']] if len(table['current_trick']) < 4 else None
            }, room=room_code)
            
            # Check if trick is complete
            if len(table['current_trick']) == 0:  # Trick was just completed and cleared
                await sio.emit('bid_whist_trick_complete', {
                    'books_team1': table['books_this_hand']['team1'],
                    'books_team2': table['books_this_hand']['team2'],
                    'next_player': table['player_order'][table['current_player_index']]
                }, room=room_code)
            
            # Check if hand is complete
            if table['game_state'] == 'hand_complete':
                await sio.emit('bid_whist_hand_complete', {
                    'scores': table['scores'],
                    'books_this_hand': table['books_this_hand'],
                    'winners': table['winners'] if table.get('winners') else None
                }, room=room_code)
                
                # Check for game over
                if table['game_state'] == 'game_over':
                    await sio.emit('bid_whist_game_over', {
                        'winner': table['winners'],
                        'final_scores': table['scores']
                    }, room=room_code)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Play card failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_get_card_history(sid: str, data: dict) -> None:
        """Get card history for strategy"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Get card history summary
            history = get_card_history_summary(table)
            
            await sio.emit('bid_whist_card_history', {
                'high_cards_remaining': history['high_cards_remaining'],
                'total_cards_played': history['total_cards_played'],
                'tricks_completed': history['tricks_completed']
            }, room=sid)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Get history failed: {str(e)}'
            }, room=sid)
    
    @sio.event
    async def bid_whist_start_new_hand(sid: str, data: dict) -> None:
        """Start a new hand after previous one completes"""
        try:
            room_code = data.get('room_code')
            
            if room_code not in bid_whist_tables:
                await sio.emit('bid_whist_error', {
                    'message': 'Room not found'
                }, room=sid)
                return
            
            table = bid_whist_tables[room_code]
            
            # Start new hand
            start_grand_master_hand(table)
            
            await sio.emit('bid_whist_hand_started', {
                'game_state': table['game_state'],
                'current_player': table['player_order'][table['current_player_index']],
                'game_number': table['game_number']
            }, room=room_code)
            
            # Send each player their hand
            for player_sid in table['player_order']:
                player = table['players'][player_sid]
                await sio.emit('bid_whist_hand_dealt', {
                    'hand': [
                        {
                            'suit': c['suit'],
                            'rank': c['rank'],
                            'id': c['id'],
                            'color': c['color']
                        }
                        for c in player['hand']
                    ]
                }, room=player_sid)
            
        except Exception as e:
            await sio.emit('bid_whist_error', {
                'message': f'Start new hand failed: {str(e)}'
            }, room=sid)
