import cron from 'node-cron';
import studentService from '../services/student.service';

/**
 * Purge Archived Students Job
 * Runs every day at 02:00 AM.
 * Hard-deletes students that have been in the archive for more than 30 days.
 */
export const startPurgeArchivedStudentsJob = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('[Purge Students Job] Starting purge of expired archived students...');

    try {
      const { purged } = await studentService.purgeExpiredStudents();
      console.log(`[Purge Students Job] Purged ${purged} expired archived student(s).`);
    } catch (error: any) {
      console.error('[Purge Students Job] Error during purge:', error.message);
    }
  });

  console.log('[Purge Students Job] Scheduled to run daily at 02:00 AM');
};
