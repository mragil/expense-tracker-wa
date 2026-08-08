import { budgets, transactions } from '@/db/schema';
import { and, eq, gte, desc } from 'drizzle-orm';
import { startOfMonth } from '@/lib/time';
import type { I18nService } from '@/services/i18n.service';
import type { Language } from '@/types';
import type { WahaClient } from '@/lib/waha';
import type { Db } from '@/db/index';

export class BudgetService {
  constructor(
    private db: Db,
    private i18n: I18nService,
    private evolutionClient: WahaClient
  ) {}

  async checkBudget(remoteJid: string, lang: Language = 'id', timezone?: string) {
    const t = this.i18n.getT(lang);
    const userBudget = await this.db.query.budgets.findFirst({
      where: eq(budgets.whatsappNumber, remoteJid),
      orderBy: [desc(budgets.createdAt)],
    });

    if (!userBudget) {
      await this.evolutionClient.sendTextMessage(remoteJid, t.budget_status_no_limit);
      return;
    }

    const startOfMonthDate = startOfMonth(timezone);

    const monthTransactions = await this.db.select().from(transactions).where(
      and(
        eq(transactions.whatsappId, remoteJid),
        gte(transactions.createdAt, startOfMonthDate),
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
      t.budget_status_encouragement;

    await this.evolutionClient.sendTextMessage(remoteJid, budgetText);
  }

  async updateBudget(remoteJid: string, amount: number, lang: Language = 'id') {
    const t = this.i18n.getT(lang);
    await this.db.insert(budgets).values({
      whatsappNumber: remoteJid,
      amount: amount,
      period: 'month',
    });

    await this.evolutionClient.sendTextMessage(remoteJid, t.budget_update_success(amount.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')) + t.budget_update_footer);
  }
}

