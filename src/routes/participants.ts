import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';
import { validateTurnstile } from '@/middleware/validateTurnstile';

const router = Router();

// Validation schemas
const participantRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  tier: z.enum(['FREE', 'PREMIUM', 'VIP'], { required_error: 'Tier selection is required' }),
  walletAddress: z.string().optional(),
  discordUsername: z.string().optional(),
  telegramUsername: z.string().optional(),
  referralCode: z.string().optional(),
  turnstileToken: z.string().min(1, 'Bot verification required'),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
  subscribeMailing: z.boolean().optional()
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  walletAddress: z.string().optional(),
  discordUsername: z.string().optional(),
  telegramUsername: z.string().optional()
});

// POST /api/participants/register
router.post('/register', validateTurnstile, async (req: Request, res: Response) => {
  try {
    const validatedData = participantRegistrationSchema.parse(req.body);
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      throw new AppError('Email already registered. Please login instead.', 409);
    }

    // Validate referral code if provided
    let referredByPromoter = null;
    if (validatedData.referralCode) {
      referredByPromoter = await prisma.promoter.findUnique({
        where: { 
          referralCode: validatedData.referralCode,
          status: 'APPROVED'
        }
      });

      if (!referredByPromoter) {
        throw new AppError('Invalid referral code', 400);
      }
    }

    // Create user and participant in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user account
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          password: 'TEMP_PASSWORD', // Will be set after payment confirmation
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          country: validatedData.country,
          role: 'PARTICIPANT'
        }
      });

      // Create participant profile
      const participant = await tx.participant.create({
        data: {
          userId: user.id,
          tier: validatedData.tier,
          status: validatedData.tier === 'FREE' ? 'APPROVED' : 'PENDING', // Free tier auto-approved
          walletAddress: validatedData.walletAddress,
          discordUsername: validatedData.discordUsername,
          telegramUsername: validatedData.telegramUsername,
          referralCode: validatedData.referralCode,
          referredBy: validatedData.referralCode,
          registrationData: {
            acceptTerms: validatedData.acceptTerms,
            subscribeMailing: validatedData.subscribeMailing,
            registeredAt: new Date().toISOString()
          },
          turnstileToken: validatedData.turnstileToken,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      // Update referrer's stats if applicable
      if (referredByPromoter) {
        await tx.promoter.update({
          where: { id: referredByPromoter.id },
          data: {
            totalReferrals: { increment: 1 }
          }
        });

        // Create referral record
        await tx.referral.create({
          data: {
            promoterId: referredByPromoter.id,
            participantEmail: validatedData.email,
            referralCode: validatedData.referralCode!,
            tier: validatedData.tier,
            commission: 0, // Will be updated after payment
            isConverted: validatedData.tier === 'FREE' // Free tier considered converted immediately
          }
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PARTICIPANT_REGISTER',
          entityType: 'PARTICIPANT',
          entityId: participant.id,
          newValues: {
            tier: validatedData.tier,
            email: validatedData.email,
            referralCode: validatedData.referralCode
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return { user, participant };
    });

    res.status(201).json({
      message: 'Registration successful',
      participant: {
        id: result.participant.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        tier: result.participant.tier,
        status: result.participant.status,
        needsPayment: result.participant.tier !== 'FREE'
      },
      nextSteps: result.participant.tier === 'FREE' 
        ? ['Complete your profile', 'Join our Discord community']
        : ['Complete payment to activate your account', 'Check your email for payment instructions']
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// GET /api/participants/profile
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            country: true,
            emailVerified: true,
            createdAt: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!participant) {
      throw new AppError('Participant profile not found', 404);
    }

    res.json({
      participant: {
        ...participant,
        registrationData: participant.registrationData,
        totalPaid: await prisma.payment.aggregate({
          where: { 
            participantId: participant.id,
            status: 'COMPLETED'
          },
          _sum: { amount: true }
        })
      }
    });
  } catch (error) {
    throw error;
  }
});

// PUT /api/participants/profile
router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    
    const result = await prisma.$transaction(async (tx) => {
      // Update user info
      const user = await tx.user.update({
        where: { id: req.user!.id },
        data: {
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          country: validatedData.country
        }
      });

      // Update participant info
      const participant = await tx.participant.update({
        where: { userId: req.user!.id },
        data: {
          walletAddress: validatedData.walletAddress,
          discordUsername: validatedData.discordUsername,
          telegramUsername: validatedData.telegramUsername
        },
        include: { user: true }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'PARTICIPANT_PROFILE_UPDATE',
          entityType: 'PARTICIPANT',
          entityId: participant.id,
          newValues: validatedData,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return { user, participant };
    });

    res.json({
      message: 'Profile updated successfully',
      participant: result.participant
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// GET /api/participants/stats
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { userId: req.user!.id }
    });

    if (!participant) {
      throw new AppError('Participant not found', 404);
    }

    // Get participation stats
    const stats = {
      tier: participant.tier,
      status: participant.status,
      joinDate: participant.createdAt,
      totalPayments: await prisma.payment.count({
        where: { 
          participantId: participant.id,
          status: 'COMPLETED'
        }
      }),
      totalSpent: await prisma.payment.aggregate({
        where: { 
          participantId: participant.id,
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      })
    };

    res.json({ stats });
  } catch (error) {
    throw error;
  }
});

// DELETE /api/participants/account
router.delete('/account', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Create audit log before deletion
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'PARTICIPANT_ACCOUNT_DELETE',
          entityType: 'PARTICIPANT',
          entityId: req.user!.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      // Delete user (cascades to participant and other related records)
      await tx.user.delete({
        where: { id: req.user!.id }
      });
    });

    res.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    throw error;
  }
});

export default router;