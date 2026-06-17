"""
Master Integrity Sentinel
Circuit Breaker & Auto-Healing System for Global Vibez

Prevents cascading failures by isolating broken modules
and automatically triggering recovery procedures.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ModuleStatus(str, Enum):
    """Module health states"""
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    QUARANTINED = "QUARANTINED"
    RECOVERING = "RECOVERING"


class CircuitBreakerState(str, Enum):
    """Circuit breaker states"""
    CLOSED = "CLOSED"  # Normal operation
    OPEN = "OPEN"  # Too many failures, blocking requests
    HALF_OPEN = "HALF_OPEN"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker for individual modules
    Opens after threshold failures, preventing cascade
    """
    def __init__(self, module_name: str, failure_threshold: int = 5, timeout_seconds: int = 60):
        self.module_name = module_name
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.failure_count = 0
        self.state = CircuitBreakerState.CLOSED
        self.last_failure_time = None
        self.state_changed_at = datetime.now(timezone.utc)

    def record_success(self):
        """Record successful operation"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            logger.info(f"✅ {self.module_name}: Circuit breaker CLOSING (service recovered)")
            self.state = CircuitBreakerState.CLOSED
            self.failure_count = 0
        elif self.state == CircuitBreakerState.CLOSED:
            self.failure_count = max(0, self.failure_count - 1)

    def record_failure(self):
        """Record failed operation"""
        self.failure_count += 1
        self.last_failure_time = datetime.now(timezone.utc)

        if self.failure_count >= self.failure_threshold and self.state == CircuitBreakerState.CLOSED:
            logger.error(f"🔴 {self.module_name}: Circuit breaker OPENING (too many failures: {self.failure_count})")
            self.state = CircuitBreakerState.OPEN
            self.state_changed_at = datetime.now(timezone.utc)
            return True  # Trigger quarantine
        
        return False

    def should_allow_request(self) -> bool:
        """Check if requests should be allowed"""
        if self.state == CircuitBreakerState.CLOSED:
            return True
        
        if self.state == CircuitBreakerState.OPEN:
            # Check if timeout elapsed
            time_since_open = (datetime.now(timezone.utc) - self.state_changed_at).total_seconds()
            if time_since_open >= self.timeout_seconds:
                logger.info(f"🟡 {self.module_name}: Circuit breaker entering HALF_OPEN (testing recovery)")
                self.state = CircuitBreakerState.HALF_OPEN
                return True
            return False
        
        # HALF_OPEN: allow limited requests to test recovery
        return True

    def get_status(self) -> Dict:
        """Get current breaker status"""
        return {
            "module": self.module_name,
            "state": self.state,
            "failure_count": self.failure_count,
            "threshold": self.failure_threshold,
            "last_failure": self.last_failure_time.isoformat() if self.last_failure_time else None
        }


class MasterIntegrity:
    """
    The Digital Bouncer - System-wide health monitoring and auto-healing
    
    Prevents circular dependencies, isolates failing modules,
    and triggers automatic recovery procedures.
    """
    def __init__(self):
        self.launch_time = datetime.now(timezone.utc)
        self.modules: Dict[str, Dict] = {
            "Admin_Auth": {
                "status": ModuleStatus.HEALTHY,
                "isolation_level": 10,  # Critical - highest isolation
                "circuit_breaker": CircuitBreaker("Admin_Auth", failure_threshold=3)
            },
            "Casino_Core": {
                "status": ModuleStatus.HEALTHY,
                "isolation_level": 8,
                "circuit_breaker": CircuitBreaker("Casino_Core", failure_threshold=5)
            },
            "Payment_Gateway": {
                "status": ModuleStatus.HEALTHY,
                "isolation_level": 10,
                "circuit_breaker": CircuitBreaker("Payment_Gateway", failure_threshold=2)
            },
            "Game_Engine": {
                "status": ModuleStatus.HEALTHY,
                "isolation_level": 7,
                "circuit_breaker": CircuitBreaker("Game_Engine", failure_threshold=10)
            },
            "MyVibez_Stream": {
                "status": ModuleStatus.HEALTHY,
                "isolation_level": 5,
                "circuit_breaker": CircuitBreaker("MyVibez_Stream", failure_threshold=15)
            },
            "Database_Layer": {
                "status": ModuleStatus.HEALTHY,
                "isolation_level": 10,
                "circuit_breaker": CircuitBreaker("Database_Layer", failure_threshold=3)
            }
        }
        self.error_logs: List[Dict] = []
        self.recovery_actions: List[Dict] = []

    def check_module_health(self, module_name: str) -> tuple[bool, str]:
        """
        Pre-flight check before allowing module to process requests
        """
        if module_name not in self.modules:
            logger.warning(f"⚠️ Unknown module: {module_name}")
            return False, "UNKNOWN_MODULE"
        
        module = self.modules[module_name]
        
        # Check circuit breaker
        if not module["circuit_breaker"].should_allow_request():
            logger.warning(f"🚫 {module_name}: Circuit breaker OPEN - blocking request")
            return False, "CIRCUIT_BREAKER_OPEN"
        
        # Check module status
        if module["status"] == ModuleStatus.QUARANTINED:
            logger.warning(f"🚫 {module_name}: Module QUARANTINED - blocking request")
            return False, "MODULE_QUARANTINED"
        
        return True, "READY"

    def record_module_success(self, module_name: str):
        """Record successful operation"""
        if module_name in self.modules:
            self.modules[module_name]["circuit_breaker"].record_success()
            
            # If module was degraded, consider upgrading status
            if self.modules[module_name]["status"] == ModuleStatus.DEGRADED:
                self.modules[module_name]["status"] = ModuleStatus.HEALTHY
                logger.info(f"✅ {module_name}: Status upgraded to HEALTHY")

    def record_module_failure(self, module_name: str, error_detail: str):
        """
        Record module failure and trigger auto-healing if needed
        """
        if module_name not in self.modules:
            logger.error(f"Cannot record failure for unknown module: {module_name}")
            return
        
        module = self.modules[module_name]
        
        # Log the error
        error_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "module": module_name,
            "error": error_detail,
            "isolation_level": module["isolation_level"]
        }
        self.error_logs.append(error_entry)
        
        # Record in circuit breaker
        should_quarantine = module["circuit_breaker"].record_failure()
        
        if should_quarantine:
            self._quarantine_module(module_name, error_detail)

    def _quarantine_module(self, module_name: str, reason: str):
        """
        Isolate failing module to prevent cascade failures
        """
        logger.error(f"🔴 QUARANTINING {module_name}: {reason}")
        
        module = self.modules[module_name]
        module["status"] = ModuleStatus.QUARANTINED
        
        # Trigger auto-repair
        recovery_action = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "module": module_name,
            "action": "QUARANTINE_AND_RESET",
            "reason": reason,
            "status": "INITIATED"
        }
        self.recovery_actions.append(recovery_action)
        
        # Log to system
        logger.info(f"🔧 Auto-repair initiated for {module_name}")
        
        # In production, this would trigger:
        # - Service restart
        # - Cache flush
        # - Database connection pool reset
        # - Rollback to last stable version

    def trigger_manual_recovery(self, module_name: str) -> Dict:
        """
        God-Mode manual recovery trigger
        """
        if module_name not in self.modules:
            return {"error": "Unknown module"}
        
        logger.info(f"🔧 Manual recovery triggered for {module_name}")
        
        module = self.modules[module_name]
        module["status"] = ModuleStatus.RECOVERING
        module["circuit_breaker"].failure_count = 0
        module["circuit_breaker"].state = CircuitBreakerState.HALF_OPEN
        
        return {
            "module": module_name,
            "action": "Manual recovery initiated",
            "new_status": ModuleStatus.RECOVERING
        }

    def generate_full_report(self) -> Dict:
        """
        Generate comprehensive system health report
        """
        uptime = (datetime.now(timezone.utc) - self.launch_time).total_seconds()
        
        module_statuses = {}
        for name, data in self.modules.items():
            module_statuses[name] = {
                "status": data["status"],
                "isolation_level": data["isolation_level"],
                "circuit_breaker": data["circuit_breaker"].get_status()
            }
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": uptime,
            "modules": module_statuses,
            "total_errors": len(self.error_logs),
            "recent_errors": self.error_logs[-10:],  # Last 10 errors
            "recovery_actions": self.recovery_actions[-5:],  # Last 5 recoveries
            "system_health": self._calculate_overall_health()
        }

    def _calculate_overall_health(self) -> str:
        """Calculate overall system health"""
        quarantined = sum(1 for m in self.modules.values() if m["status"] == ModuleStatus.QUARANTINED)
        degraded = sum(1 for m in self.modules.values() if m["status"] == ModuleStatus.DEGRADED)
        
        if quarantined > 0:
            return "CRITICAL"
        elif degraded > 1:
            return "DEGRADED"
        elif degraded == 1:
            return "WARNING"
        else:
            return "OPTIMAL"

    def generate_fix_recommendations(self) -> List[str]:
        """
        Generate actionable fix recommendations based on error patterns
        """
        recommendations = []
        
        # Analyze recent errors
        recent_errors = self.error_logs[-20:] if len(self.error_logs) >= 20 else self.error_logs
        
        error_counts = {}
        for error in recent_errors:
            module = error["module"]
            error_counts[module] = error_counts.get(module, 0) + 1
        
        for module, count in error_counts.items():
            if count >= 5:
                recommendations.append(
                    f"FIX: {module} has {count} recent errors - investigate and apply hotfix"
                )
            
            if module == "Casino_Core" and count >= 3:
                recommendations.append(
                    "FIX: Reduce texture sampling on game graphics to save RAM"
                )
            elif module == "Admin_Auth" and count >= 2:
                recommendations.append(
                    "FIX: Increase session timeout to prevent premature 401 errors"
                )
            elif module == "Database_Layer" and count >= 2:
                recommendations.append(
                    "FIX: Check MongoDB connection pool settings and increase max connections"
                )
        
        return recommendations if recommendations else ["All systems operating normally"]


# Global singleton instance
Sentinel = MasterIntegrity()
