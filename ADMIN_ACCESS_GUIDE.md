# 🔐 Global Vibez DSG - Admin Dashboard Access Guide

## 📍 How to Access the Admin Dashboard

### Step 1: Navigate to the Admin Login Page

Click the **purple heart logo** in the top-left corner of the landing page at:
```
https://your-app-url.com/
```

This will take you to the **VIBE VAULT ACCESS** login screen at:
```
https://your-app-url.com/vibe-vault-admin
```

---

## 🔑 Login Credentials

### Step 1: ENCRYPTION KEY (Password)
```
GlobalVibez_Founder_2025!
```

Enter this password and click **"INITIALIZE SCAN"**

---

### Step 2: 6-DIGIT AUTH CODE (2FA)

The 6-digit code changes **every 30 seconds** for security.

#### 🚀 Quick Way: Get Current Code
Run this command anytime to get the current 2FA code:

```bash
python3 /app/GET_ADMIN_CODE.py
```

#### 📱 Alternative: Use Google Authenticator App

1. **Download Google Authenticator** (or any TOTP app like Authy, Microsoft Authenticator)
2. **Scan this QR code** or manually enter the secret:

**Secret Key:** `JBSWY3DPEHPK3PXP`

**Manual Setup:**
- Open your authenticator app
- Tap "+" or "Add account"
- Select "Enter a setup key"
- Account name: `Global Vibez Admin`
- Key: `JBSWY3DPEHPK3PXP`
- Type: Time-based

The app will now generate codes automatically every 30 seconds!

---

## 🎯 Complete Login Example

1. Click the **purple heart logo** (top-left on landing page)
2. Enter password: `GlobalVibez_Founder_2025!`
3. Click **"INITIALIZE SCAN"**
4. Run: `python3 /app/GET_ADMIN_CODE.py` to get current code
5. Enter the 6-digit code (e.g., `455142`)
6. Click **"VERIFY FOUNDER IDENTITY"**
7. ✅ You're in! Welcome to God Mode 🎮

---

## 🛠️ Admin Dashboard Features

Once logged in at `/vibe-vault-admin/dashboard`, you can:

- 📊 **Master Stats**: View real-time platform metrics
- 👥 **Active Users**: Monitor online players (last 24h)
- 💰 **Token Circulation**: Track economy (7-day stats)
- 🎮 **Live Games**: See active tables and bets
- 💸 **Revenue Tracking**: Monitor platform earnings
- 🚨 **Moderation Tools**: Kick users, manage reports
- 📈 **Trending Charts**: Visual analytics with Tremor charts

---

## 🔒 Security Notes

- **Password:** Stored in environment variable `ADMIN_PASSWORD`
- **2FA Secret:** Stored in environment variable `FOUNDER_2FA_SECRET`
- **Session:** 4-hour expiration after login
- **Production Tip:** Change these credentials before deploying!

---

## 🆘 Troubleshooting

### "Invalid Security Token" Error
- The 2FA code expired (they change every 30 seconds)
- Solution: Run `python3 /app/GET_ADMIN_CODE.py` again for a fresh code

### "Access Denied" Error
- Wrong password entered
- Solution: Copy-paste exactly: `GlobalVibez_Founder_2025!`

### Can't Find the Logo
- Make sure you're on the main landing page (`/`)
- Look for the **purple heart icon** in the top-left corner
- It should show a hover effect when you mouse over it

---

## 📞 Support

If you need to change the admin password or 2FA secret:

1. Update in `/app/backend/routes/admin_dashboard.py`
2. Or set environment variables:
   ```bash
   export ADMIN_PASSWORD="YourNewPassword"
   export FOUNDER_2FA_SECRET="YourNew2FASecret"
   ```

---

**Last Updated:** April 11, 2026  
**Version:** God Mode v1.0
