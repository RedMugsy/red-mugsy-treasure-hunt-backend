import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Create default admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@redmugsy.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          emailVerified: true
        }
      });

      console.log(`✅ Created admin user: ${admin.email}`);
    } else {
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    }

    // Create system configuration entries
    const configs = [
      {
        key: 'site_settings',
        value: {
          siteName: 'Red Mugsy Treasure Hunt',
          maxParticipants: 10000,
          registrationOpen: true,
          promoterApplicationsOpen: true
        }
      },
      {
        key: 'tier_pricing',
        value: {
          FREE: 0,
          PREMIUM: 99,
          VIP: 299
        }
      },
      {
        key: 'commission_rates',
        value: {
          default: 0.1, // 10%
          influencer: 0.15, // 15%
          business: 0.12, // 12%
          community: 0.1 // 10%
        }
      },
      {
        key: 'email_templates',
        value: {
          welcomeSubject: '🏆 Welcome to Red Mugsy Treasure Hunt!',
          approvalSubject: '🎉 Promoter Application Approved!',
          rejectionSubject: 'Promoter Application Update'
        }
      }
    ];

    for (const config of configs) {
      const existing = await prisma.systemConfig.findUnique({
        where: { key: config.key }
      });

      if (!existing) {
        await prisma.systemConfig.create({
          data: config
        });
        console.log(`✅ Created system config: ${config.key}`);
      } else {
        console.log(`ℹ️  System config already exists: ${config.key}`);
      }
    }

    console.log('🎉 Database seeding completed!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();