# 🚀 Railway Deployment Guide

This guide helps you deploy the Red Mugsy Treasure Hunt backend to Railway.

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository
- Stripe account
- Cloudflare Turnstile account
- SMTP email service

## Step 1: Create Railway Project

1. Go to [Railway](https://railway.app) and sign in
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your forked repository
5. Railway will automatically detect this as a Node.js project

## Step 2: Add PostgreSQL Database

1. In your Railway project dashboard
2. Click "New Service"
3. Select "Database" → "PostgreSQL"
4. Railway will provision a PostgreSQL instance
5. Note the `DATABASE_URL` connection string

## Step 3: Configure Environment Variables

In Railway project settings → Variables, add:

```bash
# Environment
NODE_ENV=production
PORT=3001

# Database (automatically set by Railway)
DATABASE_URL=postgresql://...

# JWT Secrets (generate secure random strings)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-at-least-32-chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-production-email@domain.com
SMTP_PASS=your-app-specific-password
EMAIL_FROM=noreply@redmugsy.com
EMAIL_FROM_NAME=Red Mugsy Treasure Hunt

# Cloudflare Turnstile (production keys)
TURNSTILE_SECRET_KEY=your-production-turnstile-secret

# Frontend URL (your production frontend)
FRONTEND_URL=https://your-frontend-domain.com

# Admin Configuration
ADMIN_EMAIL=admin@redmugsy.com
ADMIN_PASSWORD=secure-production-admin-password
```

## Step 4: Configure Custom Domain (Optional)

1. In Railway project → Settings → Networking
2. Add your custom domain
3. Configure DNS CNAME record to point to Railway's provided domain
4. Update `FRONTEND_URL` environment variable

## Step 5: Deploy

1. Push your code to the main branch
2. Railway will automatically build and deploy
3. Monitor the build logs in Railway dashboard
4. Deployment will run:
   - `npm install`
   - `npm run build`
   - `npm run db:migrate` (database migrations)
   - `npm start`

## Step 6: Initialize Database

After successful deployment:

1. Go to Railway project → Database service
2. Open "Query" tab or connect via terminal
3. The database migrations ran automatically
4. To seed initial data, you can run: `npm run db:seed`

## Step 7: Configure Stripe Webhooks

1. In Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-railway-domain/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET` environment variable
5. Redeploy the service

## Step 8: Test the Deployment

1. Visit `https://your-railway-domain/health`
2. Should return healthy status
3. Test API endpoints using Postman/curl
4. Verify database connection
5. Test email sending (check SMTP logs)

## Health Check Endpoint

Railway will automatically monitor: `https://your-railway-domain/health`

This endpoint checks:
- Server status
- Database connectivity
- Environment configuration

## Monitoring & Logs

1. **Application Logs**: Railway dashboard → Service → Logs
2. **Metrics**: Railway dashboard → Service → Metrics  
3. **Database**: Railway dashboard → Database → Metrics

## Scaling

Railway automatically scales based on traffic. For heavy usage:

1. Consider upgrading to Pro plan
2. Configure additional replicas if needed
3. Monitor database performance

## Environment-Specific Settings

### Development
```bash
NODE_ENV=development
DATABASE_URL=local_postgres_url
STRIPE_SECRET_KEY=sk_test_...
TURNSTILE_SECRET_KEY=development_key
```

### Production
```bash
NODE_ENV=production
DATABASE_URL=railway_postgres_url
STRIPE_SECRET_KEY=sk_live_...
TURNSTILE_SECRET_KEY=production_key
```

## Troubleshooting

### Build Failures
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Review build logs in Railway

### Database Connection Issues
- Verify DATABASE_URL is set
- Check PostgreSQL service status
- Review connection pool settings

### Environment Variable Issues
- Ensure all required variables are set
- Check for typos in variable names
- Verify sensitive values are properly escaped

### Email Delivery Issues
- Test SMTP credentials
- Check spam filters
- Verify email templates render correctly

## Security Checklist

- [ ] Strong JWT secrets (32+ characters)
- [ ] Production Stripe keys
- [ ] Secure admin password
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled
- [ ] Turnstile protection active
- [ ] Database backups enabled

## Backup Strategy

Railway automatically backs up PostgreSQL databases. For additional protection:

1. Set up periodic database dumps
2. Store critical data exports
3. Document recovery procedures

## Support

For deployment issues:
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Project Support: support@redmugsy.com