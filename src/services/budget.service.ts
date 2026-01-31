import { db } from '../db/index';
import { budgets, transactions } from '../db/schema';
import { and, eq, gte, desc } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';
import { getT, type Language } from './i18n.service';

export async function checkBudget(remoteJid: string, lang: Language = 'id') {
  const t = getT(lang);
  const userBudget = await db.query.budgets.findFirst({
    where: eq(budgets.whatsappNumber, remoteJid),
    orderBy: [desc(budgets.createdAt)],
  });

  if (!userBudget) {
    await sendTextMessage(remoteJid, t.budget_status_no_limit);
    return;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthTransactions = await db.select().from(transactions).where(
    and(
      eq(transactions.whatsappId, remoteJid),
      gte(transactions.createdAt, startOfMonth),
      eq(transactions.transactionType, 'expense')
    )
  );

  const totalExpense = monthTransactions.reduce((sum, trx) => sum + trx.amount, 0);
  const remaining = userBudget.amount - totalExpense;
  const percentUsed = (totalExpense / userBudget.amount) * 100;

  let emoji = '✅';
  if (percentUsed >= 100) emoji = '⚠️';
  else if (percentUsed >= 80) emoji = '🟡';

  const budgetText = 
    `${t.budget_status_title}\n\n` +
    `*${t.budget_status_limit}* ${userBudget.amount.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}\n` +
    `*${t.budget_status_spent}* ${totalExpense.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')} (${percentUsed.toFixed(1)}%)\n` +
    `--------------------------\n` +
    `*${t.budget_status_remaining}* ${remaining.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')} ${emoji}\n\n` +
    (lang === 'id' ? "Tetap semangat mengatur keuangan! 💪" : "Keep up the good work managing your finances! 💪");

  await sendTextMessage(remoteJid, budgetText);
}

export async function updateBudget(remoteJid: string, amount: number, lang: Language = 'id') {
  const t = getT(lang);
  await db.insert(budgets).values({
    whatsappNumber: remoteJid,
    amount: amount,
    period: 'month',
  });

  await sendTextMessage(remoteJid, t.budget_update_success(amount.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')) + (lang === 'id' ? "\n\nKetik \"Cek budget\" untuk melihat status penggunaan Anda." : "\n\nType \"Check budget\" to see your usage status."));
}
