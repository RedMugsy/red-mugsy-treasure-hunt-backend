import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { authenticate, authorize, AuthenticatedRequest } from '@/middleware/auth';

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// Validation schemas
const approvePromoterSchema = z.object({
  promoterId: z.string().cuid(),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  commissionRate: z.number().min(0).max(1).optional()
});

const updateParticipantStatusSchema = z.object({
  participantId: z.string().cuid(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'SUSPENDED']),
  reason: z.string().optional()
});

// GET /api/admin/dashboard
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalParticipants,
      totalPromoters,
      pendingPromoters,
      totalRevenue,
      recentRegistrations,
      topPromoters
    ] = await Promise.all([
      // Total participants
      prisma.participant.count(),
      
      // Total promoters
      prisma.promoter.count(),
      
      // Pending promoter applications
      prisma.promoter.count({
        where: { status: 'PENDING' }
      }),
      
      // Total revenue
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      
      // Recent registrations (last 7 days)
      prisma.participant.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Top promoters by referrals
      prisma.promoter.findMany({
        take: 5,
        orderBy: { totalReferrals: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true }
          }
        }
      })
    ]);

    // Tier distribution
    const tierDistribution = await prisma.participant.groupBy({
      by: ['tier'],
      _count: true
    });

    // Monthly registration trends
    const monthlyTrends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as registrations
      FROM "participants" 
      WHERE "createdAt" >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month DESC
    `;

    res.json({
      dashboard: {
        overview: {
          totalParticipants,
          totalPromoters,
          pendingPromoters,
          totalRevenue: totalRevenue._sum.amount || 0,
          recentRegistrations
        },
        tierDistribution,
        monthlyTrends,
        topPromoters: topPromoters.map((p: any) => ({
          id: p.id,
          name: `${p.user.firstName} ${p.user.lastName}`,
          email: p.user.email,
          referrals: p.totalReferrals,
          revenue: p.totalRevenue,
          status: p.status
        }))
      }
    });
  } catch (error) {
    throw error;
  }
});

// GET /api/admin/participants
router.get('/participants', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const tier = req.query.tier as string;
    const status = req.query.status as string;

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }
    if (tier) where.tier = tier;
    if (status) where.status = status;

    const [participants, total] = await Promise.all([
      prisma.participant.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              country: true,
              createdAt: true
            }
          },
          payments: {
            where: { status: 'COMPLETED' },
            select: { amount: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.participant.count({ where })
    ]);

    res.json({
      participants: participants.map((p: any) => ({
        ...p,
        totalPaid: p.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)
      })),
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

// GET /api/admin/promoters
router.get('/promoters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const type = req.query.type as string;

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { companyName: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (status) where.status = status;
    if (type) where.type = type;

    const [promoters, total] = await Promise.all([
      prisma.promoter.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              country: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.promoter.count({ where })
    ]);

    res.json({
      promoters,
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

// PUT /api/admin/promoters/approve
router.put('/promoters/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = approvePromoterSchema.parse(req.body);
    
    const promoter = await prisma.promoter.findUnique({
      where: { id: validatedData.promoterId },
      include: { user: true }
    });

    if (!promoter) {
      throw new AppError('Promoter not found', 404);
    }

    if (promoter.status !== 'PENDING') {
      throw new AppError('Only pending applications can be approved/rejected', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update promoter status
      const updatedPromoter = await tx.promoter.update({
        where: { id: validatedData.promoterId },
        data: {
          status: validatedData.approved ? 'APPROVED' : 'REJECTED',
          approvedBy: req.user!.id,
          approvedAt: validatedData.approved ? new Date() : null,
          rejectionReason: validatedData.rejectionReason,
          commissionRate: validatedData.commissionRate || 0.1
        },
        include: { user: true }
      });

      // Generate password for approved promoters
      if (validatedData.approved) {
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 12);
        
        await tx.user.update({
          where: { id: promoter.userId },
          data: { password: hashedPassword }
        });

        // TODO: Send welcome email with temp password
        console.log('Promoter approved - send welcome email:', {
          email: promoter.user.email,
          tempPassword,
          referralCode: promoter.referralCode
        });
      } else {
        // TODO: Send rejection email
        console.log('Promoter rejected - send rejection email:', {
          email: promoter.user.email,
          reason: validatedData.rejectionReason
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: validatedData.approved ? 'PROMOTER_APPROVED' : 'PROMOTER_REJECTED',
          entityType: 'PROMOTER',
          entityId: updatedPromoter.id,
          oldValues: { status: 'PENDING' },
          newValues: {
            status: updatedPromoter.status,
            rejectionReason: validatedData.rejectionReason
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return updatedPromoter;
    });

    res.json({
      message: `Promoter ${validatedData.approved ? 'approved' : 'rejected'} successfully`,
      promoter: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// PUT /api/admin/participants/status
router.put('/participants/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = updateParticipantStatusSchema.parse(req.body);
    
    const result = await prisma.$transaction(async (tx) => {
      const participant = await tx.participant.update({
        where: { id: validatedData.participantId },
        data: { status: validatedData.status },
        include: { user: true }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'PARTICIPANT_STATUS_UPDATE',
          entityType: 'PARTICIPANT',
          entityId: participant.id,
          newValues: {
            status: validatedData.status,
            reason: validatedData.reason
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return participant;
    });

    res.json({
      message: 'Participant status updated successfully',
      participant: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// GET /api/admin/payments
router.get('/payments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    const where: any = status ? { status: status as any } : {};

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true }
          },
          participant: {
            select: { tier: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      payments,
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

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    const action = req.query.action as string;

    const where = action ? { action } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
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