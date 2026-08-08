import { transactions } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfLastMonth,
  endOfLastMonth,
  startOfYear,
  parseLocalDate,
  formatDateShort,
  formatTimeShort,
  formatDateLong,
} from '@/lib/time';
import type { I18nService } from '@/services/i18n.service';
import type { Language, ReportData } from '@/types';
import type { WahaClient } from '@/lib/waha';
import type { Db } from '@/db/index';

export class ReportService {
  constructor(
    private db: Db,
    private i18n: I18nService,
    private evolutionClient: WahaClient
  ) {}

  async generateSummary(remoteJid: string, reportData: Omit<ReportData, 'type'>, lang: Language = 'id', timezone?: string) {
    const t = this.i18n.getT(lang);
    const { period, startDate: customStart, endDate: customEnd } = reportData;
    let startDate = new Date();
    let endDate: Date | undefined = undefined;

    if (period === 'custom' && customStart) {
      startDate = parseLocalDate(customStart, timezone);
      if (customEnd) {
        endDate = parseLocalDate(customEnd, timezone);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      switch (period) {
        case 'today':
          startDate = startOfDay(timezone);
          break;
        case 'week':
          startDate = startOfWeek(timezone);
          break;
        case 'month':
          startDate = startOfMonth(timezone);
          break;
        case 'last_month':
          startDate = startOfLastMonth(timezone);
          endDate = endOfLastMonth(timezone);
          break;
        case 'year':
          startDate = startOfYear(timezone);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
      }
    }

    const whereConditions = [
      eq(transactions.whatsappId, remoteJid)
    ];

    if (period !== 'all') {
      whereConditions.push(gte(transactions.createdAt, startDate));
    }

    if (endDate) {
      whereConditions.push(lte(transactions.createdAt, endDate));
    }

    const userTransactions = await this.db.select().from(transactions).where(and(...whereConditions));

    if (userTransactions.length === 0) {
      await this.evolutionClient.sendTextMessage(remoteJid, t.report_no_data);
      return;
    }

    const summary = userTransactions.reduce((acc, curr) => {
      if (curr.transactionType === 'income') {
        acc.totalIncome += curr.amount;
      } else {
        acc.totalExpense += curr.amount;
      }
      return acc;
    }, { totalIncome: 0, totalExpense: 0 });

    const net = summary.totalIncome - summary.totalExpense;
    const emoji = net >= 0 ? '📈' : '📉';

    let detailsText = '';
    if (userTransactions.length > 0) {
      const sortedDetails = [...userTransactions].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });

      detailsText = `\n\n*${t.report_details}*\n` + 
        sortedDetails
          .slice(0, 30)
          .map(trx => {
            const tEmoji = trx.transactionType === 'income' ? '💰' : '💸';
            const amountStr = trx.amount.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
            const dateObj = trx.createdAt ? new Date(trx.createdAt) : null;
            const timeStr = dateObj ? formatTimeShort(dateObj, timezone, lang) : '--:--';
            const dateStr = dateObj ? formatDateShort(dateObj, timezone, lang) : '--/--/--';
            const desc = trx.description ? `: ${trx.description}` : '';
            return `[${dateStr} ${timeStr}] ${tEmoji} ${amountStr} - ${trx.category}${desc}`;
          })
          .join('\n');
      
      if (userTransactions.length > 30) {
        detailsText += t.report_oldest_hint;
      }
    }

    let periodLabel = t.label(period || 'custom');
    if (period === 'custom' && customStart) {
      const startStr = formatDateLong(parseLocalDate(customStart, timezone), timezone, lang);
      if (customEnd) {
        const endStr = formatDateLong(parseLocalDate(customEnd, timezone), timezone, lang);
        periodLabel = `${startStr} - ${endStr}`;
      } else {
        periodLabel = startStr;
      }
    }

    const reportText = `${t.report_title(periodLabel)} ${emoji}\n\n` +
      `${t.report_income}${summary.totalIncome.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}\n` +
      `${t.report_expense}${summary.totalExpense.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}\n` +
      `--------------------------\n` +
      `${t.report_balance}${net.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}${detailsText}`;

    await this.evolutionClient.sendTextMessage(remoteJid, reportText);
  }
}

