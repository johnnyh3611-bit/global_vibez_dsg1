# 🔒 LOCKED SPEC — GISA (Global Integrity & Stress Agent) Pre-Beta Blueprint

**Source PDFs**:
- `GISA_System_Audit_Blueprint.pdf` — uploaded 2026-02-16 (pre-beta blueprint)
- `GISA_Master_System_Audit_Final.pdf` — uploaded 2026-02-16 (v1.0 LOCKED master)

**Status**: 🟢 LOCKED. Do NOT lose, downgrade, or alter without explicit founder instruction.
**Last reaffirmed**: 2026-02-16

> ⚠ This file is the canonical engineering source-of-truth for GISA.
> Future agents: read this BEFORE editing anything in
> `services/gisa_agent.py`, `routes/gisa_routes.py`, or `gisa_agent.py` (CLI).

---

## 🎯 Mission

GISA is a **Blind Auditor** middleware agent that pressure-tests Global Vibez DSG
across 4 health vectors PRE-BETA, so we ship a stable beta to real users.

| Vector | What it Audits |
|---|---|
| **Concurrency** | Up to 1,000,000 simulated socket connections |
| **Isolation** | Zero cross-talk between Hungry Vibes / VibeRidez / Gaming / Dating / Private Rooms |
| **Transaction Velocity** | Solana TPS saturation on the DSG token gateway |
| **Visual Parity** | All 31 game rooms match the **"5654 Vibe"** gold standard (UE5.5) |

---

## 🧱 Architecture (decoupled middleware)

```
┌──────────────────┐     simulated traffic     ┌─────────────────┐
│  GISA Agent CLI  ├──────────────────────────▶│  FastAPI / WS   │
│ gisa_agent.py    │                           │  + Solana GW    │
└────────┬─────────┘                           └─────────────────┘
         │ MongoDB schema crawl
         ▼
   /reports/system_health.json
```

The agent talks to the SAME endpoints a real user would, plus a special
`Audit-Mode: True` HTTP header so backend logs can flag the simulated
traffic for debugging.

---

## 🐍 Canonical Locust Class (LOCKED)

```python
import locust
from locust import task, between

class GlobalVibezAuditor(locust.HttpUser):
    wait_time = locust.between(0.1, 0.5)

    @locust.task(5)
    def test_game_sockets(self):
        self.client.get(
            "/ws/gaming/vibe-check",
            headers={"Audit-Mode": "True"},
        )

    @locust.task(2)
    def test_transaction_throughput(self):
        # Stress the Solana Gateway for DSG Tokens.
        # Watches for latency spikes and double-entry failures.
        self.client.post(
            "/api/v1/ledger/validate",
            json={"sim_volume": 10000},
        )

    @locust.task(1)
    def test_cross_service_leak(self):
        # Check if HungryVibes data is accessible via VibeRidez endpoint.
        response = self.client.get("/api/v1/logistics/integrity-ping")
        if "leaked_data" in response.text:
            print("CRITICAL: Cross-service intertwining detected.")
```

`StressAgent` (master-audit variant) — same idea, faster cadence:

```python
class StressAgent(locust.HttpUser):
    wait_time = locust.between(0.01, 0.05)

    @locust.task
    def simulate_betting_load(self):
        self.client.post("/api/v1/gaming/bet",
                         json={"user_id": "sim_bot", "amount": 100})

    @locust.task
    def simulate_delivery_ping(self):
        self.client.get("/api/v1/logistics/status")
```

---

## 🧪 Module Audit Matrix (LOCKED)

| Module | Logic Check | Visual Check |
|---|---|---|
| **31 Game Rooms** | Physics collision & result sync | Ray-tracing & texture parity (5654 Vibe) |
| **VibeRidez / Hungry Vibes** | GPS coordinate isolation | UI responsiveness under load |
| **Blockchain Gateway (Solana)** | TPS saturation, double-entry detection | Transaction confirmation speed |
| **Private Rooms** | End-to-end data silo check | N/A (performance-focused) |

### Logic Isolation pseudocode

```python
def run_integrity_check(database_connection):
    # Crawls MongoDB schemas for cross-service data leaks
    services = ['gaming', 'logistics', 'dating', 'private_rooms']
    for service in services:
        leak_found = database_connection.check_isolation(service)
        if leak_found:
            print(f"CRITICAL: Data leak detected in {service} module.")
```

### Visual & "Vibe" Parity Engine

- Gold standard: **"5654 Vibe"**
- Engine: **Unreal Engine 5.5**
- Specific checks:
  - **Ray-Tracing** depth (Celestial Glasshouse most demanding)
  - **Texture Parity** on dice + card assets (high-fidelity realism)
  - **Human Features** — AI Dealer animations must be smooth, non-robotic

---

## 📝 CLI Usage Protocol (LOCKED)

```bash
python gisa_agent.py --mode full_audit --users 1000000
```

Output: `/reports/system_health.json` (structured JSON, parseable).

Modes:
- `full_audit` — runs all 4 vectors
- `stress` — concurrency + transaction velocity only
- `isolation` — MongoDB schema crawl only
- `visual` — visual parity engine only

---

## 🚨 Disaster Recovery Protocols

If the system breaks under simulation (memory leak, socket drop, TPS collapse):
1. GISA dumps a **Heatmap Report** to `/reports/system_health.json`.
2. Heatmap pinpoints the **exact line of FastAPI code** OR the
   **specific UE5 asset** responsible for the bottleneck.
3. Engineers fix root cause → re-run with `--mode full_audit`.

---

## ✅ Pass / Fail Thresholds (canonical, locked)

| Metric | Pass | Warn | Fail |
|---|---|---|---|
| WebSocket p95 latency | < 100ms | 100–500ms | > 500ms |
| Solana TPS sustained | ≥ 1500 | 800–1500 | < 800 |
| Cross-service leaks | 0 | n/a | ≥ 1 |
| 5654 Vibe parity score | ≥ 95% | 85–94% | < 85% |
| AI Dealer animation smoothness | ≥ 90% | 75–89% | < 75% |

---

## 🔁 CI/CD Integration

GISA must be runnable as part of CI/CD pre-deploy gates. Future work:
1. GitHub Actions workflow that runs `--mode isolation` on every PR.
2. Nightly `--mode full_audit --users 100000` smoke run.
3. Weekly `--users 1000000` full beta-readiness audit.

---

## 📜 Version Log

- **v1.0** (2026-02-16) — initial blueprint + master audit specs locked.
