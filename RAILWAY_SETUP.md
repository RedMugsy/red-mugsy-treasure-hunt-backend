# Railway Deployment Quick Fix Guide

## Critical Issue Identified

⚠️ **DATABASE MISMATCH**: This backend requires **PostgreSQL**, not MongoDB!

The Prisma schema is configured for PostgreSQL. If you have MongoDB configured in Railway, this is causing the deployment failures.

## Required Railway Services

1. **PostgreSQL Database** (not MongoDB!)
   - Add PostgreSQL service in Railway
   - Railway will automatically set `DATABASE_URL` environment variable

2. **Backend Service** (this repository)
   - Connected to your GitHub repository
   - Configured with the environment variables below

## Required Environment Variables in Railway

Set these in Railway Project → Variables:

```bash
# Environment
NODE_ENV=production
PORT=3001

# Database - Railway auto-sets this when you add PostgreSQL service
# DATABASE_URL=postgresql://... (automatically set)

# JWT Secrets - REQUIRED
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-min-32-chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Stripe - REQUIRED
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key

# Email - REQUIRED
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@redmugsy.com
EMAIL_FROM_NAME=Red Mugsy Treasure Hunt

# Cloudflare Turnstile - REQUIRED
TURNSTILE_SECRET_KEY=your-turnstile-secret-key

# Frontend URL - REQUIRED for CORS
FRONTEND_URL=https://redmugsy.github.io

# Admin - REQUIRED
ADMIN_EMAIL=admin@redmugsy.com
ADMIN_PASSWORD=your-secure-admin-password
```

## Deployment Steps

1. **Fix Database Service**
   - In Railway, remove MongoDB service if present
   - Add PostgreSQL service: New → Database → PostgreSQL
   - Railway will automatically connect it to your backend

2. **Verify Environment Variables**
   - Go to your backend service → Variables
   - Ensure all variables above are set
   - `DATABASE_URL` should be automatically set by Railway

3. **Redeploy**
   - Push this commit to trigger a new deployment
   - Railway will now use the updated build configuration
   - Monitor build logs for success

## What Was Fixed

1. **Added nixpacks.toml** - Explicit build instructions for TypeScript compilation
2. **Updated railway.toml** - Added healthcheck timeout
3. **Added Procfile** - Fallback deployment configuration
4. **Fixed .gitignore** - Allow Prisma migrations to be committed
5. **Added .railwayignore** - Ensure source files are included in deployment
6. **Database initialization** - Auto-run `prisma db push` on startup

## Checking Deployment Success

1. Visit: `https://your-app.railway.app/health`
2. Should return: `{"status":"healthy"}`
3. Check build logs in Railway for any errors

## Common Issues

### "Failed to read app source directory"
- Fixed by nixpacks.toml configuration
- Ensures Railway can find TypeScript source files

### "Database connection failed"
- Verify PostgreSQL service is running
- Check `DATABASE_URL` is set in environment variables
- Ensure Railway has linked the database to your backend service

### CORS errors from frontend
- Verify `FRONTEND_URL=https://redmugsy.github.io` is set
- Check the frontend is calling the correct Railway URL

## Frontend API Configuration

Update your frontend's API configuration to point to:
```
https://red-mugsy-treasure-hunt-backend-production.up.railway.app
```

Or use Railway's provided domain from your deployment.
