#!/bin/bash

# WebSocket Environment Switcher
# Allows switching between local testing and production mode

MODE=$1

if [ -z "$MODE" ]; then
  echo "Usage: ./switch_websocket_mode.sh [local|production]"
  echo ""
  echo "Modes:"
  echo "  local      - Use localhost URLs (bypasses ingress, for testing in pod)"
  echo "  production - Use preview URL (requires WebSocket ingress support)"
  exit 1
fi

FRONTEND_ENV="/app/frontend/.env"
BACKUP_FILE="/app/frontend/.env.backup"

# Backup current .env if not already backed up
if [ ! -f "$BACKUP_FILE" ]; then
  echo "📦 Creating backup of original .env..."
  cp "$FRONTEND_ENV" "$BACKUP_FILE"
fi

if [ "$MODE" = "local" ]; then
  echo "🔧 Switching to LOCAL mode..."
  echo "   WebSocket will connect to: http://localhost:8001"
  
  # Update frontend .env to use localhost
  sed -i 's|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=http://localhost:8001|g' "$FRONTEND_ENV"
  
  echo "✅ Switched to LOCAL mode"
  echo "📝 Frontend will now connect directly to localhost:8001"
  echo "🔄 Restarting frontend service..."
  sudo supervisorctl restart frontend
  
  echo ""
  echo "✨ Local testing ready!"
  echo "   - WebSocket connections will bypass Kubernetes ingress"
  echo "   - Access via: http://localhost:3000/multiplayer"
  echo "   - This only works from inside the pod"
  
elif [ "$MODE" = "production" ]; then
  echo "🌐 Switching to PRODUCTION mode..."
  
  # Restore from backup
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$FRONTEND_ENV"
    echo "✅ Restored production configuration from backup"
  else
    echo "❌ No backup found. Please set REACT_APP_BACKEND_URL manually."
    exit 1
  fi
  
  echo "🔄 Restarting frontend service..."
  sudo supervisorctl restart frontend
  
  echo ""
  echo "✨ Production mode restored!"
  echo "   - WebSocket connections use preview URL"
  echo "   - Requires WebSocket ingress support"
  
else
  echo "❌ Unknown mode: $MODE"
  echo "   Use 'local' or 'production'"
  exit 1
fi

echo ""
echo "📊 Current configuration:"
grep "REACT_APP_BACKEND_URL" "$FRONTEND_ENV"
