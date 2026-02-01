import { users, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { I18nService, i18nService } from '@/services/i18n.service';
import type { Language, User } from '@/types';
import * as evolution from '@/lib/evolution';
import * as ai from '@/lib/ai';
import { db as defaultDb } from '@/db/index';

export class OnboardingService {
  constructor(
    private db: typeof defaultDb,
    private i18n: I18nService,
    private evolutionClient: typeof evolution,
    private aiClient: typeof ai
  ) {}

  private async handleNameStep(remoteJid: string, messageText: string, _user: User, lang: Language) {
    const name = await this.aiClient.extractName(messageText);
    await this.db.update(users)
      .set({ displayName: name, onboardingStep: 'budget' })
      .where(eq(users.whatsappNumber, remoteJid));
    
    const t = this.i18n.getT(lang);
    await this.evolutionClient.sendTextMessage(remoteJid, t.onboarding_budget_prompt(name));
  }

  private async handleBudgetStep(remoteJid: string, messageText: string, user: User, lang: Language) {
    const isSkip = messageText.toLowerCase().includes('skip') || messageText.toLowerCase().includes('nanti');
    const t = this.i18n.getT(lang);

    if (isSkip) {
      await this.db.update(users).set({ onboardingStep: 'completed', isActive: true }).where(eq(users.whatsappNumber, remoteJid));
      await this.evolutionClient.sendTextMessage(remoteJid, t.onboarding_completed(user.displayName));
      return;
    }

    const budgetInfo = await this.aiClient.extractBudget(messageText);
    if (budgetInfo) {
      await this.db.insert(budgets).values({
        whatsappNumber: remoteJid,
        amount: budgetInfo.amount,
        period: 'month',
      });
      await this.db.update(users).set({ onboardingStep: 'completed', isActive: true }).where(eq(users.whatsappNumber, remoteJid));
      await this.evolutionClient.sendTextMessage(remoteJid, t.onboarding_completed(user.displayName));
    } else {
      await this.evolutionClient.sendTextMessage(remoteJid, t.error_budget_parse);
    }
  }

  async handleOnboarding(remoteJid: string, messageText: string, user: User, lang: Language) {
    switch (user.onboardingStep) {
      case 'name':
        await this.handleNameStep(remoteJid, messageText, user, lang);
        break;
      case 'budget':
        await this.handleBudgetStep(remoteJid, messageText, user, lang);
        break;
    }
  }

  async startOnboarding(remoteJid: string, lang: Language) {
    await this.db.insert(users).values({
      whatsappNumber: remoteJid,
      onboardingStep: 'name',
    }).onConflictDoUpdate({
      target: users.whatsappNumber,
      set: { onboardingStep: 'name' }
    });
    
    const t = this.i18n.getT(lang);
    await this.evolutionClient.sendTextMessage(remoteJid, t.welcome_onboarding);
    await this.evolutionClient.sendTextMessage(remoteJid, t.onboarding_name_prompt);
  }
}

export const onboardingService = new OnboardingService(defaultDb, i18nService, evolution, ai);
