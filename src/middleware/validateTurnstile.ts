import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

export interface TurnstileRequest extends Request {
  turnstileVerified?: boolean;
}

export const validateTurnstile = async (
  req: TurnstileRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { turnstileToken } = req.body;
    
    if (!turnstileToken) {
      return res.status(400).json({
        error: 'Turnstile verification required.',
        code: 'MISSING_TURNSTILE_TOKEN'
      });
    }

    if (!process.env.TURNSTILE_SECRET_KEY) {
      console.error('TURNSTILE_SECRET_KEY not configured');
      // In development or Railway staging, skip verification if not configured
      if (process.env.NODE_ENV === 'development' || process.env.RAILWAY_ENVIRONMENT) {
        console.warn('Turnstile validation bypassed - no secret key configured');
        req.turnstileVerified = true;
        return next();
      }
      return res.status(500).json({
        error: 'Server configuration error.',
        code: 'TURNSTILE_NOT_CONFIGURED'
      });
    }

    // Verify token with Cloudflare Turnstile
    const response = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: req.ip
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    const { success, 'error-codes': errorCodes } = response.data;

    if (!success) {
      console.error('Turnstile verification failed:', errorCodes);
      return res.status(400).json({
        error: 'Bot verification failed. Please try again.',
        code: 'TURNSTILE_VERIFICATION_FAILED',
        details: process.env.NODE_ENV === 'development' ? errorCodes : undefined
      });
    }

    req.turnstileVerified = true;
    next();
  } catch (error) {
    console.error('Turnstile validation error:', error);

    // In development, Railway environment, or when explicitly disabled, allow bypass on error
    if (process.env.NODE_ENV === 'development' || 
        process.env.RAILWAY_ENVIRONMENT || 
        process.env.DISABLE_TURNSTILE === 'true') {
      console.warn('Turnstile validation bypassed due to error or environment setting');
      req.turnstileVerified = true;
      return next();
    }    return res.status(500).json({
      error: 'Bot verification service temporarily unavailable.',
      code: 'TURNSTILE_SERVICE_ERROR'
    });
  }
};