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
# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Test Keys (available in pod)
# Check /home/johnnie/master-project/.env for pre-configured test keys
```

### External Services (Optional)
```env
# OpenAI (for AI features)
OPENAI_API_KEY=sk-your-openai-key

# Twilio (for SMS)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# SendGrid (for emails)
SENDGRID_API_KEY=your-sendgrid-key
```

### Application Configuration
```env
# Server
PORT=8001
HOST=0.0.0.0
ENVIRONMENT=development  # development, staging, production

# CORS
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Redis (for caching, optional)
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
