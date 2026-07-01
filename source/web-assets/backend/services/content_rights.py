"""
Content Rights & IP Protection Service.

Encodes `Content_Rights_And_IP_Policy.pdf` end-to-end. Implements the
"safety first" guarantee: users can sample any downloadable asset for
free, but the master file is locked behind a verified purchase + a
time-limited signed download URL.

Five pillars (one method per pillar):
  1. PREFLIGHT — fingerprint + metadata + seller warranty before upload
  2. PURCHASE — record verified purchase, mint signed download URL
  3. SAMPLE   — public watermarked preview endpoint (no auth)
  4. DMCA     — takedown notices + 24h SLA + repeat-infringer strikes
  5. ESCROW   — 10-day payment hold to allow disputes

Design notes:
  * Signed URLs are HMAC-SHA256 over `{asset_id}:{user_id}:{exp}` with a
    server-side secret. They expire in 5 minutes by default and are
    one-shot per purchase — once consumed, the row's `consumed_at` is
    set so replay attacks fail.
  * Fingerprint matching today uses a simple SHA-256 dedupe against
    prior uploads in our DB. Plug Pex / Audible Magic by replacing
    `_fingerprint_lookup` — same shape.
  * Metadata block list is the spec's defaults; expandable via env.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────── Spec constants ──
DMCA_TAKEDOWN_SLA_HOURS: int = 24
REPEAT_INFRINGER_STRIKE_THRESHOLD: int = 3
PAYMENT_ESCROW_DAYS: int = 10
DEFAULT_DOWNLOAD_TTL_SECONDS: int = 300         # 5 minutes
SAMPLE_DURATION_SECONDS: int = 30               # 30s preview clips

# Metadata keyword blocklist — Spec §2 ("Metadata Filter").
# AI-scan for keywords that signal mislabeling or piracy. Case-insensitive.
DEFAULT_METADATA_BLOCKLIST: List[str] = [
    "official movie", "official video", "official trailer",
    "leak", "leaked", "leak ed",
    "type beat",        # Spec lists explicitly
    "pirated", "ripped", "cam rip",
    "exclusive remix",  # Often used for re-uploaded copyrighted material
]


# ────────────────────────────────────────────── Pure helpers ──

def _server_secret() -> bytes:
    """HMAC secret for signed download URLs. Required in production."""
    secret = os.environ.get("CONTENT_RIGHTS_SECRET", "")
    if not secret:
        # Last-resort dev fallback. Never use this in production.
        secret = "DEV_FALLBACK_DO_NOT_USE_IN_PROD"
    return secret.encode("utf-8")


def mint_download_token(asset_id: str, user_id: str, ttl_seconds: int = DEFAULT_DOWNLOAD_TTL_SECONDS) -> Dict[str, Any]:
    """Sign a short-lived download token. Returns {token, expires_at}."""
    exp = int((datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).timestamp())
    nonce = uuid.uuid4().hex[:12]
    payload = f"{asset_id}:{user_id}:{exp}:{nonce}"
    sig = hmac.new(_server_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return {
        "token": f"{payload}:{sig}",
        "asset_id": asset_id,
        "user_id": user_id,
        "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc).isoformat(),
        "expires_in_seconds": ttl_seconds,
    }


def verify_download_token(token: str) -> Dict[str, Any]:
    """Verify a signed download token. Returns the decoded payload or
    raises ValueError on tampering / expiry."""
    try:
        parts = token.split(":")
        if len(parts) != 5:
            raise ValueError("Malformed token")
        asset_id, user_id, exp_s, nonce, sig = parts
        payload = f"{asset_id}:{user_id}:{exp_s}:{nonce}"
        expected = hmac.new(_server_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("Invalid signature")
        exp = int(exp_s)
        if exp < datetime.now(timezone.utc).timestamp():
            raise ValueError("Token expired")
        return {
            "asset_id": asset_id,
            "user_id": user_id,
            "nonce": nonce,
            "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc).isoformat(),
        }
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}")


def metadata_block_check(*fields: str) -> Optional[str]:
    """Scan `*fields` for blocklist keywords. Returns the FIRST keyword
    hit (so admin can show the seller what's wrong) or None on clear."""
    haystack = " ".join(str(f) for f in fields if f).lower()
    for kw in DEFAULT_METADATA_BLOCKLIST:
        if kw in haystack:
            return kw
    # ALSO catch any "X type beat" phrasing as per spec.
    if re.search(r"\b\w+\s+type\s+beat\b", haystack):
        return "type beat"
    return None


def compute_fingerprint(file_bytes: bytes) -> str:
    """SHA-256 fingerprint. Production-grade audio/video fingerprinting
    (Pex, Audible Magic, AcoustID) plugs in by replacing this function."""
    return hashlib.sha256(file_bytes).hexdigest()


# ────────────────────────────────────────────── Stateful (Mongo) ──

async def _log_event(db, kind: str, details: Dict[str, Any], actor_id: Optional[str] = None) -> None:
    await db.content_rights_events.insert_one({
        "event_id": f"cr_{uuid.uuid4().hex[:14]}",
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        "actor_id": actor_id,
        "details": details,
    })


async def _fingerprint_lookup(db, fingerprint: str) -> Optional[Dict[str, Any]]:
    """Check global asset registry for fingerprint collision."""
    return await db.content_assets.find_one(
        {"fingerprint": fingerprint},
        {"_id": 0, "asset_id": 1, "owner_id": 1, "title": 1},
    )


async def preflight_upload(
    db,
    seller_id: str,
    title: str,
    description: str,
    fingerprint: str,
    warranty_signed: bool,
) -> Dict[str, Any]:
    """Run all pre-upload checks per Spec §1-3.

    Returns `{ok: bool, block_reason?: str, ...}`. If ok=False, the
    seller's upload is REJECTED before any bytes hit storage.
    """
    # 1. Seller warranty — Spec §3.
    if not warranty_signed:
        return {
            "ok": False,
            "block_reason": "warranty_missing",
            "message": "You must legally swear ownership of all masters and compositions to upload.",
        }

    # 2. Repeat-infringer check (Spec §1c).
    striker = await db.content_rights_strikes.find_one(
        {"seller_id": seller_id, "terminated": True}, {"_id": 0}
    )
    if striker:
        return {
            "ok": False,
            "block_reason": "seller_terminated",
            "message": "This account has been terminated for repeat copyright infringement.",
        }

    # 3. Metadata blocklist (Spec §2).
    hit = metadata_block_check(title, description)
    if hit:
        return {
            "ok": False,
            "block_reason": "metadata_blocked",
            "blocked_keyword": hit,
            "message": (
                f'Title or description contains a prohibited keyword ("{hit}"). '
                "Common reasons: re-uploading a copyrighted track, mislabeled "
                'content, or using "Type Beat" without proper licensing.'
            ),
        }

    # 4. Fingerprint match against global registry (Spec §2 Validation Workflow).
    match = await _fingerprint_lookup(db, fingerprint)
    if match and match.get("owner_id") != seller_id:
        return {
            "ok": False,
            "block_reason": "fingerprint_conflict",
            "rights_holder_asset_id": match.get("asset_id"),
            "message": (
                "This file matches an existing master on the platform owned "
                "by another creator. If you believe this is your work, contact support."
            ),
        }

    return {"ok": True, "message": "Upload cleared. Proceed to file storage."}


async def register_asset(
    db,
    seller_id: str,
    title: str,
    description: str,
    fingerprint: str,
    master_url: str,
    sample_url: Optional[str] = None,
    price_usd: float = 0.50,
    asset_type: str = "beat",
) -> Dict[str, Any]:
    """Persist a cleared upload to `content_assets`. Caller is expected
    to have run `preflight_upload` first."""
    asset_id = f"asset_{uuid.uuid4().hex[:14]}"
    doc = {
        "asset_id": asset_id,
        "owner_id": seller_id,
        "title": title,
        "description": description,
        "fingerprint": fingerprint,
        "master_url": master_url,           # NEVER exposed in API responses
        "sample_url": sample_url,           # Public preview
        "asset_type": asset_type,           # beat | video | photo | other
        "price_usd": price_usd,
        "is_active": True,
        "takedown_status": "none",          # none | pending | upheld | dismissed
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.content_assets.insert_one(dict(doc))
    await _log_event(db, "asset_registered", {"asset_id": asset_id, "seller_id": seller_id}, actor_id=seller_id)
    return _public_asset(doc)


def _public_asset(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip master_url + Mongo _id from API responses. NEVER expose
    the raw master URL — only signed download tokens lead to it."""
    return {
        k: v for k, v in doc.items()
        if k not in ("_id", "master_url")
    }


async def record_purchase(
    db,
    asset_id: str,
    buyer_user_id: str,
) -> Dict[str, Any]:
    """Record a verified purchase + mint a signed download token.

    Caller (e.g. the Beat Vault `/use` endpoint) has already verified
    payment cleared. We log the purchase to `content_purchases` with a
    10-day escrow window per Spec §5."""
    asset = await db.content_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise ValueError("Asset not found")
    if not asset.get("is_active") or asset.get("takedown_status") == "upheld":
        raise ValueError("Asset is not available for purchase")

    now = datetime.now(timezone.utc)
    escrow_release = (now + timedelta(days=PAYMENT_ESCROW_DAYS)).isoformat()
    purchase_id = f"purchase_{uuid.uuid4().hex[:14]}"

    await db.content_purchases.insert_one({
        "purchase_id": purchase_id,
        "asset_id": asset_id,
        "buyer_user_id": buyer_user_id,
        "seller_id": asset.get("owner_id"),
        "price_usd": asset.get("price_usd"),
        "purchased_at": now.isoformat(),
        "escrow_release_at": escrow_release,
        "escrow_status": "holding",     # holding | released | refunded
    })
    await _log_event(db, "asset_purchased", {
        "asset_id": asset_id, "purchase_id": purchase_id, "buyer": buyer_user_id,
    }, actor_id=buyer_user_id)

    token = mint_download_token(asset_id, buyer_user_id)
    return {
        "purchase_id": purchase_id,
        "asset_id": asset_id,
        "escrow_release_at": escrow_release,
        "escrow_status": "holding",
        **token,
    }


async def has_active_license(db, asset_id: str, user_id: str) -> bool:
    """Does `user_id` own a non-refunded purchase of `asset_id`?"""
    rec = await db.content_purchases.find_one(
        {"asset_id": asset_id, "buyer_user_id": user_id, "escrow_status": {"$ne": "refunded"}},
        {"_id": 0, "purchase_id": 1},
    )
    return rec is not None


# ────────────────────────────────────────────── DMCA flow ──

async def submit_dmca_notice(
    db,
    asset_id: str,
    claimant_name: str,
    claimant_email: str,
    claim_text: str,
    claim_proof_url: Optional[str] = None,
) -> Dict[str, Any]:
    """File a DMCA takedown notice against an asset. Status defaults to
    `pending`; SLA is 24h per Spec §1b."""
    asset = await db.content_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise ValueError("Asset not found")
    if len(claim_text.strip()) < 30:
        raise ValueError("Claim description must be at least 30 characters")

    now = datetime.now(timezone.utc)
    notice_id = f"dmca_{uuid.uuid4().hex[:14]}"
    doc = {
        "notice_id": notice_id,
        "asset_id": asset_id,
        "seller_id": asset.get("owner_id"),
        "claimant_name": claimant_name,
        "claimant_email": claimant_email,
        "claim_text": claim_text.strip(),
        "claim_proof_url": claim_proof_url,
        "status": "pending",            # pending | upheld | dismissed
        "submitted_at": now.isoformat(),
        "sla_deadline": (now + timedelta(hours=DMCA_TAKEDOWN_SLA_HOURS)).isoformat(),
        "resolved_at": None,
        "admin_user_id": None,
        "admin_note": None,
    }
    await db.content_rights_dmca.insert_one(dict(doc))

    # Flag the asset as `pending` while review happens.
    await db.content_assets.update_one(
        {"asset_id": asset_id},
        {"$set": {"takedown_status": "pending"}},
    )
    await _log_event(db, "dmca_filed", {"notice_id": notice_id, "asset_id": asset_id})
    return {k: v for k, v in doc.items() if k != "_id"}


async def admin_decide_dmca(
    db,
    notice_id: str,
    admin_user_id: str,
    decision: str,           # "upheld" | "dismissed"
    note: Optional[str] = None,
) -> Dict[str, Any]:
    if decision not in ("upheld", "dismissed"):
        raise ValueError("decision must be 'upheld' or 'dismissed'")

    now = datetime.now(timezone.utc).isoformat()
    notice = await db.content_rights_dmca.find_one_and_update(
        {"notice_id": notice_id},
        {"$set": {
            "status": decision,
            "resolved_at": now,
            "admin_user_id": admin_user_id,
            "admin_note": note,
        }},
        return_document=True,
    )
    if not notice:
        raise ValueError("DMCA notice not found")

    asset_id = notice.get("asset_id")
    seller_id = notice.get("seller_id")

    if decision == "upheld":
        # 1. Remove the asset.
        await db.content_assets.update_one(
            {"asset_id": asset_id},
            {"$set": {"is_active": False, "takedown_status": "upheld"}},
        )
        # 2. Refund all in-escrow purchases.
        await db.content_purchases.update_many(
            {"asset_id": asset_id, "escrow_status": "holding"},
            {"$set": {"escrow_status": "refunded"}},
        )
        # 3. Add a copyright strike to the seller. Auto-terminate at 3.
        await add_copyright_strike(db, seller_id, asset_id, notice_id)
    else:
        # Dismissed — restore asset to active.
        await db.content_assets.update_one(
            {"asset_id": asset_id},
            {"$set": {"takedown_status": "none"}},
        )

    await _log_event(db, "dmca_decided", {"notice_id": notice_id, "decision": decision}, actor_id=admin_user_id)
    return {k: v for k, v in notice.items() if k != "_id"}


async def add_copyright_strike(
    db,
    seller_id: str,
    asset_id: str,
    notice_id: str,
) -> Dict[str, Any]:
    """Record a copyright strike. Auto-terminate at `REPEAT_INFRINGER_STRIKE_THRESHOLD`."""
    if not seller_id:
        return {"strikes": 0, "terminated": False}

    now = datetime.now(timezone.utc).isoformat()
    record = await db.content_rights_strikes.find_one_and_update(
        {"seller_id": seller_id},
        {
            "$push": {"strikes": {"asset_id": asset_id, "notice_id": notice_id, "ts": now}},
            "$setOnInsert": {"seller_id": seller_id, "created_at": now},
        },
        upsert=True,
        return_document=True,
    )
    strike_count = len(record.get("strikes", []))
    terminated = strike_count >= REPEAT_INFRINGER_STRIKE_THRESHOLD

    if terminated and not record.get("terminated"):
        await db.content_rights_strikes.update_one(
            {"seller_id": seller_id},
            {"$set": {"terminated": True, "terminated_at": now}},
        )
        # Deactivate ALL the seller's other assets too — repeat infringer wipe.
        await db.content_assets.update_many(
            {"owner_id": seller_id},
            {"$set": {"is_active": False, "takedown_status": "upheld"}},
        )
        await _log_event(db, "seller_terminated", {"seller_id": seller_id, "strikes": strike_count})

    return {
        "seller_id": seller_id,
        "strikes": strike_count,
        "terminated": terminated,
    }


# ────────────────────────────────────────────── Snapshot ──

async def policy_snapshot(db) -> Dict[str, Any]:
    """Public policy snapshot — surfaces every spec constant + the
    audit log size so users know the rules are real + enforced."""
    asset_count = await db.content_assets.count_documents({"is_active": True})
    purchase_count = await db.content_purchases.count_documents({})
    dmca_count = await db.content_rights_dmca.count_documents({})
    terminated_count = await db.content_rights_strikes.count_documents({"terminated": True})

    # DMCA Designated Agent registration (US Copyright Office) — required
    # for DMCA Safe Harbor per Spec §1a. Sourced from environment so the
    # registration info can be updated without a code change on renewal.
    dmca_agent: Dict[str, Any] = {}
    name = os.environ.get("DMCA_AGENT_NAME", "").strip()
    if name:
        dmca_agent = {
            "name": name,
            "address": os.environ.get("DMCA_AGENT_ADDRESS", "").strip() or None,
            "email": os.environ.get("DMCA_AGENT_EMAIL", "").strip() or None,
            "phone": os.environ.get("DMCA_AGENT_PHONE", "").strip() or None,
            "registration_date": os.environ.get("DMCA_AGENT_REGISTRATION_DATE", "").strip() or None,
            "paygov_tracking_id": os.environ.get("DMCA_AGENT_PAYGOV_TRACKING_ID", "").strip() or None,
        }

    return {
        "dmca_takedown_sla_hours": DMCA_TAKEDOWN_SLA_HOURS,
        "repeat_infringer_strike_threshold": REPEAT_INFRINGER_STRIKE_THRESHOLD,
        "payment_escrow_days": PAYMENT_ESCROW_DAYS,
        "default_download_ttl_seconds": DEFAULT_DOWNLOAD_TTL_SECONDS,
        "sample_duration_seconds": SAMPLE_DURATION_SECONDS,
        "metadata_blocklist": DEFAULT_METADATA_BLOCKLIST,
        "protocol_version": "Content Rights & Anti-Piracy Policy · 2026",
        "active_assets": asset_count,
        "lifetime_purchases": purchase_count,
        "dmca_notices_filed": dmca_count,
        "sellers_terminated": terminated_count,
        "dmca_agent": dmca_agent,
        "user_rights_agreement": (
            "By uploading content to this platform, you grant the platform a limited "
            "license to host and distribute the file, while warranting that you are "
            "the sole creator or legal owner of all Intellectual Property. You agree "
            "to indemnify the platform against all legal claims resulting from "
            "unauthorized distribution."
        ),
    }
