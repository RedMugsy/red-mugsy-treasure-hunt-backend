import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { errorHandler } from '@/middleware/errorHandler';
import { notFound } from '@/middleware/notFound';
import { validateTurnstile } from '@/middleware/validateTurnstile';

// Import routes
import authRoutes from '@/routes/auth';
import participantRoutes from '@/routes/participants';
import promoterRoutes from '@/routes/promoters';
import adminRoutes from '@/routes/admin';
import paymentRoutes from '@/routes/payments';
import healthRoutes from '@/routes/health';
import stripeWebhook from '@/webhooks/stripe';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'https://*.railway.app',
    'https://*.vercel.app',
    /\.redmugsy\.com$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check route (no auth required)
app.use('/health', healthRoutes);

// Webhook routes (no body parsing, raw buffer needed)
app.use('/webhooks', express.raw({ type: 'application/json' }), stripeWebhook);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/promoters', promoterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// Webhook routes (no body parsing, raw buffer needed)
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '🏆 Red Mugsy Treasure Hunt API',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      participants: '/api/participants',
      promoters: '/api/promoters', 
      admin: '/api/admin',
      payments: '/api/payments'
    }
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Red Mugsy Treasure Hunt API server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  });
}

export default app;