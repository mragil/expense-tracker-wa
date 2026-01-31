import { db } from '../db/index';
import { transactions } from '../db/schema';
import { sendTextMessage } from '../lib/evolution';
import type { TransactionData } from '../lib/ai';
import { getT, type Language } from './i18n.service';

export async function handleTransaction(remoteJid: string, data: TransactionData, loggedBy?: string, lang: Language = 'id') {
  const t = getT(lang);
  const { amount, transactionType: type, category, description } = data;

  await db.insert(transactions).values({
    whatsappId: remoteJid,
    amount,
    transactionType: type,
    category,
    description,
    loggedBy: loggedBy || remoteJid,
  });

  const amountStr = amount.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
  const typeLabel = t.label(type);
  
  const confirmationText = t.transaction_success(typeLabel, amountStr, category) + (description ? `\n\n_Notes: ${description}_` : '');

  await sendTextMessage(remoteJid, confirmationText);
}
