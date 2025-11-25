import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';
import { validateTurnstile } from '@/middleware/validateTurnstile';

const router = Router();

// Helper function to generate unique referral code
const generateReferralCode = async (): Promise<string> => {
  let code: string;
  let exists = true;
  
  while (exists) {
    code = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const existing = await prisma.promoter.findUnique({
      where: { referralCode: code }
    });
    exists = !!existing;
  }
  
  return code!;
};

// Validation schemas
const promoterRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  type: z.enum(['INFLUENCER', 'BUSINESS', 'COMMUNITY'], { required_error: 'Promoter type is required' }),
  companyName: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  socialMediaLinks: z.object({
    twitter: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional(),
    linkedin: z.string().optional(),
    discord: z.string().optional(),
    other: z.string().optional()
  }).optional(),
  followersCount: z.number().int().min(0).optional(),
  engagementRate: z.number().min(0).max(100).optional(),
  niche: z.string().optional(),
  experienceDescription: z.string().min(50, 'Please provide at least 50 characters about your experience'),
  promotionPlan: z.string().min(100, 'Please provide at least 100 characters about your promotion plan'),
  turnstileToken: z.string().min(1, 'Bot verification required'),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
  agreeCommission: z.boolean().refine(val => val === true, 'You must agree to the commission structure')
});

const updatePromoterSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  companyName: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  socialMediaLinks: z.object({
    twitter: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional(),
    linkedin: z.string().optional(),
    discord: z.string().optional(),
    other: z.string().optional()
  }).optional(),
  followersCount: z.number().int().min(0).optional(),
  engagementRate: z.number().min(0).max(100).optional(),
  niche: z.string().optional()
});

// POST /api/promoters/register
router.post('/register', validateTurnstile, async (req: Request, res: Response) => {
  try {
    const validatedData = promoterRegistrationSchema.parse(req.body);
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      throw new AppError('Email already registered. Please login instead.', 409);
    }

    // Generate unique referral code
    const referralCode = await generateReferralCode();

    // Create user and promoter in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user account
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          password: 'TEMP_PASSWORD', // Will be set after approval
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          country: validatedData.country,
          role: 'PROMOTER'
        }
      });

      // Create promoter profile
      const promoter = await tx.promoter.create({
        data: {
          userId: user.id,
          type: validatedData.type,
          status: 'PENDING',
          referralCode,
          companyName: validatedData.companyName,
          website: validatedData.website,
          socialMediaLinks: validatedData.socialMediaLinks,
          followersCount: validatedData.followersCount,
          engagementRate: validatedData.engagementRate,
          niche: validatedData.niche,
          applicationData: {
            experienceDescription: validatedData.experienceDescription,
            promotionPlan: validatedData.promotionPlan,
            acceptTerms: validatedData.acceptTerms,
            agreeCommission: validatedData.agreeCommission,
            appliedAt: new Date().toISOString()
          },
          turnstileToken: validatedData.turnstileToken,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'PROMOTER_APPLICATION',
          entityType: 'PROMOTER',
          entityId: promoter.id,
          newValues: {
            type: validatedData.type,
            email: validatedData.email,
            referralCode,
            status: 'PENDING'
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return { user, promoter };
    });

    // TODO: Send notification email to admin
    console.log('New promoter application:', {
      id: result.promoter.id,
      email: result.user.email,
      type: result.promoter.type,
      referralCode
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        id: result.promoter.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        type: result.promoter.type,
        status: result.promoter.status,
        referralCode: result.promoter.referralCode
      },
      nextSteps: [
        'Your application is under review by our admin team',
        'You will receive an email notification once approved',
        'Approval typically takes 1-3 business days',
        'Make sure to check your email including spam folder'
      ]
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// GET /api/promoters/profile
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const promoter = await prisma.promoter.findUnique({
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
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!promoter) {
      throw new AppError('Promoter profile not found', 404);
    }

    // Calculate earnings
    const earnings = await prisma.referral.aggregate({
      where: { 
        promoterId: promoter.id,
        isConverted: true
      },
      _sum: { commission: true }
    });

    res.json({
      promoter: {
        ...promoter,
        totalEarnings: earnings._sum.commission || 0,
        conversionRate: promoter.totalReferrals > 0 
          ? (promoter.referrals.filter((r: any) => r.isConverted).length / promoter.totalReferrals) * 100
          : 0
      }
    });
  } catch (error) {
    throw error;
  }
});

// PUT /api/promoters/profile
router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = updatePromoterSchema.parse(req.body);
    
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

      // Update promoter info
      const promoter = await tx.promoter.update({
        where: { userId: req.user!.id },
        data: {
          companyName: validatedData.companyName,
          website: validatedData.website,
          socialMediaLinks: validatedData.socialMediaLinks,
          followersCount: validatedData.followersCount,
          engagementRate: validatedData.engagementRate,
          niche: validatedData.niche
        },
        include: { user: true }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'PROMOTER_PROFILE_UPDATE',
          entityType: 'PROMOTER',
          entityId: promoter.id,
          newValues: validatedData,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return { user, promoter };
    });

    res.json({
      message: 'Profile updated successfully',
      promoter: result.promoter
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// GET /api/promoters/stats
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const promoter = await prisma.promoter.findUnique({
      where: { userId: req.user!.id }
    });

    if (!promoter) {
      throw new AppError('Promoter not found', 404);
    }

    // Get detailed stats
    const stats = {
      status: promoter.status,
      referralCode: promoter.referralCode,
      totalReferrals: promoter.totalReferrals,
      totalRevenue: promoter.totalRevenue,
      commissionRate: promoter.commissionRate,
      joinDate: promoter.createdAt,
      approvedDate: promoter.approvedAt,
      
      // Recent performance
      conversions: await prisma.referral.count({
        where: { 
          promoterId: promoter.id,
          isConverted: true
        }
      }),
      
      pendingReferrals: await prisma.referral.count({
        where: { 
          promoterId: promoter.id,
          isConverted: false
        }
      }),
      
      thisMonthReferrals: await prisma.referral.count({
        where: {
          promoterId: promoter.id,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      
      tierBreakdown: await prisma.referral.groupBy({
        by: ['tier'],
        where: {
          promoterId: promoter.id,
          isConverted: true
        },
        _count: true,
        _sum: { commission: true }
      })
    };

    res.json({ stats });
  } catch (error) {
    throw error;
  }
});

// GET /api/promoters/referrals
router.get('/referrals', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const promoter = await prisma.promoter.findUnique({
      where: { userId: req.user!.id }
    });

    if (!promoter) {
      throw new AppError('Promoter not found', 404);
    }

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where: { promoterId: promoter.id },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.referral.count({
        where: { promoterId: promoter.id }
      })
    ]);

    res.json({
      referrals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    throw error;
  }
});

export default router;