"""
PROTOCOL: OMEGA - 4D Tactical Chess Simulation
The definitive blueprint for futuristic warfare on a Data-Stream Battleground

Features:
- Tri-Plane Grid System (3 stacked 10×10 layers)
- Energy Programs (HP/EP based pieces)
- Non-Binary Combat (damage, shields, reflections, knock-offs)
- Void-Leeches (AI viruses that steal EP)
- Queen: Reflective Aegis (mirrors damage)
- King: The Singularity (board-clearing blast)
"""
import secrets
from typing import Dict, Tuple
from datetime import datetime
from enum import Enum

# Game States
class OmegaGameState(Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    SYSTEM_REFRAG = "system_refrag"  # Layer shifting phase
    SINGULARITY = "singularity"      # King ultimate active
    GAME_OVER = "game_over"

# Teams
class Team(Enum):
    CYAN = "cyan"      # #00ffff
    MAGENTA = "magenta" # #ff00ff

# Piece Types
class ProgramType(Enum):
    PAWN = "pawn"
    ROOK = "rook"
    KNIGHT = "knight"
    BISHOP = "bishop"
    QUEEN = "queen"
    KING = "king"
    VOID_LEECH = "void_leech"  # AI virus

# Combat Types
class AttackType(Enum):
    DIRECT = "direct"      # Standard attack
    REFLECT = "reflect"    # Mirrored by Queen's Aegis
    AREA = "area"          # Splash damage
    VOID = "void"          # EP drain (Leech)

# Protocol: Omega tables storage
omega_tables: Dict[str, Dict] = {}

class EnergyProgram:
    """
    Energy Program - The fundamental unit in Protocol: Omega
    
    Each piece has:
    - Integrity (HP): 0-100
    - Energy (EP): 0-100
    - Layer position (0-2)
    - Grid position (x, y)
    """
    def __init__(
        self,
        program_id: str,
        team: Team,
        program_type: ProgramType,
        layer: int,
        position: Tuple[int, int],
        integrity: int = 100,
        energy: int = 100
    ):
        self.id = program_id
        self.team = team
        self.type = program_type
        self.layer = layer  # 0 (bottom), 1 (middle), 2 (top)
        self.position = position  # (x, y) on 10×10 grid
        self.integrity = integrity  # HP
        self.energy = energy  # EP
        self.shield_active = False
        self.shield_integrity = 0
        self.is_alive = True
        
        # Special ability cooldowns
        self.ability_ready = True
        self.ability_cooldown = 0
        
        # Stats based on type
        self.base_attack = self._get_base_attack()
        self.attack_cost = self._get_attack_cost()
        self.movement_range = self._get_movement_range()
    
    def _get_base_attack(self) -> int:
        """Get base attack damage for piece type"""
        attack_map = {
            ProgramType.PAWN: 10,
            ProgramType.ROOK: 25,
            ProgramType.KNIGHT: 20,
            ProgramType.BISHOP: 22,
            ProgramType.QUEEN: 30,
            ProgramType.KING: 15,
            ProgramType.VOID_LEECH: 0  # Drains EP instead
        }
        return attack_map[self.type]
    
    def _get_attack_cost(self) -> int:
        """Get EP cost for attacking"""
        cost_map = {
            ProgramType.PAWN: 5,
            ProgramType.ROOK: 15,
            ProgramType.KNIGHT: 12,
            ProgramType.BISHOP: 13,
            ProgramType.QUEEN: 20,
            ProgramType.KING: 25,
            ProgramType.VOID_LEECH: 10
        }
        return cost_map[self.type]
    
    def _get_movement_range(self) -> int:
        """Get movement range for piece type"""
        range_map = {
            ProgramType.PAWN: 1,
            ProgramType.ROOK: 10,  # Entire row/column
            ProgramType.KNIGHT: 1,  # L-shape
            ProgramType.BISHOP: 10,  # Entire diagonal
            ProgramType.QUEEN: 10,  # Any direction
            ProgramType.KING: 1,    # One square
            ProgramType.VOID_LEECH: 2  # Random movement
        }
        return range_map[self.type]
    
    def attack(self, target: 'EnergyProgram') -> Dict:
        """
        Execute attack on target
        Returns combat result with damage dealt
        """
        if self.energy < self.attack_cost:
            return {'success': False, 'reason': 'insufficient_energy'}
        
        # Calculate damage
        damage = self.base_attack
        
        # Apply damage
        self.energy -= self.attack_cost
        
        return {
            'success': True,
            'damage': damage,
            'attacker_ep_remaining': self.energy
        }
    
    def take_damage(self, damage: int) -> bool:
        """
        Take damage, returns True if program is destroyed
        """
        # Check shield first
        if self.shield_active and self.shield_integrity > 0:
            if self.shield_integrity >= damage:
                self.shield_integrity -= damage
                return False
            else:
                # Shield breaks, excess damage to integrity
                excess_damage = damage - self.shield_integrity
                self.shield_integrity = 0
                self.shield_active = False
                self.integrity -= excess_damage
        else:
            self.integrity -= damage
        
        # Check if destroyed
        if self.integrity <= 0:
            self.is_alive = False
            return True
        
        return False
    
    def regenerate_energy(self, amount: int = 10):
        """Regenerate EP (happens each turn)"""
        self.energy = min(100, self.energy + amount)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'team': self.team.value,
            'type': self.type.value,
            'layer': self.layer,
            'position': self.position,
            'integrity': self.integrity,
            'energy': self.energy,
            'shield_active': self.shield_active,
            'shield_integrity': self.shield_integrity,
            'is_alive': self.is_alive,
            'ability_ready': self.ability_ready
        }

class VoidLeech(EnergyProgram):
    """
    Void-Leech: AI virus that spawns randomly and drains EP
    """
    def __init__(self, leech_id: str, layer: int, position: Tuple[int, int]):
        super().__init__(
            program_id=leech_id,
            team=Team.CYAN,  # Neutral, but using CYAN for rendering
            program_type=ProgramType.VOID_LEECH,
            layer=layer,
            position=position,
            integrity=50,  # Lower HP
            energy=100
        )
        self.ep_drain_rate = 10  # Drains 10 EP per turn from nearby programs
    
    def infect(self, target: EnergyProgram) -> int:
        """Drain EP from target, return amount drained"""
        drain_amount = min(self.ep_drain_rate, target.energy)
        target.energy -= drain_amount
        self.energy = min(100, self.energy + drain_amount)
        return drain_amount
    
    def random_move(self, grid_size: int = 10) -> Tuple[int, int]:
        """Move randomly on grid"""
        x, y = self.position
        direction = secrets.randbelow(4)  # 0=up, 1=right, 2=down, 3=left
        
        if direction == 0 and y < grid_size - 1:
            y += 1
        elif direction == 1 and x < grid_size - 1:
            x += 1
        elif direction == 2 and y > 0:
            y -= 1
        elif direction == 3 and x > 0:
            x -= 1
        
        self.position = (x, y)
        return self.position

def create_omega_table(
    room_code: str,
    host_session_id: str,
    host_name: str,
    grid_size: int = 10,
    num_layers: int = 3,
    void_leech_spawn_rate: float = 0.15
) -> Dict:
    """
    Create a Protocol: Omega battle table
    
    Args:
        grid_size: Size of each layer grid (default 10×10)
        num_layers: Number of vertical layers (default 3)
        void_leech_spawn_rate: Chance of Void-Leech spawn per turn (15%)
    """
    table = {
        'room_code': room_code,
        'created_at': datetime.utcnow().isoformat(),
        'game_state': OmegaGameState.WAITING.value,
        'players': {},  # session_id -> player data
        'grid_size': grid_size,
        'num_layers': num_layers,
        'current_turn': 0,
        'current_player': None,
        'turn_time_limit': 60,  # 60 seconds per turn
        
        # Tri-Plane Grid
        'layers': {
            0: {'z': 0, 'glass_opacity': 0.3, 'programs': {}},    # Bottom
            1: {'z': 100, 'glass_opacity': 0.2, 'programs': {}},  # Middle
            2: {'z': 200, 'glass_opacity': 0.1, 'programs': {}}   # Top
        },
        
        # System Refrag (layer shifting)
        'refrag_interval': 3,  # Shift layers every 3 turns
        'turns_until_refrag': 3,
        
        # Void-Leech spawning
        'void_leech_spawn_rate': void_leech_spawn_rate,
        'void_leeches': [],  # List of active Void-Leeches
        'next_leech_id': 0,
        
        # Combat tracking
        'combat_log': [],  # List of all combat events
        'threat_vectors': [],  # Active attack paths visualized
        
        # Special abilities
        'singularity_ready': {Team.CYAN.value: False, Team.MAGENTA.value: False},
        'singularity_cooldown': {Team.CYAN.value: 5, Team.MAGENTA.value: 5},
        'aegis_active': {Team.CYAN.value: False, Team.MAGENTA.value: False},
        
        # Win condition
        'winner': None,
        'game_over_reason': None
    }
    
    # Add host player
    table['players'][host_session_id] = {
        'session_id': host_session_id,
        'name': host_name,
        'team': Team.CYAN.value,
        'is_ready': False,
        'king_id': None,
        'queen_id': None,
        'total_integrity': 0,
        'total_energy': 0
    }
    
    return table

def initialize_board(table: Dict, cyan_session: str, magenta_session: str):
    """
    Initialize the board with starting Energy Programs
    
    Standard chess-like setup on Layer 1 (middle layer)
    """
    programs = {}
    program_id = 0
    
    # CYAN TEAM (bottom rows)
    # Pawns (row 1)
    for x in range(10):
        programs[str(program_id)] = EnergyProgram(
            program_id=str(program_id),
            team=Team.CYAN,
            program_type=ProgramType.PAWN,
            layer=1,
            position=(x, 1)
        )
        program_id += 1
    
    # Back row (row 0): Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook (+ 2 extra)
    back_row_types = [
        ProgramType.ROOK, ProgramType.KNIGHT, ProgramType.BISHOP, 
        ProgramType.QUEEN, ProgramType.KING, ProgramType.BISHOP, 
        ProgramType.KNIGHT, ProgramType.ROOK, ProgramType.ROOK, ProgramType.ROOK
    ]
    
    for x, ptype in enumerate(back_row_types):
        programs[str(program_id)] = EnergyProgram(
            program_id=str(program_id),
            team=Team.CYAN,
            program_type=ptype,
            layer=1,
            position=(x, 0)
        )
        if ptype == ProgramType.KING:
            table['players'][cyan_session]['king_id'] = str(program_id)
        elif ptype == ProgramType.QUEEN:
            table['players'][cyan_session]['queen_id'] = str(program_id)
        program_id += 1
    
    # MAGENTA TEAM (top rows)
    # Pawns (row 8)
    for x in range(10):
        programs[str(program_id)] = EnergyProgram(
            program_id=str(program_id),
            team=Team.MAGENTA,
            program_type=ProgramType.PAWN,
            layer=1,
            position=(x, 8)
        )
        program_id += 1
    
    # Back row (row 9)
    for x, ptype in enumerate(back_row_types):
        programs[str(program_id)] = EnergyProgram(
            program_id=str(program_id),
            team=Team.MAGENTA,
            program_type=ptype,
            layer=1,
            position=(x, 9)
        )
        if ptype == ProgramType.KING:
            table['players'][magenta_session]['king_id'] = str(program_id)
        elif ptype == ProgramType.QUEEN:
            table['players'][magenta_session]['queen_id'] = str(program_id)
        program_id += 1
    
    # Place all programs on Layer 1
    for prog_id, program in programs.items():
        table['layers'][1]['programs'][prog_id] = program
    
    table['game_state'] = OmegaGameState.ACTIVE.value
    table['current_player'] = cyan_session

def system_refrag(table: Dict):
    """
    Execute System Refrag - shift all layers
    
    Layer rotation:
    Layer 0 → Layer 2
    Layer 1 → Layer 0
    Layer 2 → Layer 1
    """
    # Store current layers
    old_layers = {
        0: table['layers'][0]['programs'].copy(),
        1: table['layers'][1]['programs'].copy(),
        2: table['layers'][2]['programs'].copy()
    }
    
    # Rotate layers
    table['layers'][2]['programs'] = old_layers[0]
    table['layers'][0]['programs'] = old_layers[1]
    table['layers'][1]['programs'] = old_layers[2]
    
    # Update program layer references
    for layer_idx, programs in table['layers'].items():
        for program in programs['programs'].values():
            program.layer = layer_idx
    
    # Reset refrag counter
    table['turns_until_refrag'] = table['refrag_interval']
    
    # Log event
    table['combat_log'].append({
        'event': 'SYSTEM_REFRAG',
        'turn': table['current_turn'],
        'message': '⚠️ SYSTEM REFRAG COMPLETE - LAYERS SHIFTED'
    })

def spawn_void_leech(table: Dict):
    """
    Spawn a Void-Leech at random location
    """
    # Random layer and position
    layer = secrets.randbelow(table['num_layers'])
    x = secrets.randbelow(table['grid_size'])
    y = secrets.randbelow(table['grid_size'])
    
    # Check if position is occupied
    if any(p.position == (x, y) for p in table['layers'][layer]['programs'].values()):
        return  # Skip if occupied
    
    # Create Void-Leech
    leech_id = f"leech_{table['next_leech_id']}"
    leech = VoidLeech(leech_id, layer, (x, y))
    
    # Add to grid
    table['layers'][layer]['programs'][leech_id] = leech
    table['void_leeches'].append(leech_id)
    table['next_leech_id'] += 1
    
    # Log event
    table['combat_log'].append({
        'event': 'VOID_LEECH_SPAWN',
        'turn': table['current_turn'],
        'position': (x, y),
        'layer': layer,
        'message': f'🦠 VOID-LEECH DETECTED: [{chr(65+x)}{y+1}, Layer {layer+1}]'
    })

def execute_turn(table: Dict):
    """
    Execute end-of-turn mechanics:
    - EP regeneration
    - Void-Leech movement and infection
    - System Refrag check
    - New Void-Leech spawn check
    """
    table['current_turn'] += 1
    
    # EP Regeneration for all programs
    for layer in table['layers'].values():
        for program in layer['programs'].values():
            if program.is_alive and program.type != ProgramType.VOID_LEECH:
                program.regenerate_energy(10)
    
    # Void-Leech actions
    for leech_id in table['void_leeches'][:]:  # Copy list to allow removal
        leech = None
        for layer in table['layers'].values():
            if leech_id in layer['programs']:
                leech = layer['programs'][leech_id]
                break
        
        if not leech or not leech.is_alive:
            table['void_leeches'].remove(leech_id)
            continue
        
        # Move randomly
        leech.random_move(table['grid_size'])
        
        # Infect nearby programs
        for layer in table['layers'].values():
            for program in layer['programs'].values():
                if (program.type != ProgramType.VOID_LEECH and 
                    program.is_alive and
                    abs(program.position[0] - leech.position[0]) <= 1 and
                    abs(program.position[1] - leech.position[1]) <= 1):
                    drained = leech.infect(program)
                    if drained > 0:
                        table['combat_log'].append({
                            'event': 'VOID_DRAIN',
                            'turn': table['current_turn'],
                            'leech_id': leech_id,
                            'target_id': program.id,
                            'ep_drained': drained
                        })
    
    # System Refrag check
    table['turns_until_refrag'] -= 1
    if table['turns_until_refrag'] <= 0:
        table['game_state'] = OmegaGameState.SYSTEM_REFRAG.value
        system_refrag(table)
        table['game_state'] = OmegaGameState.ACTIVE.value
    
    # Void-Leech spawn check
    if secrets.random() < table['void_leech_spawn_rate']:
        spawn_void_leech(table)
    
    # Update Singularity cooldowns
    for team in [Team.CYAN.value, Team.MAGENTA.value]:
        if table['singularity_cooldown'][team] > 0:
            table['singularity_cooldown'][team] -= 1
        if table['singularity_cooldown'][team] == 0:
            table['singularity_ready'][team] = True

def execute_combat(table: Dict, attacker_id: str, defender_id: str) -> Dict:
    """
    Execute combat between two programs
    
    Returns combat result with damage, reflections, etc.
    """
    # Find attacker and defender
    attacker = None
    defender = None
    
    for layer in table['layers'].values():
        if attacker_id in layer['programs']:
            attacker = layer['programs'][attacker_id]
        if defender_id in layer['programs']:
            defender = layer['programs'][defender_id]
    
    if not attacker or not defender:
        return {'success': False, 'reason': 'program_not_found'}
    
    if not attacker.is_alive or not defender.is_alive:
        return {'success': False, 'reason': 'program_destroyed'}
    
    # Check for Queen's Reflective Aegis
    defender_player = None
    for player in table['players'].values():
        if player['team'] == defender.team.value:
            defender_player = player
            break
    
    if (defender_player and 
        table['aegis_active'][defender.team.value] and
        defender_player['queen_id']):
        # REFLECT DAMAGE BACK TO ATTACKER
        attack_result = attacker.attack(defender)
        if attack_result['success']:
            damage = attack_result['damage']
            reflected_damage = int(damage * 1.5)  # 1.5x multiplier
            
            attacker.take_damage(reflected_damage)
            
            table['combat_log'].append({
                'event': 'REFLECTIVE_AEGIS',
                'turn': table['current_turn'],
                'attacker_id': attacker_id,
                'defender_id': defender_id,
                'damage': damage,
                'reflected_damage': reflected_damage,
                'message': f'🛡️ REFLECTIVE AEGIS: {reflected_damage} damage mirrored back!'
            })
            
            return {
                'success': True,
                'type': AttackType.REFLECT.value,
                'reflected_damage': reflected_damage,
                'attacker_destroyed': not attacker.is_alive
            }
    
    # Normal attack
    attack_result = attacker.attack(defender)
    if not attack_result['success']:
        return attack_result
    
    damage = attack_result['damage']
    defender_destroyed = defender.take_damage(damage)
    
    # Check if King was destroyed (game over)
    if defender_destroyed and defender.type == ProgramType.KING:
        table['winner'] = attacker.team.value
        table['game_state'] = OmegaGameState.GAME_OVER.value
        table['game_over_reason'] = 'KING_ELIMINATED'
    
    # Log combat
    table['combat_log'].append({
        'event': 'COMBAT',
        'turn': table['current_turn'],
        'attacker_id': attacker_id,
        'defender_id': defender_id,
        'damage': damage,
        'defender_destroyed': defender_destroyed
    })
    
    return {
        'success': True,
        'type': AttackType.DIRECT.value,
        'damage': damage,
        'defender_destroyed': defender_destroyed
    }

def activate_singularity(table: Dict, team: str):
    """
    THE SINGULARITY - King's ultimate ability
    
    Board-clearing blast that deletes all programs with Integrity < 50
    """
    if not table['singularity_ready'][team]:
        return {'success': False, 'reason': 'cooldown_active'}
    
    table['game_state'] = OmegaGameState.SINGULARITY.value
    
    programs_deleted = []
    
    # Delete low-integrity programs
    for layer_idx, layer in table['layers'].items():
        programs_to_delete = []
        for prog_id, program in layer['programs'].items():
            if program.integrity < 50 and program.type != ProgramType.KING:
                programs_to_delete.append(prog_id)
                programs_deleted.append({
                    'id': prog_id,
                    'type': program.type.value,
                    'team': program.team.value,
                    'position': program.position
                })
        
        for prog_id in programs_to_delete:
            del layer['programs'][prog_id]
    
    # Log event
    table['combat_log'].append({
        'event': 'SINGULARITY_COLLAPSE',
        'turn': table['current_turn'],
        'team': team,
        'programs_deleted': len(programs_deleted),
        'message': f'⚡ SINGULARITY COLLAPSE: {len(programs_deleted)} programs eliminated!'
    })
    
    # Reset cooldown
    table['singularity_ready'][team] = False
    table['singularity_cooldown'][team] = 5
    
    # Return to active state
    table['game_state'] = OmegaGameState.ACTIVE.value
    
    return {
        'success': True,
        'programs_deleted': programs_deleted
    }

def get_board_state(table: Dict) -> Dict:
    """
    Get complete board state for rendering
    """
    board_state = {
        'game_state': table['game_state'],
        'current_turn': table['current_turn'],
        'turns_until_refrag': table['turns_until_refrag'],
        'layers': {},
        'void_leeches': table['void_leeches'],
        'combat_log_recent': table['combat_log'][-5:],  # Last 5 events
        'singularity_ready': table['singularity_ready'],
        'aegis_active': table['aegis_active']
    }
    
    # Convert programs to dict
    for layer_idx, layer in table['layers'].items():
        board_state['layers'][layer_idx] = {
            'z': layer['z'],
            'glass_opacity': layer['glass_opacity'],
            'programs': [p.to_dict() for p in layer['programs'].values()]
        }
    
    return board_state
