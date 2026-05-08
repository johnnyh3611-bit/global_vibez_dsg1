#!/bin/bash

# Automated System Health Check Runner
# Runs health checks and reports status

set -e

echo "========================================="
echo "Global Vibez DSG - System Health Check"
echo "========================================="
echo ""

# Get backend URL
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

echo "🔍 Running health checks..."
echo ""

# Test 1: Basic Health
echo "1️⃣  Basic Health Check"
HEALTH_STATUS=$(curl -s "$API_URL/api/health" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")
if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo "   ✅ Status: $HEALTH_STATUS"
else
    echo "   ❌ Status: $HEALTH_STATUS"
    exit 1
fi
echo ""

# Test 2: System Status
echo "2️⃣  Comprehensive System Status"
SYSTEM_REPORT=$(curl -s "$API_URL/api/system-status")
OVERALL_HEALTH=$(echo "$SYSTEM_REPORT" | python3 -c "import sys,json;print(json.load(sys.stdin)['overall_health'])")
RESPONSE_TIME=$(echo "$SYSTEM_REPORT" | python3 -c "import sys,json;print(json.load(sys.stdin)['response_time_ms'])")

if [ "$OVERALL_HEALTH" = "GOOD" ]; then
    echo "   ✅ Overall Health: $OVERALL_HEALTH"
elif [ "$OVERALL_HEALTH" = "DEGRADED" ]; then
    echo "   ⚠️  Overall Health: $OVERALL_HEALTH"
else
    echo "   ❌ Overall Health: $OVERALL_HEALTH"
    exit 1
fi
echo "   ⏱️  Response Time: ${RESPONSE_TIME}ms"
echo ""

# Test 3: Database
echo "3️⃣  Database Health"
DB_STATUS=$(echo "$SYSTEM_REPORT" | python3 -c "import sys,json;data=json.load(sys.stdin);print(data['services']['database']['status'])")
DB_LATENCY=$(echo "$SYSTEM_REPORT" | python3 -c "import sys,json;data=json.load(sys.stdin);print(data['services']['database']['latency_ms'])")

if [ "$DB_STATUS" = "online" ]; then
    echo "   ✅ MongoDB: $DB_STATUS (${DB_LATENCY}ms)"
else
    echo "   ❌ MongoDB: $DB_STATUS"
    exit 1
fi
echo ""

# Test 4: Game Services
echo "4️⃣  Game Services Health"
GAMES_STATUS=$(echo "$SYSTEM_REPORT" | python3 -c "import sys,json;data=json.load(sys.stdin);print(data['services']['game_services']['status'])")

if [ "$GAMES_STATUS" = "online" ]; then
    echo "   ✅ Game Services: $GAMES_STATUS"
    
    # Vibez 654 details
    VIBEZ_SESSIONS=$(echo "$SYSTEM_REPORT" | python3 -c "import sys,json;data=json.load(sys.stdin);print(data['services']['game_services']['vibez_654']['total_sessions'])")
    VIBEZ_STAND=$(echo "$SYSTEM_REPORT" | python3 -c "import sys,json;data=json.load(sys.stdin);print(data['services']['game_services']['vibez_654']['stand_mechanic'])")
    
    echo "   📊 Vibez 654:"
    echo "      - Total Sessions: $VIBEZ_SESSIONS"
    echo "      - Stand Mechanic: $VIBEZ_STAND"
else
    echo "   ❌ Game Services: $GAMES_STATUS"
    exit 1
fi
echo ""

# Test 5: Frontend
echo "5️⃣  Frontend Health"
FRONTEND_STATUS=$(curl -s "$API_URL/api/health/frontend" | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])")

if [ "$FRONTEND_STATUS" = "online" ]; then
    echo "   ✅ React Frontend: $FRONTEND_STATUS"
else
    echo "   ⚠️  React Frontend: $FRONTEND_STATUS"
fi
echo ""

echo "========================================="
echo "✅ All Critical Systems Operational"
echo "========================================="
echo ""
echo "📋 Full Report: $API_URL/api/system-status"
echo ""

exit 0
