# Environment Variables Reference

## Required Environment Variables

### Database Configuration
```env
# MongoDB Connection
MONGO_URL=mongodb://localhost:27017
DB_NAME=casino_db
```

### Authentication & Security
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Privy social login (Google / X) — JWT verify via JWKS
# Frontend also needs REACT_APP_PRIVY_APP_ID (bake-time) with the same app id.
# PRIVY_APP_SECRET is NOT used by this FastAPI app (JWKS-only verification).
PRIVY_APP_ID=your_privy_app_id
PRIVY_JWKS_URL=https://auth.privy.io/api/v1/apps/your_privy_app_id/jwks.json

# Admin Access
ADMIN_EMAILS=admin@globalvibez.com,founder@globalvibez.com
ADMIN_PASSWORD=GlobalVibez_Founder_2025!
FOUNDER_2FA_SECRET=JBSWY3DPEHPK3PXP
```

### Payment Integration
```env
# Preferred coin top-up (no Stripe): Solana deposit
GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET=YourSolanaTreasuryPubkey

# Helio / MoonPay Commerce — ONLY card rail for coin packs (we do NOT use Stripe)
# Dashboard: https://moonpay.hel.io → Developers → API keys + dynamic Pay Link
# Embed Pay Link id is public; secrets stay server-side.
# Webhook target: POST https://<api-host>/api/coins/webhook/helio
# Health: GET /api/integrations/health → services.helio.configured
HELIO_API_KEY=your_helio_public_api_key
HELIO_SECRET_KEY=your_helio_secret_bearer
HELIO_PAYLINK_ID=your_dynamic_paylink_id
HELIO_NETWORK=test
HELIO_WEBHOOK_TOKEN=shared_token_from_helio_webhook_create

# Founding Member payment beta (Helio card). Solana stays open for everyone.
# Default ON when ENVIRONMENT=production until you set PAYMENT_BETA_MODE=false.
PAYMENT_BETA_MODE=true
PAYMENT_BETA_ALLOWLIST=alice@example.com,bob@example.com
PAYMENT_SUPPORT_EMAIL=payments-beta@globalvibezdsg.com
PAYMENT_SUPPORT_DISCORD=https://discord.gg/globalvibez
# Fail closed on Helio webhooks even outside production:
# PAYMENTS_REQUIRE_WEBHOOK_AUTH=1

# Stripe — NOT used for coin top-up / wallet card checkout. Leave unset.
# (Legacy routes return 410. Do not provision STRIPE_* for payments.)
```

See `source/web-assets/PAYMENT_SECURITY.md` for Helio PCI / TLS / webhook / audit rules.

### External Services (Optional)
```env
# AI — Google Gemini (date planner, coaches, matching, practice, translation)
# Get a key: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key
# GOOGLE_API_KEY=also_accepted_as_alias

# OpenAI — Voice Mirror + Voice Coach STT/TTS (Whisper + tts-1)
# Required for /api/voice-mirror/* audio and /api/voice-coach/voice-question
# Get a key: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key

# Twilio (optional PSTN / SMS — NOT required for in-app Vibe Phone calling)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Agora RTC — Vibe Phone + FaceTime-style video (required for live media)
# Secrets live only in the host env (Railway / local .env) — never commit the certificate.
# Console: https://console.agora.io → Project → App ID + App Certificate
# Health: GET /api/agora/health → {"configured": true, "app_id_present": true}
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate

# Email — Resend is what the code actually uses
RESEND_API_KEY=re_your_resend_key
RESEND_SENDER_EMAIL=onboarding@resend.dev

# Cloudflare Stream — DSG TV + streamer live ingest (RTMPS → HLS)
# Dashboard: https://dash.cloudflare.com → Stream → Live inputs
# Health: GET /api/streaming/cloudflare/status  and  GET /api/integrations/health
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_stream_api_token
CLOUDFLARE_STREAM_SUBDOMAIN=customer-xxxxx.cloudflarestream.com
# CLOUDFLARE_STREAM_WEBHOOK_SECRET=optional
```

### Application Configuration
```env
# Server
PORT=8001
HOST=0.0.0.0
ENVIRONMENT=development  # development, staging, production

# CORS
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Redis — required for multi-instance Socket.IO + optional caching
# When unset, Socket.IO uses an in-process manager (single replica only).
# Set this before scaling FastAPI beyond one replica or room mates on
# different pods will not see each other's moves.
REDIS_URL=redis://localhost:6379
```

## Frontend Environment Variables

Located at `source/web-assets/frontend/.env` (local) or Railway frontend service vars (production build):

```env
# Backend API URL (public HTTPS — not *.railway.internal)
REACT_APP_BACKEND_URL=https://your-backend-url.com
# Optional alias accepted by src/config/backendUrl.ts
# REACT_APP_API_URL=https://your-backend-url.com

# Privy (required for Google / X buttons; rebuild frontend after setting)
REACT_APP_PRIVY_APP_ID=your_privy_app_id

# Socket.IO
REACT_APP_SOCKET_URL=https://your-backend-url.com

# Stripe Publishable Key
REACT_APP_STRIPE_KEY=pk_test_your_stripe_publishable_key

# Environment
REACT_APP_ENV=development
```

## Environment-Specific Configurations

### Development
```env
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
```

### Production
```env
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
SECURE_COOKIES=true
```

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` files to version control
- Use strong, unique passwords in production
- Rotate secrets regularly
- Use environment-specific secrets management
- Enable 2FA for admin accounts

## Checking Environment Variables

```bash
# List all environment variables
env | grep -E "MONGO|JWT|STRIPE|ADMIN"

# Check specific variable
echo $MONGO_URL

# Load from .env file
export $(cat /home/johnnie/master-project/.env | xargs)
```

## Default Values

If not set, the application uses these defaults:
- `MONGO_URL`: mongodb://localhost:27017
- `DB_NAME`: casino_db
- `PORT`: 8001
- `ADMIN_EMAILS`: admin@globalvibez.com
- `JWT_EXPIRATION_HOURS`: 24
