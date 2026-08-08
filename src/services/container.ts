import { createDb, type Db } from '@/db/index';
import { createWahaClient, type WahaClient } from '@/lib/waha';
import { createAi, type AiClient } from '@/lib/ai';
import { I18nService } from '@/services/i18n.service';
import { OnboardingService } from '@/services/onboarding.service';
import { TransactionService } from '@/services/transaction.service';
import { BudgetService } from '@/services/budget.service';
import { ReportService } from '@/services/report.service';
import { WebhookService } from '@/services/webhook.service';
import type { Env, Services } from '@/types';

export function createContainer(env: Env): Services {
  const db = createDb(env.DB);
  const i18n = new I18nService();
  const evolution = createWahaClient({
    apiUrl: env.WAHA_API_URL,
    apiKey: env.WAHA_API_KEY,
    instance: env.WAHA_INSTANCE,
    whitelist: (env.WAHA_WHITELISTED_NUMBERS || '').split(',').filter(Boolean),
  });
  const ai = createAi(env.AI);

  const onboarding = new OnboardingService(db, i18n, evolution, ai);
  const transaction = new TransactionService(db, i18n, evolution);
  const budget = new BudgetService(db, i18n, evolution);
  const report = new ReportService(db, i18n, evolution);
  const webhook = new WebhookService(
    db,
    i18n,
    onboarding,
    transaction,
    budget,
    report,
    evolution,
    ai,
    env
  );

  return {
    i18n,
    onboarding,
    transaction,
    budget,
    report,
    webhook,
  };
}

export type Container = Services;
export type { Db, WahaClient, AiClient };
