import { transactions } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { I18nService, i18nService } from '@/services/i18n.service';
import type { Language, ReportData } from '@/types';
import * as evolution from '@/lib/evolution';
import { db as defaultDb } from '@/db/index';

export class ReportService {
  constructor(
    private db: typeof defaultDb,
    private i18n: I18nService,
    private evolutionClient: typeof evolution
  ) {}

  async generateSummary(remoteJid: string, reportData: Omit<ReportData, 'type'>, lang: Language = 'id') {
    const t = this.i18n.getT(lang);
    const now = new Date();
    const { period, startDate: customStart, endDate: customEnd } = reportData;
    let startDate = new Date();
    let endDate: Date | undefined = undefined;

    if (period === 'custom' && customStart) {
      startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      if (customEnd) {
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      switch (period) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          startDate.setDate(diff);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);
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
            const timeStr = dateObj ? dateObj.toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const dateStr = dateObj ? dateObj.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '--/--/--';
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
      const startStr = new Date(customStart).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      if (customEnd) {
        const endStr = new Date(customEnd).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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

export const reportService = new ReportService(defaultDb, i18nService, evolution);
