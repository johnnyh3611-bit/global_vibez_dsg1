#!/usr/bin/env python3
"""
Global Vibez DSG - Admin Dashboard Access Helper
Run this script anytime to get your current 2FA code
"""
import pyotp
import os

# Admin Credentials
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
FOUNDER_2FA_SECRET = os.getenv("FOUNDER_2FA_SECRET", "JBSWY3DPEHPK3PXP")

def get_current_code():
    totp = pyotp.TOTP(FOUNDER_2FA_SECRET)
    return totp.now()

if __name__ == "__main__":
    print("=" * 60)
    print("🔐 GLOBAL VIBEZ DSG - ADMIN DASHBOARD ACCESS")
    print("=" * 60)
    print()
    print("📍 Admin Dashboard URL: /vibe-vault-admin")
    print()
    print("Step 1: ENCRYPTION KEY (Password)")
    print(f"   → {ADMIN_PASSWORD}")
    print()
    print("Step 2: 6-DIGIT AUTH CODE (2FA)")
    print(f"   → {get_current_code()}")
    print()
    print("⚠️  Note: 2FA code regenerates every 30 seconds")
    print("💡 Tip: Run this script anytime to get a fresh code")
    print()
    print("=" * 60)
