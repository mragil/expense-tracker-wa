import { db } from '../db/index';
import { transactions } from '../db/schema';
import { sendTextMessage } from '../lib/evolution';
import { extractTransaction } from '../lib/ai';

export async function handleTransaction(remoteJid: string, messageText: string) {
  const result = await extractTransaction(messageText);

  if ('error' in result) {
    if (result.error === 'unsupported_topic') {
      await sendTextMessage(remoteJid, "I'm sorry, I can only help you log expenses or income. Try something like 'Spent 50k on coffee' or 'Got 1 million salary'.");
    } else {
      await sendTextMessage(remoteJid, "Oops! I had trouble understanding that transaction. Could you try rephrasing it?");
    }
    return;
  }

  const { amount, type, category, description } = result;

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
    `Type \`/report\` to see your summary.`;

  await sendTextMessage(remoteJid, confirmationText);
}
