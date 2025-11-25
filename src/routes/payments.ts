import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

// Validation schemas
const createPaymentSessionSchema = z.object({
  tier: z.enum(['PREMIUM', 'VIP']),
  participantId: z.string().cuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});

// Tier pricing
const TIER_PRICES = {
  PREMIUM: 99,
  VIP: 299
} as const;

// POST /api/payments/create-session
router.post('/create-session', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = createPaymentSessionSchema.parse(req.body);
    
    // Find participant
    const participant = await prisma.participant.findUnique({
      where: { id: validatedData.participantId },
      include: { user: true }
    });

    if (!participant) {
      throw new AppError('Participant not found', 404);
    }

    // Check if user owns this participant record
    if (participant.userId !== req.user!.id) {
      throw new AppError('Unauthorized access to participant record', 403);
    }

    // Check if participant already paid for this tier
    const existingPayment = await prisma.payment.findFirst({
      where: {
        participantId: participant.id,
        tier: validatedData.tier,
        status: 'COMPLETED'
      }
    });

    if (existingPayment) {
      throw new AppError('Payment already completed for this tier', 400);
    }

    const amount = TIER_PRICES[validatedData.tier];
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Red Mugsy Treasure Hunt - ${validatedData.tier} Tier`,
              description: `Registration for ${validatedData.tier.toLowerCase()} tier access`,
              images: ['https://your-domain.com/treasure-hunt-logo.png']
            },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: validatedData.successUrl,
      cancel_url: validatedData.cancelUrl,
      customer_email: participant.user.email,
      metadata: {
        participantId: participant.id,
        userId: participant.userId,
        tier: validatedData.tier,
        referralCode: participant.referredBy || ''
      },
      automatic_tax: { enabled: true }
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId: participant.userId,
        participantId: participant.id,
        stripePaymentIntentId: 'pending', // Will be updated by webhook
        stripeSessionId: session.id,
        amount: amount,
        currency: 'usd',
        tier: validatedData.tier,
        status: 'PENDING',
        referralCode: participant.referredBy
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'PAYMENT_SESSION_CREATED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        newValues: {
          tier: validatedData.tier,
          amount,
          sessionId: session.id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Payment session created successfully',
      sessionId: session.id,
      sessionUrl: session.url,
      paymentId: payment.id,
      amount,
      tier: validatedData.tier
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0].message, 400);
    }
    throw error;
  }
});

// GET /api/payments/session/:sessionId/status
router.get('/session/:sessionId/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Get payment record
    const payment = await prisma.payment.findFirst({
      where: { 
        stripeSessionId: sessionId,
        userId: req.user!.id
      },
      include: {
        participant: {
          include: { user: true }
        }
      }
    });

    if (!payment) {
      throw new AppError('Payment session not found', 404);
    }

    // Get session status from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        tier: payment.tier,
        createdAt: payment.createdAt
      },
      session: {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        url: session.url
      },
      participant: {
        id: payment.participant!.id,
        tier: payment.participant!.tier,
        status: payment.participant!.status
      }
    });
  } catch (error) {
    throw error;
  }
});

// GET /api/payments/history
router.get('/history', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: req.user!.id },
        include: {
          participant: {
            select: { tier: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.payment.count({
        where: { userId: req.user!.id }
      })
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

export default router;