import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '@/config/database';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Stripe webhook handler
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'invoice.payment_succeeded':
        // Handle subscription payments if needed in future
        console.log('Invoice payment succeeded:', event.data.object.id);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Handle successful checkout session
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);
  
  const { participantId, userId, tier, referralCode } = session.metadata!;
  
  try {
    await prisma.$transaction(async (tx) => {
      // Update payment record
      const payment = await tx.payment.findFirst({
        where: { stripeSessionId: session.id }
      });

      if (!payment) {
        throw new Error(`Payment record not found for session ${session.id}`);
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          stripePaymentIntentId: session.payment_intent as string,
          receiptUrl: undefined // Receipt URL not available in session object
        }
      });

      // Activate participant
      await tx.participant.update({
        where: { id: participantId },
        data: {
          status: 'ACTIVE',
          tier: tier as any
        }
      });

      // Process referral commission if applicable
      if (referralCode) {
        const referral = await tx.referral.findFirst({
          where: {
            participantEmail: session.customer_email!,
            referralCode,
            isConverted: false
          },
          include: { promoter: true }
        });

        if (referral) {
          // Mark referral as converted
          await tx.referral.update({
            where: { id: referral.id },
            data: {
              isConverted: true,
              convertedAt: new Date(),
              paymentId: payment.id
            }
          });

          // Update promoter stats
          await tx.promoter.update({
            where: { id: referral.promoterId },
            data: {
              totalReferrals: { increment: 1 },
              totalRevenue: { increment: referral.commission }
            }
          });
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'PAYMENT_COMPLETED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          newValues: {
            status: 'COMPLETED',
            tier,
            amount: payment.amount
          }
        }
      });

      console.log(`Payment completed for participant ${participantId}, tier ${tier}`);
    });

    // TODO: Send confirmation email
    console.log('TODO: Send payment confirmation email to:', session.customer_email);
    
  } catch (error) {
    console.error('Error processing checkout session:', error);
    throw error;
  }
}

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment intent succeeded:', paymentIntent.id);
  
  // This is usually handled by checkout.session.completed, but we can add
  // additional logic here if needed for direct PaymentIntent usage
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment intent failed:', paymentIntent.id);
  
  try {
    // Find and update payment record
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: paymentIntent.last_payment_error?.message
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: payment.userId,
          action: 'PAYMENT_FAILED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          newValues: {
            status: 'FAILED',
            reason: paymentIntent.last_payment_error?.message
          }
        }
      });

      console.log(`Payment failed for payment ${payment.id}`);
    }
    
    // TODO: Send failure notification email
    
  } catch (error) {
    console.error('Error processing payment failure:', error);
    throw error;
  }
}

export default router;