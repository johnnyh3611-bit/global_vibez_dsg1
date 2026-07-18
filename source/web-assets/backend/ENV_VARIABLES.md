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

# Admin Access
ADMIN_EMAILS=admin@globalvibez.com,founder@globalvibez.com
ADMIN_PASSWORD=GlobalVibez_Founder_2025!
FOUNDER_2FA_SECRET=JBSWY3DPEHPK3PXP
```

### Payment Integration
```env
# Preferred coin top-up (no Stripe): Solana deposit
GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET=YourSolanaTreasuryPubkey

# Helio / MoonPay Commerce — fiat card checkout for coin packs (Stripe alternative)
# Dashboard: https://moonpay.hel.io → Developers → API keys + dynamic Pay Link
# Embed Pay Link id is public; secrets stay server-side.
# Webhook target: POST https://<api-host>/api/coins/webhook/helio
# Health: GET /api/integrations/health → services.helio.configured
HELIO_API_KEY=your_helio_public_api_key
HELIO_SECRET_KEY=your_helio_secret_bearer
HELIO_PAYLINK_ID=your_dynamic_paylink_id
HELIO_NETWORK=test
HELIO_WEBHOOK_TOKEN=shared_token_from_helio_webhook_create

# Stripe (legacy — de-emphasized; chairs / High Roller may still use)
STRIPE_API_KEY=sk_test_your_stripe_secret_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### External Services (Optional)
```env
# AI — Google Gemini (date planner, coaches, matching, practice)
# Get a key: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key
# GOOGLE_API_KEY=also_accepted_as_alias

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

Located at `/app/frontend/.env`:

```env
# Backend API URL
REACT_APP_BACKEND_URL=https://your-backend-url.com

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
