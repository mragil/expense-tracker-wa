import { db } from '../db/index';
import { transactions } from '../db/schema';
import { sendTextMessage } from '../lib/evolution';
import type { TransactionData } from '../lib/ai';

export async function handleTransaction(remoteJid: string, data: TransactionData) {
  const { amount, transactionType: type, category, description } = data;

  await db.insert(transactions).values({
    whatsappId: remoteJid,
    amount,
    transactionType: type,
    category,
    description,
  });

  const emoji = type === 'expense' ? '💸' : '💰';
  const confirmationText = `*Transaction Logged!* ${emoji}\n\n` +
    `*Amount:* ${amount.toLocaleString()}\n` +
    `*Type:* ${type.charAt(0).toUpperCase() + type.slice(1)}\n` +
    `*Category:* ${category}\n` +
    `*Description:* ${description}\n\n` +
    `Ask "what is my expense for today?" to see your summary.`;

  await sendTextMessage(remoteJid, confirmationText);
}
