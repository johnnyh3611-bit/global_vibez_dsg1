# Deferred Tasks — DO NOT surface until the user explicitly says the trigger word.

## 🔒 Domain Setup (trigger: "domains" or "let's do domains")

**Status:** Deferred at user request on 2026-02-22. Do NOT mention, suggest, or ask about any of the below until the user says "domains" or equivalent.

### What's deferred
1. **Resend custom sender domain verification**
   - Currently using `onboarding@resend.dev` in `RESEND_SENDER_EMAIL`
   - Means password-reset emails only deliver to Resend account owner (johnnyh3611@gmail.com)
   - When user says "domains": walk them through https://resend.com/domains → Add Domain → DNS records
   - Then swap `RESEND_SENDER_EMAIL` in `/app/backend/.env` to `support@<their-domain>` or similar

2. **Resend tier upgrade** — Free (100/day) / Pro ($20/mo, 50k) / Scale ($90/mo, 100k)
   - Currently on Free. Not blocking anything.

3. **Smartcar + Spotify redirect URI updates** for production domain
   - Currently point to `social-connect-953.preview.emergentagent.com`
   - After custom domain goes live, update:
     - `SMARTCAR_REDIRECT_URI` in `.env`
     - `SPOTIFY_REDIRECT_URI` in `.env`
     - `FRONTEND_URL` in `.env`
     - Redirect URI allowlists in Smartcar dashboard + Spotify dashboard

4. **Generic "anything that involves leaving the site"**
   - User asked to skip anything that requires opening an external dashboard to click around
   - Includes: Stripe dashboard, Agora signup, Solana faucet (for devnet bootstrap), any DNS work, any third-party billing portal
