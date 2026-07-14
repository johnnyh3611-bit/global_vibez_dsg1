"""
Underground Spades - Socket.IO Events
Real-time multiplayer for the exclusive Underground Club
"""

import secrets
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from services.reconnection_queue import spades_reconnect_queue

# Global games storage
underground_spades_games = {}
# sid -> (room_code, player_id) for disconnect mark-offline
_spades_sid_index: Dict[str, tuple] = {}


def fisher_yates_shuffle(deck: List[Dict]) -> List[Dict]:
    """Cryptographically secure Fisher-Yates shuffle"""
    shuffled = deck.copy()
    for i in range(len(shuffled) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
    return shuffled


class UndergroundSpadesGame:
    """
    Underground Club Spades - 4-player team-based card game
    - 2 teams of 2 players
    - Classic Spades rules with street-style trash talk
    - Spades always trump
    - Game to 200 points
    - 5-bag penalty system
    """
    
    SUITS = ['spades', 'hearts', 'diamonds', 'clubs']
    RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    RANK_VALUES = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
                   '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}
    
    def __init__(self, room_code: str):
        self.room_code = room_code
        self.players = {}  # {player_id: {name, position, hand, bid, tricks, team, sid}}
        self.positions = ['north', 'east', 'south', 'west']  # north/south = team1, east/west = team2
        self.game_state = 'waiting'  # waiting, bidding, playing, hand_complete, game_over
        self.current_player_position = None
        self.current_trick = []
        self.tricks_played = 0
        self.spades_broken = False
        self.led_suit = None
        self.scores = {'team1': {'points': 0, 'bags': 0}, 'team2': {'points': 0, 'bags': 0}}
        self.trash_talk_log = []
        self.created_at = datetime.now(timezone.utc)
    
    def add_player(self, player_id: str, player_name: str, sid: str) -> Dict:
        """Add a player to the game"""
        if player_id in self.players:
            return self.reconnect_player(player_id, sid)

        if len(self.players) >= 4:
            return {'success': False, 'message': 'Game is full'}
        
        # Assign position
        taken_positions = [p['position'] for p in self.players.values()]
        available = [pos for pos in self.positions if pos not in taken_positions]
        position = available[0]
        
        # Assign team based on position
        team = 'team1' if position in ['north', 'south'] else 'team2'
        
        self.players[player_id] = {
            'name': player_name,
            'position': position,
            'hand': [],
            'bid': None,
            'tricks': 0,
            'team': team,
            'sid': sid
        }
        
        return {'success': True, 'position': position, 'team': team, 'reconnected': False}

    def reconnect_player(self, player_id: str, sid: str) -> Dict:
        """Refresh sid for an existing seat (Socket.IO reconnect / resume)."""
        player = self.players.get(player_id)
        if not player:
            return {'success': False, 'message': 'Player not in game'}
        player['sid'] = sid
        return {
            'success': True,
            'position': player['position'],
            'team': player['team'],
            'reconnected': True,
        }

    def snapshot_for(self, player_id: str) -> Dict[str, Any]:
        """Public + private state for a reconnecting player."""
        player = self.players.get(player_id) or {}
        return {
            'room_code': self.room_code,
            'game_state': self.game_state,
            'current_player_position': self.current_player_position,
            'spades_broken': self.spades_broken,
            'tricks_played': self.tricks_played,
            'scores': self.scores,
            'current_trick': self.current_trick,
            'players': {
                pid: {
                    'name': p['name'],
                    'position': p['position'],
                    'team': p['team'],
                    'bid': p.get('bid'),
                    'tricks': p.get('tricks', 0),
                }
                for pid, p in self.players.items()
            },
            'hand': list(player.get('hand') or []),
            'your_position': player.get('position'),
            'your_team': player.get('team'),
        }
    
    def create_deck(self) -> List[Dict]:
        """Create and shuffle a standard 52-card deck"""
        deck = []
        for suit in self.SUITS:
            for rank in self.RANKS:
                deck.append({
                    'suit': suit,
                    'rank': rank,
                    'value': self.RANK_VALUES[rank],
                    'id': f"{rank}_{suit}"
                })
        return fisher_yates_shuffle(deck)
    
    def deal_cards(self):
        """Deal 13 cards to each player"""
        deck = self.create_deck()
        
        # Deal cards
        for i, card in enumerate(deck):
            position = self.positions[i % 4]
            player = next(p for p in self.players.values() if p['position'] == position)
            player['hand'].append(card)
        
        # Sort hands
        for player in self.players.values():
            player['hand'].sort(key=lambda c: (self.SUITS.index(c['suit']), c['value']))
        
        self.game_state = 'bidding'
        self.current_player_position = 'north'
    
    def place_bid(self, player_id: str, bid: int) -> Dict:
        """Place a bid (0-13)"""
        if bid < 0 or bid > 13:
            return {'success': False, 'message': 'Invalid bid (0-13)'}
        
        player = self.players.get(player_id)
        if not player:
            return {'success': False, 'message': 'Player not found'}
        
        player['bid'] = bid
        
        # Check if all bids are in
        if all(p['bid'] is not None for p in self.players.values()):
            self.game_state = 'playing'
            self.current_player_position = 'north'  # North leads first trick
        else:
            # Move to next player
            self._advance_turn()
        
        return {'success': True}
    
    def play_card(self, player_id: str, card_id: str) -> Dict:
        """Play a card to the current trick"""
        player = self.players.get(player_id)
        if not player:
            return {'success': False, 'message': 'Player not found'}
        
        # Find card in hand
        card = next((c for c in player['hand'] if c['id'] == card_id), None)
        if not card:
            return {'success': False, 'message': 'Card not in hand'}
        
        # Validate play
        if not self._is_valid_play(player, card):
            return {'success': False, 'message': 'Invalid play'}
        
        # Remove card from hand
        player['hand'] = [c for c in player['hand'] if c['id'] != card_id]
        
        # Add to current trick
        self.current_trick.append({
            'player_id': player_id,
            'position': player['position'],
            'card': card
        })
        
        # Set led suit if first card
        if len(self.current_trick) == 1:
            self.led_suit = card['suit']
        
        # Check if spades broken
        if card['suit'] == 'spades' and len(self.current_trick) > 1:
            self.spades_broken = True
        
        # Check if trick complete
        if len(self.current_trick) == 4:
            return self._complete_trick()
        
        # Advance to next player
        self._advance_turn()
        return {'success': True, 'trick_complete': False}
    
    def _is_valid_play(self, player: Dict, card: Dict) -> bool:
        """Check if card play is valid"""
        # If leading
        if len(self.current_trick) == 0:
            # Can't lead spades unless broken or only spades left
            if card['suit'] == 'spades' and not self.spades_broken:
                non_spades = [c for c in player['hand'] if c['suit'] != 'spades']
                if non_spades:
                    return False
            return True
        
        # Must follow suit if possible
        same_suit = [c for c in player['hand'] if c['suit'] == self.led_suit]
        if same_suit and card['suit'] != self.led_suit:
            return False
        
        return True
    
    def _complete_trick(self) -> Dict:
        """Determine trick winner and advance game"""
        # Find winner
        spades_played = [p for p in self.current_trick if p['card']['suit'] == 'spades']
        
        if spades_played:
            winner = max(spades_played, key=lambda p: p['card']['value'])
        else:
            led_suit_cards = [p for p in self.current_trick if p['card']['suit'] == self.led_suit]
            winner = max(led_suit_cards, key=lambda p: p['card']['value'])
        
        winner_player = self.players[winner['player_id']]
        winner_player['tricks'] += 1
        
        self.tricks_played += 1
        self.current_player_position = winner_player['position']
        self.current_trick = []
        self.led_suit = None
        
        # Check if hand complete
        if self.tricks_played == 13:
            self._score_hand()
            return {'success': True, 'trick_complete': True, 'hand_complete': True, 
                   'winner_position': winner_player['position']}
        
        return {'success': True, 'trick_complete': True, 'hand_complete': False,
               'winner_position': winner_player['position']}
    
    def _score_hand(self):
        """Score the completed hand"""
        for team in ['team1', 'team2']:
            team_players = [p for p in self.players.values() if p['team'] == team]
            
            team_bid = sum(p['bid'] for p in team_players)
            team_tricks = sum(p['tricks'] for p in team_players)
            
            if team_tricks >= team_bid:
                # Made bid
                points = team_bid * 10
                bags = team_tricks - team_bid
                self.scores[team]['bags'] += bags
                points += bags
                
                # 5-bag penalty
                if self.scores[team]['bags'] >= 5:
                    penalty_bags = self.scores[team]['bags'] // 5
                    points -= penalty_bags * 50
                    self.scores[team]['bags'] = self.scores[team]['bags'] % 5
                
                self.scores[team]['points'] += points
            else:
                # Failed bid
                self.scores[team]['points'] -= team_bid * 10
        
        # Check for winner
        if self.scores['team1']['points'] >= 200 or self.scores['team2']['points'] >= 200:
            self.game_state = 'game_over'
        else:
            self.game_state = 'hand_complete'
    
    def _advance_turn(self):
        """Move to next player's turn"""
        current_idx = self.positions.index(self.current_player_position)
        next_idx = (current_idx + 1) % 4
        self.current_player_position = self.positions[next_idx]
    
    def reset_hand(self):
        """Start a new hand"""
        for player in self.players.values():
            player['hand'] = []
            player['bid'] = None
            player['tricks'] = 0
        
        self.current_trick = []
        self.tricks_played = 0
        self.spades_broken = False
        self.led_suit = None
        self.game_state = 'bidding'
        self.current_player_position = 'north'
        self.deal_cards()
    
    def add_trash_talk(self, player_id: str, message: str):
        """Add trash talk message"""
        player = self.players.get(player_id)
        if player:
            self.trash_talk_log.append({
                'player_name': player['name'],
                'message': message,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })


def register_underground_spades_events(sio):
    """Register all Underground Spades Socket.IO events"""

    async def _emit_room(room_code: str, event: str, payload: Dict[str, Any]) -> None:
        """Broadcast to room; buffer per offline player so reconnect can catch up."""
        game = underground_spades_games.get(room_code)
        if not game:
            await sio.emit(event, payload, room=room_code)
            return
        for pid, player in game.players.items():
            qe = spades_reconnect_queue.enqueue(room_code, pid, event, payload)
            if spades_reconnect_queue.is_offline(room_code, pid):
                continue
            target = player.get('sid')
            if target:
                await sio.emit(event, qe.payload, room=target)

    async def _emit_player(
        room_code: str, player_id: str, event: str, payload: Dict[str, Any], sid: Optional[str] = None
    ) -> None:
        qe = spades_reconnect_queue.enqueue(room_code, player_id, event, payload)
        if spades_reconnect_queue.is_offline(room_code, player_id):
            return
        game = underground_spades_games.get(room_code)
        target = sid or (game.players.get(player_id, {}) if game else {}).get('sid')
        if target:
            await sio.emit(event, qe.payload, room=target)

    def _index_sid(sid: str, room_code: str, player_id: str) -> None:
        _spades_sid_index[sid] = (room_code, player_id)
        spades_reconnect_queue.mark_online(room_code, player_id, sid)
    
    @sio.event
    async def underground_spades_create_game(sid, data):
        """Create a new Underground Spades game"""
        try:
            room_code = data.get('room_code')
            player_name = data.get('player_name', 'Player')
            player_id = data.get('player_id', sid)
            
            if room_code in underground_spades_games:
                await sio.emit('underground_spades_error', 
                             {'message': 'Room already exists'}, room=sid)
                return
            
            game = UndergroundSpadesGame(room_code)
            result = game.add_player(player_id, player_name, sid)
            
            if not result['success']:
                await sio.emit('underground_spades_error',
                             {'message': result['message']}, room=sid)
                return
            
            underground_spades_games[room_code] = game
            await sio.enter_room(sid, room_code)
            _index_sid(sid, room_code, player_id)
            
            await _emit_room(room_code, 'underground_spades_game_created', {
                'room_code': room_code,
                'position': result['position'],
                'team': result['team'],
                'players': {pid: {'name': p['name'], 'position': p['position'], 'team': p['team']} 
                           for pid, p in game.players.items()}
            })
            
        except Exception as e:
            await sio.emit('underground_spades_error',
                         {'message': f'Error creating game: {str(e)}'}, room=sid)
    
    @sio.event
    async def underground_spades_join_game(sid, data):
        """Join an existing Underground Spades game (or resume after disconnect)."""
        try:
            room_code = data.get('room_code')
            player_name = data.get('player_name', 'Player')
            player_id = data.get('player_id', sid)
            last_seq = int(data.get('last_seq') or 0)
            
            game = underground_spades_games.get(room_code)
            if not game:
                await sio.emit('underground_spades_error',
                             {'message': 'Game not found'}, room=sid)
                return
            
            result = game.add_player(player_id, player_name, sid)
            
            if not result['success']:
                await sio.emit('underground_spades_error',
                             {'message': result['message']}, room=sid)
                return
            
            await sio.enter_room(sid, room_code)
            _index_sid(sid, room_code, player_id)

            # Reconnect path — snapshot + buffered event flush (kills jitter)
            if result.get('reconnected'):
                await sio.emit('underground_spades_resumed', {
                    'snapshot': game.snapshot_for(player_id),
                    'replay': [
                        {'seq': e.seq, 'event': e.event, 'payload': e.payload}
                        for e in spades_reconnect_queue.drain_since(
                            room_code, player_id, last_seq
                        )
                    ],
                }, room=sid)
                return
            
            # Notify all players
            await _emit_room(room_code, 'underground_spades_player_joined', {
                'player_id': player_id,
                'player_name': player_name,
                'position': result['position'],
                'team': result['team'],
                'players': {pid: {'name': p['name'], 'position': p['position'], 'team': p['team']} 
                           for pid, p in game.players.items()},
                'player_count': len(game.players)
            })
            
            # If 4 players, start game
            if len(game.players) == 4:
                game.deal_cards()
                
                # Send hands to each player privately
                for pid, player in game.players.items():
                    await _emit_player(room_code, pid, 'underground_spades_hand_dealt', {
                        'hand': player['hand'],
                        'game_state': game.game_state,
                        'current_player_position': game.current_player_position
                    }, sid=player['sid'])
                
                # Notify all players game started
                await _emit_room(room_code, 'underground_spades_game_started', {
                    'game_state': game.game_state,
                    'current_player_position': game.current_player_position
                })
            
        except Exception as e:
            await sio.emit('underground_spades_error',
                         {'message': f'Error joining game: {str(e)}'}, room=sid)
    
    @sio.event
    async def underground_spades_place_bid(sid, data):
        """Place a bid"""
        try:
            room_code = data.get('room_code')
            player_id = data.get('player_id', sid)
            bid = data.get('bid')
            
            game = underground_spades_games.get(room_code)
            if not game:
                await sio.emit('underground_spades_error',
                             {'message': 'Game not found'}, room=sid)
                return
            
            result = game.place_bid(player_id, bid)
            
            if not result['success']:
                await sio.emit('underground_spades_error',
                             {'message': result['message']}, room=sid)
                return
            
            # Notify all players (queued if offline)
            await _emit_room(room_code, 'underground_spades_bid_placed', {
                'player_id': player_id,
                'position': game.players[player_id]['position'],
                'bid': bid,
                'game_state': game.game_state,
                'current_player_position': game.current_player_position,
                'all_bids': {p['position']: p['bid'] for p in game.players.values()}
            })
            
        except Exception as e:
            await sio.emit('underground_spades_error',
                         {'message': f'Error placing bid: {str(e)}'}, room=sid)
    
    @sio.event
    async def underground_spades_play_card(sid, data):
        """Play a card"""
        try:
            room_code = data.get('room_code')
            player_id = data.get('player_id', sid)
            card_id = data.get('card_id')
            
            game = underground_spades_games.get(room_code)
            if not game:
                await sio.emit('underground_spades_error',
                             {'message': 'Game not found'}, room=sid)
                return
            
            result = game.play_card(player_id, card_id)
            
            if not result['success']:
                await sio.emit('underground_spades_error',
                             {'message': result['message']}, room=sid)
                return
            
            # Notify all players (queued if offline)
            await _emit_room(room_code, 'underground_spades_card_played', {
                'player_id': player_id,
                'position': game.players[player_id]['position'],
                'card_id': card_id,
                'current_trick': game.current_trick,
                'current_player_position': game.current_player_position,
                'spades_broken': game.spades_broken
            })
            
            # If trick complete
            if result.get('trick_complete'):
                await _emit_room(room_code, 'underground_spades_trick_complete', {
                    'winner_position': result['winner_position'],
                    'tricks_played': game.tricks_played,
                    'current_player_position': game.current_player_position
                })
            
            # If hand complete
            if result.get('hand_complete'):
                await _emit_room(room_code, 'underground_spades_hand_complete', {
                    'scores': game.scores,
                    'game_state': game.game_state
                })
            
        except Exception as e:
            await sio.emit('underground_spades_error',
                         {'message': f'Error playing card: {str(e)}'}, room=sid)
    
    @sio.event
    async def underground_spades_start_new_hand(sid, data):
        """Start a new hand"""
        try:
            room_code = data.get('room_code')
            
            game = underground_spades_games.get(room_code)
            if not game:
                await sio.emit('underground_spades_error',
                             {'message': 'Game not found'}, room=sid)
                return
            
            game.reset_hand()
            
            # Send hands to each player
            for pid, player in game.players.items():
                await _emit_player(room_code, pid, 'underground_spades_hand_dealt', {
                    'hand': player['hand'],
                    'game_state': game.game_state,
                    'current_player_position': game.current_player_position
                }, sid=player['sid'])
            
            # Notify all players
            await _emit_room(room_code, 'underground_spades_new_hand_started', {
                'game_state': game.game_state,
                'current_player_position': game.current_player_position
            })
            
        except Exception as e:
            await sio.emit('underground_spades_error',
                         {'message': f'Error starting new hand: {str(e)}'}, room=sid)
    
    @sio.event
    async def underground_spades_trash_talk(sid, data):
        """Send trash talk message"""
        try:
            room_code = data.get('room_code')
            player_id = data.get('player_id', sid)
            message = data.get('message', '')
            
            game = underground_spades_games.get(room_code)
            if not game:
                return
            
            game.add_trash_talk(player_id, message)
            
            player = game.players.get(player_id)
            if player:
                await _emit_room(room_code, 'underground_spades_trash_talk_received', {
                    'player_name': player['name'],
                    'position': player['position'],
                    'message': message
                })
            
        except Exception as e:
            print(f"Error sending trash talk: {e}")

    @sio.event
    async def underground_spades_resume(sid, data):
        """Explicit resume after Socket.IO reconnect — flush buffered events."""
        try:
            room_code = data.get('room_code')
            player_id = data.get('player_id', sid)
            last_seq = int(data.get('last_seq') or 0)
            game = underground_spades_games.get(room_code)
            if not game or player_id not in game.players:
                await sio.emit(
                    'underground_spades_error',
                    {'message': 'Cannot resume — not seated'},
                    room=sid,
                )
                return
            game.reconnect_player(player_id, sid)
            await sio.enter_room(sid, room_code)
            _index_sid(sid, room_code, player_id)
            await sio.emit(
                'underground_spades_resumed',
                {
                    'snapshot': game.snapshot_for(player_id),
                    'replay': [
                        {'seq': e.seq, 'event': e.event, 'payload': e.payload}
                        for e in spades_reconnect_queue.drain_since(
                            room_code, player_id, last_seq
                        )
                    ],
                },
                room=sid,
            )
        except Exception as e:
            await sio.emit(
                'underground_spades_error',
                {'message': f'Resume failed: {e}'},
                room=sid,
            )

    @sio.event
    async def disconnect(sid):
        """Mark Spades seat offline so events buffer until resume."""
        mapping = _spades_sid_index.pop(sid, None)
        if not mapping:
            return
        room_code, player_id = mapping
        spades_reconnect_queue.mark_offline(room_code, player_id)
        game = underground_spades_games.get(room_code)
        if game and player_id in game.players:
            # Keep seat; just notify peers (do not remove player).
            await sio.emit(
                'underground_spades_player_offline',
                {'player_id': player_id, 'position': game.players[player_id]['position']},
                room=room_code,
            )
