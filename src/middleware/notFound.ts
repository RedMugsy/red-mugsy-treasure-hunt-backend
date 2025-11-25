import { Request, Response } from 'express';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.path} does not exist.`,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      health: 'GET /health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout'
      },
      participants: {
        register: 'POST /api/participants/register',
        profile: 'GET /api/participants/profile'
      },
      promoters: {
        register: 'POST /api/promoters/register',
        profile: 'GET /api/promoters/profile'
      },
      admin: {
        participants: 'GET /api/admin/participants',
        promoters: 'GET /api/admin/promoters'
      },
      payments: {
        createSession: 'POST /api/payments/create-session',
        webhook: 'POST /webhooks/stripe'
      }
    }
  });
};