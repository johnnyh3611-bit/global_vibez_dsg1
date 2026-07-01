# Load Testing & System Health Monitoring - Complete Guide

## 🎯 Overview

Global Vibez now has enterprise-grade load testing and health monitoring infrastructure with:
1. **Locust Load Testing** - Simulate 10k concurrent users
2. **Master Integrity Sentinel** - Circuit breakers & auto-healing
3. **God-Mode Health Monitor UI** - Real-time system health dashboard
4. **Auto-Repair System** - Automatic failure isolation & recovery

---

## 📦 What Was Built

### 1. Locust Load Testing Suite (`/app/backend/tests/locustfile.py`)

**Features:**
- Simulates realistic user behavior across the platform
- Tests auth flows, game interactions, admin operations
- Two user classes:
  * `GlobalVibezAuditor` - Normal users (browsing, playing, checking balance)
  * `AdminStressTest` - Admin operations (dashboard, treasury, audit logs)
  
**Task Distribution:**
- Browse games: 10x weight (most common)
- Check balance: 5x weight
- Play games: 3x weight
- Admin checks: 2x weight
- Streaming health: 1x weight

**Auto-Reporting:**
- Tracks critical failures
- Logs slow requests (>2 seconds)
- Generates comprehensive test summary

### 2. Master Integrity Sentinel (`/app/backend/utils/master_integrity.py`)

**Circuit Breaker System:**
- **CLOSED**: Normal operation
- **OPEN**: Too many failures, blocking requests
- **HALF_OPEN**: Testing if service recovered

**Module Health States:**
- **HEALTHY**: Operating normally
- **DEGRADED**: Experiencing issues
- **QUARANTINED**: Isolated from system
- **RECOVERING**: Manual recovery in progress

**Monitored Modules:**
1. **Admin_Auth** (Isolation Level: 10) - Failure Threshold: 3
2. **Casino_Core** (Isolation Level: 8) - Failure Threshold: 5
3. **Payment_Gateway** (Isolation Level: 10) - Failure Threshold: 2
4. **Game_Engine** (Isolation Level: 7) - Failure Threshold: 10
5. **MyVibez_Stream** (Isolation Level: 5) - Failure Threshold: 15
6. **Database_Layer** (Isolation Level: 10) - Failure Threshold: 3

**Auto-Healing:**
- Automatic module quarantine on threshold breach
- Circuit breaker state management
- Error logging and recovery action tracking
- AI-powered fix recommendations

### 3. God-Mode Monitoring API (`/app/backend/routes/god_mode_monitor.py`)

**Endpoints:**

**PUBLIC:**
- `GET /api/god-mode/system-health` - Basic health check

**ADMIN-ONLY (require God-Mode permissions):**
- `GET /api/god-mode/full-audit-report` - Complete system status
- `GET /api/god-mode/module-status/{module_name}` - Specific module health
- `POST /api/god-mode/repair` - Manual module recovery
- `GET /api/god-mode/error-logs?limit=50` - Recent error logs
- `GET /api/god-mode/recovery-history?limit=20` - Auto-repair history
- `GET /api/god-mode/recommendations` - AI fix suggestions
- `POST /api/god-mode/simulate-failure/{module_name}` - Testing endpoint

### 4. System Health Monitor UI (`/app/frontend/src/components/admin/SystemHealthMonitor.jsx`)

**Features:**
- Real-time health monitoring (auto-refresh every 10 seconds)
- System overview dashboard (health, uptime, errors, modules)
- Module integrity grid with circuit breaker status
- One-click manual repair for degraded modules
- AI-powered fix recommendations
- Recent error log viewer
- Live updates with timestamp

**Integrated into GodModeDashboard:**
- New 11th tab: "🔥 LIVE System Health"
- Accessible via Heart Logo → /vibe-vault-admin

---

## 🚀 How to Use

### Running Load Tests

**1. Basic Load Test (100 users):**
```bash
cd /app/backend/tests
locust -f locustfile.py --headless -u 100 -r 10 --run-time 5m --host=http://localhost:8001
```

**2. Stress Test (1000 users):**
```bash
locust -f locustfile.py --headless -u 1000 -r 50 --run-time 10m --host=http://localhost:8001
```

**3. 10k Bot Swarm (Maximum Load):**
```bash
locust -f locustfile.py --headless -u 10000 -r 100 --run-time 15m --html report.html --host=http://localhost:8001
```

**4. Interactive Web UI:**
```bash
locust -f locustfile.py --host=http://localhost:8001
# Then open http://localhost:8089 in your browser
```

**Parameters:**
- `-u` = Number of users
- `-r` = Spawn rate (users per second)
- `--run-time` = Test duration
- `--html` = Generate HTML report
- `--headless` = Run without web UI

### Monitoring System Health

**1. Via God-Mode Dashboard:**
1. Login to the platform
2. Click the Heart Logo on landing page
3. Navigate to "System Health" tab (11th tab)
4. Monitor real-time health metrics

**2. Via API (curl):**
```bash
# Public health check
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -s "$API_URL/api/god-mode/system-health" | python3 -m json.tool

# Full audit report (requires admin cookie)
curl -s "$API_URL/api/god-mode/full-audit-report" --cookie "session_token=YOUR_TOKEN" | python3 -m json.tool
```

### Triggering Manual Repairs

**1. Via UI:**
- Navigate to System Health tab
- Find degraded/quarantined module
- Click "🔧 FORCE REPAIR" button
- Confirm action

**2. Via API:**
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

curl -X POST "$API_URL/api/god-mode/repair" \
  -H "Content-Type: application/json" \
  --cookie "session_token=YOUR_TOKEN" \
  -d '{"module_name": "Casino_Core", "admin_note": "Manual recovery test"}'
```

### Simulating Failures (Testing)

```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

curl -X POST "$API_URL/api/god-mode/simulate-failure/Game_Engine?error_detail=Test%20failure" \
  --cookie "session_token=YOUR_TOKEN"
```

---

## 📊 Understanding the Data

### Circuit Breaker States

**CLOSED (Green)**
- Normal operation
- Requests flowing normally
- Failure count below threshold

**OPEN (Red)**
- Too many failures detected
- Blocking all requests to prevent cascade
- Waiting for timeout period

**HALF_OPEN (Yellow)**
- Timeout elapsed, testing recovery
- Allowing limited requests
- Will close on success or reopen on failure

### Health Status Levels

**OPTIMAL (Green)** - All systems healthy
**WARNING (Yellow)** - 1 module degraded
**DEGRADED (Orange)** - 2+ modules degraded
**CRITICAL (Red)** - 1+ modules quarantined

### Module Isolation Levels

Higher isolation = more critical to platform:
- **10** = Mission-critical (Admin_Auth, Payment, Database)
- **8** = Core functionality (Casino_Core)
- **7** = Important features (Game_Engine)
- **5** = Nice-to-have (Streaming)

---

## 🔧 Integration with Existing Code

### In Your Backend Code:

```python
from utils.master_integrity import Sentinel

# Before processing critical operation
is_healthy, message = Sentinel.check_module_health("Casino_Core")
if not is_healthy:
    raise HTTPException(status_code=503, detail=f"Service unavailable: {message}")

try:
    # Your critical operation
    result = process_game_logic()
    
    # Record success
    Sentinel.record_module_success("Casino_Core")
    return result
    
except Exception as e:
    # Record failure
    Sentinel.record_module_failure("Casino_Core", str(e))
    raise
```

### Testing New Endpoints with Locust:

Add to `locustfile.py`:
```python
@task(5)
def test_new_feature(self):
    """Test your new feature"""
    with self.client.post("/api/your-new-endpoint", 
                         json={"data": "test"},
                         catch_response=True) as response:
        if response.status_code == 200:
            response.success()
        else:
            response.failure(f"Feature failed: {response.status_code}")
```

---

## 🎯 Best Practices

### Load Testing:
1. **Start Small**: Begin with 100 users, gradually increase
2. **Monitor Resources**: Watch CPU, memory, and database connections
3. **Test Realistic Scenarios**: Match actual user behavior patterns
4. **Generate Reports**: Always save HTML reports for analysis
5. **Test Different Times**: Load patterns vary by time of day

### Health Monitoring:
1. **Auto-Refresh**: Keep enabled during active operations
2. **Check Recommendations**: Review AI suggestions regularly
3. **Manual Repairs**: Only use when auto-healing fails
4. **Error Logs**: Investigate patterns, not individual errors
5. **Circuit Breakers**: Let them do their job - don't force close

### Production Deployment:
1. **Adjust Thresholds**: Tune failure thresholds based on your traffic
2. **Add Custom Modules**: Register your specific services
3. **Configure Alerts**: Hook up to Slack/Email for critical failures
4. **Regular Testing**: Run load tests weekly to catch regressions
5. **Review Logs**: Check God-Mode dashboard daily

---

## 📈 Sample Load Test Results

Expected performance benchmarks:
- **100 users**: <100ms average response time
- **1000 users**: <500ms average response time
- **10000 users**: <2000ms average response time

Failure rate should be <1% under normal load.

---

## 🔐 Security Notes

- God-Mode endpoints require admin authentication (`require_god_mode`)
- Load testing should be done in staging/test environments
- Manual repairs are logged in audit trail
- Simulated failures should only be used in testing

---

## 📁 Files Created

**Backend:**
- `/app/backend/tests/locustfile.py` (305 lines)
- `/app/backend/utils/master_integrity.py` (353 lines)
- `/app/backend/routes/god_mode_monitor.py` (165 lines)

**Frontend:**
- `/app/frontend/src/components/admin/SystemHealthMonitor.jsx` (343 lines)

**Integration:**
- `/app/backend/server.py` - Added god_mode_monitor_router
- `/app/frontend/src/pages/admin/GodModeDashboard.jsx` - Added System Health tab

---

## ✅ Verification

Test the setup:
```bash
# 1. Backend health check
curl http://localhost:8001/api/god-mode/system-health

# 2. Run quick load test
cd /app/backend/tests && locust -f locustfile.py --headless -u 10 -r 2 --run-time 30s --host=http://localhost:8001

# 3. Check UI (via browser)
# Login → Heart Logo → System Health tab
```

All systems should report OPTIMAL status! 🎉
