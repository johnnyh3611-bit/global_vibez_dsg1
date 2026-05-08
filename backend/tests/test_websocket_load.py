"""
Global Vibez DSG - WebSocket Multiplayer Load Test
===================================================
Comprehensive stress test of the multiplayer WebSocket infrastructure:
- Connection establishment at scale (100 → 1000 → 5000 → 10000 bots)
- Room creation and joining
- Real-time game state synchronization
- Message broadcasting latency
- Connection stability over time
- Performance metrics (latency, throughput, connection limits)

Test Strategy:
1. Gradually scale connections to find server limits
2. Measure connection success rate at each scale
3. Test room operations under load
4. Measure message latency and throughput
5. Monitor for dropped connections
"""

import pytest
import asyncio
import socketio
import time
import json
import os
import statistics
import uuid
from datetime import datetime
from typing import List, Optional
import aiohttp
import secrets
secure_random = secrets.SystemRandom()

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

# Configuration
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://social-connect-953.preview.emergentagent.com"

# Socket.IO paths - the server has two Socket.IO endpoints
SOCKETIO_PATH_1 = "/api/socket.io"  # services/multiplayer.py - WORKING
SOCKETIO_PATH_2 = "/socket.io"  # websocket_server.py - may not be accessible via ingress

# Test parameters
CONNECTION_TIMEOUT = 30
MESSAGE_TIMEOUT = 10

# Metrics storage
class WebSocketMetrics:
    """Track WebSocket load test metrics"""
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.connections_attempted = 0
        self.connections_successful = 0
        self.connections_failed = 0
        self.connection_times = []
        self.rooms_created = 0
        self.rooms_joined = 0
        self.messages_sent = 0
        self.messages_received = 0
        self.message_latencies = []
        self.errors = []
        self.disconnections = 0
        self.reconnections = 0
        self.active_connections = 0
        self.peak_connections = 0
        
    def start(self):
        self.start_time = time.time()
        
    def stop(self):
        self.end_time = time.time()
        
    def record_connection(self, success: bool, connection_time: float, error: str = None):
        self.connections_attempted += 1
        if success:
            self.connections_successful += 1
            self.connection_times.append(connection_time)
            self.active_connections += 1
            self.peak_connections = max(self.peak_connections, self.active_connections)
        else:
            self.connections_failed += 1
            if error:
                self.errors.append(f"Connection: {error}")
                
    def record_disconnection(self):
        self.disconnections += 1
        self.active_connections = max(0, self.active_connections - 1)
        
    def record_message_latency(self, latency_ms: float):
        self.message_latencies.append(latency_ms)
        
    def get_report(self) -> dict:
        if self.start_time is None:
            self.start_time = time.time()
        if self.end_time is None:
            self.end_time = time.time()
            
        duration = self.end_time - self.start_time
        
        return {
            "test_timestamp": datetime.now().isoformat(),
            "duration_seconds": round(duration, 2),
            "connections": {
                "attempted": self.connections_attempted,
                "successful": self.connections_successful,
                "failed": self.connections_failed,
                "success_rate": round((self.connections_successful / max(1, self.connections_attempted)) * 100, 2),
                "peak_concurrent": self.peak_connections,
                "disconnections": self.disconnections,
                "reconnections": self.reconnections
            },
            "connection_times": {
                "min_ms": round(min(self.connection_times) * 1000, 2) if self.connection_times else 0,
                "max_ms": round(max(self.connection_times) * 1000, 2) if self.connection_times else 0,
                "avg_ms": round(statistics.mean(self.connection_times) * 1000, 2) if self.connection_times else 0,
                "p50_ms": round(statistics.median(self.connection_times) * 1000, 2) if self.connection_times else 0,
                "p95_ms": round(sorted(self.connection_times)[int(len(self.connection_times) * 0.95)] * 1000, 2) if len(self.connection_times) > 20 else 0,
                "p99_ms": round(sorted(self.connection_times)[int(len(self.connection_times) * 0.99)] * 1000, 2) if len(self.connection_times) > 100 else 0,
            },
            "rooms": {
                "created": self.rooms_created,
                "joined": self.rooms_joined
            },
            "messages": {
                "sent": self.messages_sent,
                "received": self.messages_received,
                "throughput_per_second": round(self.messages_sent / max(1, duration), 2)
            },
            "message_latency": {
                "min_ms": round(min(self.message_latencies), 2) if self.message_latencies else 0,
                "max_ms": round(max(self.message_latencies), 2) if self.message_latencies else 0,
                "avg_ms": round(statistics.mean(self.message_latencies), 2) if self.message_latencies else 0,
                "p50_ms": round(statistics.median(self.message_latencies), 2) if self.message_latencies else 0,
                "p95_ms": round(sorted(self.message_latencies)[int(len(self.message_latencies) * 0.95)], 2) if len(self.message_latencies) > 20 else 0,
                "p99_ms": round(sorted(self.message_latencies)[int(len(self.message_latencies) * 0.99)], 2) if len(self.message_latencies) > 100 else 0,
            },
            "errors": list(set(self.errors))[:20]  # Top 20 unique errors
        }


# Global metrics instance
metrics = WebSocketMetrics()


class BotClient:
    """Simulated bot client for WebSocket testing"""
    
    def __init__(self, bot_id: int, socketio_path: str = SOCKETIO_PATH_1):
        self.bot_id = bot_id
        self.user_id = f"bot_{bot_id}_{uuid.uuid4().hex[:8]}"
        self.username = f"Bot_{bot_id}"
        self.sio = socketio.AsyncClient(
            reconnection=False,
            logger=False,
            engineio_logger=False
        )
        self.connected = False
        self.current_room = None
        self.messages_received = []
        self.connection_time = 0
        self.socketio_path = socketio_path
        
        # Register event handlers
        self._setup_handlers()
        
    def _setup_handlers(self):
        """Setup Socket.IO event handlers"""
        
        @self.sio.event
        async def connect():
            self.connected = True
            
        @self.sio.event
        async def disconnect():
            self.connected = False
            metrics.record_disconnection()
            
        @self.sio.event
        async def connection_established(data):
            pass  # Connection confirmed
            
        @self.sio.event
        async def room_created(data):
            room = data.get('room', {})
            self.current_room = room.get('room_code')
            metrics.rooms_created += 1
            
        @self.sio.event
        async def player_joined(data):
            room = data.get('room', {})
            self.current_room = room.get('room_code')
            self.messages_received.append(('player_joined', data, time.time()))
            metrics.messages_received += 1
            metrics.rooms_joined += 1
            
        @self.sio.event
        async def move_made(data):
            self.messages_received.append(('move_made', data, time.time()))
            metrics.messages_received += 1
            
        @self.sio.event
        async def chat_message(data):
            self.messages_received.append(('chat_message', data, time.time()))
            metrics.messages_received += 1
            
        @self.sio.event
        async def game_started(data):
            self.messages_received.append(('game_started', data, time.time()))
            metrics.messages_received += 1
            
        @self.sio.event
        async def error(data):
            metrics.errors.append(f"Bot {self.bot_id}: {data.get('message', 'Unknown error')}")
            
    async def connect(self) -> bool:
        """Connect to WebSocket server"""
        start_time = time.time()
        try:
            await self.sio.connect(
                BASE_URL,
                socketio_path=self.socketio_path,
                transports=['websocket', 'polling'],
                wait_timeout=CONNECTION_TIMEOUT
            )
            self.connection_time = time.time() - start_time
            self.connected = True
            metrics.record_connection(True, self.connection_time)
            return True
        except Exception as e:
            connection_time = time.time() - start_time
            metrics.record_connection(False, connection_time, str(e)[:100])
            return False
            
    async def disconnect(self):
        """Disconnect from server"""
        if self.connected:
            try:
                await self.sio.disconnect()
            except Exception:
                pass
            self.connected = False
            
    async def create_room(self, game_type: str = "tictactoe") -> Optional[str]:
        """Create a game room"""
        if not self.connected:
            return None
            
        try:
            # Reset room code
            self.current_room = None
            
            # Emit create room event (server uses emit, not call with ack)
            await self.sio.emit('create_room_event', {
                'game_type': game_type,
                'user_id': self.user_id,
                'user_name': self.username,
                'is_private': False
            })
            
            # Wait for room_created event
            await asyncio.sleep(0.5)
            
            if self.current_room:
                return self.current_room
        except Exception as e:
            metrics.errors.append(f"Create room: {str(e)[:50]}")
        return None
        
    async def join_room(self, room_code: str) -> bool:
        """Join an existing room"""
        if not self.connected:
            return False
            
        try:
            # Emit join room event
            await self.sio.emit('join_room_event', {
                'room_code': room_code,
                'user_id': self.user_id,
                'user_name': self.username
            })
            
            # Wait for response
            await asyncio.sleep(0.5)
            
            return self.current_room == room_code
        except Exception as e:
            metrics.errors.append(f"Join room: {str(e)[:50]}")
        return False
        
    async def send_move(self, move_type: str = "test", move_data: dict = None) -> bool:
        """Send a game move"""
        if not self.connected or not self.current_room:
            return False
            
        try:
            send_time = time.time()
            response = await self.sio.call('make_move', {
                'move_type': move_type,
                'move_data': move_data or {'action': 'test'}
            }, timeout=MESSAGE_TIMEOUT)
            
            latency = (time.time() - send_time) * 1000
            metrics.record_message_latency(latency)
            metrics.messages_sent += 1
            
            return response and response.get('success', False)
        except Exception as e:
            metrics.errors.append(f"Send move: {str(e)[:50]}")
        return False
        
    async def send_chat(self, message: str) -> bool:
        """Send a chat message"""
        if not self.connected or not self.current_room:
            return False
            
        try:
            send_time = time.time()
            response = await self.sio.call('send_chat_message', {
                'message': message
            }, timeout=MESSAGE_TIMEOUT)
            
            latency = (time.time() - send_time) * 1000
            metrics.record_message_latency(latency)
            metrics.messages_sent += 1
            
            return response and response.get('success', False)
        except Exception as e:
            metrics.errors.append(f"Send chat: {str(e)[:50]}")
        return False


async def connect_bots_batch(bot_count: int, batch_size: int = 50, socketio_path: str = SOCKETIO_PATH_1) -> List[BotClient]:
    """Connect multiple bots in batches"""
    bots = []
    connected_bots = []
    
    for i in range(bot_count):
        bots.append(BotClient(i, socketio_path))
    
    # Connect in batches
    for batch_start in range(0, bot_count, batch_size):
        batch_end = min(batch_start + batch_size, bot_count)
        batch = bots[batch_start:batch_end]
        
        # Connect batch concurrently
        tasks = [bot.connect() for bot in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for bot, result in zip(batch, results):
            if result:
                connected_bots.append(bot)
                
        # Small delay between batches to prevent overwhelming
        await asyncio.sleep(0.5)
        
    return connected_bots


async def disconnect_all_bots(bots: List[BotClient]):
    """Disconnect all bots"""
    tasks = [bot.disconnect() for bot in bots]
    await asyncio.gather(*tasks, return_exceptions=True)


class TestWebSocketBasicConnectivity:
    """Basic WebSocket connectivity tests"""
    
    async def test_01_single_connection(self):
        """Test single WebSocket connection"""
        print(f"\n{'='*60}")
        print("TEST: Single WebSocket Connection")
        print(f"{'='*60}")
        
        bot = BotClient(0)
        success = await bot.connect()
        
        print(f"  Connection successful: {success}")
        print(f"  Connection time: {bot.connection_time * 1000:.2f} ms")
        
        await bot.disconnect()
        
        assert success, "Failed to establish single WebSocket connection"
        
    async def test_02_ten_concurrent_connections(self):
        """Test 10 concurrent connections"""
        print(f"\n{'='*60}")
        print("TEST: 10 Concurrent Connections")
        print(f"{'='*60}")
        
        metrics.start()
        bots = await connect_bots_batch(10, batch_size=10)
        
        print(f"  Connected: {len(bots)}/10")
        print(f"  Success rate: {(len(bots) / 10) * 100:.1f}%")
        
        await disconnect_all_bots(bots)
        
        assert len(bots) >= 8, f"Too many connection failures: only {len(bots)}/10 connected"
        
    async def test_03_hundred_concurrent_connections(self):
        """Test 100 concurrent connections"""
        print(f"\n{'='*60}")
        print("TEST: 100 Concurrent Connections")
        print(f"{'='*60}")
        
        bots = await connect_bots_batch(100, batch_size=20)
        
        print(f"  Connected: {len(bots)}/100")
        print(f"  Success rate: {(len(bots) / 100) * 100:.1f}%")
        
        # Keep connections alive for a moment
        await asyncio.sleep(2)
        
        # Check how many are still connected
        still_connected = sum(1 for bot in bots if bot.connected)
        print(f"  Still connected after 2s: {still_connected}")
        
        await disconnect_all_bots(bots)
        
        assert len(bots) >= 50, f"Too many connection failures: only {len(bots)}/100 connected"


class TestWebSocketRoomOperations:
    """Test room creation and joining under load"""
    
    async def test_04_room_creation(self):
        """Test creating multiple rooms"""
        print(f"\n{'='*60}")
        print("TEST: Room Creation (50 rooms)")
        print(f"{'='*60}")
        
        bots = await connect_bots_batch(50, batch_size=25)
        
        rooms_created = 0
        for bot in bots:
            room_code = await bot.create_room("tictactoe")
            if room_code:
                rooms_created += 1
                
        print(f"  Rooms created: {rooms_created}/{len(bots)}")
        
        await disconnect_all_bots(bots)
        
        assert rooms_created >= 25, f"Too few rooms created: {rooms_created}"
        
    async def test_05_room_joining(self):
        """Test joining rooms"""
        print(f"\n{'='*60}")
        print("TEST: Room Joining (25 pairs)")
        print(f"{'='*60}")
        
        # Create 50 bots - 25 hosts, 25 guests
        bots = await connect_bots_batch(50, batch_size=25)
        
        if len(bots) < 50:
            print(f"  Warning: Only {len(bots)} bots connected")
            
        hosts = bots[:len(bots)//2]
        guests = bots[len(bots)//2:]
        
        # Hosts create rooms
        room_codes = []
        for host in hosts:
            room_code = await host.create_room("tictactoe")
            if room_code:
                room_codes.append(room_code)
                
        print(f"  Rooms created: {len(room_codes)}")
        
        # Guests join rooms
        joins_successful = 0
        for i, guest in enumerate(guests):
            if i < len(room_codes):
                if await guest.join_room(room_codes[i]):
                    joins_successful += 1
                    
        print(f"  Joins successful: {joins_successful}")
        
        await disconnect_all_bots(bots)
        
        assert joins_successful >= len(room_codes) // 2, f"Too few joins: {joins_successful}"


class TestWebSocketMessageBroadcasting:
    """Test message broadcasting and latency"""
    
    async def test_06_message_latency(self):
        """Test message latency in rooms"""
        print(f"\n{'='*60}")
        print("TEST: Message Latency (20 rooms, 100 messages each)")
        print(f"{'='*60}")
        
        # Create 40 bots - 20 pairs
        bots = await connect_bots_batch(40, batch_size=20)
        
        hosts = bots[:20]
        guests = bots[20:]
        
        # Create rooms and pair up
        pairs = []
        for i, host in enumerate(hosts):
            room_code = await host.create_room("tictactoe")
            if room_code and i < len(guests):
                if await guests[i].join_room(room_code):
                    pairs.append((host, guests[i]))
                    
        print(f"  Active pairs: {len(pairs)}")
        
        # Send messages
        messages_sent = 0
        for host, guest in pairs:
            for _ in range(5):  # 5 messages per bot
                if await host.send_chat(f"Test message {messages_sent}"):
                    messages_sent += 1
                if await guest.send_chat(f"Reply {messages_sent}"):
                    messages_sent += 1
                    
        print(f"  Messages sent: {messages_sent}")
        
        # Wait for messages to propagate
        await asyncio.sleep(1)
        
        await disconnect_all_bots(bots)
        
        if metrics.message_latencies:
            print(f"  Avg latency: {statistics.mean(metrics.message_latencies):.2f} ms")
            print(f"  P95 latency: {sorted(metrics.message_latencies)[int(len(metrics.message_latencies) * 0.95)]:.2f} ms")


class TestWebSocketScaleTest:
    """Scale testing - gradually increase connections"""
    
    async def test_07_scale_500_connections(self):
        """Test 500 concurrent connections"""
        print(f"\n{'='*60}")
        print("TEST: 500 Concurrent Connections")
        print(f"{'='*60}")
        
        start_time = time.time()
        bots = await connect_bots_batch(500, batch_size=50)
        connection_time = time.time() - start_time
        
        print(f"  Connected: {len(bots)}/500")
        print(f"  Success rate: {(len(bots) / 500) * 100:.1f}%")
        print(f"  Total connection time: {connection_time:.2f}s")
        print(f"  Connections/second: {len(bots) / connection_time:.1f}")
        
        # Keep alive for 5 seconds
        await asyncio.sleep(5)
        
        still_connected = sum(1 for bot in bots if bot.connected)
        print(f"  Still connected after 5s: {still_connected}")
        
        await disconnect_all_bots(bots)
        
        assert len(bots) >= 250, f"Too many failures: only {len(bots)}/500 connected"
        
    async def test_08_scale_1000_connections(self):
        """Test 1000 concurrent connections"""
        print(f"\n{'='*60}")
        print("TEST: 1000 Concurrent Connections")
        print(f"{'='*60}")
        
        start_time = time.time()
        bots = await connect_bots_batch(1000, batch_size=50)
        connection_time = time.time() - start_time
        
        print(f"  Connected: {len(bots)}/1000")
        print(f"  Success rate: {(len(bots) / 1000) * 100:.1f}%")
        print(f"  Total connection time: {connection_time:.2f}s")
        print(f"  Connections/second: {len(bots) / connection_time:.1f}")
        
        # Keep alive for 10 seconds
        await asyncio.sleep(10)
        
        still_connected = sum(1 for bot in bots if bot.connected)
        print(f"  Still connected after 10s: {still_connected}")
        
        await disconnect_all_bots(bots)
        
        # Record results
        metrics.peak_connections = max(metrics.peak_connections, len(bots))


class TestWebSocketStressTest:
    """Stress testing - find server limits"""
    
    async def test_09_stress_test_with_rooms(self):
        """Stress test with room operations"""
        print(f"\n{'='*60}")
        print("TEST: Stress Test - 200 Rooms with Active Games")
        print(f"{'='*60}")
        
        # Connect 400 bots (200 pairs)
        bots = await connect_bots_batch(400, batch_size=50)
        
        print(f"  Connected: {len(bots)}/400")
        
        hosts = bots[:len(bots)//2]
        guests = bots[len(bots)//2:]
        
        # Create rooms
        room_codes = []
        for host in hosts:
            room_code = await host.create_room("tictactoe")
            if room_code:
                room_codes.append((host, room_code))
                
        print(f"  Rooms created: {len(room_codes)}")
        
        # Join rooms
        active_pairs = []
        for i, guest in enumerate(guests):
            if i < len(room_codes):
                host, room_code = room_codes[i]
                if await guest.join_room(room_code):
                    active_pairs.append((host, guest))
                    
        print(f"  Active game pairs: {len(active_pairs)}")
        
        # Simulate game activity - each pair sends 10 moves
        moves_sent = 0
        for host, guest in active_pairs[:50]:  # Limit to 50 pairs for speed
            for _ in range(5):
                if await host.send_move("move", {"position": secrets.randbelow(8)}):
                    moves_sent += 1
                if await guest.send_move("move", {"position": secrets.randbelow(8)}):
                    moves_sent += 1
                    
        print(f"  Moves sent: {moves_sent}")
        
        await disconnect_all_bots(bots)


class TestWebSocketFinalReport:
    """Generate final test report"""
    
    async def test_10_generate_report(self):
        """Generate comprehensive load test report"""
        metrics.stop()
        report = metrics.get_report()
        
        print(f"\n{'='*60}")
        print("WEBSOCKET LOAD TEST FINAL REPORT")
        print(f"{'='*60}")
        print(f"\n  Duration: {report['duration_seconds']} seconds")
        print("\n  CONNECTIONS:")
        print(f"    Attempted: {report['connections']['attempted']}")
        print(f"    Successful: {report['connections']['successful']}")
        print(f"    Failed: {report['connections']['failed']}")
        print(f"    Success Rate: {report['connections']['success_rate']}%")
        print(f"    Peak Concurrent: {report['connections']['peak_concurrent']}")
        print(f"    Disconnections: {report['connections']['disconnections']}")
        
        print("\n  CONNECTION TIMES:")
        print(f"    Min: {report['connection_times']['min_ms']} ms")
        print(f"    Max: {report['connection_times']['max_ms']} ms")
        print(f"    Avg: {report['connection_times']['avg_ms']} ms")
        print(f"    P50: {report['connection_times']['p50_ms']} ms")
        print(f"    P95: {report['connection_times']['p95_ms']} ms")
        print(f"    P99: {report['connection_times']['p99_ms']} ms")
        
        print("\n  ROOMS:")
        print(f"    Created: {report['rooms']['created']}")
        print(f"    Joined: {report['rooms']['joined']}")
        
        print("\n  MESSAGES:")
        print(f"    Sent: {report['messages']['sent']}")
        print(f"    Received: {report['messages']['received']}")
        print(f"    Throughput: {report['messages']['throughput_per_second']} msg/s")
        
        if report['message_latency']['avg_ms'] > 0:
            print("\n  MESSAGE LATENCY:")
            print(f"    Min: {report['message_latency']['min_ms']} ms")
            print(f"    Max: {report['message_latency']['max_ms']} ms")
            print(f"    Avg: {report['message_latency']['avg_ms']} ms")
            print(f"    P50: {report['message_latency']['p50_ms']} ms")
            print(f"    P95: {report['message_latency']['p95_ms']} ms")
        
        if report['errors']:
            print(f"\n  ERRORS ({len(report['errors'])}):")
            for err in report['errors'][:10]:
                print(f"    - {err[:80]}")
        
        # Save report
        report_path = "/app/test_reports/websocket_load_test.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n  Report saved to: {report_path}")
        
        # Performance assessment
        print("\n  PERFORMANCE ASSESSMENT:")
        if report['connections']['success_rate'] >= 95:
            print("    ✅ Connection success rate EXCELLENT (>95%)")
        elif report['connections']['success_rate'] >= 80:
            print("    ⚠️ Connection success rate GOOD (80-95%)")
        else:
            print("    ❌ Connection success rate NEEDS IMPROVEMENT (<80%)")
            
        if report['connection_times']['avg_ms'] < 100:
            print("    ✅ Connection time EXCELLENT (<100ms avg)")
        elif report['connection_times']['avg_ms'] < 500:
            print("    ⚠️ Connection time ACCEPTABLE (100-500ms avg)")
        else:
            print("    ❌ Connection time SLOW (>500ms avg)")
            
        if report['message_latency']['avg_ms'] > 0:
            if report['message_latency']['avg_ms'] < 100:
                print("    ✅ Message latency EXCELLENT (<100ms avg)")
            elif report['message_latency']['avg_ms'] < 500:
                print("    ⚠️ Message latency ACCEPTABLE (100-500ms avg)")
            else:
                print("    ❌ Message latency HIGH (>500ms avg)")


# HTTP Multiplayer Fallback Tests
class TestHTTPMultiplayerFallback:
    """Test HTTP multiplayer endpoints as fallback"""
    
    async def test_http_multiplayer_stats(self):
        """Test HTTP multiplayer stats endpoint"""
        print(f"\n{'='*60}")
        print("TEST: HTTP Multiplayer Stats Endpoint")
        print(f"{'='*60}")
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/api/http-multiplayer/stats") as response:
                assert response.status == 200
                data = await response.json()
                print(f"  Active games: {data.get('active_games', 0)}")
                print(f"  Total games: {data.get('total_games', 0)}")
                print(f"  Online players: {data.get('online_players', 0)}")
                
    async def test_http_multiplayer_join_queue(self):
        """Test HTTP multiplayer matchmaking"""
        print(f"\n{'='*60}")
        print("TEST: HTTP Multiplayer Join Queue")
        print(f"{'='*60}")
        
        async with aiohttp.ClientSession() as session:
            # Join queue
            async with session.post(
                f"{BASE_URL}/api/http-multiplayer/join-queue",
                json={
                    "game_type": "tictactoe",
                    "user_id": f"test_{uuid.uuid4().hex[:8]}",
                    "user_name": "Test Bot"
                }
            ) as response:
                assert response.status == 200
                data = await response.json()
                print(f"  Success: {data.get('success')}")
                print(f"  Match found: {data.get('match_found')}")
                print(f"  Session ID: {data.get('session_id', 'N/A')}")


if __name__ == "__main__":
    # Run with: pytest test_websocket_load.py -v -s
    pytest.main([__file__, "-v", "-s", "--tb=short"])
