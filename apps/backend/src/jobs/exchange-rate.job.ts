import cron from 'node-cron';
import prisma from '../utils/prisma';
import exchangeRateService from '../services/exchange-rate.service';

/**
 * Exchange Rate Update Job
 * Runs every day at 12:00 PM (after NBP publishes new rates around 11:45 AM)
 * Updates exchange rates for all organizations
 */
export const startExchangeRateJob = () => {
  // Run daily at 12:00 PM
  cron.schedule('0 12 * * *', async () => {
    console.log('[Exchange Rate Job] Starting daily exchange rate update...');

    try {
      // Get all organizations
      const organizations = await prisma.organization.findMany({
        select: { id: true, name: true },
      });

      for (const org of organizations) {
        try {
          await exchangeRateService.updateRatesForOrganization(org.id);
          console.log(`[Exchange Rate Job] Updated rates for org: ${org.name}`);
        } catch (error: any) {
          console.error(`[Exchange Rate Job] Error updating rates for org ${org.name}:`, error.message);
        }
      }

      console.log(`[Exchange Rate Job] Completed update for ${organizations.length} organizations`);
    } catch (error: any) {
      console.error('[Exchange Rate Job] Fatal error:', error.message);
    }
  });

  console.log('[Exchange Rate Job] Scheduled to run daily at 12:00 PM');

  // Also run once on startup to ensure we have current rates
  (async () => {
    try {
      console.log('[Exchange Rate Job] Running initial rate update on startup...');
      const organizations = await prisma.organization.findMany({
        select: { id: true, name: true },
      });

      for (const org of organizations) {
        try {
          await exchangeRateService.updateRatesForOrganization(org.id);
        } catch (error: any) {
          console.error(`[Exchange Rate Job] Error updating rates for org ${org.name}:`, error.message);
        }
      }
      console.log('[Exchange Rate Job] Initial update completed');
    } catch (error: any) {
      console.error('[Exchange Rate Job] Error in initial update:', error.message);
    }
  })();
};
