import { Router } from 'express';
import { Request, Response } from 'express';
import prisma from '@/config/database';

const router = Router();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error : 'Database connection failed'
    });
  }
});

// Detailed health check for monitoring
router.get('/detailed', async (req: Request, res: Response) => {
  const healthInfo: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    checks: {
      database: 'unknown',
      email: 'unknown',
      stripe: 'unknown'
    }
  };

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    healthInfo.checks.database = 'healthy';
  } catch (error) {
    healthInfo.checks.database = 'unhealthy';
    healthInfo.status = 'degraded';
  }

  // Email service check (basic config check)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    healthInfo.checks.email = 'configured';
  } else {
    healthInfo.checks.email = 'not_configured';
  }

  // Stripe check (basic config check)
  if (process.env.STRIPE_SECRET_KEY) {
    healthInfo.checks.stripe = 'configured';
  } else {
    healthInfo.checks.stripe = 'not_configured';
  }

  const statusCode = healthInfo.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthInfo);
});

export default router;