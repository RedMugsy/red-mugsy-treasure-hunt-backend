import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';
import { validateTurnstile } from '@/middleware/validateTurnstile';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  turnstileToken: z.string().min(1, 'Bot verification required')
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  turnstileToken: z.string().min(1, 'Bot verification required')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

// Helper function to generate tokens
const generateTokens = (userId: string, email: string, role: string) => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  
  if (!jwtSecret || !jwtRefreshSecret) {
    throw new Error('JWT secrets not configured');
  }

  const accessToken = jwt.sign(
    { id: userId, email, role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    { id: userId },
    jwtRefreshSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  return { accessToken, refreshToken };
};

// POST /api/auth/login
router.post('/login', validateTurnstile, async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: {
        participant: true,
        promoter: true
      }
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        participant: user.participant,
        promoter: user.promoter
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// POST /api/auth/register
router.post('/register', validateTurnstile, async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: 'PARTICIPANT' // Default role
      }
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTER',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT refresh secret not configured');
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET) as any;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Generate new tokens
    const tokens = generateTokens(user.id, user.email, user.role);

    res.json({
      message: 'Tokens refreshed',
      tokens
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid refresh token', 401);
    }
    throw error;
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'USER_LOGOUT',
        entityType: 'USER',
        entityId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    throw error;
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        participant: true,
        promoter: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      user
    });
  } catch (error) {
    throw error;
  }
});

export default router;