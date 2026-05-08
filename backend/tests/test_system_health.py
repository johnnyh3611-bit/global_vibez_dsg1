"""
Automated Health Check Tests
Tests all system health endpoints and validates service status
"""
import pytest
import httpx
import asyncio

# Backend URL from environment
BACKEND_URL = "http://localhost:8001"

@pytest.mark.asyncio
async def test_basic_health_check():
    """Test basic health endpoint (for load balancers)"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/api/health", timeout=10.0)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print("✅ Basic health check passed")

@pytest.mark.asyncio
async def test_system_status_report():
    """Test comprehensive system status endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/api/system-status", timeout=15.0)
        assert response.status_code == 200
        data = response.json()
        
        # Verify report structure
        assert "timestamp" in data
        assert "overall_health" in data
        assert "services" in data
        assert "response_time_ms" in data
        
        # Verify all services are present
        services = data["services"]
        assert "database" in services
        assert "auth_service" in services
        assert "wallet_stripe" in services
        assert "game_services" in services
        assert "ai_services" in services
        
        # Check database status
        db_status = services["database"]["status"]
        assert db_status in ["online", "offline", "degraded"]
        
        print(f"✅ System status: {data['overall_health']}")
        print(f"✅ Response time: {data['response_time_ms']}ms")
        return data

@pytest.mark.asyncio
async def test_database_health():
    """Test detailed database health endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/api/health/database", timeout=10.0)
        assert response.status_code == 200
        data = response.json()
        
        if data["status"] == "online":
            assert "latency_ms" in data
            assert "collections" in data
            assert data["latency_ms"] < 100  # Should be fast
            print(f"✅ Database health: {data['status']} ({data['latency_ms']}ms)")
        else:
            print(f"⚠️  Database status: {data['status']}")

@pytest.mark.asyncio
async def test_game_services_health():
    """Test game services health endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/api/health/games", timeout=10.0)
        assert response.status_code == 200
        data = response.json()
        
        if data["status"] == "online":
            assert "vibez_654" in data
            assert "blackjack" in data
            assert "slots" in data
            assert "roulette" in data
            
            vibez_654 = data["vibez_654"]
            assert "stand_mechanic" in vibez_654
            assert vibez_654["stand_mechanic"] == "active"
            
            print(f"✅ Game services: {data['status']}")
            print(f"   Vibez 654 sessions: {vibez_654['total_sessions']}")
        else:
            print(f"⚠️  Game services status: {data['status']}")

@pytest.mark.asyncio
async def test_frontend_health():
    """Test frontend accessibility"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/api/health/frontend", timeout=10.0)
        assert response.status_code == 200
        data = response.json()
        
        print(f"✅ Frontend status: {data['status']}")
        if data["status"] == "online":
            assert data["build"] == "react-18"

@pytest.mark.asyncio
async def test_overall_system_integrity():
    """End-to-end system integrity test"""
    async with httpx.AsyncClient() as client:
        # Get full system report
        response = await client.get(f"{BACKEND_URL}/api/system-status", timeout=15.0)
        assert response.status_code == 200
        data = response.json()
        
        # Critical services must be online
        critical_services = ["database", "auth_service", "game_services"]
        for service_name in critical_services:
            service = data["services"][service_name]
            status = service.get("status", "unknown")
            
            if status == "offline":
                pytest.fail(f"❌ CRITICAL: {service_name} is offline!")
            elif status == "degraded":
                print(f"⚠️  WARNING: {service_name} is degraded")
            else:
                print(f"✅ {service_name}: {status}")
        
        # Overall health should not be CRITICAL
        overall = data["overall_health"]
        if overall == "CRITICAL":
            print("❌ System overall health is CRITICAL")
            print(f"Services status: {data['services']}")
            pytest.fail("System health is CRITICAL")
        else:
            print(f"✅ Overall system health: {overall}")

if __name__ == "__main__":
    # Run tests manually
    asyncio.run(test_basic_health_check())
    asyncio.run(test_system_status_report())
    asyncio.run(test_database_health())
    asyncio.run(test_game_services_health())
    asyncio.run(test_frontend_health())
    asyncio.run(test_overall_system_integrity())
