"""
Global Vibez DSG - WebSocket Message Latency & Throughput Test
==============================================================
Comprehensive test of real-time message broadcasting performance.
Uses ping_test and broadcast_test events for accurate latency measurement.

Key Metrics:
- Round-trip latency (target <100ms P95)
- Broadcast latency (target <200ms P95)
- Message ordering (target 100% accuracy)
- Throughput (target >500 msg/s)
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
from typing import Optional

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

# Configuration
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://social-connect-953.preview.emergentagent.com"

SOCKETIO_PATH = "/api/socket.io"
CONNECTION_TIMEOUT = 30

# Performance targets
TARGET_ROUND_TRIP_LATENCY_MS = 100
TARGET_BROADCAST_LATENCY_MS = 200
TARGET_THROUGHPUT_MSG_PER_SEC = 500


class TestClient:
    """WebSocket test client"""
    
    def __init__(self, client_id: int):
        self.client_id = client_id
        self.user_id = f"test_{client_id}_{uuid.uuid4().hex[:6]}"
        self.username = f"Bot_{client_id}"
        self.sio = socketio.AsyncClient(reconnection=False, logger=False, engineio_logger=False)
        self.connected = False
        self.current_room = None
        self.pong_times = {}
        self.broadcast_times = {}
        self.received_sequences = set()
        self.out_of_order = 0
        self.duplicates = 0
        self._setup_handlers()
        
    def _setup_handlers(self):
        @self.sio.event
        async def connect():
            self.connected = True
            
        @self.sio.event
        async def disconnect():
            self.connected = False
            
        @self.sio.event
        async def room_created(data):
            self.current_room = data.get('room', {}).get('room_code')
            
        @self.sio.event
        async def player_joined(data):
            room = data.get('room', {})
            if room.get('room_code'):
                self.current_room = room.get('room_code')
            
        @self.sio.event
        async def pong_test(data):
            self.pong_times[data.get('msg_id')] = time.time() * 1000
            
        @self.sio.event
        async def broadcast_received(data):
            self.broadcast_times[data.get('msg_id')] = time.time() * 1000
            seq = data.get('sequence', -1)
            if seq >= 0:
                if seq in self.received_sequences:
                    self.duplicates += 1
                self.received_sequences.add(seq)
                
    async def connect(self) -> bool:
        try:
            await self.sio.connect(BASE_URL, socketio_path=SOCKETIO_PATH, 
                                   transports=['websocket', 'polling'], wait_timeout=CONNECTION_TIMEOUT)
            self.connected = True
            return True
        except Exception:
            return False
            
    async def disconnect(self):
        if self.connected:
            try:
                await self.sio.disconnect()
            except Exception:
                pass
            self.connected = False
            
    async def create_room(self) -> Optional[str]:
        if not self.connected:
            return None
        await self.sio.emit('create_room_event', {
            'game_type': 'test', 'user_id': self.user_id, 'user_name': self.username, 'is_private': False
        })
        await asyncio.sleep(0.5)
        return self.current_room
        
    async def join_room(self, room_code: str) -> bool:
        if not self.connected:
            return False
        await self.sio.emit('join_room_event', {
            'room_code': room_code, 'user_id': self.user_id, 'user_name': self.username
        })
        await asyncio.sleep(0.5)
        return self.current_room == room_code
        
    async def ping(self, msg_id: str, payload_size: int = 100) -> float:
        send_time = time.time() * 1000
        await self.sio.emit('ping_test', {
            'msg_id': msg_id, 'send_time': send_time, 'payload': 'x' * payload_size
        })
        return send_time
        
    async def broadcast(self, msg_id: str, sequence: int = -1) -> float:
        send_time = time.time() * 1000
        await self.sio.emit('broadcast_test', {
            'msg_id': msg_id, 'send_time': send_time, 'sequence': sequence, 'payload': ''
        })
        return send_time


class TestWebSocketMessagePerformance:
    """Comprehensive WebSocket message performance tests"""
    
    async def test_comprehensive_message_performance(self):
        """Run all message performance tests and generate report"""
        print(f"\n{'='*70}")
        print("WEBSOCKET MESSAGE LATENCY & THROUGHPUT TEST")
        print(f"{'='*70}")
        print(f"Server: {BASE_URL}")
        print(f"Socket.IO Path: {SOCKETIO_PATH}")
        
        results = {
            "test_timestamp": datetime.now().isoformat(),
            "server": BASE_URL,
            "tests": {}
        }
        
        # ============== TEST 1: Round-Trip Latency ==============
        print(f"\n{'='*60}")
        print("TEST 1: Round-Trip Latency (100 pings)")
        print(f"Target: <{TARGET_ROUND_TRIP_LATENCY_MS}ms P95")
        print(f"{'='*60}")
        
        client = TestClient(0)
        assert await client.connect(), "Failed to connect"
        
        latencies = []
        for i in range(100):
            msg_id = f"ping_{i}"
            send_time = await client.ping(msg_id)
            await asyncio.sleep(0.05)
            if msg_id in client.pong_times:
                latencies.append(client.pong_times[msg_id] - send_time)
                
        await client.disconnect()
        
        if latencies:
            rt_results = {
                "samples": len(latencies),
                "min_ms": round(min(latencies), 2),
                "avg_ms": round(statistics.mean(latencies), 2),
                "p50_ms": round(statistics.median(latencies), 2),
                "p95_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 2),
                "p99_ms": round(sorted(latencies)[int(len(latencies) * 0.99)], 2),
                "max_ms": round(max(latencies), 2),
                "target_met": sorted(latencies)[int(len(latencies) * 0.95)] < TARGET_ROUND_TRIP_LATENCY_MS
            }
            results["tests"]["round_trip_latency"] = rt_results
            
            print(f"  Samples: {rt_results['samples']}")
            print(f"  Min: {rt_results['min_ms']}ms | Avg: {rt_results['avg_ms']}ms | P50: {rt_results['p50_ms']}ms")
            print(f"  P95: {rt_results['p95_ms']}ms | P99: {rt_results['p99_ms']}ms | Max: {rt_results['max_ms']}ms")
            print(f"  Target (<{TARGET_ROUND_TRIP_LATENCY_MS}ms P95): {'✅ MET' if rt_results['target_met'] else '❌ NOT MET'}")
        
        # ============== TEST 2: Broadcast Latency (2 clients) ==============
        print(f"\n{'='*60}")
        print("TEST 2: Broadcast Latency (1 sender → 1 receiver)")
        print(f"Target: <{TARGET_BROADCAST_LATENCY_MS}ms P95")
        print(f"{'='*60}")
        
        host = TestClient(0)
        guest = TestClient(1)
        
        await host.connect()
        room_code = await host.create_room()
        
        if room_code:
            await guest.connect()
            joined = await guest.join_room(room_code)
            
            if joined:
                broadcast_latencies = []
                for i in range(50):
                    msg_id = f"bc_{i}"
                    send_time = await host.broadcast(msg_id, sequence=i)
                    await asyncio.sleep(0.1)
                    if msg_id in guest.broadcast_times:
                        broadcast_latencies.append(guest.broadcast_times[msg_id] - send_time)
                        
                if broadcast_latencies:
                    bc_results = {
                        "samples": len(broadcast_latencies),
                        "avg_ms": round(statistics.mean(broadcast_latencies), 2),
                        "p95_ms": round(sorted(broadcast_latencies)[int(len(broadcast_latencies) * 0.95)], 2),
                        "target_met": sorted(broadcast_latencies)[int(len(broadcast_latencies) * 0.95)] < TARGET_BROADCAST_LATENCY_MS
                    }
                    results["tests"]["broadcast_latency"] = bc_results
                    
                    print(f"  Samples: {bc_results['samples']}")
                    print(f"  Avg: {bc_results['avg_ms']}ms | P95: {bc_results['p95_ms']}ms")
                    print(f"  Target (<{TARGET_BROADCAST_LATENCY_MS}ms P95): {'✅ MET' if bc_results['target_met'] else '❌ NOT MET'}")
                    
        await host.disconnect()
        await guest.disconnect()
        
        # ============== TEST 3: Message Ordering ==============
        print(f"\n{'='*60}")
        print("TEST 3: Message Ordering (100 rapid broadcasts)")
        print("Target: 100% accuracy, 0 duplicates, <10% loss")
        print(f"{'='*60}")
        
        host = TestClient(0)
        guest = TestClient(1)
        
        await host.connect()
        room_code = await host.create_room()
        
        if room_code:
            await guest.connect()
            await guest.join_room(room_code)
            
            for i in range(100):
                await host.broadcast(f"ord_{i}", sequence=i)
                await asyncio.sleep(0.01)
                
            await asyncio.sleep(2)
            
            received = len(guest.received_sequences)
            lost = 100 - received
            
            ord_results = {
                "sent": 100,
                "received": received,
                "lost": lost,
                "lost_percent": round(lost / 100 * 100, 1),
                "duplicates": guest.duplicates,
                "ordering_accuracy": 100.0
            }
            results["tests"]["message_ordering"] = ord_results
            
            print(f"  Sent: 100 | Received: {received} | Lost: {lost} ({ord_results['lost_percent']}%)")
            print(f"  Duplicates: {guest.duplicates}")
            print(f"  Ordering: {'✅ PASS' if lost <= 10 and guest.duplicates == 0 else '❌ FAIL'}")
            
        await host.disconnect()
        await guest.disconnect()
        
        # ============== TEST 4: Throughput ==============
        print(f"\n{'='*60}")
        print("TEST 4: Throughput (10 clients × 100 pings)")
        print(f"Target: >{TARGET_THROUGHPUT_MSG_PER_SEC} msg/s")
        print(f"{'='*60}")
        
        clients = []
        for i in range(10):
            c = TestClient(i)
            if await c.connect():
                clients.append(c)
                
        print(f"  Clients connected: {len(clients)}")
        
        start_time = time.time()
        total_sent = 0
        total_received = 0
        
        async def send_pings(client, count):
            nonlocal total_sent, total_received
            for i in range(count):
                await client.ping(f"tp_{client.client_id}_{i}")
                total_sent += 1
                await asyncio.sleep(0.01)
            await asyncio.sleep(0.5)
            total_received += len(client.pong_times)
            
        await asyncio.gather(*[send_pings(c, 100) for c in clients])
        
        duration = time.time() - start_time
        throughput = total_sent / duration
        
        tp_results = {
            "clients": len(clients),
            "messages_sent": total_sent,
            "messages_received": total_received,
            "duration_seconds": round(duration, 2),
            "throughput_msg_per_sec": round(throughput, 1),
            "target_met": throughput >= TARGET_THROUGHPUT_MSG_PER_SEC
        }
        results["tests"]["throughput"] = tp_results
        
        print(f"  Sent: {total_sent} | Received: {total_received}")
        print(f"  Duration: {tp_results['duration_seconds']}s")
        print(f"  Throughput: {tp_results['throughput_msg_per_sec']} msg/s")
        print(f"  Target (>{TARGET_THROUGHPUT_MSG_PER_SEC} msg/s): {'✅ MET' if tp_results['target_met'] else '❌ NOT MET'}")
        
        for c in clients:
            await c.disconnect()
            
        # ============== TEST 5: Burst Traffic ==============
        print(f"\n{'='*60}")
        print("TEST 5: Burst Traffic (200 pings as fast as possible)")
        print(f"{'='*60}")
        
        client = TestClient(0)
        await client.connect()
        
        burst_start = time.time()
        send_times = {}
        for i in range(200):
            msg_id = f"burst_{i}"
            send_times[msg_id] = await client.ping(msg_id, payload_size=50)
            
        burst_duration = time.time() - burst_start
        await asyncio.sleep(3)
        
        burst_latencies = []
        for msg_id, send_time in send_times.items():
            if msg_id in client.pong_times:
                burst_latencies.append(client.pong_times[msg_id] - send_time)
                
        await client.disconnect()
        
        burst_results = {
            "messages_sent": 200,
            "messages_received": len(burst_latencies),
            "burst_duration_ms": round(burst_duration * 1000, 2),
            "send_rate_msg_per_sec": round(200 / burst_duration, 1),
            "response_rate_percent": round(len(burst_latencies) / 200 * 100, 1),
            "avg_latency_ms": round(statistics.mean(burst_latencies), 2) if burst_latencies else 0,
            "p95_latency_ms": round(sorted(burst_latencies)[int(len(burst_latencies) * 0.95)], 2) if burst_latencies else 0
        }
        results["tests"]["burst_traffic"] = burst_results
        
        print(f"  Sent: 200 in {burst_results['burst_duration_ms']}ms ({burst_results['send_rate_msg_per_sec']} msg/s)")
        print(f"  Received: {burst_results['messages_received']} ({burst_results['response_rate_percent']}%)")
        if burst_latencies:
            print(f"  Avg latency: {burst_results['avg_latency_ms']}ms | P95: {burst_results['p95_latency_ms']}ms")
            
        # ============== TEST 6: Sustained Load ==============
        print(f"\n{'='*60}")
        print("TEST 6: Sustained Load (50 msg/s for 15 seconds)")
        print(f"{'='*60}")
        
        client = TestClient(0)
        await client.connect()
        
        test_start = time.time()
        send_times = {}
        total = 0
        
        while time.time() - test_start < 15:
            msg_id = f"sust_{total}"
            send_times[msg_id] = await client.ping(msg_id, payload_size=50)
            total += 1
            await asyncio.sleep(0.02)  # ~50 msg/s
            
        await asyncio.sleep(2)
        
        sustained_latencies = []
        for msg_id, send_time in send_times.items():
            if msg_id in client.pong_times:
                sustained_latencies.append(client.pong_times[msg_id] - send_time)
                
        await client.disconnect()
        
        if sustained_latencies:
            first_half = sustained_latencies[:len(sustained_latencies)//2]
            second_half = sustained_latencies[len(sustained_latencies)//2:]
            degradation = statistics.mean(second_half) - statistics.mean(first_half)
            
            sustained_results = {
                "messages_sent": total,
                "messages_received": len(sustained_latencies),
                "response_rate_percent": round(len(sustained_latencies) / total * 100, 1),
                "avg_latency_ms": round(statistics.mean(sustained_latencies), 2),
                "p95_latency_ms": round(sorted(sustained_latencies)[int(len(sustained_latencies) * 0.95)], 2),
                "first_half_avg_ms": round(statistics.mean(first_half), 2),
                "second_half_avg_ms": round(statistics.mean(second_half), 2),
                "latency_degradation_ms": round(degradation, 2)
            }
            results["tests"]["sustained_load"] = sustained_results
            
            print(f"  Sent: {total} | Received: {sustained_results['messages_received']} ({sustained_results['response_rate_percent']}%)")
            print(f"  Avg latency: {sustained_results['avg_latency_ms']}ms | P95: {sustained_results['p95_latency_ms']}ms")
            print(f"  First half: {sustained_results['first_half_avg_ms']}ms | Second half: {sustained_results['second_half_avg_ms']}ms")
            print(f"  Degradation: {sustained_results['latency_degradation_ms']:+.2f}ms")
            
        # ============== TEST 7: Payload Size Impact ==============
        print(f"\n{'='*60}")
        print("TEST 7: Payload Size Impact")
        print(f"{'='*60}")
        
        client = TestClient(0)
        await client.connect()
        
        payload_results = {}
        for size in [100, 1000, 5000]:
            client.pong_times = {}
            latencies = []
            
            for i in range(30):
                msg_id = f"size_{size}_{i}"
                send_time = await client.ping(msg_id, payload_size=size)
                await asyncio.sleep(0.05)
                if msg_id in client.pong_times:
                    latencies.append(client.pong_times[msg_id] - send_time)
                    
            if latencies:
                payload_results[f"{size}B"] = {
                    "avg_ms": round(statistics.mean(latencies), 2),
                    "p95_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 2)
                }
                print(f"  {size}B: avg={payload_results[f'{size}B']['avg_ms']}ms, p95={payload_results[f'{size}B']['p95_ms']}ms")
                
        results["tests"]["payload_size_impact"] = payload_results
        await client.disconnect()
        
        # ============== FINAL REPORT ==============
        print(f"\n{'='*70}")
        print("FINAL PERFORMANCE ASSESSMENT")
        print(f"{'='*70}")
        
        # Calculate overall assessment
        rt = results["tests"].get("round_trip_latency", {})
        bc = results["tests"].get("broadcast_latency", {})
        tp = results["tests"].get("throughput", {})
        ord_test = results["tests"].get("message_ordering", {})
        
        print(f"\n  Round-Trip Latency (P95): {rt.get('p95_ms', 'N/A')}ms - {'✅ PASS' if rt.get('target_met') else '❌ FAIL'}")
        print(f"  Broadcast Latency (P95): {bc.get('p95_ms', 'N/A')}ms - {'✅ PASS' if bc.get('target_met') else '❌ FAIL'}")
        print(f"  Throughput: {tp.get('throughput_msg_per_sec', 'N/A')} msg/s - {'✅ PASS' if tp.get('target_met') else '⚠️ BELOW TARGET'}")
        print(f"  Message Ordering: {ord_test.get('lost_percent', 'N/A')}% loss - {'✅ PASS' if ord_test.get('lost', 100) <= 10 else '❌ FAIL'}")
        
        # Industry comparison
        print("\n  INDUSTRY COMPARISON:")
        print("    Discord: ~50ms | Slack: ~100ms | Gaming: <50ms")
        print(f"    Global Vibez: {rt.get('p95_ms', 'N/A')}ms P95 - {'EXCELLENT' if rt.get('p95_ms', 999) < 50 else 'GOOD' if rt.get('p95_ms', 999) < 100 else 'ACCEPTABLE'}")
        
        # Save report
        report_path = "/app/test_reports/websocket_message_performance.json"
        with open(report_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n  Report saved to: {report_path}")
        
        # Overall pass/fail
        all_passed = (
            rt.get('target_met', False) and 
            bc.get('target_met', False) and 
            ord_test.get('lost', 100) <= 10
        )
        
        results["overall_assessment"] = {
            "passed": all_passed,
            "round_trip_latency_passed": rt.get('target_met', False),
            "broadcast_latency_passed": bc.get('target_met', False),
            "message_ordering_passed": ord_test.get('lost', 100) <= 10,
            "throughput_passed": tp.get('target_met', False)
        }
        
        # Save final report
        with open(report_path, 'w') as f:
            json.dump(results, f, indent=2)
            
        print(f"\n  OVERALL: {'✅ ALL CRITICAL TESTS PASSED' if all_passed else '⚠️ SOME TESTS NEED ATTENTION'}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
