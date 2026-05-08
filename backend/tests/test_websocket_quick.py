"""
Quick WebSocket Test - Verify Socket.IO server works
Tests room creation, joining, and basic events
"""

import asyncio
import socketio

API_URL = "http://localhost:8001"

async def test_websocket():
    """Test WebSocket functionality"""
    
    print("🧪 Starting WebSocket Test\n")
    
    # Create two clients (simulate two players)
    client1 = socketio.AsyncClient()
    client2 = socketio.AsyncClient()
    
    test_results = []
    
    # Event handlers for client 1
    @client1.on('connect')
    def on_connect1():
        print("✅ Client 1 connected")
        test_results.append(("Client 1 Connect", True))
    
    @client1.on('room_created')
    def on_room_created(data):
        print(f"✅ Room created: {data['room_code']}")
        test_results.append(("Room Creation", True))
        global room_code
        room_code = data['room_code']
    
    @client1.on('player_joined')
    def on_player_joined1(data):
        print(f"✅ Client 1 sees player joined: {data['player']['username']}")
        test_results.append(("Player Join Event", True))
    
    @client1.on('game_started')
    def on_game_started1(data):
        print("✅ Client 1 sees game started")
        test_results.append(("Game Start", True))
    
    # Event handlers for client 2
    @client2.on('connect')
    def on_connect2():
        print("✅ Client 2 connected")
        test_results.append(("Client 2 Connect", True))
    
    @client2.on('room_joined')
    def on_room_joined(data):
        print(f"✅ Client 2 joined room: {data['room_code']}")
        test_results.append(("Room Join", True))
    
    @client2.on('player_joined')
    def on_player_joined2(data):
        print(f"✅ Client 2 sees player joined: {data['player']['username']}")
    
    @client2.on('game_started')
    def on_game_started2(data):
        print("✅ Client 2 sees game started")
    
    try:
        # Step 1: Connect both clients
        print("\n📡 Step 1: Connecting clients...")
        await client1.connect(API_URL)
        await asyncio.sleep(1)
        await client2.connect(API_URL)
        await asyncio.sleep(1)
        
        # Step 2: Client 1 creates room
        print("\n🎮 Step 2: Creating room...")
        room_code = None
        await client1.emit('create_room', {
            'game_type': 'poker',
            'max_players': 4,
            'is_private': False,
            'user_id': 'test_user_1',
            'username': 'TestPlayer1'
        })
        await asyncio.sleep(2)
        
        if not room_code:
            print("❌ Room code not received")
            test_results.append(("Room Creation", False))
            return
        
        # Step 3: Client 2 joins room
        print(f"\n👥 Step 3: Client 2 joining room {room_code}...")
        await client2.emit('join_room', {
            'room_code': room_code,
            'user_id': 'test_user_2',
            'username': 'TestPlayer2'
        })
        await asyncio.sleep(2)
        
        # Step 4: Both players mark ready
        print("\n✅ Step 4: Players marking ready...")
        await client1.emit('player_ready', {})
        await asyncio.sleep(1)
        await client2.emit('player_ready', {})
        await asyncio.sleep(2)
        
        # Step 5: Test chat
        print("\n💬 Step 5: Testing chat...")
        await client1.emit('send_chat_message', {'message': 'Hello from Player 1!'})
        await asyncio.sleep(1)
        
        # Step 6: Test move
        print("\n🎯 Step 6: Testing move...")
        await client1.emit('make_move', {
            'move_type': 'play_card',
            'move_data': {'card': 'AS'}
        })
        await asyncio.sleep(1)
        
        print("\n✅ All steps completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        test_results.append(("Test Execution", False))
    
    finally:
        # Cleanup
        print("\n🧹 Cleaning up...")
        await client1.disconnect()
        await client2.disconnect()
    
    # Print results
    print("\n" + "="*50)
    print("📊 TEST RESULTS")
    print("="*50)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print(f"Success Rate: {(passed/total*100):.1f}%\n")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(test_websocket())
    exit(0 if success else 1)
