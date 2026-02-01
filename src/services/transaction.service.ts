import { transactions } from '@/db/schema';
import type { TransactionData, Language } from '@/types';
import { I18nService, i18nService } from '@/services/i18n.service';
import * as evolution from '@/lib/evolution';
import { db as defaultDb } from '@/db/index';

export class TransactionService {
  constructor(
    private db: typeof defaultDb,
    private i18n: I18nService,
    private evolutionClient: typeof evolution
  ) {}

  async handleTransaction(remoteJid: string, data: TransactionData, loggedBy?: string, lang: Language = 'id') {
    const t = this.i18n.getT(lang);
    const { amount, transactionType: type, category, description } = data;

    await this.db.insert(transactions).values({
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

    await this.evolutionClient.sendTextMessage(remoteJid, confirmationText);
  }
}

// Default instance
export const transactionService = new TransactionService(defaultDb, i18nService, evolution);
