"""
Shared fixtures for the API-contract suite.

Goal: lightweight, fast endpoint-level checks against the running backend
(via REACT_APP_BACKEND_URL). Each test asserts both HTTP status AND the
response-shape contract, so silent schema drift trips a fail.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import pytest


def _read_env_from_files() -> Dict[str, str]:
    """Best-effort: pick up .env values when running outside supervisor."""
    out: Dict[str, str] = {}
    for env_path in ("/app/frontend/.env", "/app/backend/.env"):
        p = Path(env_path)
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            out.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return out


_FILE_ENV = _read_env_from_files()


def _env(name: str) -> Optional[str]:
    return os.environ.get(name) or _FILE_ENV.get(name) or None


@pytest.fixture(scope="session")
def base_url() -> str:
    url = _env("REACT_APP_BACKEND_URL")
    if not url:
        pytest.skip("REACT_APP_BACKEND_URL not configured")
    return url.rstrip("/")


@pytest.fixture(scope="session")
def api(base_url: str) -> str:
    return f"{base_url}/api"


@pytest.fixture(scope="session")
def http() -> httpx.Client:
    """Synchronous httpx client with a sensible timeout. Reused per session."""
    with httpx.Client(timeout=15.0, follow_redirects=False) as client:
        yield client


@pytest.fixture(scope="session")
def admin_password() -> str:
    pw = _env("ADMIN_PASSWORD")
    if not pw:
        pytest.skip("ADMIN_PASSWORD not configured")
    return pw


@pytest.fixture(scope="session")
def admin_2fa() -> str:
    code = _env("ADMIN_2FA")
    if not code:
        pytest.skip("ADMIN_2FA not configured")
    return code


@pytest.fixture(scope="session")
def demo_session(http: httpx.Client, api: str) -> Dict[str, Any]:
    """Spin up a demo user once and reuse the bearer token for the suite."""
    r = http.post(f"{api}/auth/demo-login")
    assert r.status_code == 200, f"demo-login failed: {r.text}"
    data = r.json()
    assert {"user_id", "token"} <= data.keys(), f"demo-login schema drift: {data}"
    return data


@pytest.fixture(scope="session")
def auth_headers(demo_session: Dict[str, Any]) -> Dict[str, str]:
    return {"Authorization": f"Bearer {demo_session['token']}"}


@pytest.fixture(scope="session")
def admin_cookies(
    http: httpx.Client, api: str, admin_password: str, admin_2fa: str
) -> Dict[str, str]:
    """Logs in as God-Mode admin once and returns the admin_session cookie."""
    r = http.post(
        f"{api}/admin/vault-auth",
        json={"password": admin_password, "code": admin_2fa},
    )
    assert r.status_code == 200, f"admin vault-auth failed: {r.text}"
    cookies = {k: v for k, v in r.cookies.items()}
    if not cookies:
        pytest.skip("admin vault-auth returned no cookie — admin tests can't run")
    return cookies


# ---------------------------------------------------------------- helpers

def assert_keys(payload: Any, required: set, *, where: str) -> None:
    """Soft schema check — payload must be dict and contain ``required`` keys."""
    assert isinstance(payload, dict), f"{where}: expected dict, got {type(payload).__name__}"
    missing = required - payload.keys()
    assert not missing, f"{where}: missing keys {missing} (got {sorted(payload.keys())})"
