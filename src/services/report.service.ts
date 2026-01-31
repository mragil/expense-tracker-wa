import { db } from '../db/index';
import { transactions } from '../db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';
import { getT, type Language } from './i18n.service';

export async function generateSummary(remoteJid: string, period: 'today' | 'week' | 'month' | 'year', lang: Language = 'id') {
  const t = getT(lang);
  const now = new Date();
  let startDate = new Date();

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
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  const userTransactions = await db.select().from(transactions).where(
    and(
      eq(transactions.whatsappId, remoteJid),
      gte(transactions.createdAt, startDate)
    )
  );

  if (userTransactions.length === 0) {
    await sendTextMessage(remoteJid, t.report_no_data);
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
          const timeStr = trx.createdAt ? new Date(trx.createdAt).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
          const desc = trx.description ? `: ${trx.description}` : '';
          return `[${timeStr}] ${tEmoji} ${amountStr} - ${trx.category}${desc}`;
        })
        .join('\n');
    
    if (userTransactions.length > 30) {
      detailsText += t.report_oldest_hint;
    }
  }

  const periodLabel = t.label(period);

  const reportText = `${t.report_title(periodLabel)} ${emoji}\n\n` +
    `${t.report_income}${summary.totalIncome.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}\n` +
    `${t.report_expense}${summary.totalExpense.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}\n` +
    `--------------------------\n` +
    `${t.report_balance}${net.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}${detailsText}`;

  await sendTextMessage(remoteJid, reportText);
}
