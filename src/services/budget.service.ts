import { db } from '../db/index';
import { budgets, transactions } from '../db/schema';
import { and, eq, gte, desc } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';

export async function checkBudget(remoteJid: string) {
  const userBudget = await db.query.budgets.findFirst({
    where: eq(budgets.whatsappNumber, remoteJid),
    orderBy: [desc(budgets.createdAt)],
  });

  if (!userBudget) {
    await sendTextMessage(remoteJid, "Anda belum mengatur budget. Silakan ketik 'budget [jumlah]' untuk mengaturnya!");
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

  const totalExpense = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
  const remaining = userBudget.amount - totalExpense;
  const percentUsed = (totalExpense / userBudget.amount) * 100;

  let emoji = '✅';
  if (percentUsed >= 100) emoji = '⚠️';
  else if (percentUsed >= 80) emoji = '🟡';

  const budgetText = 
    `*📊 Status Budget Anda*\n\n` +
    `*Limit Budget:* ${userBudget.amount.toLocaleString('id-ID')}\n` +
    `*Terpakai:* ${totalExpense.toLocaleString('id-ID')} (${percentUsed.toFixed(1)}%)\n` +
    `--------------------------\n` +
    `*Sisa Budget:* ${remaining.toLocaleString('id-ID')} ${emoji}\n\n` +
    `Tetap semangat mengatur keuangan! 💪`;

  await sendTextMessage(remoteJid, budgetText);
}

export async function updateBudget(remoteJid: string, amount: number) {
  await db.insert(budgets).values({
    whatsappNumber: remoteJid,
    amount: amount,
    period: 'month',
  });

  await sendTextMessage(remoteJid, `*Budget Terupdate!* ✅\n\nLimit budget bulanan Anda sekarang adalah *${amount.toLocaleString('id-ID')}*.\n\nKetik "Cek budget" untuk melihat status penggunaan Anda.`);
}
