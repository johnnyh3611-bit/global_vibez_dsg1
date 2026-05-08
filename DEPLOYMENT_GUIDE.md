# 🚀 Deployment Guide: Railway & Render

## Overview

This guide helps you deploy Global Vibez DSG to Railway or Render, where Socket.IO works perfectly without any infrastructure configuration!

---

## 🎯 Why Deploy Elsewhere?

**Current Situation:**
- Emergent preview environment blocks Socket.IO (both WebSocket and polling)
- Requires infrastructure team to configure ingress routing
- Blocking all multiplayer features

**Solution:**
- Deploy to Railway or Render
- Socket.IO works immediately (no configuration needed)
- Full multiplayer functionality available
- Can still develop on Emergent, just deploy elsewhere for testing

---

## 🚂 Option 1: Railway (Recommended - Easiest)

### Why Railway?
- ✅ Automatic deployment from GitHub
- ✅ Free tier available ($5 credit/month)
- ✅ Socket.IO works out-of-the-box
- ✅ Built-in MongoDB support
- ✅ Zero configuration needed
- ✅ Preview deployments for testing

### Prerequisites
1. GitHub account
2. Railway account (sign up at railway.app)
3. Your code pushed to GitHub

### Deployment Steps

#### 1. Push Code to GitHub

```bash
# Initialize git (if not already)
cd /app
git init
git add .
git commit -m "Initial commit - Global Vibez DSG with multiplayer"

# Create a new GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/global-vibez-dsg.git
git branch -M main
git push -u origin main
```

#### 2. Deploy to Railway

**Option A: Via Railway Dashboard**
1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `global-vibez-dsg` repository
6. Railway will auto-detect it's a Python/Node.js app

**Option B: Via Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd /app
railway init

# Deploy
railway up
```

#### 3. Configure Environment Variables

In Railway dashboard, add these variables:

**Required:**
```bash
# MongoDB
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=global_vibez_prod

# Emergent LLM Key
EMERGENT_LLM_KEY=your_emergent_key_here

# Stripe (optional)
STRIPE_API_KEY=your_stripe_key_here

# Frontend URL (Railway will provide this)
REACT_APP_BACKEND_URL=https://your-app.up.railway.app
```

**Railway-Specific:**
```bash
# Port (Railway assigns automatically)
PORT=8001

# Python version
PYTHON_VERSION=3.11
```

#### 4. Configure MongoDB

**Option A: Use Railway's MongoDB Template**
1. In Railway dashboard, click "New"
2. Select "Database" → "MongoDB"
3. Railway creates a MongoDB instance
4. Copy the connection URL to `MONGO_URL`

**Option B: Use MongoDB Atlas (Free)**
1. Create free cluster at mongodb.com/cloud/atlas
2. Get connection string
3. Add to Railway as `MONGO_URL`

#### 5. Build Frontend for Production

Railway will automatically build the frontend. Ensure your `package.json` has:

```json
{
  "scripts": {
    "build": "react-scripts build",
    "start": "serve -s build -l 3000"
  }
}
```

#### 6. Deploy!

```bash
railway up
```

Railway will:
- ✅ Install dependencies
- ✅ Build frontend
- ✅ Start backend
- ✅ Provide a public URL
- ✅ Enable Socket.IO (works automatically!)

#### 7. Verify Deployment

1. Visit your Railway URL: `https://your-app.up.railway.app`
2. Navigate to `/multiplayer`
3. Check connection status → Should show "Connected" ✅
4. Test matchmaking with 2 browser windows
5. Play Tic-Tac-Toe or Connect 4!

---

## 🎨 Option 2: Render (Alternative)

### Why Render?
- ✅ Free tier (no credit card needed)
- ✅ Automatic HTTPS
- ✅ Socket.IO supported
- ✅ Good for static sites + backend

### Deployment Steps

#### 1. Create Render Account
- Go to https://render.com
- Sign up with GitHub

#### 2. Deploy Backend

1. In Render dashboard, click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name:** global-vibez-backend
   - **Environment:** Python 3
   - **Build Command:** `cd backend && pip install -r requirements.txt`
   - **Start Command:** `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free

4. Add environment variables (same as Railway)

#### 3. Deploy Frontend

1. Click "New" → "Static Site"
2. Connect your GitHub repository
3. Configure:
   - **Name:** global-vibez-frontend
   - **Build Command:** `cd frontend && yarn install && yarn build`
   - **Publish Directory:** `frontend/build`
   - **Plan:** Free

4. Add environment variable:
   ```bash
   REACT_APP_BACKEND_URL=https://global-vibez-backend.onrender.com
   ```

#### 4. Configure MongoDB

Use MongoDB Atlas (free tier) or Render's MongoDB addon.

#### 5. Verify

1. Visit: `https://global-vibez-frontend.onrender.com`
2. Test multiplayer features!

---

## 🔧 Post-Deployment Configuration

### Update Frontend Environment

After deployment, update your frontend `.env` with the new backend URL:

**Railway:**
```bash
REACT_APP_BACKEND_URL=https://your-app.up.railway.app
```

**Render:**
```bash
REACT_APP_BACKEND_URL=https://global-vibez-backend.onrender.com
```

### Enable CORS (if needed)

Backend is already configured with:
```python
cors_allowed_origins='*'  # Allows all origins
```

For production, you might want to restrict this:
```python
cors_allowed_origins=['https://your-frontend-url.com']
```

### Configure Emergent Google Auth

Update your Emergent Google Auth redirect URLs to include your new deployment URL:
1. Go to Emergent dashboard
2. Update OAuth callback URLs
3. Add your Railway/Render URL

---

## 🧪 Testing Multiplayer on New Deployment

### Test Checklist:

**Connection:**
- [ ] Navigate to `/multiplayer`
- [ ] Connection badge shows "Connected" (green)
- [ ] Online player count shows ≥ 1
- [ ] No console errors

**Matchmaking:**
- [ ] Open 2 browser windows (different browsers or incognito)
- [ ] Both players select same game
- [ ] Click "FIND MATCH"
- [ ] Player 2 sees "MATCH FOUND!"
- [ ] Click "ACCEPT"
- [ ] Both navigate to game room

**Gameplay:**
- [ ] Moves sync in real-time
- [ ] Turn indicators update
- [ ] Winner sees confetti
- [ ] Play Again button works

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Railway** | $5 credit/month | $0.000231/GB-hour | Testing & production |
| **Render** | 750 hours/month | $7/month | Free tier apps |
| **Heroku** | No free tier | $7/month | Legacy apps |

**Recommendation:** Start with **Railway** for flexibility and ease of use.

---

## 🔄 Continuous Deployment

### Railway
- Automatically deploys on every `git push` to main branch
- Preview deployments for pull requests
- Rollback to previous deployments

### Render
- Automatically deploys on every `git push`
- Manual deploy triggers available
- Blueprint for infrastructure-as-code

---

## 🚨 Common Issues

### Issue: Frontend Can't Connect to Backend

**Solution:**
```bash
# Ensure REACT_APP_BACKEND_URL is correct
# Railway: https://your-app.up.railway.app
# Render: https://your-backend.onrender.com

# Rebuild frontend after changing .env
railway up  # or trigger Render rebuild
```

### Issue: MongoDB Connection Failed

**Solution:**
```bash
# Check MONGO_URL format:
# Correct: mongodb+srv://username:password@cluster.mongodb.net/dbname
# Wrong: mongodb://localhost:27017

# Ensure DB_NAME matches your database
```

### Issue: Socket.IO Still Not Connecting

**Solution:**
```bash
# Check browser console for errors
# Verify backend URL in useMultiplayer.js
# Check CORS configuration in backend
# Ensure backend is running (check Railway/Render logs)
```

---

## 📊 Monitoring & Logs

### Railway
```bash
# View logs
railway logs

# Follow logs in real-time
railway logs --follow
```

### Render
- View logs in Render dashboard
- Real-time log streaming available
- Persistent logs for debugging

---

## 🎯 Production Checklist

Before going live:

**Security:**
- [ ] Restrict CORS to your domain
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS (automatic on Railway/Render)
- [ ] Add rate limiting
- [ ] Implement authentication properly

**Performance:**
- [ ] Enable caching
- [ ] Optimize database queries
- [ ] Add CDN for static assets
- [ ] Monitor response times

**Monitoring:**
- [ ] Set up error tracking (Sentry)
- [ ] Monitor uptime (UptimeRobot)
- [ ] Track user analytics
- [ ] Set up alerts

---

## 🔙 Keeping Emergent as Primary Development

You can continue using Emergent for development and deploy to Railway/Render for testing:

**Workflow:**
1. Develop on Emergent (AI-powered development)
2. Push changes to GitHub
3. Railway/Render auto-deploys
4. Test multiplayer on Railway/Render URL
5. Iterate

**Benefits:**
- ✅ Best of both worlds
- ✅ AI-powered development (Emergent)
- ✅ Working multiplayer (Railway/Render)
- ✅ Easy to switch back to Emergent once infrastructure is fixed

---

## 📞 Support

**Railway:**
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app

**Render:**
- Discord: https://render.com/discord
- Docs: https://render.com/docs

**Need Help?**
- Check logs in deployment dashboard
- Review deployment guides above
- Ask in platform Discord communities

---

## 🚀 Quick Start Commands

### Railway
```bash
# Install CLI
npm install -g @railway/cli

# Deploy
cd /app
railway login
railway init
railway up

# View logs
railway logs --follow
```

### Render
```bash
# Deploy via dashboard (no CLI needed)
# 1. Connect GitHub repo
# 2. Configure build & start commands
# 3. Deploy!
```

---

**Deploy now and test multiplayer immediately! No infrastructure headaches! 🎮✨**
