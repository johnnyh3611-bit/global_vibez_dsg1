# 🔔 Firebase Push Notifications - Complete Setup Guide

## ✅ SETUP COMPLETE

Firebase Push Notifications are now **fully configured** for Global Vibez DSG with both:
- ✅ **Frontend (Web)**: Client-side Firebase SDK for receiving notifications
- ✅ **Backend (Server)**: Firebase Admin SDK for sending notifications

---

## 📦 What's Configured

### Backend (Firebase Admin SDK)
- **Service Account**: `/app/backend/firebase-service-account.json`
- **Package Installed**: `firebase-admin==7.3.0`
- **Routes**: `/app/backend/routes/notifications.py`

### Frontend (Firebase Web SDK)
- **Config File**: `/app/frontend/src/lib/firebase.js`
- **Service Worker**: `/app/frontend/public/firebase-messaging-sw.js`
- **Environment Variables**: `/app/frontend/.env`
  - Updated `REACT_APP_FIREBASE_API_KEY` to latest value
  - All Firebase config variables properly set

---

## 🚀 Available API Endpoints

### 1. **Check Status**
```bash
GET /api/notifications/status
```
Response:
```json
{
  "success": true,
  "registered_tokens": 0,
  "firebase_configured": true,
  "admin_sdk_configured": true
}
```

### 2. **Register Device Token (Frontend calls this)**
```bash
POST /api/notifications/register
Content-Type: application/json

{
  "fcm_token": "YOUR_FCM_TOKEN_HERE"
}
```

### 3. **Send Notification to Specific User**
```bash
POST /api/notifications/send
Content-Type: application/json

{
  "user_id": "demo_user",
  "title": "New Match!",
  "body": "You have a new connection in Dating Universe",
  "data": {
    "type": "match",
    "match_id": "abc123"
  },
  "url": "/matches"
}
```

### 4. **Broadcast to All Users**
```bash
POST /api/notifications/broadcast?title=Welcome&body=Thanks for joining!
```

### 5. **Send Test Notification**
```bash
POST /api/notifications/test
```

---

## 🧪 How to Test

### Step 1: Enable Notifications in Browser
1. Visit your app at `https://social-connect-953.preview.emergentagent.com`
2. When the notification banner appears, click **"Enable Notifications"**
3. Browser will prompt for permission → Click **"Allow"**
4. Frontend will automatically register your FCM token with backend

### Step 2: Send Test Notification
```bash
curl -X POST https://social-connect-953.preview.emergentagent.com/api/notifications/test
```

You should receive a notification: **"🎮 Global Vibez DSG Test - Your notifications are working!"**

---

## 🔧 How It Works

### Frontend Flow:
1. User visits app
2. Notification banner appears (after 3 seconds)
3. User clicks "Enable Notifications"
4. Browser requests permission
5. If granted:
   - Firebase SDK generates FCM token
   - Token sent to backend via `/api/notifications/register`
   - Token stored in MongoDB `fcm_tokens` collection

### Backend Flow:
1. Game event occurs (match found, game invite, etc.)
2. Backend calls Firebase Admin SDK
3. Firebase Cloud Messaging sends push notification
4. User receives notification (even if browser closed)

---

## 🎯 Integration Examples

### Example 1: Send Match Notification
```python
# In your matches route
from routes.notifications import send_notification

# When match is found
await send_notification({
    "user_id": match.user_id,
    "title": "💘 New Match!",
    "body": f"You matched with {match.partner_name}",
    "data": {"match_id": str(match.id), "type": "match"},
    "url": "/matches"
})
```

### Example 2: Game Invite Notification
```python
# When game invite is sent
await send_notification({
    "user_id": invitee_id,
    "title": "🎮 Game Invite",
    "body": f"{inviter_name} invited you to play {game_name}",
    "data": {"game_id": game_id, "type": "game_invite"},
    "url": f"/games/join/{game_id}"
})
```

### Example 3: Vibe Ridez Notification
```python
# When ride driver arrives
await send_notification({
    "user_id": rider_id,
    "title": "🚗 Driver Arriving",
    "body": "Your driver will arrive in 2 minutes!",
    "data": {"ride_id": ride_id, "eta": "2min"},
    "url": "/rides/active"
})
```

---

## 📝 Firebase Credentials

### Current Configuration:
- **Project ID**: `global-vibez-dsg`
- **API Key**: `AIzaSyCy6128GnnznO_vO0-Kbtcx60DDaJBUUIA`
- **Messaging Sender ID**: `855242106787`
- **Service Account Email**: `firebase-adminsdk-fbsvc@global-vibez-dsg.iam.gserviceaccount.com`

---

## 🛡️ Security Notes

1. **Service Account Key**: Stored securely in `/app/backend/firebase-service-account.json` (backend only)
2. **VAPID Key**: Public key safe to use in frontend
3. **Tokens**: FCM tokens are device-specific and expire/rotate automatically
4. **Database**: User tokens stored in `fcm_tokens` collection with `user_id` linking

---

## 🐛 Troubleshooting

### Issue: Notification banner doesn't appear
- **Solution**: Check browser notification permission (should be "default" or "granted")
- Clear browser cache and reload
- Check browser console for Firebase initialization logs

### Issue: Permission already denied
- **Solution**: User must manually allow in browser settings:
  1. Click padlock icon in URL bar
  2. Find "Notifications" setting
  3. Change from "Block" to "Allow"
  4. Refresh page

### Issue: Token not registering
- **Check**: Browser console for errors
- **Check**: Service worker registered (`/firebase-messaging-sw.js` accessible)
- **Check**: Firebase config in `.env` file

### Issue: Notifications not sending
- **Check**: Backend logs for Firebase errors
- **Check**: `/api/notifications/status` shows `admin_sdk_configured: true`
- **Check**: FCM tokens exist in database: `db.fcm_tokens.find({})`

---

## 📊 Database Schema

### `fcm_tokens` Collection
```javascript
{
  "_id": ObjectId("..."),
  "token": "FCM_DEVICE_TOKEN_STRING",
  "user_id": "demo_user",
  "active": true,
  "created_at": "2026-03-30T12:00:00Z",
  "updated_at": "2026-03-30T12:00:00Z"
}
```

---

## ✨ Next Steps

1. **Test**: Send test notification and verify it works
2. **Integrate**: Add notification calls to your app events (matches, game invites, messages)
3. **Customize**: Update notification titles/bodies for your brand voice
4. **Monitor**: Track notification delivery rates in Firebase Console

---

## 🎉 You're All Set!

Firebase Push Notifications are production-ready. Start sending engaging notifications to keep your users connected to the vibez!
