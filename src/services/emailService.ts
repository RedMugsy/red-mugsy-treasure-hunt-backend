import nodemailer from 'nodemailer';
import { AppError } from '@/middleware/errorHandler';

// Email templates
export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

// Create email transporter
const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Email configuration incomplete. Check SMTP environment variables.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Base email sending function
export const sendEmail = async (
  to: string | string[],
  template: EmailTemplate,
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>
): Promise<void> => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'Red Mugsy Treasure Hunt'} <${process.env.EMAIL_FROM}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new AppError('Failed to send email notification', 500);
  }
};

// Welcome email for participants
export const sendParticipantWelcomeEmail = async (
  email: string,
  firstName: string,
  tier: string,
  walletAddress: string
): Promise<void> => {
  const template: EmailTemplate = {
    subject: `🏆 Welcome to Red Mugsy Treasure Hunt - ${tier} Tier!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff1a4b, #00F0FF); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏆 Welcome to the Hunt!</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333;">Hello ${firstName}!</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Congratulations! Your registration for the <strong>${tier} tier</strong> has been confirmed.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff1a4b;">
            <h3 style="margin-top: 0; color: #ff1a4b;">Your Hunt Details</h3>
            <p><strong>Tier:</strong> ${tier}</p>
            <p><strong>Wallet:</strong> ${walletAddress}</p>
            <p><strong>Status:</strong> ${tier === 'FREE' ? 'Active - Ready to Hunt!' : 'Active after Payment'}</p>
          </div>
          
          <h3 style="color: #333;">Next Steps:</h3>
          <ol style="font-size: 16px; line-height: 1.6; color: #555;">
            <li>Join our Discord community for hunt updates</li>
            <li>Follow us on social media for clues</li>
            <li>Keep your wallet ready for treasure claims</li>
            <li>Stay tuned for hunt announcements</li>
          </ol>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://discord.gg/redmugsy" style="background: #5865f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
              Join Discord
            </a>
            <a href="https://treasure-hunt.redmugsy.com" style="background: #ff1a4b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Visit Hunt Portal
            </a>
          </div>
          
          <p style="color: #777; font-size: 14px; margin-top: 30px;">
            Questions? Reply to this email or contact us at support@redmugsy.com
          </p>
        </div>
        
        <div style="background: #333; color: white; text-align: center; padding: 15px; font-size: 12px;">
          © 2025 Red Mugsy Treasure Hunt. All rights reserved.
        </div>
      </div>
    `,
    text: `
Welcome to Red Mugsy Treasure Hunt!

Hello ${firstName}!

Congratulations! Your registration for the ${tier} tier has been confirmed.

Your Hunt Details:
- Tier: ${tier}
- Wallet: ${walletAddress}
- Status: ${tier === 'FREE' ? 'Active - Ready to Hunt!' : 'Active after Payment'}

Next Steps:
1. Join our Discord community for hunt updates
2. Follow us on social media for clues
3. Keep your wallet ready for treasure claims
4. Stay tuned for hunt announcements

Join Discord: https://discord.gg/redmugsy
Visit Hunt Portal: https://treasure-hunt.redmugsy.com

Questions? Contact us at support@redmugsy.com

© 2025 Red Mugsy Treasure Hunt. All rights reserved.
    `
  };

  await sendEmail(email, template);
};

// Promoter application submitted notification
export const sendPromoterApplicationEmail = async (
  email: string,
  firstName: string,
  type: string,
  referralCode: string
): Promise<void> => {
  const template: EmailTemplate = {
    subject: '📈 Promoter Application Submitted - Under Review',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff1a4b, #00F0FF); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">📈 Application Received!</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333;">Hello ${firstName}!</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Thank you for applying to become a <strong>${type}</strong> promoter for Red Mugsy Treasure Hunt!
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00F0FF;">
            <h3 style="margin-top: 0; color: #00F0FF;">Application Details</h3>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Your Referral Code:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${referralCode}</code></p>
            <p><strong>Status:</strong> Under Review</p>
          </div>
          
          <h3 style="color: #333;">What Happens Next:</h3>
          <ol style="font-size: 16px; line-height: 1.6; color: #555;">
            <li>Our team will review your application (1-3 business days)</li>
            <li>We'll verify your social media presence and engagement</li>
            <li>You'll receive approval/feedback via email</li>
            <li>Upon approval, you'll get login credentials</li>
          </ol>
          
          <p style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong>Important:</strong> Save your referral code <code>${referralCode}</code>. You'll need this to track your referrals and earnings.
          </p>
          
          <p style="color: #777; font-size: 14px; margin-top: 30px;">
            Questions about your application? Reply to this email or contact us at promoters@redmugsy.com
          </p>
        </div>
        
        <div style="background: #333; color: white; text-align: center; padding: 15px; font-size: 12px;">
          © 2025 Red Mugsy Treasure Hunt. All rights reserved.
        </div>
      </div>
    `
  };

  await sendEmail(email, template);
};

// Promoter approval email
export const sendPromoterApprovalEmail = async (
  email: string,
  firstName: string,
  referralCode: string,
  tempPassword: string,
  commissionRate: number
): Promise<void> => {
  const template: EmailTemplate = {
    subject: '🎉 Promoter Application Approved - Welcome to the Team!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #28a745, #20c997); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Welcome to the Team!</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333;">Congratulations ${firstName}!</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your promoter application has been <strong style="color: #28a745;">APPROVED</strong>! 
            You're now part of the Red Mugsy Treasure Hunt promotion team.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="margin-top: 0; color: #28a745;">Your Promoter Details</h3>
            <p><strong>Referral Code:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; font-size: 16px;">${referralCode}</code></p>
            <p><strong>Commission Rate:</strong> ${(commissionRate * 100).toFixed(1)}%</p>
            <p><strong>Status:</strong> Active</p>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #856404;">Login Credentials</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 3px; font-family: monospace;">${tempPassword}</code></p>
            <p style="font-size: 14px; color: #856404; margin-top: 10px;">
              ⚠️ Please change your password after first login for security.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://treasure-hunt.redmugsy.com/promoter-signin" style="background: #ff1a4b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Access Promoter Dashboard
            </a>
          </div>
          
          <h3 style="color: #333;">How to Earn:</h3>
          <ul style="font-size: 16px; line-height: 1.6; color: #555;">
            <li>Share your referral code: <strong>${referralCode}</strong></li>
            <li>Earn ${(commissionRate * 100).toFixed(1)}% commission on Premium ($99) and VIP ($299) signups</li>
            <li>Track your performance in the promoter dashboard</li>
            <li>Get paid monthly via your preferred method</li>
          </ul>
          
          <p style="color: #777; font-size: 14px; margin-top: 30px;">
            Need help getting started? Contact us at promoters@redmugsy.com
          </p>
        </div>
        
        <div style="background: #333; color: white; text-align: center; padding: 15px; font-size: 12px;">
          © 2025 Red Mugsy Treasure Hunt. All rights reserved.
        </div>
      </div>
    `
  };

  await sendEmail(email, template);
};

// Promoter rejection email
export const sendPromoterRejectionEmail = async (
  email: string,
  firstName: string,
  reason?: string
): Promise<void> => {
  const template: EmailTemplate = {
    subject: 'Promoter Application Update',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6c757d; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application Update</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333;">Hello ${firstName},</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Thank you for your interest in becoming a promoter for Red Mugsy Treasure Hunt.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            After careful review, we're unable to approve your application at this time.
          </p>
          
          ${reason ? `
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="margin-top: 0; color: #dc3545;">Feedback</h3>
            <p style="color: #555;">${reason}</p>
          </div>
          ` : ''}
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            You're welcome to reapply in the future as our program grows and evolves.
          </p>
          
          <p style="color: #777; font-size: 14px; margin-top: 30px;">
            Questions? Contact us at promoters@redmugsy.com
          </p>
        </div>
        
        <div style="background: #333; color: white; text-align: center; padding: 15px; font-size: 12px;">
          © 2025 Red Mugsy Treasure Hunt. All rights reserved.
        </div>
      </div>
    `
  };

  await sendEmail(email, template);
};

// Payment confirmation email
export const sendPaymentConfirmationEmail = async (
  email: string,
  firstName: string,
  tier: string,
  amount: number,
  transactionId: string
): Promise<void> => {
  const template: EmailTemplate = {
    subject: `💰 Payment Confirmed - ${tier} Tier Activated!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #28a745, #20c997); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">💰 Payment Confirmed!</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333;">Hello ${firstName}!</h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your payment has been successfully processed and your <strong>${tier} tier</strong> access is now active!
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="margin-top: 0; color: #28a745;">Payment Details</h3>
            <p><strong>Tier:</strong> ${tier}</p>
            <p><strong>Amount:</strong> $${amount.toFixed(2)} USD</p>
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Status:</strong> ✅ Confirmed</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://treasure-hunt.redmugsy.com" style="background: #ff1a4b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Start Your Hunt
            </a>
          </div>
          
          <h3 style="color: #333;">What's Next:</h3>
          <ol style="font-size: 16px; line-height: 1.6; color: #555;">
            <li>Your account is now fully activated</li>
            <li>You have access to all ${tier} tier benefits</li>
            <li>Watch for hunt announcements and clues</li>
            <li>Keep your wallet ready for treasure claims</li>
          </ol>
          
          <p style="color: #777; font-size: 14px; margin-top: 30px;">
            Questions about your payment? Contact us at billing@redmugsy.com
          </p>
        </div>
        
        <div style="background: #333; color: white; text-align: center; padding: 15px; font-size: 12px;">
          © 2025 Red Mugsy Treasure Hunt. All rights reserved.
        </div>
      </div>
    `
  };

  await sendEmail(email, template);
};

// Admin notification emails
export const sendAdminNotification = async (
  subject: string,
  message: string,
  data?: any
): Promise<void> => {
  if (!process.env.ADMIN_EMAIL) {
    console.warn('ADMIN_EMAIL not configured, skipping admin notification');
    return;
  }

  const template: EmailTemplate = {
    subject: `[Admin] ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #343a40; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">[ADMIN NOTIFICATION]</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333;">${subject}</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">${message}</p>
          
          ${data ? `
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Details:</h3>
            <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(data, null, 2)}</pre>
          </div>
          ` : ''}
          
          <p style="color: #777; font-size: 14px; margin-top: 30px;">
            Time: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `
  };

  await sendEmail(process.env.ADMIN_EMAIL, template);
};