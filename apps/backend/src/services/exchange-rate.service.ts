import prisma from '../utils/prisma';
import axios from 'axios';

// NBP API supports these currencies
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CZK', 'DKK', 'NOK', 'SEK'];

interface NBPRate {
  currency: string;
  code: string;
  mid: number; // Middle exchange rate
}

interface NBPResponse {
  table: string;
  no: string;
  effectiveDate: string;
  rates: NBPRate[];
}

class ExchangeRateService {
  /**
   * Fetch exchange rates from NBP API for a specific date
   */
  async fetchRatesFromNBP(date?: Date): Promise<NBPResponse | null> {
    try {
      const dateStr = date ? this.formatDate(date) : 'today';
      const url = `https://api.nbp.pl/api/exchangerates/tables/A/${dateStr}/?format=json`;

      const response = await axios.get<NBPResponse[]>(url, {
        timeout: 10000,
        headers: { 'Accept': 'application/json' }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No data for this date (weekend/holiday), try previous day
        if (date) {
          const previousDay = new Date(date);
          previousDay.setDate(previousDay.getDate() - 1);
          return this.fetchRatesFromNBP(previousDay);
        }
      }
      console.error('Error fetching NBP rates:', error.message);
      return null;
    }
  }

  /**
   * Update exchange rates for an organization
   */
  async updateRatesForOrganization(organizationId: string, date?: Date): Promise<void> {
    const nbpData = await this.fetchRatesFromNBP(date);

    if (!nbpData) {
      console.error('Could not fetch NBP rates');
      return;
    }

    const effectiveDate = new Date(nbpData.effectiveDate);
    effectiveDate.setHours(0, 0, 0, 0);

    // Update rates for each supported currency
    for (const rate of nbpData.rates) {
      if (SUPPORTED_CURRENCIES.includes(rate.code)) {
        try {
          await prisma.exchangeRate.upsert({
            where: {
              organizationId_currency_effectiveDate: {
                organizationId,
                currency: rate.code,
                effectiveDate,
              },
            },
            create: {
              organizationId,
              currency: rate.code,
              rate: rate.mid,
              effectiveDate,
              source: 'NBP',
            },
            update: {
              rate: rate.mid,
              source: 'NBP',
            },
          });
        } catch (error) {
          console.error(`Error upserting rate for ${rate.code}:`, error);
        }
      }
    }

    console.log(`Updated ${nbpData.rates.length} exchange rates for org ${organizationId} on ${nbpData.effectiveDate}`);
  }

  /**
   * Get exchange rate for a specific currency and date
   * Falls back to most recent rate if exact date not found
   */
  async getExchangeRate(
    organizationId: string,
    currency: string,
    date: Date = new Date()
  ): Promise<number> {
    // PLN to PLN is always 1
    if (currency === 'PLN') {
      return 1;
    }

    const effectiveDate = new Date(date);
    effectiveDate.setHours(0, 0, 0, 0);

    // Try exact date first
    let rate = await prisma.exchangeRate.findUnique({
      where: {
        organizationId_currency_effectiveDate: {
          organizationId,
          currency,
          effectiveDate,
        },
      },
    });

    // If not found, get the most recent rate before this date
    if (!rate) {
      rate = await prisma.exchangeRate.findFirst({
        where: {
          organizationId,
          currency,
          effectiveDate: { lte: effectiveDate },
        },
        orderBy: { effectiveDate: 'desc' },
      });
    }

    // If still not found, try to fetch from NBP
    if (!rate) {
      await this.updateRatesForOrganization(organizationId, date);

      rate = await prisma.exchangeRate.findFirst({
        where: {
          organizationId,
          currency,
          effectiveDate: { lte: effectiveDate },
        },
        orderBy: { effectiveDate: 'desc' },
      });
    }

    if (!rate) {
      throw new Error(`No exchange rate found for ${currency} on ${date.toISOString()}`);
    }

    return Number(rate.rate);
  }

  /**
   * Convert amount from one currency to PLN
   */
  async convertToPLN(
    organizationId: string,
    amount: number,
    fromCurrency: string,
    date: Date = new Date(),
    overrideRate?: number
  ): Promise<number> {
    if (fromCurrency === 'PLN') {
      return amount;
    }

    const rate = overrideRate ?? await this.getExchangeRate(organizationId, fromCurrency, date);
    return amount * rate;
  }

  /**
   * Convert amount from PLN to another currency
   */
  async convertFromPLN(
    organizationId: string,
    amount: number,
    toCurrency: string,
    date: Date = new Date(),
    overrideRate?: number
  ): Promise<number> {
    if (toCurrency === 'PLN') {
      return amount;
    }

    const rate = overrideRate ?? await this.getExchangeRate(organizationId, toCurrency, date);
    return amount / rate;
  }

  /**
   * Convert amount between two currencies
   */
  async convert(
    organizationId: string,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Convert to PLN first, then to target currency
    const plnAmount = await this.convertToPLN(organizationId, amount, fromCurrency, date);
    return await this.convertFromPLN(organizationId, plnAmount, toCurrency, date);
  }

  /**
   * Format date for NBP API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get all available currencies
   */
  getSupportedCurrencies(): string[] {
    return ['PLN', ...SUPPORTED_CURRENCIES];
  }

  /**
   * Get exchange rates for all currencies on a specific date
   */
  async getAllRates(organizationId: string, date: Date = new Date()): Promise<Record<string, number>> {
    const effectiveDate = new Date(date);
    effectiveDate.setHours(0, 0, 0, 0);

    const rates = await prisma.exchangeRate.findMany({
      where: {
        organizationId,
        effectiveDate: { lte: effectiveDate },
      },
      orderBy: { effectiveDate: 'desc' },
      distinct: ['currency'],
    });

    const result: Record<string, number> = { PLN: 1 };

    for (const rate of rates) {
      result[rate.currency] = Number(rate.rate);
    }

    return result;
  }
}

export default new ExchangeRateService();
