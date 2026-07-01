"""v8 API endpoint integration tests (against live backend URL)."""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


# --- GISA ---
class TestGISA:
    def test_thresholds(self):
        r = requests.get(f"{API}/gisa/thresholds", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "thresholds" in d
        assert d["thresholds"]["ws_p95_ms"]["pass"] == 100
        assert d["thresholds"]["solana_tps"]["pass"] == 1500

    def test_modules(self):
        r = requests.get(f"{API}/gisa/modules", timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Accept either "modules" or "matrix" key
        mods = d.get("modules") or d.get("matrix")
        assert mods and len(mods) >= 4

    def test_run_full_audit(self):
        r = requests.post(f"{API}/gisa/run", json={"mode": "full_audit", "users": 100}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "report" in d or "summary" in d or "stress" in d or "status" in d

    def test_report_latest(self):
        r = requests.get(f"{API}/gisa/report/latest", timeout=15)
        assert r.status_code in (200, 404)


# --- Localization ---
class TestLocalization:
    def test_countries(self):
        r = requests.get(f"{API}/localization/countries", timeout=15)
        assert r.status_code == 200
        d = r.json()
        countries = d.get("countries") or d
        assert len(countries) >= 28

    def test_languages(self):
        r = requests.get(f"{API}/localization/languages", timeout=15)
        assert r.status_code == 200
        d = r.json()
        langs = d.get("languages") or d
        assert len(langs) >= 10

    def test_detect_tokyo(self):
        # NOTE: CF-IPCountry header stripped by K8s ingress on preview env;
        # use X-Country header fallback (supported by route).
        r = requests.post(
            f"{API}/localization/detect",
            headers={"Accept-Language": "ja-JP,ja;q=0.9", "X-Country": "JP"},
            json={},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        payload = d.get("localization") or d.get("locale") or d
        assert payload.get("country_code") == "JP"
        assert payload.get("currency") == "JPY"
        assert payload.get("unit_system") == "metric"

    def test_select_mexico(self):
        r = requests.post(f"{API}/localization/select", json={"country_code": "MX"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        payload = d.get("localization") or d
        assert payload.get("currency") == "MXN"
        assert payload.get("unit_system") == "metric"

    def test_select_gb(self):
        r = requests.post(f"{API}/localization/select", json={"country_code": "GB"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        payload = d.get("localization") or d
        assert payload.get("currency") == "GBP"

    def test_persist_round_trip(self):
        uid = "TEST_v8_locale_user"
        save = requests.post(
            f"{API}/localization/me/{uid}/save",
            json={"country_code": "JP", "language_code": "ja"},
            timeout=15,
        )
        assert save.status_code in (200, 201), save.text[:200]
        get_r = requests.get(f"{API}/localization/me/{uid}", timeout=15)
        assert get_r.status_code == 200
        d = get_r.json()
        payload = d.get("localization") or d
        assert payload.get("country_code") == "JP"
        assert payload.get("currency") == "JPY"


# --- Cultural Onboarding ---
class TestCulturalOnboarding:
    # Use a fresh UID per test run so MongoDB state from previous runs
    # cannot leak into the "complete=False before submit" assertion.
    import uuid as _uuid
    UID = f"TEST_v8_cultural_{_uuid.uuid4().hex[:8]}"

    def test_steps(self):
        r = requests.get(f"{API}/cultural-onboarding/steps", timeout=15)
        assert r.status_code == 200
        d = r.json()
        steps = d.get("steps") or d
        assert len(steps) == 4

    def test_complete_gate_requires_all_4(self):
        # Before any steps
        r = requests.get(f"{API}/cultural-onboarding/{self.UID}/complete", timeout=15)
        # Either 200 with complete=false or 404
        if r.status_code == 200:
            assert r.json().get("complete") is False

        # Submit all 4 steps
        step_payloads = [
            ("origin_and_vibe", {"home_country": "US", "vibing_country": "US"}),
            ("linguistic_range", {"fluent": ["en", "es"], "learning": []}),
            ("dialect_selection", {"en": "en-US", "es": "es-MX"}),
            ("cultural_values", {"traditions": "casual"}),
        ]
        for step, data in step_payloads:
            r = requests.post(
                f"{API}/cultural-onboarding/{self.UID}/submit",
                json={"step": step, "payload": data},
                timeout=15,
            )
            assert r.status_code in (200, 201), f"{step} failed: {r.status_code} {r.text[:200]}"

        # Now complete
        r = requests.get(f"{API}/cultural-onboarding/{self.UID}/complete", timeout=15)
        assert r.status_code == 200
        assert r.json().get("complete") is True

    def test_get_profile(self):
        r = requests.get(f"{API}/cultural-onboarding/{self.UID}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "profile" in d or "user_id" in d or "complete" in d
