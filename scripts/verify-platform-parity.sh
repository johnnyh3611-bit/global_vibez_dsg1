#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "vercel.json"
  "railway.json"
  "source/web-assets/frontend/vercel.json"
  "source/web-assets/railway.json"
  "source/web-assets/backend/railway.json"
  "source/web-assets/frontend/railway.json"
  ".github/workflows/ci.yml"
  ".github/workflows/pr-up-to-date.yml"
  ".github/workflows/platform-parity.yml"
  ".github/workflows/production-release-gate.yml"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "FAIL: required file missing: $file"
    exit 1
  fi
done

python3 <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(".")
errors = []

def load(path: str):
    return json.loads((root / path).read_text())

def expect(path: str, actual, expected):
    if actual != expected:
        errors.append(f"{path}: expected {expected!r}, got {actual!r}")

root_vercel = load("vercel.json")
expect("vercel.json.version", root_vercel.get("version"), 2)
expect("vercel.json.installCommand", root_vercel.get("installCommand"), "yarn --cwd source/web-assets/frontend install --frozen-lockfile")
expect("vercel.json.buildCommand", root_vercel.get("buildCommand"), "yarn --cwd source/web-assets/frontend build")
expect("vercel.json.outputDirectory", root_vercel.get("outputDirectory"), "source/web-assets/frontend/build")

deployment_enabled = ((root_vercel.get("git") or {}).get("deploymentEnabled") or {})
if deployment_enabled.get("main") is not True:
    errors.append("vercel.json.git.deploymentEnabled.main must be true")
for branch, enabled in deployment_enabled.items():
    if branch != "main" and enabled is True:
        errors.append(f"vercel.json.git.deploymentEnabled.{branch} must not be true")

root_backend_url = ((root_vercel.get("env") or {}).get("REACT_APP_BACKEND_URL") or "").strip()
build_backend_url = ((((root_vercel.get("build") or {}).get("env") or {}).get("REACT_APP_BACKEND_URL") or "").strip())
if not root_backend_url.startswith("https://"):
    errors.append("vercel.json env.REACT_APP_BACKEND_URL must be an absolute https URL")
if root_backend_url != build_backend_url:
    errors.append("vercel.json env.REACT_APP_BACKEND_URL and build.env.REACT_APP_BACKEND_URL must match")

frontend_env_file = root / "source/web-assets/frontend/.env.production"
if frontend_env_file.exists():
    frontend_backend_url = None
    for raw_line in frontend_env_file.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("REACT_APP_BACKEND_URL="):
            frontend_backend_url = line.split("=", 1)[1].strip()
            break
    if frontend_backend_url and frontend_backend_url != root_backend_url:
        errors.append("frontend .env.production REACT_APP_BACKEND_URL must match root vercel.json when set")

root_railway = load("railway.json")
guard_cmd = (((root_railway.get("deploy") or {}).get("startCommand")) or "")
if "Wrong Railway target" not in guard_cmd:
    errors.append("railway.json must keep root guard startCommand")
expect("railway.json.deploy.restartPolicyType", ((root_railway.get("deploy") or {}).get("restartPolicyType")), "NEVER")

wa_root_railway = load("source/web-assets/railway.json")
wa_guard_cmd = (((wa_root_railway.get("deploy") or {}).get("startCommand")) or "")
if "Wrong Railway target" not in wa_guard_cmd:
    errors.append("source/web-assets/railway.json must keep root guard startCommand")
expect("source/web-assets/railway.json.deploy.restartPolicyType", ((wa_root_railway.get("deploy") or {}).get("restartPolicyType")), "NEVER")

backend_railway = load("source/web-assets/backend/railway.json")
expect("source/web-assets/backend/railway.json.build.builder", ((backend_railway.get("build") or {}).get("builder")), "DOCKERFILE")
expect("source/web-assets/backend/railway.json.build.dockerfilePath", ((backend_railway.get("build") or {}).get("dockerfilePath")), "Dockerfile")
expect("source/web-assets/backend/railway.json.deploy.startCommand", ((backend_railway.get("deploy") or {}).get("startCommand")), "sh /app/entrypoint.sh")
expect("source/web-assets/backend/railway.json.deploy.healthcheckPath", ((backend_railway.get("deploy") or {}).get("healthcheckPath")), "/health")

frontend_railway = load("source/web-assets/frontend/railway.json")
expect("source/web-assets/frontend/railway.json.build.builder", ((frontend_railway.get("build") or {}).get("builder")), "DOCKERFILE")
expect("source/web-assets/frontend/railway.json.build.dockerfilePath", ((frontend_railway.get("build") or {}).get("dockerfilePath")), "Dockerfile")
expect("source/web-assets/frontend/railway.json.deploy.healthcheckPath", ((frontend_railway.get("deploy") or {}).get("healthcheckPath")), "/")

frontend_vercel = load("source/web-assets/frontend/vercel.json")
expect("source/web-assets/frontend/vercel.json.version", frontend_vercel.get("version"), 2)
expect("source/web-assets/frontend/vercel.json.installCommand", frontend_vercel.get("installCommand"), "yarn install --frozen-lockfile")
expect("source/web-assets/frontend/vercel.json.buildCommand", frontend_vercel.get("buildCommand"), "yarn build")
expect("source/web-assets/frontend/vercel.json.outputDirectory", frontend_vercel.get("outputDirectory"), "build")

if not any(rewrite.get("destination") == "/index.html" for rewrite in (frontend_vercel.get("rewrites") or [])):
    errors.append("source/web-assets/frontend/vercel.json must keep SPA fallback rewrite to /index.html")

if errors:
    print("Platform parity check FAILED:")
    for err in errors:
        print(f" - {err}")
    sys.exit(1)

print("Platform parity check PASSED")
PY
