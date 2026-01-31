import { db } from '../db/index';
import { transactions } from '../db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';

export async function generateSummary(remoteJid: string, period: 'today' | 'week' | 'month' | 'year') {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
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
    await sendTextMessage(remoteJid, `No transactions found for ${period}.`);
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
  const status = net >= 0 ? 'Surplus' : 'Deficit';
  const emoji = net >= 0 ? '📈' : '📉';

  let detailsText = '';
  if (userTransactions.length > 0) {
    const sortedDetails = [...userTransactions].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

    detailsText = '\n\n*Details:*\n' + 
      sortedDetails
        .slice(0, 30)
        .map(t => {
          const tEmoji = t.transactionType === 'income' ? '💰' : '💸';
          const amountStr = t.amount.toLocaleString('id-ID');
          const timeStr = t.createdAt ? new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';
          const desc = t.description ? `: ${t.description}` : '';
          return `[${timeStr}] ${tEmoji} ${amountStr} - ${t.category}${desc}`;
        })
        .join('\n');
    
    if (userTransactions.length > 30) {
      detailsText += '\n_(Showing oldest 30 transactions)_';
    }
  }

  const reportText = `*Summary Report (${period.charAt(0).toUpperCase() + period.slice(1)})* ${emoji}\n\n` +
    `*Total Income:* ${summary.totalIncome.toLocaleString()}\n` +
    `*Total Expense:* ${summary.totalExpense.toLocaleString()}\n` +
    `--------------------------\n` +
    `*Net Balance:* ${net.toLocaleString()}\n` +
    `*Status:* ${status}${detailsText}`;

  await sendTextMessage(remoteJid, reportText);
}
