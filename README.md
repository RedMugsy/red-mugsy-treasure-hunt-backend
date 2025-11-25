# 🏆 Red Mugsy Treasure Hunt - Backend API

A comprehensive Node.js/TypeScript backend for the Red Mugsy Treasure Hunt system with participant registration, promoter management, payment processing, and admin controls.

## 🚀 Features

### Core Functionality
- **User Authentication** - JWT-based auth with role-based access control
- **Participant Registration** - Multi-tier registration with wallet integration
- **Promoter Management** - Application system with approval workflow
- **Payment Processing** - Stripe integration for tier payments
- **Admin Dashboard** - Comprehensive management interface
- **Email Notifications** - Automated email workflows
- **Audit Logging** - Complete action tracking
- **Security** - Cloudflare Turnstile, rate limiting, input validation

### Technical Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Payments**: Stripe
- **Email**: Nodemailer
- **Security**: Cloudflare Turnstile, Helmet, CORS
- **Deployment**: Railway

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account
- Cloudflare Turnstile keys
- SMTP email service

## ⚙️ Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Environment
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/treasure_hunt_db"

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=your-turnstile-secret-key

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Admin
ADMIN_EMAIL=admin@redmugsy.com
```

## 🛠️ Installation & Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📊 Database Schema

### Users
- Authentication and profile data
- Role-based access (PARTICIPANT, PROMOTER, ADMIN)

### Participants
- Registration details and tier information
- Solana wallet addresses
- Payment status and history

### Promoters
- Application and approval workflow
- Referral codes and commission tracking
- Performance analytics

### Payments
- Stripe integration
- Transaction history
- Referral commission processing

### Audit Logs
- Complete action tracking
- Admin oversight and compliance

## 🔗 API Endpoints

### Authentication
```
POST   /api/auth/login         # User login
POST   /api/auth/register      # User registration
POST   /api/auth/refresh       # Token refresh
POST   /api/auth/logout        # User logout
GET    /api/auth/me           # Get user profile
```

### Participants
```
POST   /api/participants/register    # Participant registration
GET    /api/participants/profile     # Get participant profile
PUT    /api/participants/profile     # Update participant profile
GET    /api/participants/status      # Get participation status
```

### Promoters
```
POST   /api/promoters/register       # Promoter application
GET    /api/promoters/profile        # Get promoter profile
PUT    /api/promoters/profile        # Update promoter profile
GET    /api/promoters/stats          # Get performance stats
GET    /api/promoters/referrals      # Get referral history
```

### Payments
```
POST   /api/payments/create-session  # Create Stripe session
GET    /api/payments/session/:id/status # Check payment status
GET    /api/payments/history         # Payment history
```

### Admin
```
GET    /api/admin/dashboard          # Admin dashboard data
GET    /api/admin/participants       # Manage participants
GET    /api/admin/promoters          # Manage promoters
PUT    /api/admin/promoters/approve  # Approve/reject promoters
PUT    /api/admin/participants/status # Update participant status
GET    /api/admin/payments           # Payment management
GET    /api/admin/audit-logs         # Audit log viewer
```

### Webhooks
```
POST   /webhooks/stripe             # Stripe payment webhooks
```

### Health Check
```
GET    /health                      # Basic health check
GET    /health/detailed             # Detailed system status
```

## 🔐 Security Features

- **JWT Authentication** - Secure token-based auth
- **Role-Based Access** - Participant, Promoter, Admin roles
- **Cloudflare Turnstile** - Bot protection on forms
- **Rate Limiting** - API abuse prevention
- **Input Validation** - Zod schema validation
- **SQL Injection Protection** - Prisma ORM
- **CORS Configuration** - Cross-origin request control
- **Helmet Security** - HTTP header security

## 💳 Payment Processing

### Stripe Integration
- Secure payment processing for tier upgrades
- Webhook handling for payment confirmation
- Automatic participant activation
- Referral commission calculation

### Supported Tiers
- **FREE** - $0 (Auto-approved)
- **PREMIUM** - $99 (Payment required)
- **VIP** - $299 (Payment required)

## 📧 Email Notifications

Automated email workflows for:
- Participant welcome emails
- Payment confirmations
- Promoter application updates
- Approval/rejection notifications
- Admin notifications

## 🚀 Railway Deployment

### Quick Deploy
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Railway
```
NODE_ENV=production
DATABASE_URL=<Railway PostgreSQL URL>
JWT_SECRET=<Strong secret key>
JWT_REFRESH_SECRET=<Strong refresh secret>
STRIPE_SECRET_KEY=<Production Stripe key>
STRIPE_WEBHOOK_SECRET=<Stripe webhook secret>
SMTP_HOST=<Email SMTP host>
SMTP_USER=<Email username>
SMTP_PASS=<Email password>
TURNSTILE_SECRET_KEY=<Cloudflare secret>
FRONTEND_URL=<Your frontend URL>
ADMIN_EMAIL=<Admin email address>
```

### Database Migration
Railway will automatically run migrations on deploy via the `railway:deploy` script.

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📁 Project Structure

```
src/
├── config/          # Database and app configuration
├── controllers/     # Route controllers (if using controller pattern)
├── middleware/      # Auth, validation, error handling
├── models/          # Database models (Prisma)
├── routes/          # API route definitions
├── services/        # Business logic and external services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── webhooks/        # Webhook handlers
└── server.ts        # Main application entry point

prisma/
├── schema.prisma    # Database schema
└── migrations/      # Database migration files
```

## 🔧 Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for consistency
- Prettier for code formatting

### Error Handling
- Centralized error handling middleware
- Custom AppError class for consistent error responses
- Comprehensive logging for debugging

### Database
- Prisma ORM for type-safe database access
- Migration-based schema management
- Audit logging for all important actions

### API Design
- RESTful API principles
- Consistent JSON response format
- Proper HTTP status codes
- Request validation with Zod

## 📈 Monitoring & Logging

### Health Checks
- Basic health endpoint at `/health`
- Detailed system status at `/health/detailed`
- Database connection monitoring

### Audit Logs
- All user actions logged
- Admin action tracking
- Payment event logging
- IP address and user agent capture

### Error Tracking
- Structured error logging
- Development vs production error details
- Failed request tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Run linting and tests
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

For support and questions:
- Email: support@redmugsy.com
- Discord: [Join our server](https://discord.gg/redmugsy)

---

Built with ❤️ for the Red Mugsy Treasure Hunt community