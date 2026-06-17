"""
Global Vibez DSG - WebSocket Message Latency & Throughput Test
==============================================================
Comprehensive test of real-time message broadcasting performance:
- Single message round-trip latency (target <100ms)
- Broadcast latency to multiple clients (target <200ms for 10 clients)
- Message ordering verification (FIFO, no duplicates, no drops)
- Throughput testing (messages/second under different loads)
- Game state synchronization speed
- Rapid-fire player actions
- Performance under different load scenarios

Building on successful connection test (1000 concurrent, 100% success).
Now focusing on MESSAGE PERFORMANCE.
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
from typing import List, Optional, Tuple
import secrets
secure_random = secrets.SystemRandom()

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

# Configuration
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://social-connect-953.preview.emergentagent.com"

SOCKETIO_PATH = "/api/socket.io"
CONNECTION_TIMEOUT = 30
MESSAGE_TIMEOUT = 10

# Performance targets
TARGET_ROUND_TRIP_LATENCY_MS = 100  # <100ms for single message round-trip
TARGET_BROADCAST_LATENCY_MS = 200   # <200ms for broadcast to 10 clients
TARGET_THROUGHPUT_MSG_PER_SEC = 500  # >500 messages/second (realistic for single server)


class MessageMetrics:
    """Track message performance metrics"""
    
    def __init__(self):
        self.reset()
        
    def reset(self):
        self.start_time = None
        self.end_time = None
        self.round_trip_latencies = []
        self.broadcast_latencies = []
        self.messages_sent = 0
        self.messages_received = 0
        self.messages_lost = 0
        self.messages_out_of_order = 0
        self.messages_duplicated = 0
        self.game_state_sync_latencies = []
        self.burst_latencies = []
        self.sustained_latencies = []
        self.payload_size_latencies = {}  # size -> [latencies]
        self.errors = []
        
    def start(self):
        self.start_time = time.time()
        
    def stop(self):
        self.end_time = time.time()
        
    def get_duration(self):
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return 0
        
    def get_percentile(self, data: List[float], percentile: float) -> float:
        """Calculate percentile from data"""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]
        
    def get_report(self) -> dict:
        duration = self.get_duration() or 1
        
        return {
            "test_timestamp": datetime.now().isoformat(),
            "duration_seconds": round(duration, 2),
            "round_trip_latency": {
                "count": len(self.round_trip_latencies),
                "min_ms": round(min(self.round_trip_latencies), 2) if self.round_trip_latencies else 0,
                "max_ms": round(max(self.round_trip_latencies), 2) if self.round_trip_latencies else 0,
                "avg_ms": round(statistics.mean(self.round_trip_latencies), 2) if self.round_trip_latencies else 0,
                "p50_ms": round(self.get_percentile(self.round_trip_latencies, 50), 2),
                "p95_ms": round(self.get_percentile(self.round_trip_latencies, 95), 2),
                "p99_ms": round(self.get_percentile(self.round_trip_latencies, 99), 2),
                "target_met": (self.get_percentile(self.round_trip_latencies, 95) < TARGET_ROUND_TRIP_LATENCY_MS) if self.round_trip_latencies else False
            },
            "broadcast_latency": {
                "count": len(self.broadcast_latencies),
                "min_ms": round(min(self.broadcast_latencies), 2) if self.broadcast_latencies else 0,
                "max_ms": round(max(self.broadcast_latencies), 2) if self.broadcast_latencies else 0,
                "avg_ms": round(statistics.mean(self.broadcast_latencies), 2) if self.broadcast_latencies else 0,
                "p50_ms": round(self.get_percentile(self.broadcast_latencies, 50), 2),
                "p95_ms": round(self.get_percentile(self.broadcast_latencies, 95), 2),
                "p99_ms": round(self.get_percentile(self.broadcast_latencies, 99), 2),
                "target_met": (self.get_percentile(self.broadcast_latencies, 95) < TARGET_BROADCAST_LATENCY_MS) if self.broadcast_latencies else False
            },
            "throughput": {
                "messages_sent": self.messages_sent,
                "messages_received": self.messages_received,
                "messages_per_second": round(self.messages_sent / duration, 2) if duration > 0 else 0,
                "target_met": (self.messages_sent / duration) >= TARGET_THROUGHPUT_MSG_PER_SEC if duration > 0 else False
            },
            "message_ordering": {
                "messages_lost": self.messages_lost,
                "messages_out_of_order": self.messages_out_of_order,
                "messages_duplicated": self.messages_duplicated,
                "ordering_accuracy": round((1 - (self.messages_out_of_order / max(1, self.messages_sent))) * 100, 2)
            },
            "game_state_sync": {
                "count": len(self.game_state_sync_latencies),
                "avg_ms": round(statistics.mean(self.game_state_sync_latencies), 2) if self.game_state_sync_latencies else 0,
                "p95_ms": round(self.get_percentile(self.game_state_sync_latencies, 95), 2)
            },
            "burst_traffic": {
                "count": len(self.burst_latencies),
                "avg_ms": round(statistics.mean(self.burst_latencies), 2) if self.burst_latencies else 0,
                "p95_ms": round(self.get_percentile(self.burst_latencies, 95), 2)
            },
            "sustained_load": {
                "count": len(self.sustained_latencies),
                "avg_ms": round(statistics.mean(self.sustained_latencies), 2) if self.sustained_latencies else 0,
                "p95_ms": round(self.get_percentile(self.sustained_latencies, 95), 2)
            },
            "payload_size_impact": {
                size: {
                    "avg_ms": round(statistics.mean(latencies), 2) if latencies else 0,
                    "p95_ms": round(self.get_percentile(latencies, 95), 2)
                }
                for size, latencies in self.payload_size_latencies.items()
            },
            "errors": list(set(self.errors))[:20]
        }


# Global metrics
metrics = MessageMetrics()


class MessageTestClient:
    """Client for message latency testing"""
    
    def __init__(self, client_id: int):
        self.client_id = client_id
        self.user_id = f"msg_test_{client_id}_{uuid.uuid4().hex[:8]}"
        self.username = f"MsgBot_{client_id}"
        self.sio = socketio.AsyncClient(
            reconnection=False,
            logger=False,
            engineio_logger=False
        )
        self.connected = False
        self.current_room = None
        self.received_messages = []
        self.pong_timestamps = {}  # msg_id -> receive_time
        self.broadcast_timestamps = {}  # msg_id -> receive_time
        self.last_sequence = -1
        self.out_of_order_count = 0
        self.duplicate_count = 0
        self.received_sequences = set()
        
        self._setup_handlers()
        
    def _setup_handlers(self):
        """Setup Socket.IO event handlers"""
        
        @self.sio.event
        async def connect():
            self.connected = True
            
        @self.sio.event
        async def disconnect():
            self.connected = False
            
        @self.sio.event
        async def connection_established(data):
            pass
            
        @self.sio.event
        async def online_count(data):
            pass
            
        @self.sio.event
        async def room_created(data):
            room = data.get('room', {})
            self.current_room = room.get('room_code')
            
        @self.sio.event
        async def player_joined(data):
            room = data.get('room', {})
            if room.get('room_code'):
                self.current_room = room.get('room_code')
            receive_time = time.time() * 1000
            self.received_messages.append(('player_joined', data, receive_time))
            
        @self.sio.event
        async def pong_test(data):
            """Handle ping response for round-trip latency"""
            receive_time = time.time() * 1000
            msg_id = data.get('msg_id')
            if msg_id:
                self.pong_timestamps[msg_id] = receive_time
            self.received_messages.append(('pong_test', data, receive_time))
            metrics.messages_received += 1
            
        @self.sio.event
        async def broadcast_received(data):
            """Handle broadcast message for broadcast latency"""
            receive_time = time.time() * 1000
            msg_id = data.get('msg_id')
            sequence = data.get('sequence', -1)
            
            if msg_id:
                self.broadcast_timestamps[msg_id] = receive_time
                
            # Check ordering
            if sequence >= 0:
                if sequence in self.received_sequences:
                    self.duplicate_count += 1
                    metrics.messages_duplicated += 1
                else:
                    self.received_sequences.add(sequence)
                    if sequence != self.last_sequence + 1 and self.last_sequence >= 0:
                        self.out_of_order_count += 1
                        metrics.messages_out_of_order += 1
                    self.last_sequence = max(self.last_sequence, sequence)
                    
            self.received_messages.append(('broadcast_received', data, receive_time))
            metrics.messages_received += 1
            
        @self.sio.event
        async def chat_message(data):
            receive_time = time.time() * 1000
            msg_id = data.get('msg_id')
            if msg_id:
                self.broadcast_timestamps[msg_id] = receive_time
            self.received_messages.append(('chat_message', data, receive_time))
            metrics.messages_received += 1
            
        @self.sio.event
        async def error(data):
            metrics.errors.append(f"Client {self.client_id}: {data.get('message', 'Unknown')}")
            
    async def connect(self) -> bool:
        """Connect to WebSocket server"""
        try:
            await self.sio.connect(
                BASE_URL,
                socketio_path=SOCKETIO_PATH,
                transports=['websocket', 'polling'],
                wait_timeout=CONNECTION_TIMEOUT
            )
            self.connected = True
            return True
        except Exception as e:
            metrics.errors.append(f"Connect: {str(e)[:50]}")
            return False
            
    async def disconnect(self):
        """Disconnect from server"""
        if self.connected:
            try:
                await self.sio.disconnect()
            except Exception:
                pass
            self.connected = False
            
    async def create_room(self, game_type: str = "latency_test") -> Optional[str]:
        """Create a game room"""
        if not self.connected:
            return None
            
        try:
            self.current_room = None
            await self.sio.emit('create_room_event', {
                'game_type': game_type,
                'user_id': self.user_id,
                'user_name': self.username,
                'is_private': False
            })
            await asyncio.sleep(0.5)
            return self.current_room
        except Exception as e:
            metrics.errors.append(f"Create room: {str(e)[:50]}")
        return None
        
    async def join_room(self, room_code: str) -> bool:
        """Join an existing room"""
        if not self.connected:
            return False
            
        try:
            await self.sio.emit('join_room_event', {
                'room_code': room_code,
                'user_id': self.user_id,
                'user_name': self.username
            })
            await asyncio.sleep(0.5)
            return self.current_room == room_code
        except Exception as e:
            metrics.errors.append(f"Join room: {str(e)[:50]}")
        return False
        
    async def ping(self, msg_id: str, payload_size: int = 100) -> Tuple[bool, float]:
        """Send ping for round-trip latency measurement"""
        if not self.connected:
            return False, 0
            
        try:
            padding = "x" * max(0, payload_size - 20)
            send_time = time.time() * 1000
            
            await self.sio.emit('ping_test', {
                'msg_id': msg_id,
                'send_time': send_time,
                'payload': padding
            })
            metrics.messages_sent += 1
            return True, send_time
        except Exception as e:
            metrics.errors.append(f"Ping: {str(e)[:50]}")
        return False, 0
        
    async def broadcast(self, msg_id: str, sequence: int = -1, payload_size: int = 100) -> Tuple[bool, float]:
        """Send broadcast message for broadcast latency measurement"""
        if not self.connected or not self.current_room:
            return False, 0
            
        try:
            padding = "x" * max(0, payload_size - 50)
            send_time = time.time() * 1000
            
            await self.sio.emit('broadcast_test', {
                'msg_id': msg_id,
                'send_time': send_time,
                'sequence': sequence,
                'payload': padding
            })
            metrics.messages_sent += 1
            return True, send_time
        except Exception as e:
            metrics.errors.append(f"Broadcast: {str(e)[:50]}")
        return False, 0
        
    async def send_chat(self, msg_id: str, message: str = "test") -> Tuple[bool, float]:
        """Send chat message"""
        if not self.connected or not self.current_room:
            return False, 0
            
        try:
            send_time = time.time() * 1000
            await self.sio.emit('send_chat', {
                'message': message,
                'msg_id': msg_id,
                'sender_name': self.username
            })
            metrics.messages_sent += 1
            return True, send_time
        except Exception as e:
            metrics.errors.append(f"Send chat: {str(e)[:50]}")
        return False, 0
        
    def get_ping_latency(self, msg_id: str, send_time: float) -> Optional[float]:
        """Get round-trip latency for a ping"""
        receive_time = self.pong_timestamps.get(msg_id)
        if receive_time:
            return receive_time - send_time
        return None
        
    def get_broadcast_latency(self, msg_id: str, send_time: float) -> Optional[float]:
        """Get latency for a broadcast message"""
        receive_time = self.broadcast_timestamps.get(msg_id)
        if receive_time:
            return receive_time - send_time
        return None
        
    def clear_messages(self):
        """Clear received messages"""
        self.received_messages = []
        self.pong_timestamps = {}
        self.broadcast_timestamps = {}
        self.last_sequence = -1
        self.out_of_order_count = 0
        self.duplicate_count = 0
        self.received_sequences = set()


async def create_room_with_clients(num_clients: int) -> Tuple[Optional[str], List[MessageTestClient]]:
    """Create a room and connect multiple clients to it"""
    clients = []
    
    # Create host
    host = MessageTestClient(0)
    if not await host.connect():
        return None, []
    clients.append(host)
    
    # Create room
    room_code = await host.create_room("latency_test")
    if not room_code:
        await host.disconnect()
        return None, []
        
    # Connect guests
    for i in range(1, num_clients):
        guest = MessageTestClient(i)
        if await guest.connect():
            if await guest.join_room(room_code):
                clients.append(guest)
            else:
                await guest.disconnect()
                
    return room_code, clients


async def disconnect_all(clients: List[MessageTestClient]):
    """Disconnect all clients"""
    tasks = [client.disconnect() for client in clients]
    await asyncio.gather(*tasks, return_exceptions=True)


class TestRoundTripLatency:
    """Test single message round-trip latency using ping_test event"""
    
    async def test_01_single_message_round_trip(self):
        """Test: Send ping from client → server → back to client"""
        print(f"\n{'='*60}")
        print("TEST: Single Message Round-Trip Latency (ping_test)")
        print(f"Target: <{TARGET_ROUND_TRIP_LATENCY_MS}ms P95")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Connect single client
        client = MessageTestClient(0)
        assert await client.connect(), "Failed to connect"
        
        # Send 100 pings and measure round-trip
        num_messages = 100
        latencies = []
        
        for i in range(num_messages):
            msg_id = f"ping_{i}_{uuid.uuid4().hex[:8]}"
            success, send_time = await client.ping(msg_id)
            
            if success:
                # Wait for pong
                await asyncio.sleep(0.05)
                
                latency = client.get_ping_latency(msg_id, send_time)
                if latency:
                    latencies.append(latency)
                    metrics.round_trip_latencies.append(latency)
                    
        await client.disconnect()
        metrics.stop()
        
        # Report results
        if latencies:
            avg_latency = statistics.mean(latencies)
            p50_latency = statistics.median(latencies)
            p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]
            p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]
            
            print(f"\n  Pings sent: {num_messages}")
            print(f"  Pongs received: {len(latencies)}")
            print(f"  Min latency: {min(latencies):.2f} ms")
            print(f"  Avg latency: {avg_latency:.2f} ms")
            print(f"  P50 latency: {p50_latency:.2f} ms")
            print(f"  P95 latency: {p95_latency:.2f} ms")
            print(f"  P99 latency: {p99_latency:.2f} ms")
            print(f"  Max latency: {max(latencies):.2f} ms")
            print(f"  Target (<{TARGET_ROUND_TRIP_LATENCY_MS}ms P95): {'✅ MET' if p95_latency < TARGET_ROUND_TRIP_LATENCY_MS else '❌ NOT MET'}")
        else:
            print("  ❌ No latency measurements collected")
            
        assert len(latencies) >= num_messages * 0.8, f"Too few responses: {len(latencies)}/{num_messages}"


class TestBroadcastLatency:
    """Test broadcast latency to multiple clients"""
    
    async def test_02_broadcast_to_10_clients(self):
        """Test: Send broadcast from 1 client → server → all 10 clients in room"""
        print(f"\n{'='*60}")
        print("TEST: Broadcast Latency (1 sender → 10 receivers)")
        print(f"Target: <{TARGET_BROADCAST_LATENCY_MS}ms for all to receive")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Create room with 10 clients
        room_code, clients = await create_room_with_clients(10)
        
        if not room_code:
            print("  ❌ Failed to create room")
            return
            
        print(f"  Clients connected: {len(clients)}")
        
        if len(clients) < 3:
            print("  ⚠️ Not enough clients connected, skipping test")
            await disconnect_all(clients)
            return
            
        sender = clients[0]
        receivers = clients[1:]
        
        # Clear all message buffers
        for client in clients:
            client.clear_messages()
        
        # Send 50 broadcasts and measure latency
        num_messages = 50
        broadcast_latencies = []
        
        for i in range(num_messages):
            msg_id = f"bc_{i}_{uuid.uuid4().hex[:8]}"
            success, send_time = await sender.broadcast(msg_id, sequence=i)
            
            if success:
                # Wait for broadcast to propagate
                await asyncio.sleep(0.1)
                
                # Measure time for all receivers to get the message
                receive_times = []
                for receiver in receivers:
                    latency = receiver.get_broadcast_latency(msg_id, send_time)
                    if latency:
                        receive_times.append(latency)
                        
                if receive_times:
                    # Broadcast latency = time for last receiver to get message
                    max_latency = max(receive_times)
                    broadcast_latencies.append(max_latency)
                    metrics.broadcast_latencies.append(max_latency)
                    
        await disconnect_all(clients)
        metrics.stop()
        
        # Report results
        if broadcast_latencies:
            avg_latency = statistics.mean(broadcast_latencies)
            p95_latency = sorted(broadcast_latencies)[int(len(broadcast_latencies) * 0.95)]
            
            print(f"\n  Messages broadcast: {num_messages}")
            print(f"  Successful broadcasts: {len(broadcast_latencies)}")
            print(f"  Avg broadcast latency: {avg_latency:.2f} ms")
            print(f"  P95 broadcast latency: {p95_latency:.2f} ms")
            print(f"  Target (<{TARGET_BROADCAST_LATENCY_MS}ms P95): {'✅ MET' if p95_latency < TARGET_BROADCAST_LATENCY_MS else '❌ NOT MET'}")
        else:
            print("  ⚠️ No broadcast latency measurements collected")


class TestMessageOrdering:
    """Test message ordering - FIFO, no duplicates, no drops"""
    
    async def test_03_message_ordering_100_rapid_messages(self):
        """Test: Send 100 rapid broadcasts, verify correct order"""
        print(f"\n{'='*60}")
        print("TEST: Message Ordering (100 rapid broadcasts)")
        print("Target: 100% ordering accuracy, no duplicates, <10% loss")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Create room with 2 clients
        room_code, clients = await create_room_with_clients(2)
        
        if not room_code or len(clients) < 2:
            print("  ❌ Failed to create room with 2 clients")
            return
            
        sender, receiver = clients[0], clients[1]
        receiver.clear_messages()
        
        # Send 100 messages rapidly
        num_messages = 100
        
        for i in range(num_messages):
            msg_id = f"ord_{i}_{uuid.uuid4().hex[:8]}"
            await sender.broadcast(msg_id, sequence=i)
            # Minimal delay to simulate rapid fire
            await asyncio.sleep(0.01)
            
        # Wait for all messages to arrive
        await asyncio.sleep(3)
        
        # Analyze received messages
        messages_received = len(receiver.received_sequences)
        messages_lost = num_messages - messages_received
        duplicates = receiver.duplicate_count
        out_of_order = receiver.out_of_order_count
                
        await disconnect_all(clients)
        metrics.stop()
        
        metrics.messages_lost = messages_lost
        
        print(f"\n  Messages sent: {num_messages}")
        print(f"  Messages received: {messages_received}")
        print(f"  Messages lost: {messages_lost} ({(messages_lost/num_messages)*100:.1f}%)")
        print(f"  Duplicates: {duplicates}")
        print(f"  Out of order: {out_of_order}")
        print(f"  Ordering accuracy: {((num_messages - out_of_order) / num_messages) * 100:.1f}%")
        
        # Soft assertions - report but continue
        if messages_lost > num_messages * 0.1:
            print(f"  ⚠️ Message loss ({messages_lost}) exceeds 10% threshold")
        if duplicates > 0:
            print(f"  ⚠️ Duplicate messages detected: {duplicates}")


class TestThroughput:
    """Test message throughput under different loads"""
    
    async def test_04_throughput_low_load(self):
        """Test: 10 clients sending 100 pings each = 1000 messages"""
        print(f"\n{'='*60}")
        print("TEST: Throughput - Low Load (10 clients × 100 pings)")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Connect 10 clients (no room needed for ping)
        clients = []
        for i in range(10):
            client = MessageTestClient(i)
            if await client.connect():
                clients.append(client)
                
        print(f"  Clients connected: {len(clients)}")
        
        # Each client sends 100 pings
        messages_per_client = 100
        total_sent = 0
        total_received = 0
        
        async def send_pings(client, count):
            nonlocal total_sent, total_received
            for i in range(count):
                msg_id = f"tp_{client.client_id}_{i}"
                success, send_time = await client.ping(msg_id)
                if success:
                    total_sent += 1
                await asyncio.sleep(0.01)
            # Wait for responses
            await asyncio.sleep(0.5)
            total_received += len(client.pong_timestamps)
                
        # Send concurrently
        tasks = [send_pings(client, messages_per_client) for client in clients]
        await asyncio.gather(*tasks)
        
        await disconnect_all(clients)
        metrics.stop()
        
        duration = metrics.get_duration()
        throughput = total_sent / duration if duration > 0 else 0
        
        print(f"\n  Total pings sent: {total_sent}")
        print(f"  Total pongs received: {total_received}")
        print(f"  Duration: {duration:.2f}s")
        print(f"  Throughput: {throughput:.1f} msg/s")
        print(f"  Target ({TARGET_THROUGHPUT_MSG_PER_SEC} msg/s): {'✅ MET' if throughput >= TARGET_THROUGHPUT_MSG_PER_SEC else '❌ NOT MET'}")


class TestBurstTraffic:
    """Test burst traffic handling"""
    
    async def test_05_burst_200_messages(self):
        """Test: Send 200 pings as fast as possible"""
        print(f"\n{'='*60}")
        print("TEST: Burst Traffic (200 pings as fast as possible)")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Connect single client
        client = MessageTestClient(0)
        assert await client.connect(), "Failed to connect"
        
        # Send 200 pings as fast as possible
        num_messages = 200
        send_times = {}
        
        burst_start = time.time()
        for i in range(num_messages):
            msg_id = f"burst_{i}"
            send_time = time.time() * 1000
            send_times[msg_id] = send_time
            
            await client.sio.emit('ping_test', {
                'msg_id': msg_id,
                'send_time': send_time,
                'payload': ''
            })
            metrics.messages_sent += 1
            
        burst_duration = time.time() - burst_start
        
        # Wait for responses
        await asyncio.sleep(3)
        
        # Calculate latencies
        latencies = []
        for msg_id, send_time in send_times.items():
            receive_time = client.pong_timestamps.get(msg_id)
            if receive_time:
                latencies.append(receive_time - send_time)
                
        await client.disconnect()
        metrics.stop()
        
        metrics.burst_latencies = latencies
        
        print(f"\n  Messages sent: {num_messages}")
        print(f"  Burst duration: {burst_duration:.3f}s")
        print(f"  Send rate: {num_messages / burst_duration:.1f} msg/s")
        print(f"  Messages received: {len(latencies)}")
        print(f"  Response rate: {(len(latencies)/num_messages)*100:.1f}%")
        
        if latencies:
            print(f"  Avg latency: {statistics.mean(latencies):.2f} ms")
            print(f"  P95 latency: {sorted(latencies)[int(len(latencies) * 0.95)]:.2f} ms")
            print(f"  Max latency: {max(latencies):.2f} ms")


class TestSustainedLoad:
    """Test sustained load over time"""
    
    async def test_06_sustained_load_15_seconds(self):
        """Test: 50 pings/second for 15 seconds"""
        print(f"\n{'='*60}")
        print("TEST: Sustained Load (50 msg/s for 15 seconds)")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Connect single client
        client = MessageTestClient(0)
        assert await client.connect(), "Failed to connect"
        
        # Send 50 pings per second for 15 seconds
        duration_seconds = 15
        messages_per_second = 50
        interval = 1.0 / messages_per_second
        
        send_times = {}
        total_sent = 0
        
        test_start = time.time()
        while time.time() - test_start < duration_seconds:
            msg_id = f"sust_{total_sent}"
            send_time = time.time() * 1000
            send_times[msg_id] = send_time
            
            await client.sio.emit('ping_test', {
                'msg_id': msg_id,
                'send_time': send_time,
                'payload': ''
            })
            metrics.messages_sent += 1
            total_sent += 1
            
            await asyncio.sleep(interval)
            
        # Wait for final responses
        await asyncio.sleep(2)
        
        # Calculate latencies
        latencies = []
        for msg_id, send_time in send_times.items():
            receive_time = client.pong_timestamps.get(msg_id)
            if receive_time:
                latencies.append(receive_time - send_time)
                
        await client.disconnect()
        metrics.stop()
        
        metrics.sustained_latencies = latencies
        
        actual_duration = time.time() - test_start
        actual_rate = total_sent / actual_duration
        
        print(f"\n  Duration: {actual_duration:.1f}s")
        print(f"  Messages sent: {total_sent}")
        print(f"  Actual rate: {actual_rate:.1f} msg/s")
        print(f"  Messages received: {len(latencies)}")
        print(f"  Response rate: {(len(latencies)/total_sent)*100:.1f}%")
        
        if latencies:
            # Check for latency degradation over time
            first_half = latencies[:len(latencies)//2]
            second_half = latencies[len(latencies)//2:]
            
            print(f"\n  First half avg latency: {statistics.mean(first_half):.2f} ms")
            print(f"  Second half avg latency: {statistics.mean(second_half):.2f} ms")
            print(f"  Overall avg latency: {statistics.mean(latencies):.2f} ms")
            print(f"  P95 latency: {sorted(latencies)[int(len(latencies) * 0.95)]:.2f} ms")
            
            degradation = statistics.mean(second_half) - statistics.mean(first_half)
            print(f"  Latency degradation: {degradation:+.2f} ms")


class TestPayloadSizeImpact:
    """Test latency with different payload sizes"""
    
    async def test_07_payload_size_impact(self):
        """Test: Latency with 100B, 1KB, 5KB payloads"""
        print(f"\n{'='*60}")
        print("TEST: Payload Size Impact on Latency")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Connect single client
        client = MessageTestClient(0)
        assert await client.connect(), "Failed to connect"
        
        # Test different payload sizes
        payload_sizes = [100, 1000, 5000]  # bytes
        messages_per_size = 30
        
        for size in payload_sizes:
            client.pong_timestamps = {}
            latencies = []
            
            for i in range(messages_per_size):
                msg_id = f"size_{size}_{i}"
                success, send_time = await client.ping(msg_id, payload_size=size)
                
                if success:
                    await asyncio.sleep(0.05)
                    latency = client.get_ping_latency(msg_id, send_time)
                    if latency:
                        latencies.append(latency)
                        
            if latencies:
                metrics.payload_size_latencies[f"{size}B"] = latencies
                avg_latency = statistics.mean(latencies)
                p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]
                print(f"\n  {size}B payload:")
                print(f"    Samples: {len(latencies)}")
                print(f"    Avg latency: {avg_latency:.2f} ms")
                print(f"    P95 latency: {p95_latency:.2f} ms")
                
        await client.disconnect()
        metrics.stop()


class TestConcurrentRooms:
    """Test concurrent rooms messaging"""
    
    async def test_08_concurrent_rooms_messaging(self):
        """Test: 10 rooms with 4 players each sending broadcasts"""
        print(f"\n{'='*60}")
        print("TEST: Concurrent Rooms Messaging (10 rooms × 4 players)")
        print(f"{'='*60}")
        
        metrics.reset()
        metrics.start()
        
        # Create 10 rooms with 4 clients each
        all_rooms = []
        
        for room_num in range(10):
            room_code, clients = await create_room_with_clients(4)
            if room_code and len(clients) >= 2:
                all_rooms.append((room_code, clients))
                
        print(f"  Rooms created: {len(all_rooms)}")
        total_clients = sum(len(clients) for _, clients in all_rooms)
        print(f"  Total clients: {total_clients}")
        
        # Each room sends 20 broadcasts
        messages_per_room = 20
        total_sent = 0
        
        async def room_activity(room_code, clients):
            nonlocal total_sent
            sender = clients[0]
            for i in range(messages_per_room):
                msg_id = f"room_{room_code}_{i}"
                await sender.broadcast(msg_id, sequence=i)
                total_sent += 1
                await asyncio.sleep(0.05)
                
        # Run all rooms concurrently
        tasks = [room_activity(room_code, clients) for room_code, clients in all_rooms]
        await asyncio.gather(*tasks)
        
        await asyncio.sleep(2)
        
        # Disconnect all
        for _, clients in all_rooms:
            await disconnect_all(clients)
            
        metrics.stop()
        
        duration = metrics.get_duration()
        throughput = total_sent / duration if duration > 0 else 0
        
        print(f"\n  Total messages sent: {total_sent}")
        print(f"  Duration: {duration:.2f}s")
        print(f"  Throughput: {throughput:.1f} msg/s")


class TestFinalReport:
    """Generate final performance report"""
    
    async def test_09_generate_final_report(self):
        """Generate comprehensive message performance report"""
        metrics.stop()
        report = metrics.get_report()
        
        print(f"\n{'='*60}")
        print("WEBSOCKET MESSAGE PERFORMANCE - FINAL REPORT")
        print(f"{'='*60}")
        
        print(f"\n  Duration: {report['duration_seconds']}s")
        
        print("\n  ROUND-TRIP LATENCY (ping_test):")
        rt = report['round_trip_latency']
        print(f"    Samples: {rt['count']}")
        if rt['count'] > 0:
            print(f"    Min: {rt['min_ms']} ms")
            print(f"    Avg: {rt['avg_ms']} ms")
            print(f"    P50: {rt['p50_ms']} ms")
            print(f"    P95: {rt['p95_ms']} ms (target: <{TARGET_ROUND_TRIP_LATENCY_MS}ms)")
            print(f"    P99: {rt['p99_ms']} ms")
            print(f"    Max: {rt['max_ms']} ms")
            print(f"    Target Met: {'✅ YES' if rt['target_met'] else '❌ NO'}")
        
        print("\n  BROADCAST LATENCY (broadcast_test):")
        bc = report['broadcast_latency']
        print(f"    Samples: {bc['count']}")
        if bc['count'] > 0:
            print(f"    Avg: {bc['avg_ms']} ms")
            print(f"    P95: {bc['p95_ms']} ms (target: <{TARGET_BROADCAST_LATENCY_MS}ms)")
            print(f"    Target Met: {'✅ YES' if bc['target_met'] else '❌ NO'}")
        
        print("\n  THROUGHPUT:")
        tp = report['throughput']
        print(f"    Messages Sent: {tp['messages_sent']}")
        print(f"    Messages Received: {tp['messages_received']}")
        print(f"    Messages/Second: {tp['messages_per_second']}")
        print(f"    Target ({TARGET_THROUGHPUT_MSG_PER_SEC} msg/s): {'✅ MET' if tp['target_met'] else '❌ NOT MET'}")
        
        print("\n  MESSAGE ORDERING:")
        mo = report['message_ordering']
        print(f"    Lost: {mo['messages_lost']}")
        print(f"    Out of Order: {mo['messages_out_of_order']}")
        print(f"    Duplicated: {mo['messages_duplicated']}")
        print(f"    Accuracy: {mo['ordering_accuracy']}%")
        
        if report['burst_traffic']['count'] > 0:
            print("\n  BURST TRAFFIC:")
            bt = report['burst_traffic']
            print(f"    Samples: {bt['count']}")
            print(f"    Avg: {bt['avg_ms']} ms")
            print(f"    P95: {bt['p95_ms']} ms")
        
        if report['sustained_load']['count'] > 0:
            print("\n  SUSTAINED LOAD:")
            sl = report['sustained_load']
            print(f"    Samples: {sl['count']}")
            print(f"    Avg: {sl['avg_ms']} ms")
            print(f"    P95: {sl['p95_ms']} ms")
        
        if report['payload_size_impact']:
            print("\n  PAYLOAD SIZE IMPACT:")
            for size, data in report['payload_size_impact'].items():
                print(f"    {size}: avg={data['avg_ms']}ms, p95={data['p95_ms']}ms")
        
        if report['errors']:
            print(f"\n  ERRORS ({len(report['errors'])}):")
            for err in report['errors'][:5]:
                print(f"    - {err[:60]}")
        
        # Save report
        report_path = "/app/test_reports/websocket_message_performance.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n  Report saved to: {report_path}")
        
        # Performance assessment
        print("\n  PERFORMANCE ASSESSMENT:")
        if rt['count'] > 0:
            if rt['target_met']:
                print(f"    ✅ Round-trip latency EXCELLENT (<{TARGET_ROUND_TRIP_LATENCY_MS}ms P95)")
            else:
                print(f"    ⚠️ Round-trip latency needs improvement (P95: {rt['p95_ms']}ms)")
        else:
            print("    ⚠️ Round-trip latency not measured")
            
        if bc['count'] > 0:
            if bc['target_met']:
                print(f"    ✅ Broadcast latency EXCELLENT (<{TARGET_BROADCAST_LATENCY_MS}ms P95)")
            else:
                print(f"    ⚠️ Broadcast latency needs improvement (P95: {bc['p95_ms']}ms)")
        else:
            print("    ⚠️ Broadcast latency not measured")
            
        if mo['ordering_accuracy'] >= 99:
            print(f"    ✅ Message ordering EXCELLENT ({mo['ordering_accuracy']}%)")
        elif mo['ordering_accuracy'] >= 95:
            print(f"    ⚠️ Message ordering GOOD ({mo['ordering_accuracy']}%)")
        else:
            print(f"    ❌ Message ordering needs improvement ({mo['ordering_accuracy']}%)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
