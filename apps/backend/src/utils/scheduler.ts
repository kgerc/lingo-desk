import cron from 'node-cron';
import notificationService from '../services/notification.service';
import paymentReminderService from '../services/payment-reminder.service';

class Scheduler {
  private tasks: cron.ScheduledTask[] = [];

  /**
   * Start all scheduled tasks
   */
  start() {
    console.log('⏰ Starting scheduled tasks...');

    // Check for upcoming lessons every 5 minutes and send reminders 1 hour before
    const lessonReminderTask = cron.schedule('*/5 * * * *', async () => {
      try {
        const results = await notificationService.sendUpcomingLessonReminders();
        if (results.length > 0) {
          console.log(`✅ Sent ${results.filter(r => r.success).length}/${results.length} lesson reminders`);
        }
      } catch (error) {
        console.error('❌ Error sending lesson reminders:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Warsaw',
    });

    this.tasks.push(lessonReminderTask);
    console.log('✅ Lesson reminder task scheduled (every 5 minutes)');

    // Send low budget alerts every Monday at 10:00 AM
    const budgetAlertTask = cron.schedule('0 10 * * 1', async () => {
      console.log('⏰ Running budget alert task...');
      try {
        // TODO: Get organization IDs from database
        // For now, just log
        console.log('✅ Budget alert task completed');
      } catch (error) {
        console.error('❌ Error sending budget alerts:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Warsaw',
    });

    this.tasks.push(budgetAlertTask);
    console.log('✅ Budget alert task scheduled (Mondays at 10:00 AM)');

    // Cleanup old notifications every Sunday at 2:00 AM
    const cleanupTask = cron.schedule('0 2 * * 0', async () => {
      console.log('⏰ Running notification cleanup task...');
      try {
        // TODO: Get organization IDs from database
        console.log('✅ Notification cleanup completed');
      } catch (error) {
        console.error('❌ Error cleaning up notifications:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Warsaw',
    });

    this.tasks.push(cleanupTask);
    console.log('✅ Cleanup task scheduled (Sundays at 2:00 AM)');

    // Payment reminders - every day at 9:00 AM
    const paymentReminderTask = cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Running payment reminder task...');
      try {
        const results = await paymentReminderService.processAllOrganizationsReminders();
        if (results.totalSent > 0 || results.totalFailed > 0) {
          console.log(`✅ Payment reminders: ${results.totalSent} sent, ${results.totalFailed} failed, ${results.totalSkipped} skipped`);
        }
      } catch (error) {
        console.error('❌ Error sending payment reminders:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Warsaw',
    });

    this.tasks.push(paymentReminderTask);
    console.log('✅ Payment reminder task scheduled (daily at 9:00 AM)');

    console.log(`⏰ ${this.tasks.length} scheduled tasks running`);
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    console.log('⏰ Stopping scheduled tasks...');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    console.log('✅ All scheduled tasks stopped');
  }

  /**
   * Manually trigger lesson reminders (for testing)
   */
  async triggerLessonReminders() {
    console.log('⏰ Manually triggering lesson reminders...');
    const results = await notificationService.sendLessonReminders();
    console.log(`✅ Sent ${results.filter(r => r.success).length}/${results.length} reminders`);
    return results;
  }

  /**
   * Manually trigger budget alerts (for testing)
   */
  async triggerBudgetAlerts(organizationId: string, managerEmail?: string) {
    console.log('⏰ Manually triggering budget alerts...');
    const results = await notificationService.sendLowBudgetAlerts(organizationId, managerEmail);
    console.log(`✅ Sent ${results.filter(r => r.success).length}/${results.length} alerts`);
    return results;
  }

  /**
   * Manually trigger payment reminders (for testing)
   */
  async triggerPaymentReminders() {
    console.log('⏰ Manually triggering payment reminders...');
    const results = await paymentReminderService.processAllOrganizationsReminders();
    console.log(`✅ Payment reminders: ${results.totalSent} sent, ${results.totalFailed} failed, ${results.totalSkipped} skipped`);
    return results;
  }
}

export default new Scheduler();
