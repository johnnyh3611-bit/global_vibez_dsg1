#!/usr/bin/env python3
"""
Global Vibez DSG - WebSocket Load Test Runner
Runs comprehensive WebSocket load tests and generates report
"""

import asyncio
import socketio
import time
import json
import os
import statistics
import uuid
from datetime import datetime
from typing import List, Optional
import secrets
secure_random = secrets.SystemRandom()

# Configuration
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://social-connect-953.preview.emergentagent.com"

SOCKETIO_PATH = "/api/socket.io"
CONNECTION_TIMEOUT = 30
MESSAGE_TIMEOUT = 10


class WebSocketMetrics:
    """Track WebSocket load test metrics"""
    
    def __init__(self):
        self.reset()
        
    def reset(self):
        self.start_time = time.time()
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
            "errors": list(set(self.errors))[:20]
        }


# Global metrics
metrics = WebSocketMetrics()


class BotClient:
    """Simulated bot client for WebSocket testing"""
    
    def __init__(self, bot_id: int):
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
        self._setup_handlers()
        
    def _setup_handlers(self):
        @self.sio.event
        async def connect():
            self.connected = True
            
        @self.sio.event
        async def disconnect():
            self.connected = False
            metrics.record_disconnection()
            
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
            
    async def connect(self) -> bool:
        start_time = time.time()
        try:
            await self.sio.connect(
                BASE_URL,
                socketio_path=SOCKETIO_PATH,
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
        if self.connected:
            try:
                await self.sio.disconnect()
            except Exception:
                pass
            self.connected = False
            
    async def create_room(self, game_type: str = "tictactoe") -> Optional[str]:
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


async def connect_bots_batch(bot_count: int, batch_size: int = 50) -> List[BotClient]:
    """Connect multiple bots in batches"""
    bots = [BotClient(i) for i in range(bot_count)]
    connected_bots = []
    
    for batch_start in range(0, bot_count, batch_size):
        batch_end = min(batch_start + batch_size, bot_count)
        batch = bots[batch_start:batch_end]
        
        tasks = [bot.connect() for bot in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for bot, result in zip(batch, results):
            if result:
                connected_bots.append(bot)
                
        await asyncio.sleep(0.5)
        
    return connected_bots


async def disconnect_all_bots(bots: List[BotClient]):
    """Disconnect all bots"""
    tasks = [bot.disconnect() for bot in bots]
    await asyncio.gather(*tasks, return_exceptions=True)


async def run_load_tests():
    """Run all load tests"""
    print(f"\n{'='*60}")
    print("GLOBAL VIBEZ DSG - WEBSOCKET LOAD TEST")
    print(f"{'='*60}")
    print(f"Target: {BASE_URL}")
    print(f"Socket.IO Path: {SOCKETIO_PATH}")
    
    results = {
        "tests": [],
        "overall_success": True
    }
    
    # Test 1: Single Connection
    print(f"\n{'='*60}")
    print("TEST 1: Single WebSocket Connection")
    print(f"{'='*60}")
    
    bot = BotClient(0)
    success = await bot.connect()
    print(f"  Connection successful: {success}")
    print(f"  Connection time: {bot.connection_time * 1000:.2f} ms")
    await bot.disconnect()
    
    results["tests"].append({
        "name": "Single Connection",
        "passed": success,
        "connection_time_ms": round(bot.connection_time * 1000, 2)
    })
    
    # Test 2: 10 Concurrent Connections
    print(f"\n{'='*60}")
    print("TEST 2: 10 Concurrent Connections")
    print(f"{'='*60}")
    
    bots = await connect_bots_batch(10, batch_size=10)
    success_rate = (len(bots) / 10) * 100
    print(f"  Connected: {len(bots)}/10")
    print(f"  Success rate: {success_rate:.1f}%")
    await disconnect_all_bots(bots)
    
    results["tests"].append({
        "name": "10 Concurrent Connections",
        "passed": len(bots) >= 8,
        "connected": len(bots),
        "success_rate": success_rate
    })
    
    # Test 3: 100 Concurrent Connections
    print(f"\n{'='*60}")
    print("TEST 3: 100 Concurrent Connections")
    print(f"{'='*60}")
    
    bots = await connect_bots_batch(100, batch_size=20)
    success_rate = (len(bots) / 100) * 100
    print(f"  Connected: {len(bots)}/100")
    print(f"  Success rate: {success_rate:.1f}%")
    
    await asyncio.sleep(2)
    still_connected = sum(1 for bot in bots if bot.connected)
    print(f"  Still connected after 2s: {still_connected}")
    await disconnect_all_bots(bots)
    
    results["tests"].append({
        "name": "100 Concurrent Connections",
        "passed": len(bots) >= 50,
        "connected": len(bots),
        "success_rate": success_rate,
        "still_connected_after_2s": still_connected
    })
    
    # Test 4: Room Creation (50 rooms)
    print(f"\n{'='*60}")
    print("TEST 4: Room Creation (50 rooms)")
    print(f"{'='*60}")
    
    bots = await connect_bots_batch(50, batch_size=25)
    rooms_created = 0
    for bot in bots:
        room_code = await bot.create_room("tictactoe")
        if room_code:
            rooms_created += 1
    print(f"  Rooms created: {rooms_created}/{len(bots)}")
    await disconnect_all_bots(bots)
    
    results["tests"].append({
        "name": "Room Creation (50 rooms)",
        "passed": rooms_created >= 25,
        "rooms_created": rooms_created
    })
    
    # Test 5: 500 Concurrent Connections
    print(f"\n{'='*60}")
    print("TEST 5: 500 Concurrent Connections")
    print(f"{'='*60}")
    
    start_time = time.time()
    bots = await connect_bots_batch(500, batch_size=50)
    connection_time = time.time() - start_time
    success_rate = (len(bots) / 500) * 100
    
    print(f"  Connected: {len(bots)}/500")
    print(f"  Success rate: {success_rate:.1f}%")
    print(f"  Total connection time: {connection_time:.2f}s")
    print(f"  Connections/second: {len(bots) / connection_time:.1f}")
    
    await asyncio.sleep(5)
    still_connected = sum(1 for bot in bots if bot.connected)
    print(f"  Still connected after 5s: {still_connected}")
    await disconnect_all_bots(bots)
    
    results["tests"].append({
        "name": "500 Concurrent Connections",
        "passed": len(bots) >= 250,
        "connected": len(bots),
        "success_rate": success_rate,
        "connection_time_seconds": round(connection_time, 2),
        "connections_per_second": round(len(bots) / connection_time, 1),
        "still_connected_after_5s": still_connected
    })
    
    # Test 6: 1000 Concurrent Connections
    print(f"\n{'='*60}")
    print("TEST 6: 1000 Concurrent Connections")
    print(f"{'='*60}")
    
    start_time = time.time()
    bots = await connect_bots_batch(1000, batch_size=50)
    connection_time = time.time() - start_time
    success_rate = (len(bots) / 1000) * 100
    
    print(f"  Connected: {len(bots)}/1000")
    print(f"  Success rate: {success_rate:.1f}%")
    print(f"  Total connection time: {connection_time:.2f}s")
    print(f"  Connections/second: {len(bots) / connection_time:.1f}")
    
    await asyncio.sleep(10)
    still_connected = sum(1 for bot in bots if bot.connected)
    print(f"  Still connected after 10s: {still_connected}")
    await disconnect_all_bots(bots)
    
    results["tests"].append({
        "name": "1000 Concurrent Connections",
        "passed": len(bots) >= 500,
        "connected": len(bots),
        "success_rate": success_rate,
        "connection_time_seconds": round(connection_time, 2),
        "connections_per_second": round(len(bots) / connection_time, 1),
        "still_connected_after_10s": still_connected
    })
    
    # Generate final report
    metrics.stop()
    report = metrics.get_report()
    report["test_results"] = results
    
    # Calculate overall success
    passed_tests = sum(1 for t in results["tests"] if t.get("passed", False))
    total_tests = len(results["tests"])
    results["overall_success"] = passed_tests >= total_tests * 0.8
    
    print(f"\n{'='*60}")
    print("FINAL REPORT")
    print(f"{'='*60}")
    print(f"\n  Tests Passed: {passed_tests}/{total_tests}")
    print("\n  CONNECTIONS:")
    print(f"    Attempted: {report['connections']['attempted']}")
    print(f"    Successful: {report['connections']['successful']}")
    print(f"    Failed: {report['connections']['failed']}")
    print(f"    Success Rate: {report['connections']['success_rate']}%")
    print(f"    Peak Concurrent: {report['connections']['peak_concurrent']}")
    
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
    
    if report['errors']:
        print(f"\n  ERRORS ({len(report['errors'])}):")
        for err in report['errors'][:5]:
            print(f"    - {err[:80]}")
    
    # Performance assessment
    print("\n  PERFORMANCE ASSESSMENT:")
    if report['connections']['success_rate'] >= 95:
        print("    ✅ Connection success rate EXCELLENT (>95%)")
    elif report['connections']['success_rate'] >= 80:
        print("    ⚠️ Connection success rate GOOD (80-95%)")
    else:
        print("    ❌ Connection success rate NEEDS IMPROVEMENT (<80%)")
        
    if report['connection_times']['avg_ms'] < 500:
        print("    ✅ Connection time GOOD (<500ms avg)")
    elif report['connection_times']['avg_ms'] < 1000:
        print("    ⚠️ Connection time ACCEPTABLE (500-1000ms avg)")
    else:
        print("    ❌ Connection time SLOW (>1000ms avg)")
    
    # Save report
    report_path = "/app/test_reports/websocket_load_test.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n  Report saved to: {report_path}")
    
    return report


if __name__ == "__main__":
    asyncio.run(run_load_tests())
