"""Regression: every auth-flow fetch call MUST include `credentials: 'include'`.

Without that flag the browser silently drops cross-domain Set-Cookie headers,
which manifests as "login works on preview but breaks on the .com production
domain" — exactly the bug the founder reported on 2026-02-15.

This test reads the canonical auth-flow page files and asserts the literal
substring `credentials: 'include'` (or `credentials: "include"`) is present
in each fetch invocation. If a future agent adds a new auth endpoint and
forgets the flag, this test goes red BEFORE the change ships.

If you intentionally remove an auth fetch (e.g., consolidate two pages),
also remove its row from the AUTH_FLOW_FILES list below.
"""
from __future__ import annotations

import re
from pathlib import Path

# (file_path, regex pattern that must be matched to confirm credentials)
AUTH_FLOW_FILES = [
    "/app/frontend/src/pages/LoginPage.tsx",
    "/app/frontend/src/pages/SignupPage.tsx",
    "/app/frontend/src/pages/ForgotPasswordPage.tsx",
    "/app/frontend/src/pages/ResetPasswordPage.tsx",
]

# Matches: credentials: 'include'  OR  credentials: "include"
CREDENTIALS_RE = re.compile(r"credentials\s*:\s*['\"]include['\"]")


def test_every_auth_flow_file_uses_credentials_include() -> None:
    for fp in AUTH_FLOW_FILES:
        path = Path(fp)
        assert path.exists(), f"Auth-flow file vanished: {fp}"
        content = path.read_text()
        assert CREDENTIALS_RE.search(content), (
            f"{fp} contains an /api/auth/* fetch but is MISSING "
            f"`credentials: 'include'`. This silently breaks login on "
            f"the production .com custom domain (cross-origin Set-Cookie "
            f"headers are dropped without it). Add the flag to ALL fetches "
            f"in this file."
        )


def test_dashboard_logout_uses_correct_path_and_credentials() -> None:
    """The Dashboard logout fetch was previously calling `/auth/logout`
    (missing the `/api` prefix) AND without credentials. Both broken on
    cross-domain prod. Lock both fixes in."""
    content = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "/api/auth/logout" in content, (
        "DashboardNew.tsx logout must hit `/api/auth/logout` (with /api prefix) "
        "or it 404s through the kubernetes ingress."
    )
    # Verify credentials flag is present near the logout fetch
    assert CREDENTIALS_RE.search(content), (
        "DashboardNew.tsx logout fetch must include `credentials: 'include'`."
    )
