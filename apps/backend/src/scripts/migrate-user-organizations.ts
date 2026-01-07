import prisma from '../utils/prisma';

/**
 * Migration script to populate UserOrganization table
 * This creates UserOrganization entries for all existing users
 */
async function migrateUserOrganizations() {
  try {
    console.log('Starting UserOrganization migration...');

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        organizationId: true,
        role: true,
      },
    });

    console.log(`Found ${users.length} users to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // Check if UserOrganization entry already exists
      const existingUserOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: user.id,
          organizationId: user.organizationId,
        },
      });

      if (existingUserOrg) {
        console.log(`Skipping user ${user.id} - already has UserOrganization entry`);
        skippedCount++;
        continue;
      }

      // Create UserOrganization entry
      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          role: user.role,
          isPrimary: true, // Set as primary organization
          isActive: true,
        },
      });

      migratedCount++;
      console.log(`Created UserOrganization for user ${user.id}`);
    }

    console.log('\nMigration completed!');
    console.log(`Migrated: ${migratedCount} users`);
    console.log(`Skipped: ${skippedCount} users (already existed)`);
    console.log(`Total: ${users.length} users`);
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateUserOrganizations()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
